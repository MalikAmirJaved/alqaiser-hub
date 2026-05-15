# apps/inventory/signals.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from apps.notifications.models import Notification
from .models import Category, Brand, Warehouse, Supplier, Product, ProductVariant, StockItem, InventoryTransaction, StockTransfer

# Helper to create notification
def create_notification(company_id, branch_id, title, message, notif_type='info'):
    if company_id and branch_id:  # Only create if we have valid IDs
        Notification.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            title=title,
            message=message,
            notification_type=notif_type
        )

# Broadcast real-time data update (for cache invalidation)
def broadcast_data_update(company_id, branch_id, entity, action=None, record_id=None):
    """Send a data_update message to the company/branch WebSocket group."""
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

# Category signals
@receiver(post_save, sender=Category)
def notify_category_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    
    if created:
        # Create notification
        create_notification(
            company_id, branch_id,
            "New Category Created",
            f"Category '{instance.name}' ({instance.code}) has been created.",
            "success"
        )
    else:
        # Create notification for update
        create_notification(
            company_id, branch_id,
            "Category Updated",
            f"Category '{instance.name}' ({instance.code}) has been updated.",
            "info"
        )
    
    # Broadcast data update for real-time cache invalidation
    action = 'create' if created else 'update'
    broadcast_data_update(company_id, branch_id, 'inventory_category', action, instance.id)

@receiver(post_delete, sender=Category)
def notify_category_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    
    # Create notification
    create_notification(
        company_id, branch_id,
        "Category Deleted",
        f"Category '{instance.name}' ({instance.code}) has been deleted.",
        "warning"
    )
    
    # Broadcast data update for real-time cache invalidation
    broadcast_data_update(company_id, branch_id, 'inventory_category', 'delete', instance.id)


@receiver(post_save, sender=Brand)
def notify_brand_change(sender, instance, created, **kwargs):
    """Create notification when brand is created or updated"""
    company_id = instance.company_id
    branch_id = instance.branch_id
    
    if created:
        # Create notification for new brand
        Notification.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            title="New Brand Added",
            message=f"Brand '{instance.name}' ({instance.code}) has been added to the inventory.",
            notification_type="success",
            user=None
        )
    else:
        # Create notification for brand update
        Notification.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            title="Brand Updated",
            message=f"Brand '{instance.name}' ({instance.code}) details have been updated.",
            notification_type="info",
            user=None
        )
    
    # Broadcast data update for real-time cache invalidation
    action = 'create' if created else 'update'
    broadcast_data_update(company_id, branch_id, 'inventory_brand', action, instance.id)

@receiver(post_delete, sender=Brand)
def notify_brand_delete(sender, instance, **kwargs):
    """Create notification when brand is deleted"""
    company_id = instance.company_id
    branch_id = instance.branch_id
    
    Notification.objects.create(
        company_id=company_id,
        branch_id=branch_id,
        title="Brand Deleted",
        message=f"Brand '{instance.name}' ({instance.code}) has been removed from inventory.",
        notification_type="warning",
        user=None
    )
    
    # Broadcast data update for real-time cache invalidation
    broadcast_data_update(company_id, branch_id, 'inventory_brand', 'delete', instance.id)

@receiver(post_save, sender=Warehouse)
def notify_warehouse_change(sender, instance, created, **kwargs):
    """Create notification when warehouse is created or updated"""
    company_id = instance.company_id
    branch_id = instance.branch_id
    
    if created:
        # Create notification for new warehouse
        create_notification(
            company_id, branch_id,
            "New Warehouse Added",
            f"Warehouse '{instance.warehouse_name}' ({instance.code}) has been added.",
            "success"
        )
    else:
        # Create notification for warehouse update
        create_notification(
            company_id, branch_id,
            "Warehouse Updated",
            f"Warehouse '{instance.warehouse_name}' ({instance.code}) details have been updated.",
            "info"
        )
    
    # Broadcast data update for real-time cache invalidation
    action = 'create' if created else 'update'
    broadcast_data_update(company_id, branch_id, 'inventory_warehouse', action, instance.id)

