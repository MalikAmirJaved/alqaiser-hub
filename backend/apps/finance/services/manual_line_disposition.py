"""
Centralized disposition logic for manual invoice lines.

Used by invoice edit (qty reduction), cancel, and return flows so supplier
bill/balance/credit handling stays consistent.

Actions:
  - go_to_product: create/reuse product variant, add product_qty to stock;
    record damage_qty as DAMAGE (reason required when damage_qty > 0).
    Does NOT change supplier bill/balance/credit.
  - return_to_supplier: reduce or cancel supplier bill and sync balance/credit.
"""
import uuid
from decimal import Decimal

from django.db import transaction

from apps.finance.models import InvoiceLineProductLink
from apps.finance.services.invoice_supplier_bill import (
    apply_line_reduction,
    bill_has_confirmed_payment,
    line_cost,
)
from apps.finance.services.supplier_balance import update_supplier_balance
from apps.inventory.models import (
    InventoryTransaction,
    Product,
    ProductVariant,
    StockItem,
    Warehouse,
)


class DispositionValidationError(ValueError):
    pass


def validate_qty_split(total_qty, product_qty, damage_qty, damage_reason=''):
    """Validate product vs damage quantity split. Raises DispositionValidationError."""
    total_qty = int(total_qty or 0)
    product_qty = int(product_qty if product_qty is not None else total_qty)
    damage_qty = int(damage_qty or 0)

    if total_qty <= 0:
        raise DispositionValidationError('Total quantity must be greater than zero.')
    if product_qty < 0 or damage_qty < 0:
        raise DispositionValidationError('Quantities cannot be negative.')
    if product_qty + damage_qty != total_qty:
        raise DispositionValidationError(
            f'Product qty ({product_qty}) + damage qty ({damage_qty}) must equal total ({total_qty}).'
        )
    if damage_qty > 0 and not (damage_reason or '').strip():
        raise DispositionValidationError('Damage reason is required when damage quantity > 0.')
    return product_qty, damage_qty, (damage_reason or '').strip()


def parse_stock_disposition(entry, default_total_qty):
    """Parse stock disposition payload (backward-compatible with legacy add_stock/damaged)."""
    if not entry:
        product_qty, damage_qty = default_total_qty, 0
        damage_reason = ''
    elif entry.get('product_qty') is not None or entry.get('damage_qty') is not None:
        product_qty = entry.get('product_qty', default_total_qty)
        damage_qty = entry.get('damage_qty', 0)
        damage_reason = (entry.get('damage_reason') or '').strip()
    elif entry.get('disposition') == 'damaged':
        product_qty, damage_qty = 0, default_total_qty
        damage_reason = (entry.get('damage_reason') or '').strip()
    else:
        product_qty, damage_qty = default_total_qty, 0
        damage_reason = (entry.get('damage_reason') or '').strip()

    validate_qty_split(default_total_qty, product_qty, damage_qty, damage_reason)
    return product_qty, damage_qty, damage_reason


def get_or_create_product_variant_for_line(line, user):
    """Return (product, variant) for a manual invoice line, creating if needed."""
    existing_link = InvoiceLineProductLink.objects.filter(
        invoice_line=line,
        is_deleted=False,
    ).select_related('product', 'variant').first()

    if existing_link:
        return existing_link.product, existing_link.variant

    name = line.manual_variant_name or 'Manual Item'
    sku = line.manual_variant_sku or _generate_sku(name, line.company_id, line.branch_id)

    sku_value = (sku or '').strip()
    if sku_value:
        existing = ProductVariant.objects.filter(
            sku=sku_value,
            company_id=line.company_id,
            branch_id=line.branch_id,
        ).select_related('product').first()
        if existing:
            product, variant = existing.product, existing
        else:
            product, variant = _create_product_variant(
                name, sku_value, line.unit_price, line.cost_price,
                line.company_id, line.branch_id, user,
            )
    else:
        product, variant = _create_product_variant(
            name, sku_value, line.unit_price, line.cost_price,
            line.company_id, line.branch_id, user,
        )

    InvoiceLineProductLink.objects.create(
        invoice_line=line,
        product=product,
        variant=variant,
        company_id=line.company_id,
        branch_id=line.branch_id,
        created_by=user,
        updated_by=user,
    )
    return product, variant


@transaction.atomic
def go_to_product_for_manual_line(
    line,
    total_qty,
    user,
    *,
    source_document_type,
    source_document_id,
    source_line_id=None,
    product_qty=None,
    damage_qty=None,
    damage_reason='',
    stock_reason='Stock added from manual line (go to product)',
    damage_reason_prefix='',
):
    """Create product + stock for manual line without touching supplier bill."""
    product_qty, damage_qty, damage_reason = validate_qty_split(
        total_qty, product_qty, damage_qty, damage_reason,
    )

    if product_qty <= 0 and damage_qty <= 0:
        return None

    product, variant = get_or_create_product_variant_for_line(line, user)
    warehouse = _get_default_warehouse(line.company_id)

    if product_qty > 0:
        _add_stock(
            variant=variant,
            warehouse=warehouse,
            quantity=product_qty,
            cost=line.cost_price,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id or line._id,
            company_id=line.company_id,
            branch_id=line.branch_id,
            user=user,
            reason_text=stock_reason,
        )

    if damage_qty > 0:
        prefix = damage_reason_prefix or 'Manual line damage'
        _record_damage(
            variant=variant,
            warehouse=warehouse,
            quantity=damage_qty,
            cost=line.cost_price,
            source_document_type=source_document_type,
            source_document_id=source_document_id,
            source_line_id=source_line_id or line._id,
            company_id=line.company_id,
            branch_id=line.branch_id,
            user=user,
            reason_text=f'{prefix}: {damage_reason}',
        )

    return {'product_id': str(product._id), 'variant_id': str(variant._id)}


