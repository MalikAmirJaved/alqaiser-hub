from .category import CategoryViewSet
from .brand import BrandViewSet
from .warehouse import WarehouseViewSet
from .product import ProductViewSet
from .supplier import BaseSupplierViewSet, SupplierViewSet, VendorViewSet
from .stock_management import StockManagementViewSet
from .transfer import StockTransferViewSet
from .purchase import PurchaseOrderViewSet, GoodsReceiptViewSet
from .variant import VariantViewSet
from .sales import (
    CustomerViewSet, SalesOrderViewSet,
    SalesShipmentViewSet, SalesReturnViewSet,
)
__all__ = [
    "CategoryViewSet", "BrandViewSet", "WarehouseViewSet",
    "BaseSupplierViewSet", "SupplierViewSet","VendorViewSet","ProductViewSet","StockManagementViewSet",
    "StockTransferViewSet","PurchaseOrderViewSet", "GoodsReceiptViewSet",
     "CustomerViewSet", "SalesOrderViewSet",
    "SalesShipmentViewSet", "SalesReturnViewSet","VariantViewSet"
]