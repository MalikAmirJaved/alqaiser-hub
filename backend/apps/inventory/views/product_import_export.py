"""
Product Import / Export views.

Uses standalone APIView classes (not ViewSet @action decorators)
to match the pattern used by the HR module (ShiftTemplateView, etc.).
"""
import io
import csv
import math
import time
import uuid
import random
import re
import logging
from decimal import Decimal, InvalidOperation

import pandas as pd
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    Product, ProductVariant, Brand, Category, Warehouse, StockItem,
    InventoryTransaction,
)


logger = logging.getLogger(__name__)


SAMPLE_HEADERS = [
    'Product Name', 'Product Description', 'Category', 'Brand',
    'Unit', 'Storage Requirement', 'Tax Rate (%)',
    'Variant SKU', 'Variant Title', 'Variant Barcode',
    'Buying Price', 'Selling Price', 'Min Stock Level', 'Max Stock Level',
]

EXPORT_HEADERS = SAMPLE_HEADERS + ['Status']

EXPECTED_COLUMNS = SAMPLE_HEADERS

# Conflict-resolution policies supported by the confirm endpoint.
CONFLICT_POLICIES = {'add_new', 'update_existing', 'skip_duplicates', 'replace_existing'}

# Fields returned to the client describing an existing matched record.
EXISTING_FIELDS = (
    'existing_match', 'existing_product_id', 'existing_product_name',
    'existing_variant_id', 'existing_variant_title', 'existing_sku',
    'existing_category_name', 'existing_brand_name', 'existing_product_status',
    'existing_location',
)


# ---------------------------------------------------------------------------
#  Helpers
# ---------------------------------------------------------------------------


def _clean_val(val, default=0):
    """
    Clean a value that might be NaN/None from pandas parsing.
    `float('nan') or x` does NOT work because `bool(float('nan'))` is True.
    """
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return default
    return val


def _normalize_sku(value):
    """SKUs are compared exact + trimmed, case-sensitive (matches the DB)."""
    if value is None:
        return ''
    if isinstance(value, float) and math.isnan(value):
        return ''
    return str(value).strip()


def _to_decimal(value, default=Decimal('0')):
    if value in (None, ''):
        return default if default is not None else Decimal('0')
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return default


def _to_int(value, default=0):
    if value in (None, ''):
        return default
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _provided_quantity(row):
    """
    The row's `quantity_on_hand`, or None when the client did not supply one.

    None is meaningful: it means "leave the stored stock alone", which is what
    keeps an untouched Qty cell from zeroing stock under Replace Existing.
    """
    value = row.get('quantity_on_hand')
    if value is None or value == '':
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    try:
        return max(int(float(value)), 0)
    except (TypeError, ValueError):
        return None


def _export_rows(queryset):
    """Yield flat dicts — one per variant row — repeating parent product fields."""
    products = queryset.prefetch_related(
        'variants',
        'variants__stock_items__warehouse',
        'category',
        'brand',
    )
    for product in products:
        for variant in product.variants.all():
            total_stock = sum(s.quantity_on_hand for s in variant.stock_items.all())
            yield {
                'Product Name': product.product_name or '',
                'Product Description': product.description or '',
                'Category': product.category.name if product.category else '',
                'Brand': product.brand.name if product.brand else '',
                'Unit': product.unit,
                'Storage Requirement': product.storage_requirement,
                'Tax Rate (%)': float(product.tax_rate),
                'Status': product.status,
                'Variant SKU': variant.sku or '',
                'Variant Title': variant.variant_title or '',
                'Variant Barcode': variant.barcode or '',
                'Buying Price': float(variant.buying_price or 0),
                'Selling Price': float(variant.selling_price or 0),
                'Min Stock Level': variant.min_stock_level,
                'Max Stock Level': variant.max_stock_level,
                'Total Stock': total_stock,
                'Source': product.source,
            }


def _make_xlsx(rows, filename, headers=None):
    if headers is None:
        headers = SAMPLE_HEADERS
    df = pd.DataFrame(rows, columns=headers)
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Products')
    output.seek(0)
    response = HttpResponse(
        output.read(),
        content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    )
    response['Content-Disposition'] = f'attachment; filename="{filename}.xlsx"'
    return response


def _make_csv(rows, filename, headers=None):
    if headers is None:
        headers = SAMPLE_HEADERS
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=headers)
    writer.writeheader()
    writer.writerows(rows)
    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
    return response


def _resolve_brand_or_category(name, model_class, company_id, branch_id):
    name = _clean_val(name, '')
    name = str(name).strip()
    if not name:
        return None, '', False
    obj = model_class.objects.filter(
        name__iexact=name, company_id=company_id, branch_id=branch_id, is_deleted=False,
    ).first()
    if obj:
        return str(obj._id), obj.name, False
    return None, name, True


