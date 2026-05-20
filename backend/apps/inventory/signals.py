# apps/inventory/signals.py
import uuid as uuid_lib
import logging

from django.db.models.signals import post_save, post_delete, pre_save
from django.dispatch import receiver
from django.db import transaction
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from django.core.cache import cache

from apps.notifications.models import Notification
from .models import (
    Category, Brand, Warehouse, Supplier, Product, ProductVariant,
    StockItem, InventoryTransaction, StockTransfer, SalesOrder
)

logger = logging.getLogger(__name__)


# ----------------------------------------------------------------------
# Helper: create a database notification (important events only)
# ----------------------------------------------------------------------
def create_notification(company_id, branch_id, title, message, notif_type='info'):
    if company_id and branch_id:
        try:
            Notification.objects.create(
                company_id=company_id,
                branch_id=branch_id,
                title=title,
                message=message,
                notification_type=notif_type,
            )
        except Exception as e:
            logger.warning(f"Failed to create notification: {e}")


# ----------------------------------------------------------------------
# Helper: broadcast a data_update message over WebSocket
# ----------------------------------------------------------------------
def broadcast_data_update(company_id, branch_id, entity, action=None, record_id=None):
    if not company_id or not branch_id:
        return
    if record_id and isinstance(record_id, uuid_lib.UUID):
        record_id = str(record_id)
    channel_layer = get_channel_layer()
    group_name = f"notify_c{company_id}_b{branch_id}"
    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'data_update',
            'entity': entity,
            'action': action,
            'record_id': record_id,
        }
    )


# ----------------------------------------------------------------------
# Helper: invalidate variant caches
# ----------------------------------------------------------------------
def invalidate_variant_caches(company_id, branch_id, variant_id=None):
    cache_patterns = [
        f"variants_queryset_{company_id}_*",
        f"allVariantsSimple_*",
        f"batch_stock_{company_id}_*",
    ]
    for pattern in cache_patterns:
        cache.delete_pattern(pattern)
    transaction.on_commit(
        lambda: broadcast_data_update(company_id, branch_id, 'variant', 'update', variant_id)
    )
    transaction.on_commit(
        lambda: broadcast_data_update(company_id, branch_id, 'stock', 'update', None)
    )


# ======================================================================
# 1. Category signals
# ======================================================================
@receiver(post_save, sender=Category)
def notify_category_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    def do_notify():
        if created:
            create_notification(company_id, branch_id, "New Category Created",
                                f"Category '{instance.name}' ({instance.code}) has been created.", "success")
        else:
            create_notification(company_id, branch_id, "Category Updated",
                                f"Category '{instance.name}' ({instance.code}) has been updated.", "info")
        broadcast_data_update(company_id, branch_id, 'inventory_category', action, instance.id)
    transaction.on_commit(do_notify)

@receiver(post_delete, sender=Category)
def notify_category_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    def do_notify():
        create_notification(company_id, branch_id, "Category Deleted",
                            f"Category '{instance.name}' ({instance.code}) has been deleted.", "warning")
        broadcast_data_update(company_id, branch_id, 'inventory_category', 'delete', instance.id)
    transaction.on_commit(do_notify)


# ======================================================================
# 2. Brand signals
# ======================================================================
@receiver(post_save, sender=Brand)
def notify_brand_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    def do_notify():
        if created:
            create_notification(company_id, branch_id, "New Brand Added",
                                f"Brand '{instance.name}' ({instance.code}) has been added.", "success")
        else:
            create_notification(company_id, branch_id, "Brand Updated",
                                f"Brand '{instance.name}' ({instance.code}) details have been updated.", "info")
        broadcast_data_update(company_id, branch_id, 'inventory_brand', action, instance.id)
    transaction.on_commit(do_notify)

@receiver(post_delete, sender=Brand)
def notify_brand_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    def do_notify():
        create_notification(company_id, branch_id, "Brand Deleted",
                            f"Brand '{instance.name}' ({instance.code}) has been removed.", "warning")
        broadcast_data_update(company_id, branch_id, 'inventory_brand', 'delete', instance.id)
    transaction.on_commit(do_notify)


# ======================================================================
# 3. Warehouse signals
# ======================================================================
@receiver(post_save, sender=Warehouse)
def notify_warehouse_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    def do_notify():
        if created:
            create_notification(company_id, branch_id, "New Warehouse Added",
                                f"Warehouse '{instance.warehouse_name}' ({instance.code}) has been added.", "success")
        else:
            create_notification(company_id, branch_id, "Warehouse Updated",
                                f"Warehouse '{instance.warehouse_name}' ({instance.code}) details have been updated.", "info")
        broadcast_data_update(company_id, branch_id, 'inventory_warehouse', action, instance.id)
    transaction.on_commit(do_notify)

