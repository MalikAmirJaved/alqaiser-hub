from django.apps import AppConfig
from apps.notifications.registry import register_websocket_model

class InventoryConfig(AppConfig):
    name = 'apps.inventory'

    def ready(self):
        from .models import (
            Category, Brand, Warehouse, Supplier, Product, ProductVariant,
            StockItem, StockTransfer, SalesOrder,Supplier,PurchaseOrder
        )
        register_websocket_model(Category, 'inventory_category')
        register_websocket_model(Brand, 'inventory_brand')
        register_websocket_model(Warehouse, 'inventory_warehouse')
        register_websocket_model(Supplier, 'inventory_supplier')
        register_websocket_model(Product, 'inventory_product')
        register_websocket_model(ProductVariant, 'inventory_variant')
        register_websocket_model(StockItem, 'inventory_stock')
        register_websocket_model(StockTransfer, 'inventory_stock_transfer')
        register_websocket_model(SalesOrder, 'inventory_sales_order')
        register_websocket_model(PurchaseOrder, 'inventory_purchase_order')