def _find_or_create_brand(name, company_id, branch_id, user, source):
    name = (name or '').strip()
    if not name:
        return None, False
    brand = Brand.objects.filter(
        name__iexact=name, company_id=company_id, branch_id=branch_id, is_deleted=False,
    ).first()
    if brand:
        return brand, False
    code_base = re.sub(r'[^a-zA-Z0-9]', '', name).upper()[:10] or 'BRAND'
    existing = set(Brand.objects.filter(company_id=company_id, branch_id=branch_id).values_list('code', flat=True))
    code = code_base
    c = 1
    while code in existing:
        code = f'{code_base}{c}'
        c += 1
    brand = Brand.objects.create(
        name=name, code=code, company_id=company_id, branch_id=branch_id,
        created_by=user, updated_by=user, source=source,
    )
    return brand, True


def _find_or_create_category(name, company_id, branch_id, user, source):
    name = (name or '').strip()
    if not name:
        return None, False
    cat = Category.objects.filter(
        name__iexact=name, company_id=company_id, branch_id=branch_id, is_deleted=False,
    ).first()
    if cat:
        return cat, False
    code_base = re.sub(r'[^a-zA-Z0-9]', '', name).upper()[:10] or 'CAT'
    existing = set(Category.objects.filter(company_id=company_id, branch_id=branch_id).values_list('code', flat=True))
    code = code_base
    c = 1
    while code in existing:
        code = f'{code_base}{c}'
        c += 1
    cat = Category.objects.create(
        name=name, code=code, company_id=company_id, branch_id=branch_id,
        created_by=user, updated_by=user, source=source,
    )
    return cat, True


def _get_default_warehouse(company_id, branch_id):
    return Warehouse.objects.filter(company_id=company_id, branch_id=branch_id, is_active=True).first()


def _auto_sku(product_id):
    return f'IMP{product_id}{int(time.time())}{random.randint(10, 99)}'[:50]


def _generate_unique_sku(product_id, company_id, branch_id, existing_skus):
    """Generate a collision-safe SKU (bounded retries), company+branch scoped."""
    for _ in range(25):
        sku = _auto_sku(product_id)
        if sku in existing_skus:
            continue
        if ProductVariant.objects.filter(
            company_id=company_id, branch_id=branch_id, sku=sku,
        ).exists():
            existing_skus.add(sku)
            continue
        return sku
    return f'IMP{uuid.uuid4().hex[:24]}'


# ---------------------------------------------------------------------------
#  Duplicate / conflict resolution (Bug 2 — server authoritative)
# ---------------------------------------------------------------------------


def _existing_variant_map(skus, company_id, branch_id):
    """
    Batched lookup of existing variants by SKU within the tenant scope.

    Returns (active, deleted) dicts keyed by the stored SKU:
      active  -> variant with is_deleted=False
      deleted -> variant with is_deleted=True (still blocks inserts via the
                 unique_together constraint, so it must be surfaced)
    """
    normalized = sorted({_normalize_sku(s) for s in skus if _normalize_sku(s)})
    active, deleted = {}, {}
    if not normalized:
        return active, deleted

    qs = (
        ProductVariant.objects
        .filter(company_id=company_id, branch_id=branch_id, sku__in=normalized)
        .select_related('product', 'product__category', 'product__brand')
        .prefetch_related('stock_items__warehouse')
    )
    for variant in qs:
        if variant.is_deleted:
            deleted.setdefault(variant.sku, variant)
        else:
            active.setdefault(variant.sku, variant)
    return active, deleted


def _existing_location(variant, default_warehouse_id=None):
    """
    Stock rows for a matched variant, default warehouse first.

    The import writes stock to the default warehouse (`_get_default_warehouse`),
    so the client needs to know which listed row that is to show the
    "80 + 20 = 100" preview for the row the user is editing.
    """
    items = list(variant.stock_items.all())
    items.sort(key=lambda s: (s.warehouse_id != default_warehouse_id, s.warehouse_id or 0))
    return [
        {
            'warehouse_id': str(s.warehouse._id) if s.warehouse else None,
            'warehouse_name': s.warehouse.warehouse_name if s.warehouse else '',
            'quantity_on_hand': s.quantity_on_hand,
            'quantity_reserved': s.quantity_reserved,
            'is_default': s.warehouse_id == default_warehouse_id,
        }
        for s in items
    ]


def _existing_metadata(variant, match, default_warehouse_id=None):
    product = variant.product
    return {
        'existing_match': match,
        'existing_product_id': str(product._id),
        'existing_product_name': product.product_name or '',
        'existing_variant_id': str(variant._id),
        'existing_variant_title': variant.variant_title or '',
        'existing_sku': variant.sku,
        'existing_category_name': product.category.name if product.category else '',
        'existing_brand_name': product.brand.name if product.brand else '',
        'existing_product_status': product.status,
        'existing_location': (
            _existing_location(variant, default_warehouse_id) if match == 'active' else []
        ),
    }