@receiver(post_delete, sender=Warehouse)
def notify_warehouse_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    def do_notify():
        create_notification(company_id, branch_id, "Warehouse Deleted",
                            f"Warehouse '{instance.warehouse_name}' ({instance.code}) has been removed.", "warning")
        broadcast_data_update(company_id, branch_id, 'inventory_warehouse', 'delete', instance.id)
    transaction.on_commit(do_notify)


# ======================================================================
# 4. Supplier/Vendor signals
# ======================================================================
@receiver(post_save, sender=Supplier)
def notify_supplier_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    partner_type = instance.get_partner_type_display()
    entity = instance.partner_type
    def do_notify():
        create_notification(company_id, branch_id, f"{partner_type} {action}d",
                            f"{partner_type} '{instance.name}' ({instance.code}) has been {action}d.",
                            "success" if created else "info")
        broadcast_data_update(company_id, branch_id, entity, action, instance.id)
    transaction.on_commit(do_notify)

@receiver(post_delete, sender=Supplier)
def notify_supplier_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    partner_type = instance.get_partner_type_display()
    entity = instance.partner_type
    def do_notify():
        create_notification(company_id, branch_id, f"{partner_type} Deleted",
                            f"{partner_type} '{instance.name}' ({instance.code}) has been deleted.", "warning")
        broadcast_data_update(company_id, branch_id, entity, 'delete', instance.id)
    transaction.on_commit(do_notify)


# ======================================================================
# 5. Product signals
# ======================================================================
@receiver(post_save, sender=Product)
def notify_product_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    def do_notify():
        create_notification(company_id, branch_id, f"Product {action}d",
                            f"Product '{instance.product_name}' has been {action}d.",
                            "success" if created else "info")
        broadcast_data_update(company_id, branch_id, 'product', action, instance.id)
    transaction.on_commit(do_notify)

@receiver(post_delete, sender=Product)
def notify_product_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    def do_notify():
        create_notification(company_id, branch_id, "Product Deleted",
                            f"Product '{instance.product_name}' has been deleted.", "warning")
        broadcast_data_update(company_id, branch_id, 'product', 'delete', instance.id)
    transaction.on_commit(do_notify)


# ======================================================================
# 6. ProductVariant signals
# ======================================================================
@receiver(post_save, sender=ProductVariant)
def notify_variant_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    def do_notify():
        create_notification(company_id, branch_id, f"Variant {action}d",
                            f"Variant '{instance.sku}' of product '{instance.product.product_name}' has been {action}d.",
                            "info")
        broadcast_data_update(company_id, branch_id, 'variant', action, instance.id)
    transaction.on_commit(do_notify)


# ======================================================================
# 7. StockItem signals
# ======================================================================
@receiver(pre_save, sender=StockItem)
def stock_item_pre_save(sender, instance, **kwargs):
    if instance.pk:
        try:
            old = sender.objects.get(pk=instance.pk)
            instance._quantity_change = instance.quantity_on_hand - old.quantity_on_hand
        except sender.DoesNotExist:
            instance._quantity_change = instance.quantity_on_hand
    else:
        instance._quantity_change = instance.quantity_on_hand

@receiver(post_save, sender=StockItem)
def stock_item_post_save(sender, instance, created, **kwargs):
    quantity_change = getattr(instance, '_quantity_change', 0)
    if quantity_change != 0:
        def do_notify():
            cache.delete_pattern(f"batch_stock_{instance.company_id}_*_{instance.variant._id}_*")
            broadcast_data_update(instance.company_id, instance.branch_id, 'stock', 'update', instance.variant._id)
            if instance.quantity_on_hand <= instance.variant.min_stock_level:
                if not getattr(instance, '_low_stock_notified', False):
                    create_notification(instance.company_id, instance.branch_id, "Low Stock Alert",
                                        f"Variant '{instance.variant.sku}' has only {instance.quantity_on_hand} units left (min: {instance.variant.min_stock_level}).",
                                        "warning")
                    instance._low_stock_notified = True
        transaction.on_commit(do_notify)