@receiver(post_delete, sender=Warehouse)
def notify_warehouse_delete(sender, instance, **kwargs):
    """Create notification when warehouse is deleted"""
    company_id = instance.company_id
    branch_id = instance.branch_id
    
    create_notification(
        company_id, branch_id,
        "Warehouse Deleted",
        f"Warehouse '{instance.warehouse_name}' ({instance.code}) has been removed.",
        "warning"
    )
    
    # Broadcast data update for real-time cache invalidation
    broadcast_data_update(company_id, branch_id, 'inventory_warehouse', 'delete', instance.id)


@receiver(post_save, sender=Supplier)
def notify_supplier_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    action = 'create' if created else 'update'
    partner_type = instance.get_partner_type_display()
    create_notification(
        company_id, branch_id,
        f"{partner_type} {action}d",
        f"{partner_type} '{instance.name}' ({instance.code}) has been {action}d.",
        "success" if created else "info"
    )
    broadcast_data_update(company_id, branch_id, f'{instance.partner_type}', action, instance.id)

@receiver(post_delete, sender=Supplier)
def notify_supplier_delete(sender, instance, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    partner_type = instance.get_partner_type_display()
    create_notification(
        company_id, branch_id,
        f"{partner_type} Deleted",
        f"{partner_type} '{instance.name}' ({instance.code}) has been deleted.",
        "warning"
    )
    broadcast_data_update(company_id, branch_id, f'{instance.partner_type}', 'delete', instance.id)


@receiver(post_save, sender=Product)
def notify_product_change(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    create_notification(
        instance.company_id, instance.branch_id,
        f"Product {action}d",
        f"Product '{instance.product_name}' has been {action}d.",
        "success" if created else "info"
    )
    broadcast_data_update(instance.company_id, instance.branch_id, 'product', action, instance.id)

@receiver(post_delete, sender=Product)
def notify_product_delete(sender, instance, **kwargs):
    create_notification(
        instance.company_id, instance.branch_id,
        "Product Deleted",
        f"Product '{instance.product_name}' has been deleted.",
        "warning"
    )
    broadcast_data_update(instance.company_id, instance.branch_id, 'product', 'delete', instance.id)

@receiver(post_save, sender=ProductVariant)
def notify_variant_change(sender, instance, created, **kwargs):
    action = 'create' if created else 'update'
    create_notification(
        instance.company_id, instance.branch_id,
        f"Variant {action}d",
        f"Variant '{instance.sku}' of product '{instance.product.product_name}' has been {action}d.",
        "info"
    )
    broadcast_data_update(instance.company_id, instance.branch_id, 'variant', action, instance.id)

@receiver(post_save, sender=StockItem)
def check_low_stock(sender, instance, **kwargs):
    """Send alert if stock falls below reorder point."""
    variant = instance.variant
    if instance.quantity_on_hand <= variant.min_stock_level:
        create_notification(
            instance.company_id, instance.branch_id,
            "Low Stock Alert",
            f"Variant '{variant.sku}' has only {instance.quantity_on_hand} units left (min: {variant.min_stock_level}).",
            "warning"
        )
        broadcast_data_update(instance.company_id, instance.branch_id, 'low_stock', 'alert', variant.id)

@receiver(post_save, sender=InventoryTransaction)
def log_transaction_notification(sender, instance, created, **kwargs):
    if created:
        # Optionally send notification for significant stock changes (e.g., >100 units)
        if abs(instance.quantity_change) > 100:
            create_notification(
                instance.company_id, None,  # branch unknown, maybe store in transaction
                "Bulk Stock Movement",
                f"{instance.get_transaction_type_display()}: {abs(instance.quantity_change)} units of {instance.variant.sku}",
                "info"
            )

@receiver(post_save, sender=StockTransfer)
def notify_transfer_change(sender, instance, created, **kwargs):
    action = 'created' if created else 'updated'
    create_notification(
        instance.company_id, instance.branch_id,
        f"Stock Transfer {action}",
        f"Transfer {instance.transfer_number} has been {action}. Status: {instance.status}",
        "info"
    )
    broadcast_data_update(instance.company_id, instance.branch_id, 'stock_transfer', action, instance.id)