def _resolve_duplicates(rows, company_id, branch_id, default_warehouse=None):
    """
    Resolve each row's SKU against the DB (active + soft-deleted) and against
    the uploaded file itself.

    Returns (by_index, active, deleted):
      by_index[row_index] = validation metadata for that row.
    """
    sku_index = {}
    for row in rows:
        sku = _normalize_sku(row.get('variant_sku'))
        if sku:
            sku_index.setdefault(sku, []).append(row.get('row_index'))

    active, deleted = _existing_variant_map(sku_index.keys(), company_id, branch_id)

    # Only matched variants carry stock context, so only look the warehouse up
    # when there is at least one active match.
    default_warehouse_id = None
    if active:
        if default_warehouse is None:
            default_warehouse = _get_default_warehouse(company_id, branch_id)
        default_warehouse_id = default_warehouse.id if default_warehouse else None

    by_index = {}
    for row in rows:
        ridx = row.get('row_index')
        sku = _normalize_sku(row.get('variant_sku'))
        info = {
            'row_index': ridx,
            'is_duplicate_in_file': False,
            'duplicate_of_row_index': None,
            'conflict_type': None,
            'existing_match': None,
        }
        if sku:
            idxs = sku_index.get(sku, [])
            if len(idxs) > 1:
                info['is_duplicate_in_file'] = True
                info['duplicate_of_row_index'] = next((i for i in idxs if i != ridx), None)
                info['conflict_type'] = 'file_duplicate'
            if sku in active:
                info['conflict_type'] = 'db_conflict'
                info.update(_existing_metadata(active[sku], 'active', default_warehouse_id))
            elif sku in deleted:
                info['conflict_type'] = 'soft_deleted'
                info.update(_existing_metadata(deleted[sku], 'soft_deleted', default_warehouse_id))
        by_index[ridx] = info
    return by_index, active, deleted


def _is_conflict(info):
    return (
        info.get('conflict_type') in ('db_conflict', 'soft_deleted', 'file_duplicate')
        or info.get('is_duplicate_in_file')
    )


def _conflict_message(row, info):
    sku = _normalize_sku(row.get('variant_sku'))
    ct = info.get('conflict_type')
    if ct == 'db_conflict':
        name = info.get('existing_product_name') or ''
        message = f'SKU "{info.get("existing_sku") or sku}" already exists for product "{name}"'
        extras = []
        if info.get('existing_category_name'):
            extras.append(f'category {info["existing_category_name"]}')
        if info.get('existing_brand_name'):
            extras.append(f'brand {info["existing_brand_name"]}')
        locations = [
            loc.get('warehouse_name') for loc in (info.get('existing_location') or [])
            if loc.get('warehouse_name')
        ]
        if locations:
            extras.append('warehouse ' + ', '.join(locations))
        if extras:
            message += ' (' + '; '.join(extras) + ')'
        return message + '.'
    if ct == 'soft_deleted':
        return f'SKU "{sku}" belongs to a deleted product. Choose a different SKU.'
    if ct == 'file_duplicate':
        other = (info.get('duplicate_of_row_index') or 0) + 1
        return f'Duplicate SKU "{sku}" in the uploaded file (also row {other}).'
    return 'This row conflicts with an existing record.'


def _existing_payload(info):
    return {k: info[k] for k in EXISTING_FIELDS if info.get(k) is not None}


def _conflict_error(row, info):
    entry = {
        'row_index': row.get('row_index'),
        'field': 'variant_sku',
        'code': info.get('conflict_type') or 'conflict',
        'message': _conflict_message(row, info),
    }
    existing = _existing_payload(info)
    if existing:
        entry['existing'] = existing
    return entry


def _skip_entry(row, info, reason):
    entry = {
        'row_index': row.get('row_index'),
        'sku': _normalize_sku(row.get('variant_sku')),
        'reason': reason,
        'message': _conflict_message(row, info),
    }
    existing = _existing_payload(info)
    if existing:
        entry['existing'] = existing
    return entry


def _validation_counts(by_index):
    valid = conflicting = 0
    for info in by_index.values():
        if _is_conflict(info):
            conflicting += 1
        else:
            valid += 1
    return {'total': len(by_index), 'valid': valid, 'conflicting': conflicting}


def _build_preview_rows(rows, company_id, branch_id):
    """Build enriched preview rows (file-derived fields + conflict metadata)."""
    preview = []
    for idx, row in enumerate(rows):
        cat_id, cat_name, cat_new = _resolve_brand_or_category(row.get('Category'), Category, company_id, branch_id)
        brand_id, brand_name, brand_new = _resolve_brand_or_category(row.get('Brand'), Brand, company_id, branch_id)
        preview.append({
            'row_index': idx,
            'product_name': str(_clean_val(row.get('Product Name'), '')),
            'product_description': str(_clean_val(row.get('Product Description'), '')),
            'category_id': cat_id,
            'category_name': str(_clean_val(cat_name, '')),
            'category_is_new': cat_new,
            'brand_id': brand_id,
            'brand_name': str(_clean_val(brand_name, '')),
            'brand_is_new': brand_new,
            'unit': str(_clean_val(row.get('Unit'), 'PIECE')),
            'storage_requirement': str(_clean_val(row.get('Storage Requirement'), 'AMBIENT')),
            'tax_rate': float(_clean_val(row.get('Tax Rate (%)'), 0)),
            'status': 'active',
            'variant_sku': _normalize_sku(row.get('Variant SKU')),
            'variant_title': str(_clean_val(row.get('Variant Title'), '')),
            'variant_barcode': str(_clean_val(row.get('Variant Barcode'), '')),
            'buying_price': float(_clean_val(row.get('Buying Price'), 0)),
            'selling_price': float(_clean_val(row.get('Selling Price'), 0)),
            'min_stock_level': int(_clean_val(row.get('Min Stock Level'), 0)),
            'max_stock_level': int(_clean_val(row.get('Max Stock Level'), 0)),
            # Not a file column: the review modal is where the user types the
            # quantity to add (Update Existing) or set (Replace Existing).
            'quantity_on_hand': None,
        })

    by_index, _active, _deleted = _resolve_duplicates(preview, company_id, branch_id)
    for row in preview:
        row.update(by_index.get(row['row_index'], {}))
    return preview


