from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.forms.models import model_to_dict
from .models import (
    Product, ProductVariant, StockItem, SalesOrder, PurchaseOrder,
    InventoryTransaction, StockTransfer, Category, Brand, Warehouse,
    Supplier, Customer
)
from .audit import log_change

# Store previous state for updates (pre_save)
_previous_state = {}


@receiver(pre_save)
def capture_previous_state(sender, instance, **kwargs):
    """Capture old state before update (only for audited models)."""
    if sender not in AUDIT_MODELS:
        return
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            _previous_state[(sender, instance.pk)] = model_to_dict(old)
        except sender.DoesNotExist:
            pass


@receiver(post_save)
def audit_create_update(sender, instance, created, **kwargs):
    """Audit create and update operations."""
    if sender not in AUDIT_MODELS:
        return
    
    key = (sender, instance.pk)
    old_state = _previous_state.pop(key, None)
    
    # Extract company_id and branch_id from instance
    company_id = getattr(instance, 'company_id', None)
    branch_id = getattr(instance, 'branch_id', None)
    
    if created:
        # CREATE operation
        log_change(
            instance,
            action='CREATE',
            after_state=instance,
            source_module='inventory',
            company_id=company_id,
            branch_id=branch_id,
        )
    else:
        # UPDATE operation
        if not old_state:
            return
        
        log_change(
            instance,
            action='UPDATE',
            before_state=old_state,
            after_state=instance,
            source_module='inventory',
            company_id=company_id,
            branch_id=branch_id,
        )


@receiver(post_delete)
def audit_delete(sender, instance, **kwargs):
    """Audit delete operations."""
    if sender not in AUDIT_MODELS:
        return
    
    # Extract company_id and branch_id from instance
    company_id = getattr(instance, 'company_id', None)
    branch_id = getattr(instance, 'branch_id', None)
    
    log_change(
        instance,
        action='DELETE',
        before_state=instance,
        after_state=None,
        source_module='inventory',
        company_id=company_id,
        branch_id=branch_id,
    )


# List of models to audit - add/remove as needed
AUDIT_MODELS = {
    Product,
    ProductVariant,
    StockItem,
    SalesOrder,
    PurchaseOrder,
    InventoryTransaction,
    StockTransfer,
    Category,
    Brand,
    Warehouse,
    Supplier,
    Customer,
}