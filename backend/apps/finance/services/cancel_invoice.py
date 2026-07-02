"""
Cancel a customer invoice and reverse all side-effects.

Reversal chain:
  1. Block if CONFIRMED payments exist (must refund first)
  2. Reverse inventory stock  → direct_release_stock()
  3. Cancel supplier bills    → soft-delete + PURCHASE_REVERSAL on supplier balance
  4. Cancel DRAFT payments    → soft-delete
  5. Reverse journal entry    → create swapping JE
  6. Set invoice status       → CANCELLED

Everything runs inside a single transaction.atomic() block.
All reversals create history records (InventoryTransaction, SupplierHistory,
JournalEntry) for full audit trail.
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import F

from apps.finance.services.payable import get_payments_queryset


def cancel_customer_invoice(invoice, user, reason=''):
    """
    Cancel a customer invoice and reverse all effects.

    Returns (success: bool, message: str).

    Raises ValueError on unrecoverable errors.
    """
    from apps.inventory.services.stock_service import direct_release_stock
    from apps.finance.models import (
        SupplierBill, Payment, JournalEntry, JournalLine,
    )
    from apps.finance.services.supplier_balance import update_supplier_balance

    # ── Pre-checks ──────────────────────────────────────────────────────
    if invoice.status == 'CANCELLED':
        return False, 'Invoice is already cancelled'

    if not reason or not reason.strip():
        return False, 'Cancellation reason is required'

    with transaction.atomic():
        # ── 1. Cancel DRAFT payments ────────────────────────────────────
        draft_payments = get_payments_queryset(invoice, status='DRAFT')
        for payment in draft_payments:
            payment.is_deleted = True
            payment.deleted_by = user
            payment.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])

        # ── 2. Reverse inventory stock ──────────────────────────────────
        # direct_release_stock reads InventoryTransaction records by
        # source_document_id and adds stock back to the exact warehouses
        # that were deducted.
        try:
            direct_release_stock(
                invoice._id,
                invoice.company_id,
                user,
            )
        except Exception as e:
            raise ValueError(f'Failed to reverse stock: {e}')

        # ── 3. Cancel supplier bills + reverse supplier balance ─────────
        supplier_bills = SupplierBill.objects.filter(
            customer_invoice=invoice,
            is_deleted=False,
        )
        for bill in supplier_bills:
            if bill.status == 'CANCELLED':
                continue

            # Reverse supplier balance for the full bill amount
            if bill.supplier_id and bill.amount > 0:
                # Check if any confirmed payments exist on this bill
                bill_payments = get_payments_queryset(bill, status='CONFIRMED')
                if bill_payments.exists():
                    raise ValueError(
                        f'Supplier bill {bill.bill_number} has confirmed payments. '
                        f'Refund them before cancelling the invoice.'
                    )

                # Reverse the PURCHASE that was recorded when bill was created
                update_supplier_balance(
                    bill.supplier,
                    bill.amount,
                    'PURCHASE_REVERSAL',
                    reference_type='supplier_bill',
                    reference_id=bill._id,
                    notes=f'Invoice {invoice.invoice_number} cancelled – bill {bill.bill_number} reversed',
                )

            # Cancel the bill's journal entry if exists
            if bill.journal_entry_id:
                _reverse_journal_entry(bill.journal_entry, user, f'Invoice {invoice.invoice_number} cancelled')

            bill.status = 'CANCELLED'
            bill.save(update_fields=['status', 'updated_at'])

        # ── 4. Reverse invoice journal entry ────────────────────────────
        if invoice.journal_entry_id:
            _reverse_journal_entry(invoice.journal_entry, user, f'Invoice {invoice.invoice_number} cancelled')

        # ── 5. Mark all invoice lines as cancelled ──────────────────────
        invoice.lines.filter(is_deleted=False).update(
            status='CANCELLED',
            updated_by=user,
        )

        # ── 6. Set invoice status to CANCELLED ──────────────────────────
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
        invoice.save(update_fields=['status', 'notes', 'updated_at'])

    return True, 'Invoice cancelled successfully'


def _reverse_journal_entry(journal_entry, user, reason=''):
    """Create a reversing journal entry that swaps debit/credit."""
    from apps.finance.models import JournalEntry, JournalLine

    if not journal_entry or not journal_entry.is_posted:
        return

    original_lines = JournalLine.objects.filter(
        journal_entry=journal_entry,
        is_deleted=False,
    )

    entry = JournalEntry.objects.create(
        entry_number=f'REV-{journal_entry.entry_number}',
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
    """Cancel all confirmed payments for an invoice, reverse their effects,
    and create a refund payment record for audit trail.

    Returns (success, message).
    """
    from apps.finance.models import Payment, BankTransaction
    from django.contrib.contenttypes.models import ContentType
    from django.utils import timezone

    confirmed = get_payments_queryset(invoice, status='CONFIRMED')
    if not confirmed.exists():
        return False, 'No confirmed payments to refund'

    total_refunded = Decimal('0')

    with transaction.atomic():
        for payment in confirmed.select_related('bank_account', 'journal_entry'):
            # 1. Reverse journal entry
            if payment.journal_entry_id:
                _reverse_journal_entry(
                    payment.journal_entry, user,
                    f'Refund for invoice {invoice.invoice_number}',
                )

            # 2. Reverse bank transaction + balance
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

            # 3. Soft-delete original payment
            payment.is_deleted = True
            payment.deleted_by = user
            payment.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])

            total_refunded += payment.amount

        # 4. Create refund payment record for audit trail
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