def _structural_errors(rows_data):
    """Pre-write, blocking validation applied for every conflict policy."""
    errors = []
    for row in rows_data:
        ridx = row.get('row_index')
        if not (row.get('product_name') or '').strip():
            errors.append({
                'row_index': ridx,
                'field': 'product_name',
                'code': 'required',
                'message': 'Product name is required.',
            })
        for field, label in (
            ('buying_price', 'Buying price'),
            ('selling_price', 'Selling price'),
        ):
            value = row.get(field)
            if value in (None, ''):
                continue
            try:
                if float(value) < 0:
                    errors.append({
                        'row_index': ridx, 'field': field, 'code': 'invalid',
                        'message': f'{label} cannot be negative.',
                    })
            except (TypeError, ValueError):
                errors.append({
                    'row_index': ridx, 'field': field, 'code': 'invalid',
                    'message': f'{label} must be a number.',
                })
        for field, label in (
            ('min_stock_level', 'Min stock level'),
            ('max_stock_level', 'Max stock level'),
        ):
            value = row.get(field)
            if value in (None, ''):
                continue
            try:
                if int(float(value)) < 0:
                    errors.append({
                        'row_index': ridx, 'field': field, 'code': 'invalid',
                        'message': f'{label} cannot be negative.',
                    })
            except (TypeError, ValueError):
                errors.append({
                    'row_index': ridx, 'field': field, 'code': 'invalid',
                    'message': f'{label} must be a whole number.',
                })
        quantity = row.get('quantity_on_hand')
        if quantity not in (None, ''):
            try:
                if int(float(quantity)) < 0:
                    errors.append({
                        'row_index': ridx, 'field': 'quantity_on_hand',
                        'code': 'invalid',
                        'message': 'Quantity cannot be negative.',
                    })
            except (TypeError, ValueError):
                errors.append({
                    'row_index': ridx, 'field': 'quantity_on_hand',
                    'code': 'invalid',
                    'message': 'Quantity must be a whole number.',
                })
    return errors


class ImportValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__('Import validation failed')


# ---------------------------------------------------------------------------
#  Import execution (Bug 3 — conflict policies)
# ---------------------------------------------------------------------------


def _create_product(pname, first, category, brand, source, user, company_id, branch_id):
    return Product.objects.create(
        product_name=pname,
        description=first.get('product_description', '') or '',
        category=category, brand=brand,
        unit=first.get('unit') or 'PIECE',
        storage_requirement=first.get('storage_requirement') or 'AMBIENT',
        tax_rate=_to_decimal(first.get('tax_rate')),
        status='active',
        is_active=True, source=source,
        company_id=company_id, branch_id=branch_id,
        created_by=user, updated_by=user,
    )


def _create_variant_for(product, row, sku, user, company_id, branch_id, default_warehouse, existing_skus):
    if not sku:
        sku = _generate_unique_sku(product.id, company_id, branch_id, existing_skus)
    existing_skus.add(sku)
    variant = ProductVariant.objects.create(
        product=product,
        company_id=company_id, branch_id=branch_id,
        sku=sku,
        variant_title=row.get('variant_title', '') or '',
        barcode=row.get('variant_barcode', '') or '',
        buying_price=_to_decimal(row.get('buying_price')),
        selling_price=_to_decimal(row.get('selling_price')),
        min_stock_level=_to_int(row.get('min_stock_level')),
        max_stock_level=_to_int(row.get('max_stock_level')),
        created_by=user, updated_by=user,
    )
    if default_warehouse:
        # The Qty cell doubles as opening stock on create; blank means 0.
        opening_qty = _provided_quantity(row) or 0
        StockItem.objects.create(
            variant=variant, warehouse=default_warehouse,
            company_id=company_id, branch_id=branch_id,
            quantity_on_hand=opening_qty, created_by=user, updated_by=user,
        )
        if opening_qty:
            _record_stock_movement(
                variant=variant, warehouse=default_warehouse, user=user,
                quantity_change=opening_qty, quantity_before=0,
                quantity_after=opening_qty, transaction_type='INITIAL',
                reason='Product import — opening stock',
            )
    return variant


def _update_product(product, row, category, brand, user, authoritative):
    if authoritative:
        name = (row.get('product_name') or '').strip()
        if name:
            product.product_name = name
        product.description = row.get('product_description', '') or ''
        product.unit = row.get('unit') or 'PIECE'
        product.storage_requirement = row.get('storage_requirement') or 'AMBIENT'
        product.tax_rate = _to_decimal(row.get('tax_rate'), product.tax_rate)
        product.category = category
        product.brand = brand
    else:
        description = row.get('product_description')
        if description not in (None, ''):
            product.description = description
        unit = row.get('unit')
        if unit:
            product.unit = unit
        storage = row.get('storage_requirement')
        if storage:
            product.storage_requirement = storage
        tax_rate = row.get('tax_rate')
        if tax_rate not in (None, ''):
            product.tax_rate = _to_decimal(tax_rate, product.tax_rate)
        if category is not None:
            product.category = category
        if brand is not None:
            product.brand = brand
    product.updated_by = user
    product.save()


