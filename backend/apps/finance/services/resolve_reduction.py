from decimal import Decimal

from django.db import transaction

from apps.finance.services.invoice_supplier_bill import bill_has_confirmed_payment
from apps.finance.services.manual_line_disposition import (
    apply_reduction_return_to_supplier,
    go_to_product_for_manual_line,
    validate_qty_split,
)


def resolve_variant_line_reduction(line, user, product_qty=None, damage_qty=None, damage_reason=''):
    """Resolve qty reduction on an inventory variant line (product vs damage split).

    After invoice update the reduced units are already back in stock.
    product_qty needs no action; damage_qty is deducted and recorded as DAMAGE.
    """
    import uuid

    from apps.inventory.models import InventoryTransaction, StockItem

    if line.resolved:
        raise ValueError('This reduction has already been resolved.')
    if not line.original_quantity:
        raise ValueError('Original quantity not recorded for this line.')
    if line.is_manual_entry:
        raise ValueError('Use manual line resolution for manual entries.')
    if not line.variant:
        raise ValueError('No variant linked to this line.')

    delta_qty = line.original_quantity - line.quantity
    if delta_qty <= 0:
        raise ValueError('No reduction to resolve.')

    product_qty, damage_qty, damage_reason = validate_qty_split(
        delta_qty, product_qty, damage_qty, damage_reason,
    )

    result = {
        'action': 'variant_qty_split',
        'delta_qty': delta_qty,
        'product_qty': product_qty,
        'damage_qty': damage_qty,
    }

    if damage_qty > 0:
        remaining = damage_qty
        stock_items = StockItem.objects.filter(
            variant=line.variant,
            company_id=line.company_id,
            quantity_on_hand__gt=0,
        ).select_related('warehouse').order_by('warehouse__warehouse_name').select_for_update()

        for stock in stock_items:
            if remaining <= 0:
                break
            deduct = min(stock.quantity_on_hand, remaining)
            before = stock.quantity_on_hand
            after = before - deduct
            stock.quantity_on_hand = after
            stock.save(update_fields=['quantity_on_hand'])

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=line.variant,
                warehouse=stock.warehouse,
                company_id=line.company_id,
                branch_id=line.branch_id,
                quantity_change=-deduct,
                quantity_before=before,
                quantity_after=after,
                unit_cost=line.variant.buying_price or 0,
                transaction_type='DAMAGE',
                source_document_type='CUSTOMER_INVOICE',
                source_document_id=line.customer_invoice._id,
                source_line_id=line._id,
                reason_text=f'Invoice edit reduction damage: {damage_reason}',
                created_by=user,
                updated_by=user,
            )
            remaining -= deduct

        if remaining > 0:
            raise ValueError(
                f'Insufficient stock to mark {damage_qty} units as damaged '
                f'({damage_qty - remaining} available).'
            )

    line.resolved = True
    line.original_quantity = None
    line.save(update_fields=['resolved', 'original_quantity', 'updated_at'])

    return result


def resolve_invoice_line_reduction(line, action, user, product_qty=None, damage_qty=None, damage_reason=''):
    """Resolve a quantity reduction on a manual invoice line.

    - return_to_vendor: Reduces the supplier bill amount and vendor balance/credit
      (company is returning stock to supplier).
    - go_to_inventory: Keeps the supplier bill and vendor balance unchanged
      (company keeps the stock; creates a product variant + adds stock).
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
    action_label = 'return to supplier' if action == 'return_to_vendor' else 'go to product'

    result = {
        'action': action,
        'delta_qty': delta_qty,
        'delta_cost': str(Decimal(str(delta_qty)) * Decimal(str(line.cost_price or 0))),
        'bill_paid': bill_has_confirmed_payment(bill),
    }

    with transaction.atomic():
        if action == 'return_to_vendor':
            apply_reduction_return_to_supplier(
                line,
                user,
                action_notes=f'Qty reduction resolved ({action_label})',
            )

        if action == 'go_to_inventory':
            go_result = go_to_product_for_manual_line(
                line,
                delta_qty,
                user,
                source_document_type='CUSTOMER_INVOICE',
                source_document_id=line.customer_invoice._id,
                source_line_id=line._id,
                product_qty=product_qty,
                damage_qty=damage_qty,
                damage_reason=damage_reason,
                stock_reason='Stock added from invoice line reduction (go to product)',
                damage_reason_prefix='Invoice edit reduction damage',
            )
            if go_result:
                result.update(go_result)

        line.resolved = True
        line.original_quantity = None
        line.save(update_fields=['resolved', 'original_quantity', 'updated_at'])

    return result
