# apps/inventory/urls.py
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import CategoryViewSet, BrandViewSet, WarehouseViewSet

router = DefaultRouter()
router.register(r'categories', CategoryViewSet, basename='inventory-category')
router.register(r'brands', BrandViewSet, basename='inventory-brand')
router.register(r'warehouses', WarehouseViewSet, basename='warehouse')


urlpatterns = [
    path('', include(router.urls)),
]