def _record_stock_movement(variant, warehouse, user, quantity_change,
                           quantity_before, quantity_after, transaction_type,
                           reason):
    """Ledger row for every stock write made by the import (same shape as the
    stock-adjustment endpoints, so the inventory audit trail stays complete)."""
    InventoryTransaction.objects.create(
        transaction_id=uuid.uuid4(),
        variant=variant,
        warehouse=warehouse,
        company_id=variant.company_id,
        branch_id=variant.branch_id,
        quantity_change=quantity_change,
        quantity_before=quantity_before,
        quantity_after=quantity_after,
        unit_cost=variant.buying_price or Decimal('0'),
        transaction_type=transaction_type,
        source_document_type='PRODUCT_IMPORT',
        reason_text=reason,
        created_by=user, updated_by=user,
    )


def _locked_stock_item(variant, warehouse, user):
    """
    The StockItem the import writes to, locked for update.

    Prefers the default warehouse (the one the create path uses); falls back to
    the variant's first stock row so an update still works when the tenant has
    no active warehouse configured. Lookups use the model's real unique key
    (`variant` + `warehouse`) so a stock row with inherited/blank tenant columns
    is still found instead of colliding with it on insert.
    """
    if warehouse is not None:
        stock_item = (
            StockItem.objects.select_for_update()
            .filter(variant=variant, warehouse=warehouse)
            .first()
        )
        if stock_item is not None:
            return stock_item
        return StockItem.objects.create(
            variant=variant, warehouse=warehouse,
            company_id=variant.company_id, branch_id=variant.branch_id,
            quantity_on_hand=0, created_by=user, updated_by=user,
        )
    return (
        StockItem.objects.select_for_update()
        .filter(variant=variant)
        .first()
    )


def _apply_stock(variant, quantity, user, warehouse, mode, policy):
    """
    Write the row's Qty cell to stock.

    mode='add' → quantity_on_hand += quantity  (Update Existing: 80 + 20 = 100)
    mode='set' → quantity_on_hand  = quantity  (Replace Existing: 80 → 20)

    A blank Qty cell (quantity is None) leaves stock untouched under every
    policy. Returns True when a stock row was actually written.
    """
    if quantity is None:
        return False
    stock_item = _locked_stock_item(variant, warehouse, user)
    if stock_item is None:
        return False

    before = stock_item.quantity_on_hand
    after = before + quantity if mode == 'add' else quantity
    if after == before:
        return False

    stock_item.quantity_on_hand = after
    stock_item.version += 1
    stock_item.updated_by = user
    stock_item.save(update_fields=['quantity_on_hand', 'version', 'updated_by', 'updated_at'])
    _record_stock_movement(
        variant=variant, warehouse=stock_item.warehouse, user=user,
        quantity_change=after - before, quantity_before=before,
        quantity_after=after,
        transaction_type='ADD_STOCK' if mode == 'add' else 'ADJUSTMENT',
        reason=f'Product import ({policy})',
    )
    return True


def _update_variant(variant, row, user, policy, default_warehouse=None):
    """
    Update a matched variant according to the conflict policy:

    - 'update_existing': overwrite every field the row supplies (a blank cell
      keeps the stored value) and **add** the row's Qty to existing stock.
    - 'replace_existing': authoritative — every field is overwritten (a blank
      cell clears it) and the row's Qty **replaces** the stock quantity.
    - anything else (legacy): omit-on-empty field update, stock untouched.
    """
    if policy == 'replace_existing':
        variant.variant_title = row.get('variant_title', '') or ''
        variant.barcode = row.get('variant_barcode', '') or ''
        variant.buying_price = _to_decimal(row.get('buying_price'))
        variant.selling_price = _to_decimal(row.get('selling_price'))
        variant.min_stock_level = _to_int(row.get('min_stock_level'))
        variant.max_stock_level = _to_int(row.get('max_stock_level'))
        stock_mode = 'set'
    else:
        # Omit-on-empty: the import row is not authoritative for blanks.
        title = row.get('variant_title')
        if title not in (None, ''):
            variant.variant_title = title
        barcode = row.get('variant_barcode')
        if barcode not in (None, ''):
            variant.barcode = barcode
        for key, attr, conv in (
            ('buying_price', 'buying_price', _to_decimal),
            ('selling_price', 'selling_price', _to_decimal),
        ):
            value = row.get(key)
            if value not in (None, ''):
                setattr(variant, attr, conv(value))
        for key, attr in (('min_stock_level', 'min_stock_level'), ('max_stock_level', 'max_stock_level')):
            value = row.get(key)
            if value not in (None, ''):
                setattr(variant, attr, _to_int(value))
        stock_mode = 'add' if policy == 'update_existing' else None

    variant.updated_by = user
    variant.save()

    if stock_mode:
        _apply_stock(
            variant, _provided_quantity(row), user, default_warehouse,
            stock_mode, policy,
        )