# ======================================================================
# 8. InventoryTransaction signals
# ======================================================================
@receiver(post_save, sender=InventoryTransaction)
def log_transaction_notification(sender, instance, created, **kwargs):
    if created and abs(instance.quantity_change) > 100:
        def do_notify():
            create_notification(instance.company_id, None, "Bulk Stock Movement",
                                f"{instance.get_transaction_type_display()}: {abs(instance.quantity_change)} units of {instance.variant.sku}",
                                "info")
        transaction.on_commit(do_notify)


# ======================================================================
# 9. StockTransfer signals
# ======================================================================
@receiver(post_save, sender=StockTransfer)
def notify_transfer_change(sender, instance, created, **kwargs):
    action = 'created' if created else 'updated'
    def do_notify():
        create_notification(instance.company_id, instance.branch_id, f"Stock Transfer {action}",
                            f"Transfer {instance.transfer_number} has been {action}. Status: {instance.status}",
                            "info")
        broadcast_data_update(instance.company_id, instance.branch_id, 'stock_transfer', action, instance.id)
        if instance.status == 'COMPLETED':
            broadcast_data_update(instance.company_id, instance.branch_id, 'stock', 'transfer', instance.variant._id)
    transaction.on_commit(do_notify)


# ======================================================================
# 10. SalesOrder signals (FIXED: now broadcasts stock on DRAFT/CANCEL)
# ======================================================================
@receiver(pre_save, sender=SalesOrder)
def sales_order_pre_save(sender, instance, **kwargs):
    """Store old status before saving."""
    if instance.pk:
        try:
            old_order = SalesOrder.objects.get(pk=instance.pk)
            instance._old_status = old_order.status
        except SalesOrder.DoesNotExist:
            instance._old_status = None
    else:
        instance._old_status = None

@receiver(post_save, sender=SalesOrder)
def sales_order_post_save(sender, instance, created, **kwargs):
    """
    Notify frontend about sales order changes.
    Refresh stock queries when reservations are created or released.
    """
    def do_notify():
        # Always refresh sales orders list
        broadcast_data_update(instance.company_id, instance.branch_id, 'sales_order', 
                              'draft' if created and instance.status == 'DRAFT' else 'update', 
                              instance._id)

        old_status = getattr(instance, '_old_status', None)

        # Refresh stock in these cases:
        # 1) New DRAFT order → reservations created
        # 2) DRAFT → CANCELLED → reservations released
        # 3) DRAFT → COMPLETE → stock deducted
        # 4) Any status change to COMPLETE
        if (created and instance.status == 'DRAFT') or \
           (old_status == 'DRAFT' and instance.status == 'CANCELLED') or \
           (old_status == 'DRAFT' and instance.status == 'COMPLETE') or \
           (instance.status == 'COMPLETE'):
            broadcast_data_update(instance.company_id, instance.branch_id, 'stock', 'update', None)

        # Additional for completed orders
        if instance.status == 'COMPLETE':
            broadcast_data_update(instance.company_id, instance.branch_id, 'sales_order', 'complete', instance._id)

    # Execute immediately (not just on_commit) to ensure broadcast for cancel
    # But still wrap the notification and other DB writes in on_commit
    if instance.status == 'CANCELLED' and getattr(instance, '_old_status', None) == 'DRAFT':
        # Immediate broadcast for stock update on cancel (bypass on_commit)
        broadcast_data_update(instance.company_id, instance.branch_id, 'stock', 'update', None)
    transaction.on_commit(do_notify)


# ======================================================================
# 11. Cache invalidation for products & variants
# ======================================================================
@receiver(post_save, sender=Product)
def product_post_save_cache_invalidation(sender, instance, created, **kwargs):
    def do_invalidate():
        invalidate_variant_caches(instance.company_id, instance.branch_id)
        if not created:
            broadcast_data_update(instance.company_id, instance.branch_id, 'product', 'update', instance._id)
    transaction.on_commit(do_invalidate)

@receiver(post_delete, sender=Product)
def product_post_delete_cache_invalidation(sender, instance, **kwargs):
    def do_invalidate():
        invalidate_variant_caches(instance.company_id, instance.branch_id)
        broadcast_data_update(instance.company_id, instance.branch_id, 'product', 'delete', instance._id)
    transaction.on_commit(do_invalidate)

@receiver(post_save, sender=ProductVariant)
def variant_post_save_cache_invalidation(sender, instance, created, **kwargs):
    def do_invalidate():
        invalidate_variant_caches(instance.company_id, instance.branch_id, instance._id)
    transaction.on_commit(do_invalidate)