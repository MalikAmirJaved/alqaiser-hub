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


# Payment balance updates are handled explicitly during confirmation.