def _process_group(pname, vrows, policy, source, user, company_id, branch_id,
                   default_warehouse, active, existing_skus):
    """Create/update one product group. Returns local counters (merged on success)."""
    local = {
        'products_created': 0, 'variants_created': 0,
        'products_updated': 0, 'variants_updated': 0,
        'brands_created': 0, 'categories_created': 0,
    }
    first = vrows[0]

    brand = None
    brand_name = (first.get('brand_name') or '').strip()
    if brand_name:
        brand, bn = _find_or_create_brand(brand_name, company_id, branch_id, user, source)
        local['brands_created'] += int(bn)

    category = None
    cat_name = (first.get('category_name') or '').strip()
    if cat_name:
        category, cn = _find_or_create_category(cat_name, company_id, branch_id, user, source)
        local['categories_created'] += int(cn)

    existing_product = None
    if policy in ('update_existing', 'replace_existing'):
        matched_products = {}
        for row in vrows:
            sku = _normalize_sku(row.get('variant_sku'))
            matched_variant = active.get(sku) if sku else None
            if matched_variant:
                matched_products[matched_variant.product_id] = matched_variant.product
        if len(matched_products) > 1:
            raise ImportValidationError([{
                'row_index': first.get('row_index'),
                'field': 'variant_sku',
                'code': 'ambiguous_match',
                'message': (
                    f'Rows for "{pname}" match variants that belong to different '
                    'existing products. Split them into separate products.'
                ),
            }])
        if matched_products:
            existing_product = next(iter(matched_products.values()))

    if existing_product is not None:
        _update_product(existing_product, first, category, brand, user,
                        authoritative=(policy == 'replace_existing'))
        local['products_updated'] += 1
        for row in vrows:
            sku = _normalize_sku(row.get('variant_sku'))
            matched_variant = active.get(sku) if sku else None
            if matched_variant:
                _update_variant(matched_variant, row, user, policy, default_warehouse)
                local['variants_updated'] += 1
            else:
                _create_variant_for(existing_product, row, sku, user, company_id, branch_id,
                                    default_warehouse, existing_skus)
                local['variants_created'] += 1
    else:
        product = _create_product(pname, first, category, brand, source, user, company_id, branch_id)
        local['products_created'] += 1
        for row in vrows:
            sku = _normalize_sku(row.get('variant_sku'))
            _create_variant_for(product, row, sku, user, company_id, branch_id,
                                default_warehouse, existing_skus)
            local['variants_created'] += 1

    return local


def _run_import(rows_data, policy, source, user, company_id, branch_id, default_warehouse):
    by_index, active, deleted = _resolve_duplicates(
        rows_data, company_id, branch_id, default_warehouse,
    )

    counters = {
        'products_created': 0, 'variants_created': 0,
        'products_updated': 0, 'variants_updated': 0,
        'brands_created': 0, 'categories_created': 0,
        'rows_skipped': 0, 'rows_failed': 0,
    }
    skipped, failed = [], []

    # ── Partition rows according to the policy ──
    if policy == 'skip_duplicates':
        imported_rows = []
        seen_skus = {}
        for row in rows_data:
            info = by_index.get(row.get('row_index'), {})
            sku = _normalize_sku(row.get('variant_sku'))
            if info.get('conflict_type') in ('db_conflict', 'soft_deleted'):
                counters['rows_skipped'] += 1
                skipped.append(_skip_entry(
                    row, info,
                    'existing_sku' if info.get('conflict_type') == 'db_conflict' else 'soft_deleted_sku',
                ))
                continue
            if info.get('is_duplicate_in_file'):
                if sku and sku in seen_skus:
                    counters['rows_skipped'] += 1
                    skipped.append(_skip_entry(row, info, 'duplicate_in_file'))
                    continue
                if sku:
                    seen_skus[sku] = row.get('row_index')
            imported_rows.append(row)
    else:
        imported_rows = list(rows_data)
        if policy == 'add_new':
            blocking = [r for r in rows_data if _is_conflict(by_index.get(r.get('row_index'), {}))]
        else:  # update_existing / replace_existing
            blocking = [
                r for r in rows_data
                if by_index.get(r.get('row_index'), {}).get('conflict_type') == 'soft_deleted'
                or by_index.get(r.get('row_index'), {}).get('is_duplicate_in_file')
            ]
        if blocking:
            raise ImportValidationError([
                _conflict_error(r, by_index.get(r.get('row_index'), {})) for r in blocking
            ])

    # ── Group by product name (preserves current behavior) ──
    groups, order = {}, []
    for row in imported_rows:
        pname = (row.get('product_name') or '').strip()
        if pname not in groups:
            groups[pname] = []
            order.append(pname)
        groups[pname].append(row)

    existing_skus = set(active.keys()) | set(deleted.keys())
    existing_skus |= {_normalize_sku(r.get('variant_sku')) for r in rows_data}

    for pname in order:
        vrows = groups[pname]
        try:
            # Nested atomic (savepoint): an unexpected DB error is isolated to
            # this group for every policy, so the affected rows stay known.
            with transaction.atomic():
                local = _process_group(
                    pname, vrows, policy, source, user, company_id, branch_id,
                    default_warehouse, active, existing_skus,
                )
        except IntegrityError:
            logger.exception(
                'Product import DB conflict for product group "%s" '
                '(company=%s branch=%s policy=%s)',
                pname, company_id, branch_id, policy,
            )
            if policy == 'skip_duplicates':
                counters['rows_failed'] += len(vrows)
                failed.append({
                    'row_index': vrows[0].get('row_index'),
                    'rows': [r.get('row_index') for r in vrows],
                    'message': 'This group could not be imported due to a database conflict and was skipped.',
                })
                continue
            # All-or-nothing policies: raise a row-scoped, friendly error.
            # It propagates out of the outer atomic() so the whole import
            # rolls back, but the user sees which rows were affected.
            raise ImportValidationError([{
                'row_index': vrows[0].get('row_index'),
                'rows': [r.get('row_index') for r in vrows],
                'field': 'variant_sku',
                'code': 'db_conflict',
                'message': (
                    'A SKU in this import conflicts with an existing record. '
                    'Revalidate the listed SKUs and try again — the SKU may '
                    'have been created by another import just now.'
                ),
            }])
        for key, value in local.items():
            counters[key] += value

    if policy == 'skip_duplicates':
        message = (
            f'{counters["products_created"]} product(s), {counters["variants_created"]} variant(s) created; '
            f'{counters["rows_skipped"]} row(s) skipped'
            + (f', {counters["rows_failed"]} row(s) failed' if counters['rows_failed'] else '')
            + '.'
        )
    elif policy == 'add_new':
        message = f'{counters["products_created"]} product(s), {counters["variants_created"]} variant(s) created.'
    else:
        message = (
            f'{counters["products_created"]} product(s) created, {counters["products_updated"]} product(s) updated, '
            f'{counters["variants_created"]} variant(s) created, {counters["variants_updated"]} variant(s) updated.'
        )

    data = dict(counters)
    data['skipped'] = skipped
    data['failed'] = failed
    return {'message': message, 'data': data}


