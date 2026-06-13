# apps/inventory/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, BrandViewSet, WarehouseViewSet,ProductViewSet, TagViewSet,InventoryViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='inventory-category')
router.register(r'brands', BrandViewSet, basename='inventory-brand')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')
router.register(r'products', ProductViewSet, basename='product')
router.register(r'tags', TagViewSet,basename='tag')
router.register(r'inventory', InventoryViewSet,basename='inventory')

urlpatterns = [
    path('', include(router.urls)),
]