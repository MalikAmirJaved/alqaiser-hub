from decimal import Decimal

from django.db import transaction

from apps.finance.services.invoice_supplier_bill import apply_line_reduction
from apps.inventory.models import (
    InventoryTransaction,
    Product,
    ProductVariant,
    StockItem,
    Warehouse,
)


def resolve_invoice_line_reduction(line, action, user):
    """Resolve a quantity reduction on a manual invoice line.

    Both actions update the supplier bill and vendor balance/credit.
    go_to_inventory additionally creates a product variant and adds stock.
    """
    if line.resolved:
        raise ValueError('This reduction has already been resolved.')
    if not line.original_quantity:
        raise ValueError('Original quantity not recorded for this line.')
    if not line.supplier_bill:
        raise ValueError('No supplier bill linked to this line.')
    if not line.vendor:
        raise ValueError('No vendor linked to this line.')

    delta_qty = line.original_quantity - line.quantity
    if delta_qty <= 0:
        raise ValueError('No reduction to resolve.')

    bill = line.supplier_bill
    from apps.finance.services.invoice_supplier_bill import bill_has_confirmed_payment
    action_label = 'return to supplier' if action == 'return_to_vendor' else 'go to inventory'

    result = {
        'action': action,
        'delta_qty': delta_qty,
        'delta_cost': str(Decimal(str(delta_qty)) * Decimal(str(line.cost_price or 0))),
        'bill_paid': bill_has_confirmed_payment(bill),
    }

    with transaction.atomic():
        apply_line_reduction(
            bill,
            line,
            user,
            action_notes=f'Qty reduction resolved ({action_label})',
        )

        if action == 'go_to_inventory':
            product, variant = _get_or_create_product_variant(
                name=line.manual_variant_name,
                sku=line.manual_variant_sku,
                selling_price=line.unit_price,
                buying_price=line.cost_price,
                company_id=line.company_id,
                branch_id=line.branch_id,
                user=user,
            )
            _add_stock(
                variant=variant,
                quantity=delta_qty,
                cost=line.cost_price,
                reference_id=line.customer_invoice._id,
                source_line_id=line._id,
                company_id=line.company_id,
                branch_id=line.branch_id,
                user=user,
            )
            result['product_id'] = str(product._id)
            result['variant_id'] = str(variant._id)

        line.resolved = True
        line.original_quantity = None
        line.save(update_fields=['resolved', 'original_quantity', 'updated_at'])

    return result


def line_cost(quantity, cost_price):
    return Decimal(str(quantity)) * Decimal(str(cost_price or 0))


def _get_or_create_product_variant(name, sku, selling_price, buying_price,
                                   company_id, branch_id, user):
    sku_value = (sku or '').strip()
    if sku_value:
        existing = ProductVariant.objects.filter(
            sku=sku_value,
            company_id=company_id,
            branch_id=branch_id,
        ).select_related('product').first()
        if existing:
            return existing.product, existing
    else:
        sku_value = _generate_sku(name, company_id, branch_id)

    product = Product.objects.create(
        product_name=name,
        status='active',
        company_id=company_id,
        branch_id=branch_id,
        created_by=user,
        updated_by=user,
    )
    variant = ProductVariant.objects.create(
        product=product,
        sku=sku_value,
        variant_title=name,
        buying_price=buying_price or 0,
        selling_price=selling_price or 0,
        company_id=company_id,
        branch_id=branch_id,
        created_by=user,
        updated_by=user,
    )
    return product, variant


def _generate_sku(name, company_id, branch_id):
    import time
    import random
    base = ''.join(ch for ch in name.upper() if ch.isalnum())[:8] or 'ITEM'
    suffix = f"{int(time.time())}{random.randint(10, 99)}"
    candidate = f"{base}-{suffix}"
    while ProductVariant.objects.filter(
        sku=candidate,
        company_id=company_id,
        branch_id=branch_id,
    ).exists():
        suffix = f"{int(time.time())}{random.randint(100, 999)}"
        candidate = f"{base}-{suffix}"
    return candidate


def _add_stock(variant, quantity, cost, reference_id, source_line_id,
               company_id, branch_id, user):
    import uuid

    warehouse = Warehouse.objects.filter(
        company_id=company_id,
        is_active=True,
    ).order_by('created_at').first()

    if not warehouse:
        raise ValueError('No active warehouse found. Create a warehouse first.')

    stock_item, _ = StockItem.objects.select_for_update().get_or_create(
        variant=variant,
        warehouse=warehouse,
        company_id=company_id,
        defaults={
            'quantity_on_hand': 0,
            'quantity_reserved': 0,
            'branch_id': branch_id,
        },
    )

    before = stock_item.quantity_on_hand
    after = before + int(quantity)

    stock_item.quantity_on_hand = after
    stock_item.save(update_fields=['quantity_on_hand'])

    InventoryTransaction.objects.create(
        transaction_id=uuid.uuid4(),
        variant=variant,
        warehouse=warehouse,
        company_id=company_id,
        branch_id=branch_id,
        quantity_change=int(quantity),
        quantity_before=before,
        quantity_after=after,
        unit_cost=cost or 0,
        transaction_type='PURCHASE_RECEIPT',
        source_document_type='CUSTOMER_INVOICE',
        source_document_id=reference_id,
        source_line_id=source_line_id,
        reason_text='Stock added from invoice line reduction (go to inventory)',
        created_by=user,
        updated_by=user,
    )