@transaction.atomic
def return_qty_to_supplier_for_line(
    line,
    qty,
    user,
    *,
    notes='',
    cancel_bill_if_zero=True,
):
    """Reverse supplier obligation for returned/reduced manual line quantity."""
    qty = int(qty or 0)
    if qty <= 0:
        return

    bill = line.supplier_bill
    vendor = line.vendor
    if not bill or not vendor:
        raise DispositionValidationError('No supplier bill linked to this manual line.')

    cost = line.cost_price or Decimal('0')
    reduction_amount = line_cost(qty, cost)
    has_payments = bill_has_confirmed_payment(bill)

    if has_payments:
        update_supplier_balance(
            vendor,
            reduction_amount,
            'CREDIT_NOTE',
            reference_type='supplier_bill',
            reference_id=bill._id,
            notes=notes or f'Returned {qty} units to supplier (bill {bill.bill_number})',
        )
    else:
        old_amount = bill.amount
        new_amount = max(Decimal('0'), old_amount - reduction_amount)
        outstanding_delta = new_amount - old_amount

        if outstanding_delta < 0:
            from apps.finance.services.payable import get_total_paid
            paid = get_total_paid(bill)
            old_outstanding = max(Decimal('0'), old_amount - paid)
            new_outstanding = max(Decimal('0'), new_amount - paid)
            reversal = old_outstanding - new_outstanding
            if reversal > 0:
                update_supplier_balance(
                    vendor,
                    reversal,
                    'PURCHASE_REVERSAL',
                    reference_type='supplier_bill',
                    reference_id=bill._id,
                    notes=notes or f'Returned {qty} units to supplier',
                )

        bill.amount = new_amount
        if cancel_bill_if_zero and new_amount <= 0:
            bill.status = 'CANCELLED'
            bill.save(update_fields=['amount', 'status', 'updated_at'])
        else:
            bill.save(update_fields=['amount', 'updated_at'])


@transaction.atomic
def return_full_line_to_supplier_on_cancel(line, bill, invoice, user, has_payments):
    """Cancel supplier bill and reverse balance/credit for full line on invoice cancel."""
    if not bill or not bill.supplier_id or bill.amount <= 0:
        return

    if has_payments:
        update_supplier_balance(
            bill.supplier,
            bill.amount,
            'CREDIT_NOTE',
            reference_type='supplier_bill',
            reference_id=bill._id,
            notes=(
                f'Invoice {invoice.invoice_number} cancelled – credit for returned goods '
                f'(bill {bill.bill_number})'
            ),
        )
    else:
        update_supplier_balance(
            bill.supplier,
            bill.amount,
            'PURCHASE_REVERSAL',
            reference_type='supplier_bill',
            reference_id=bill._id,
            notes=(
                f'Invoice {invoice.invoice_number} cancelled – bill {bill.bill_number} reversed'
            ),
        )

    if bill.journal_entry_id:
        from apps.finance.services.cancel_invoice import reverse_journal_entry
        reverse_journal_entry(
            bill.journal_entry, user,
            f'Invoice {invoice.invoice_number} cancelled',
        )

    bill.status = 'CANCELLED'
    bill.save(update_fields=['status', 'updated_at'])


def apply_reduction_return_to_supplier(line, user, action_notes=''):
    """Wrapper for edit-time qty reduction → return to supplier."""
    apply_line_reduction(
        line.supplier_bill,
        line,
        user,
        action_notes=action_notes or 'Qty reduction resolved (return to supplier)',
    )


def _create_product_variant(name, sku, selling_price, buying_price, company_id, branch_id, user):
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
        sku=sku,
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
    import random
    import time

    base = ''.join(ch for ch in (name or 'ITEM').upper() if ch.isalnum())[:8] or 'ITEM'
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


def _get_default_warehouse(company_id):
    warehouse = Warehouse.objects.filter(
        company_id=company_id,
        is_active=True,
    ).order_by('created_at').first()
    if not warehouse:
        raise DispositionValidationError('No active warehouse found. Create a warehouse first.')
    return warehouse


def _add_stock(
    variant, warehouse, quantity, cost, source_document_type, source_document_id,
    source_line_id, company_id, branch_id, user, reason_text,
):
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
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        source_line_id=source_line_id,
        reason_text=reason_text,
        created_by=user,
        updated_by=user,
    )


def _record_damage(
    variant, warehouse, quantity, cost, source_document_type, source_document_id,
    source_line_id, company_id, branch_id, user, reason_text,
):
    stock, _ = StockItem.objects.select_for_update().get_or_create(
        variant=variant,
        warehouse=warehouse,
        company_id=company_id,
        defaults={
            'quantity_on_hand': 0,
            'quantity_reserved': 0,
            'branch_id': branch_id,
        },
    )
    InventoryTransaction.objects.create(
        transaction_id=uuid.uuid4(),
        variant=variant,
        warehouse=warehouse,
        company_id=company_id,
        branch_id=branch_id,
        quantity_change=0,
        quantity_before=stock.quantity_on_hand,
        quantity_after=stock.quantity_on_hand,
        unit_cost=cost or 0,
        transaction_type='DAMAGE',
        source_document_type=source_document_type,
        source_document_id=source_document_id,
        source_line_id=source_line_id,
        reason_text=reason_text,
        created_by=user,
        updated_by=user,
    )