# ═══════════════════════════════════════════════════════════════
#  View: Export Products
# ═══════════════════════════════════════════════════════════════

class ProductExportView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'INVENTORY'
    permission_resource = 'product'

    def get(self, request):
        """GET /api/inventory/products/export/?file_format=xlsx&category=uuid&brand=uuid&product_ids=id1,id2"""
        export_format = request.query_params.get('file_format', 'xlsx')
        product_ids_param = request.query_params.get('product_ids')
        category_uuid = request.query_params.get('category')
        brand_uuid = request.query_params.get('brand')
        qs = Product.objects.filter(company_id=request.user.company_id, is_deleted=False)

        if product_ids_param:
            ids = [pid.strip() for pid in product_ids_param.split(',') if pid.strip()]
            qs = qs.filter(_id__in=ids)
        if category_uuid:
            qs = qs.filter(category___id=category_uuid)
        if brand_uuid:
            qs = qs.filter(brand___id=brand_uuid)

        if not qs.exists():
            return Response({'status': 'error', 'message': 'No products to export.'}, status=400)

        rows = list(_export_rows(qs))
        if not rows:
            return Response({'status': 'error', 'message': 'No variant data to export.'}, status=400)

        filename = f'products_export_{request.user.company_id}'
        if export_format == 'csv':
            return _make_csv(rows, filename, headers=EXPORT_HEADERS)
        return _make_xlsx(rows, filename, headers=EXPORT_HEADERS)


# ═══════════════════════════════════════════════════════════════
#  View: Import — Parse uploaded file
# ═══════════════════════════════════════════════════════════════

class ProductImportParseView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'INVENTORY'
    permission_resource = 'product'
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        """POST /api/inventory/products/import/parse/ (multipart file upload)"""
        file = request.FILES.get('file')
        if not file:
            return Response({'status': 'error', 'message': 'No file provided.'}, status=400)

        ext = file.name.rsplit('.', 1)[-1].lower() if '.' in file.name else ''
        if ext not in ('xlsx', 'xls', 'csv'):
            return Response(
                {'status': 'error', 'message': f'Unsupported format: .{ext}. Use .xlsx, .xls, or .csv.'},
                status=400,
            )

        try:
            rows = self._parse(file, ext)
        except ValueError as e:
            return Response({'status': 'error', 'message': str(e)}, status=400)
        except ImportError as e:
            return Response({'status': 'error', 'message': f'Missing library: {e}. Install openpyxl.'}, status=400)
        except Exception as e:
            logger.exception('Product import parse failed')
            return Response({'status': 'error', 'message': f'Failed to parse: {e}'}, status=400)

        if not rows:
            return Response({'status': 'error', 'message': 'File is empty.'}, status=400)

        preview = _build_preview_rows(rows, request.user.company_id, request.user.branch_id)
        return Response({
            'status': 'success',
            'message': f'Parsed {len(preview)} row(s).',
            'data': {
                'rows': preview,
                'total_rows': len(preview),
                'counts': _validation_counts({r['row_index']: r for r in preview}),
            },
        })

    def _parse(self, file, ext):
        if ext == 'xlsx':
            df = pd.read_excel(file, engine='openpyxl')
        elif ext == 'xls':
            df = pd.read_excel(file)
        else:
            df = pd.read_csv(file)
        df.columns = [c.strip() for c in df.columns]
        missing = [c for c in EXPECTED_COLUMNS if c not in df.columns]
        if missing:
            raise ValueError(f'Missing columns: {", ".join(missing)}')
        df = df.where(pd.notna(df), None)
        return df.to_dict(orient='records')


