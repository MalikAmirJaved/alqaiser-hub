# apps/finance/signals.py
from django.db.models.signals import post_save, pre_delete
from django.dispatch import receiver
from apps.notifications.registry import register_websocket_model
from apps.inventory.audit import log_change
from .models import Account, JournalEntry, SupplierBill, CustomerInvoice, Payment, BankTransaction
import logging

logger = logging.getLogger(__name__)

# Register WebSocket models
register_websocket_model(Account, 'finance_account')
register_websocket_model(JournalEntry, 'finance_journal_entry')
register_websocket_model(SupplierBill, 'finance_supplier_bill')
register_websocket_model(CustomerInvoice, 'finance_customer_invoice')
register_websocket_model(Payment, 'finance_payment')
register_websocket_model(BankTransaction, 'finance_bank_transaction')


@receiver(post_save, sender=Account)
@receiver(post_save, sender=JournalEntry)
@receiver(post_save, sender=SupplierBill)
@receiver(post_save, sender=CustomerInvoice)
@receiver(post_save, sender=Payment)
def finance_audit_post_save(sender, instance, created, **kwargs):
    user = instance.updated_by or instance.created_by
    if not user:
        return
    log_change(
        instance=instance,
        action='CREATE' if created else 'UPDATE',
        user_id=user.id,
        before_state=None if created else instance,
        after_state=instance,
        source_module='finance',
        company_id=instance.company_id,
        branch_id=instance.branch_id,
        request=None
    )


@receiver(pre_delete, sender=Account)
@receiver(pre_delete, sender=JournalEntry)
@receiver(pre_delete, sender=SupplierBill)
@receiver(pre_delete, sender=CustomerInvoice)
@receiver(pre_delete, sender=Payment)
def finance_audit_pre_delete(sender, instance, **kwargs):
    user = instance.updated_by or instance.created_by
    if not user:
        return
    log_change(
        instance=instance,
        action='DELETE',
        user_id=user.id,
        before_state=instance,
        after_state=None,
        source_module='finance',
        company_id=instance.company_id,
        branch_id=instance.branch_id,
        request=None
    )


# ============================================
# Auto-create Bank Transaction from Payment
# ============================================
@receiver(post_save, sender=Payment)
def create_bank_transaction_on_payment(sender, instance, created, **kwargs):
    """
    When a payment is created:
    1. Create a corresponding BankTransaction (pending)
    2. Update the bank account's BOOK balance immediately
    """
    if not created:
        return
    if not instance.bank_account:
        return

    try:
        if instance.payment_type == 'RECEIPT':
            bank_txn_type = 'DEPOSIT'
        else:
            bank_txn_type = 'WITHDRAWAL'

        # Create bank transaction (pending)
        bank_transaction = BankTransaction.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            bank_account=instance.bank_account,
            transaction_date=instance.payment_date,
            amount=instance.amount,
            transaction_type=bank_txn_type,
            description=f"{instance.get_payment_type_display()} - {instance.reference_number or 'Manual'}",
            reference=instance.reference_number or '',
            reconciled=False,
            created_by=instance.created_by,
            updated_by=instance.updated_by,
        )

        # Update BOOK balance immediately
        bank_account = instance.bank_account
        if bank_txn_type == 'DEPOSIT':
            bank_account.book_balance += instance.amount
        else:
            bank_account.book_balance -= instance.amount
        bank_account.save(update_fields=['book_balance'])

        logger.info(
            f"Auto-created BankTransaction {bank_transaction.id} for Payment {instance.id}. "
            f"Book balance updated to {bank_account.book_balance}, cleared balance unchanged."
        )

    except Exception as e:
        logger.error(f"Failed to create BankTransaction for Payment {instance.id}: {str(e)}", exc_info=True)