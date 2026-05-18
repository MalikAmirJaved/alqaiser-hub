from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CategoryViewSet, BrandViewSet, WarehouseViewSet,
    ProductViewSet,SupplierViewSet,VendorViewSet,StockManagementViewSet,StockTransferViewSet,PurchaseOrderViewSet, GoodsReceiptViewSet,
    CustomerViewSet,SalesOrderViewSet,SalesShipmentViewSet,SalesReturnViewSet,VariantViewSet
)
router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='inventory-category')
router.register(r'brands', BrandViewSet, basename='inventory-brand')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'suppliers', SupplierViewSet, basename='supplier')
router.register(r'vendors', VendorViewSet, basename='vendor')
router.register(r'stock', StockManagementViewSet, basename='stock-management') 
router.register(r'transfers', StockTransferViewSet, basename='stock-transfer')
router.register(r'purchase-orders', PurchaseOrderViewSet, basename='purchase-order')
router.register(r'goods-receipts', GoodsReceiptViewSet, basename='goods-receipt')
router.register(r'customers', CustomerViewSet, basename='customer')
router.register(r'sales-orders', SalesOrderViewSet, basename='sales-order')
router.register(r'shipments', SalesShipmentViewSet, basename='sales-shipment')
router.register(r'returns', SalesReturnViewSet, basename='sales-return')
router.register(r'variants', VariantViewSet, basename='variant')


urlpatterns = [
    path('', include(router.urls)),
]