# ═══════════════════════════════════════════════════════════════
#  View: Import — Validate rows (server-authoritative revalidation)
# ═══════════════════════════════════════════════════════════════

class ProductImportValidateView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'INVENTORY'
    permission_resource = 'product'

    def post(self, request):
        """POST /api/inventory/products/import/validate/  {rows: [...]}"""
        rows_data = request.data.get('rows', [])
        if not isinstance(rows_data, list):
            return Response({'status': 'error', 'message': 'rows must be a list.'}, status=400)

        by_index, _active, _deleted = _resolve_duplicates(
            rows_data, request.user.company_id, request.user.branch_id,
        )
        return Response({
            'status': 'success',
            'message': 'Validation complete.',
            'data': {
                'rows': list(by_index.values()),
                'counts': _validation_counts(by_index),
            },
        })


# ═══════════════════════════════════════════════════════════════
#  View: Import — Confirm / Create / Update
# ═══════════════════════════════════════════════════════════════

class ProductImportConfirmView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'INVENTORY'
    permission_resource = 'product'

    def post(self, request):
        """POST /api/inventory/products/import/confirm/  {rows: [...], source, conflict_policy}"""
        rows_data = request.data.get('rows', [])
        source = request.data.get('source', 'excel')
        policy = request.data.get('conflict_policy', 'add_new')
        user = request.user
        company_id = user.company_id
        branch_id = user.branch_id

        if not isinstance(rows_data, list) or not rows_data:
            return Response({'status': 'error', 'message': 'No rows provided.'}, status=400)
        if policy not in CONFLICT_POLICIES:
            return Response(
                {'status': 'error',
                 'message': f'Unknown conflict policy "{policy}".'},
                status=400,
            )

        # 1. Structural row validation (blocking for every policy)
        validation_errors = _structural_errors(rows_data)
        if validation_errors:
            return Response({
                'status': 'error',
                'message': 'Validation failed. Nothing was created.',
                'errors': validation_errors,
            }, status=422)

        default_warehouse = _get_default_warehouse(company_id, branch_id)

        # 2. Execute inside a single transaction; expected conflicts are
        #    detected before any write (Bug 2/3), DB errors are the last resort.
        try:
            with transaction.atomic():
                result = _run_import(
                    rows_data, policy, source, user, company_id, branch_id, default_warehouse,
                )
        except ImportValidationError as e:
            logger.warning(
                'Product import rejected by validation (company=%s branch=%s policy=%s rows=%s)',
                company_id, branch_id, policy,
                [err.get('row_index') for err in e.errors],
            )
            return Response({
                'status': 'error',
                'message': 'Validation failed. Nothing was created.',
                'errors': e.errors,
            }, status=422)
        except IntegrityError:
            logger.exception(
                'Product import IntegrityError (company=%s branch=%s policy=%s)',
                company_id, branch_id, policy,
            )
            # Last-resort safety net: the outer atomic already rolled back, so
            # re-resolve duplicates to point the user at the offending row(s).
            errors = []
            try:
                by_index, _active, _deleted = _resolve_duplicates(
                    rows_data, company_id, branch_id,
                )
                errors = [
                    _conflict_error(r, by_index.get(r.get('row_index'), {}))
                    for r in rows_data
                    if _is_conflict(by_index.get(r.get('row_index'), {}))
                ]
            except Exception:  # pragma: no cover — never mask the original error
                logger.exception('Import conflict re-resolution failed')
            if not errors:
                errors = [{
                    'row_index': None,
                    'field': 'variant_sku',
                    'code': 'db_conflict',
                    'message': 'A SKU in this import conflicts with an existing record. Revalidate and retry.',
                }]
            return Response({
                'status': 'error',
                'message': (
                    'A database conflict prevented the import. Nothing was created. '
                    'Please revalidate the listed SKUs and try again — the SKU may have '
                    'been created by another import just now.'
                ),
                'errors': errors,
            }, status=422)

        return Response({
            'status': 'success',
            'message': result['message'],
            'data': result['data'],
        })


# ═══════════════════════════════════════════════════════════════
#  View: Sample Template
# ═══════════════════════════════════════════════════════════════

class ProductImportTemplateView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'INVENTORY'
    permission_resource = 'product'

    def get(self, request):
        """GET /api/inventory/products/import/template/?format=xlsx"""
        fmt = request.query_params.get('format', 'xlsx')
        blank = {col: '' for col in SAMPLE_HEADERS}
        rows = [blank]
        filename = 'product_import_template'
        if fmt == 'csv':
            return _make_csv(rows, filename)
        return _make_xlsx(rows, filename)
