"""
Product Import / Export views.

Uses standalone APIView classes (not ViewSet @action decorators)
to match the pattern used by the HR module (ShiftTemplateView, etc.).
"""
import io
import csv
import math
import time
import random
import re
from decimal import Decimal

import pandas as pd
from django.db import IntegrityError, transaction
from django.http import HttpResponse
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import Product, ProductVariant, Brand, Category, Warehouse, StockItem


SAMPLE_HEADERS = [
    'Product Name', 'Product Description', 'Category', 'Brand',
    'Unit', 'Storage Requirement', 'Tax Rate (%)', 'Status',
    'Variant SKU', 'Variant Title', 'Variant Barcode',
    'Buying Price', 'Selling Price', 'Min Stock Level', 'Max Stock Level',
]

EXPECTED_COLUMNS = SAMPLE_HEADERS


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


def _make_xlsx(rows, filename):
    df = pd.DataFrame(rows, columns=SAMPLE_HEADERS)
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


def _make_csv(rows, filename):
    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=SAMPLE_HEADERS)
    writer.writeheader()
    writer.writerows(rows)
    response = HttpResponse(output.getvalue(), content_type='text/csv; charset=utf-8')
    response['Content-Disposition'] = f'attachment; filename="{filename}.csv"'
    return response


def _resolve_brand_or_category(name, model_class, company_id, branch_id):
    name = (name or '').strip()
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
    return f'IMP{product_id}{int(time.time())}{random.randint(10,99)}'[:50]


class ImportValidationError(Exception):
    def __init__(self, errors):
        self.errors = errors
        super().__init__('Import validation failed')


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
            return _make_csv(rows, filename)
        return _make_xlsx(rows, filename)


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
            print("the rows length is: ", len(rows))
        except ValueError as e:
            return Response({'status': 'error', 'message': str(e)}, status=400)
        except ImportError as e:
            return Response({'status': 'error', 'message': f'Missing library: {e}. Install openpyxl.'}, status=400)
        except Exception as e:
            return Response({'status': 'error', 'message': f'Failed to parse: {e}'}, status=400)

        if not rows:
            return Response({'status': 'error', 'message': 'File is empty.'}, status=400)

        preview = self._build_preview(rows, request.user.company_id, request.user.branch_id)
        return Response({
            'status': 'success',
            'message': f'Parsed {len(preview)} row(s).',
            'data': {'rows': preview, 'total_rows': len(preview)},
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

    def _build_preview(self, rows, company_id, branch_id):
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
                'status': str(_clean_val(row.get('Status'), 'active')),
                'variant_sku': str(_clean_val(row.get('Variant SKU'), '')).strip(),
                'variant_title': str(_clean_val(row.get('Variant Title'), '')),
                'variant_barcode': str(_clean_val(row.get('Variant Barcode'), '')),
                'buying_price': float(_clean_val(row.get('Buying Price'), 0)),
                'selling_price': float(_clean_val(row.get('Selling Price'), 0)),
                'min_stock_level': int(_clean_val(row.get('Min Stock Level'), 0)),
                'max_stock_level': int(_clean_val(row.get('Max Stock Level'), 0)),
            })
        return preview


# ═══════════════════════════════════════════════════════════════
#  View: Import — Confirm / Create
# ═══════════════════════════════════════════════════════════════

class ProductImportConfirmView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'INVENTORY'
    permission_resource = 'product'

    def post(self, request):
        """POST /api/inventory/products/import/confirm/  {rows: [...], source: 'excel'|'csv'}"""
        rows_data = request.data.get('rows', [])
        source = request.data.get('source', 'excel')
        user = request.user
        company_id = user.company_id
        branch_id = user.branch_id

        if not rows_data:
            return Response({'status': 'error', 'message': 'No rows provided.'}, status=400)

        errors = []
        products_created = variants_created = brands_created = categories_created = 0
        default_warehouse = _get_default_warehouse(company_id, branch_id)

        try:
            with transaction.atomic():
                groups = {}
                for row in rows_data:
                    pname = (row.get('product_name') or '').strip()
                    if not pname:
                        errors.append({'row_index': row.get('row_index'), 'error': 'Product name is required.'})
                        continue
                    groups.setdefault(pname, []).append(row)

                if errors:
                    raise ImportValidationError(errors)

                for pname, vrows in groups.items():
                    brand_name = vrows[0].get('brand_name', '').strip()
                    brand = None
                    if brand_name:
                        brand, bn = _find_or_create_brand(brand_name, company_id, branch_id, user, source)
                        if bn:
                            brands_created += 1

                    cat_name = vrows[0].get('category_name', '').strip()
                    category = None
                    if cat_name:
                        category, cn = _find_or_create_category(cat_name, company_id, branch_id, user, source)
                        if cn:
                            categories_created += 1

                    first = vrows[0]
                    product = Product.objects.create(
                        product_name=pname,
                        description=first.get('product_description', ''),
                        category=category, brand=brand,
                        unit=first.get('unit', 'PIECE'),
                        storage_requirement=first.get('storage_requirement', 'AMBIENT'),
                        tax_rate=Decimal(str(first.get('tax_rate', 0))),
                        status=first.get('status', 'active'),
                        is_active=True, source=source,
                        company_id=company_id, branch_id=branch_id,
                        created_by=user, updated_by=user,
                    )
                    products_created += 1

                    for vrow in vrows:
                        sku = (vrow.get('variant_sku') or '').strip() or _auto_sku(product.id)
                        variant = ProductVariant.objects.create(
                            product=product,
                            company_id=company_id, branch_id=branch_id,
                            sku=sku,
                            variant_title=vrow.get('variant_title', ''),
                            barcode=vrow.get('variant_barcode', ''),
                            buying_price=Decimal(str(vrow.get('buying_price', 0))),
                            selling_price=Decimal(str(vrow.get('selling_price', 0))),
                            min_stock_level=int(vrow.get('min_stock_level', 0)),
                            max_stock_level=int(vrow.get('max_stock_level', 0)),
                            created_by=user, updated_by=user,
                        )
                        variants_created += 1
                        if default_warehouse:
                            StockItem.objects.create(
                                variant=variant, warehouse=default_warehouse,
                                company_id=company_id, branch_id=branch_id,
                                quantity_on_hand=0, created_by=user, updated_by=user,
                            )

            return Response({
                'status': 'success',
                'message': f'{products_created} product(s), {variants_created} variant(s) created.',
                'data': {
                    'products_created': products_created,
                    'variants_created': variants_created,
                    'brands_created': brands_created,
                    'categories_created': categories_created,
                },
            })
        except ImportValidationError as e:
            return Response(
                {'status': 'error', 'message': 'Validation failed. Nothing was created.', 'errors': e.errors},
                status=422,
            )
        except IntegrityError as e:
            return Response(
                {'status': 'error', 'message': f'DB constraint: {e}. Nothing was created.',
                 'errors': [{'row_index': None, 'error': str(e)}]},
                status=422,
            )


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
