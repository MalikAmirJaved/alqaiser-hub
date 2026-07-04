"""
Cancel a customer invoice and reverse all side-effects.

Reversal chain:
  1. Cancel DRAFT payments      → soft-delete
  2. Reverse inventory stock     → per-line product_qty / damage_qty split
  3. Cancel supplier bills       → depends on per-line actions (manual lines)
  4. Reverse journal entry       → create swapping JE
  5. Mark lines as cancelled
  6. Set invoice status          → CANCELLED
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import F

from apps.finance.services.payable import get_payments_queryset
from apps.finance.services.manual_line_disposition import (
    DispositionValidationError,
    go_to_product_for_manual_line,
    parse_stock_disposition,
    return_full_line_to_supplier_on_cancel,
)


def cancel_customer_invoice(invoice, user, reason='', supplier_action='return_to_supplier', line_actions=None, stock_dispositions=None):
    """
    Cancel a customer invoice and reverse all effects.

    Args:
        line_actions: [{ source_line_id, action: go_to_inventory|return_to_supplier }]
        stock_dispositions: [{
            source_line_id,
            disposition?: add_stock|damaged,  # legacy
            product_qty?, damage_qty?, damage_reason?
        }]
    """
    from apps.inventory.services.stock_service import direct_release_stock
    from apps.finance.models import CustomerInvoiceLine, SupplierBill

    if invoice.status == 'CANCELLED':
        return False, 'Invoice is already cancelled'

    if not reason or not reason.strip():
        return False, 'Cancellation reason is required'

    line_actions = line_actions or []
    stock_dispositions = stock_dispositions or []
    line_action_map = {
        la['source_line_id']: la['action']
        for la in line_actions
        if 'source_line_id' in la and 'action' in la
    }
    stock_disp_map = {
        sd['source_line_id']: sd
        for sd in stock_dispositions
        if 'source_line_id' in sd
    }

    for sd in stock_dispositions:
        disp = sd.get('disposition')
        if disp and disp not in ('add_stock', 'damaged'):
            if sd.get('product_qty') is None and sd.get('damage_qty') is None:
                raise ValueError(
                    f"Invalid stock disposition: {disp}. Must be 'add_stock' or 'damaged'."
                )

    with transaction.atomic():
        draft_payments = get_payments_queryset(invoice, status='DRAFT')
        for payment in draft_payments:
            payment.is_deleted = True
            payment.deleted_by = user
            payment.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])

        try:
            _reverse_invoice_stock_with_dispositions(invoice, user, stock_disp_map, line_action_map)
        except DispositionValidationError as e:
            raise ValueError(str(e))
        except Exception as e:
            raise ValueError(f'Failed to reverse stock: {e}')

        supplier_bills = SupplierBill.objects.filter(
            customer_invoice=invoice,
            is_deleted=False,
        )
        for bill in supplier_bills:
            if bill.status == 'CANCELLED':
                continue

            line = invoice.lines.filter(
                supplier_bill=bill,
                is_deleted=False,
            ).first()
            effective_action = supplier_action
            if line and str(line._id) in line_action_map:
                effective_action = line_action_map[str(line._id)]

            if effective_action == 'go_to_inventory':
                continue

            if bill.supplier_id and bill.amount > 0:
                bill_payments = get_payments_queryset(bill, status='CONFIRMED')
                has_payments = bill_payments.exists()
                return_full_line_to_supplier_on_cancel(line, bill, invoice, user, has_payments)
            else:
                bill.status = 'CANCELLED'
                bill.save(update_fields=['status', 'updated_at'])

        for la in line_actions:
            if la.get('action') != 'go_to_inventory':
                continue
            try:
                line = invoice.lines.get(
                    _id=la['source_line_id'],
                    is_deleted=False,
                    is_manual_entry=True,
                )
            except CustomerInvoiceLine.DoesNotExist:
                continue

            disp = stock_disp_map.get(str(line._id), {})
            try:
                product_qty, damage_qty, damage_reason = parse_stock_disposition(
                    disp, line.quantity,
                )
            except DispositionValidationError as e:
                raise ValueError(str(e))

            go_to_product_for_manual_line(
                line,
                line.quantity,
                user,
                source_document_type='CUSTOMER_INVOICE_CANCELLATION',
                source_document_id=invoice._id,
                source_line_id=line._id,
                product_qty=product_qty,
                damage_qty=damage_qty,
                damage_reason=damage_reason,
                stock_reason='Stock added from invoice cancellation (go to product)',
                damage_reason_prefix='Invoice cancellation damage',
            )

        if invoice.journal_entry_id:
            reverse_journal_entry(invoice.journal_entry, user, f'Invoice {invoice.invoice_number} cancelled')

        invoice.lines.filter(is_deleted=False).update(
            status='CANCELLED',
            updated_by=user,
        )

        from django.utils import timezone
        invoice.status = 'CANCELLED'
        invoice.cancelled_by = user
        invoice.cancelled_at = timezone.now()
        cancel_notes = f'Cancelled by {user.username}'
        if reason:
            cancel_notes += f': {reason}'
        if invoice.notes:
            invoice.notes = f'{invoice.notes}\n\n{cancel_notes}'
        else:
            invoice.notes = cancel_notes
        invoice.save(update_fields=['status', 'notes', 'updated_at', 'cancelled_by', 'cancelled_at'])

    return True, 'Invoice cancelled successfully'


def _reverse_invoice_stock_with_dispositions(invoice, user, stock_disp_map, line_action_map):
    """Reverse stock deductions for variant lines with product/damage qty split."""
    from apps.inventory.models import InventoryTransaction, StockItem
    import uuid

    transactions = InventoryTransaction.objects.filter(
        source_document_id=invoice._id,
        source_document_type='CUSTOMER_INVOICE',
        company_id=invoice.company_id,
    ).select_related('variant', 'warehouse')

    transactions_by_line = {}
    for txn in transactions:
        line_id = str(txn.source_line_id) if txn.source_line_id else 'unknown'
        transactions_by_line.setdefault(line_id, []).append(txn)

    active_lines = {
        str(line._id): line
        for line in invoice.lines.filter(is_deleted=False).select_related('variant')
    }

    for line_id, txns in transactions_by_line.items():
        line = active_lines.get(line_id)
        if not line or line.is_manual_entry:
            continue

        if line_action_map.get(line_id) == 'go_to_inventory':
            continue

        # Use current invoice line qty — not the sum of every historical SALE txn.
        # After edit (e.g. 10 → 5) old -10 and new -5 would incorrectly total 15.
        restorable_qty = line.quantity
        if restorable_qty <= 0:
            continue

        disp = stock_disp_map.get(line_id, {})
        product_qty, damage_qty, damage_reason = parse_stock_disposition(disp, restorable_qty)

        net_by_key = {}
        for txn in txns:
            key = (txn.variant_id, txn.warehouse_id, txn.branch_id)
            net_by_key.setdefault(key, {
                'variant': txn.variant,
                'warehouse': txn.warehouse,
                'branch_id': txn.branch_id,
                'net_qty': 0,
                'unit_cost': txn.unit_cost,
            })
            net_by_key[key]['net_qty'] += txn.quantity_change

        remaining_damage = damage_qty

        for data in net_by_key.values():
            net_qty = data['net_qty']
            if net_qty >= 0:
                continue

            qty_to_handle = abs(net_qty)
            variant = data['variant']
            wh = data['warehouse']
            branch_id = data['branch_id'] or invoice.branch_id

            stock, _ = StockItem.objects.select_for_update().get_or_create(
                variant=variant,
                warehouse=wh,
                company_id=invoice.company_id,
                defaults={
                    'quantity_on_hand': 0,
                    'quantity_reserved': 0,
                    'branch_id': branch_id,
                },
            )

            before = stock.quantity_on_hand
            after = before + qty_to_handle
            stock.quantity_on_hand = after
            stock.version = F('version') + 1
            stock.save(update_fields=['quantity_on_hand', 'version'])

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=wh,
                company_id=invoice.company_id,
                branch_id=branch_id,
                quantity_change=qty_to_handle,
                quantity_before=before,
                quantity_after=after,
                unit_cost=data['unit_cost'],
                transaction_type='ADJUSTMENT',
                source_document_type='CUSTOMER_INVOICE_REVERSAL',
                source_document_id=invoice._id,
                source_line_id=line._id,
                reason_text='Invoice cancelled – stock fully restored',
                created_by=user,
                updated_by=user,
            )

            dmg_qty = min(remaining_damage, qty_to_handle)
            if dmg_qty > 0:
                before = stock.quantity_on_hand
                after = before - dmg_qty
                stock.quantity_on_hand = after
                stock.version = F('version') + 1
                stock.save(update_fields=['quantity_on_hand', 'version'])

                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=wh,
                    company_id=invoice.company_id,
                    branch_id=branch_id,
                    quantity_change=-dmg_qty,
                    quantity_before=before,
                    quantity_after=after,
                    unit_cost=data['unit_cost'],
                    transaction_type='DAMAGE',
                    source_document_type='CUSTOMER_INVOICE_CANCELLATION',
                    source_document_id=invoice._id,
                    source_line_id=line._id,
                    reason_text=f'Invoice {invoice.invoice_number} cancellation damage: {damage_reason}',
                    created_by=user,
                    updated_by=user,
                )
                remaining_damage -= dmg_qty

    if not transactions_by_line:
        from apps.inventory.services.stock_service import direct_release_stock
        direct_release_stock(invoice._id, invoice.company_id, user)


def reverse_journal_entry(journal_entry, user, reason=''):
    """Create a reversing journal entry that swaps debit/credit."""
    from apps.finance.models import JournalEntry, JournalLine
    import time

    if not journal_entry or not journal_entry.is_posted:
        return

    original_lines = JournalLine.objects.filter(
        journal_entry=journal_entry,
        is_deleted=False,
    )

    base_number = f'REV-{journal_entry.entry_number}'
    entry_number = base_number
    # Ensure unique entry_number by appending a counter if needed
    counter = 1
    while JournalEntry.objects.filter(entry_number=entry_number).exists():
        entry_number = f'{base_number}-{counter}'
        counter += 1

    entry = JournalEntry.objects.create(
        entry_number=entry_number,
        date=journal_entry.date,
        description=f'Reversal of {journal_entry.entry_number}: {reason}',
        reference_type=journal_entry.reference_type,
        reference_id=journal_entry.reference_id,
        company_id=journal_entry.company_id,
        branch_id=journal_entry.branch_id,
        created_by=user,
        is_posted=True,
    )

    for line in original_lines:
        JournalLine.objects.create(
            journal_entry=entry,
            account=line.account,
            debit=line.credit,
            credit=line.debit,
            company_id=line.company_id,
            branch_id=line.branch_id,
        )


def refund_invoice_payments(invoice, user):
    """Cancel all confirmed payments for an invoice, reverse their effects."""
    from apps.finance.models import Payment, BankTransaction
    from django.contrib.contenttypes.models import ContentType
    from django.utils import timezone

    confirmed = get_payments_queryset(invoice, status='CONFIRMED')
    if not confirmed.exists():
        return False, 'No confirmed payments to refund'

    total_refunded = Decimal('0')

    with transaction.atomic():
        for payment in confirmed.select_related('bank_account', 'journal_entry'):
            if payment.journal_entry_id:
                reverse_journal_entry(
                    payment.journal_entry, user,
                    f'Refund for invoice {invoice.invoice_number}',
                )

            if payment.bank_account_id:
                bank_txn = BankTransaction.objects.filter(
                    bank_account=payment.bank_account,
                    amount=payment.amount,
                    transaction_date=payment.payment_date,
                    is_deleted=False,
                ).first()
                if bank_txn:
                    bank_txn.is_deleted = True
                    bank_txn.save(update_fields=['is_deleted', 'updated_at'])

                if payment.payment_type == 'RECEIPT':
                    payment.bank_account.book_balance = F('book_balance') - payment.amount
                else:
                    payment.bank_account.book_balance = F('book_balance') + payment.amount
                payment.bank_account.save(update_fields=['book_balance'])

            payment.is_deleted = True
            payment.deleted_by = user
            payment.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])
            total_refunded += payment.amount

        ct = ContentType.objects.get_for_model(invoice.__class__, for_concrete_model=False)
        Payment.objects.create(
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            content_type=ct,
            object_id=invoice.pk,
            payment_type='PAYMENT',
            payment_method='BANK_TRANSFER',
            amount=total_refunded,
            payment_date=timezone.now().date(),
            reference_number=f'REFUND-{invoice.invoice_number}',
            status='CONFIRMED',
            notes=f'Refund for cancelled invoice {invoice.invoice_number}',
            created_by=user,
            updated_by=user,
        )

    return True, f'Refunded {total_refunded} from {confirmed.count()} payment(s)'
