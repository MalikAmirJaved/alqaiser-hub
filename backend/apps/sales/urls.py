from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet, QuoteViewSet, SalesInvoiceViewSet, SalesDashboardViewSet

router = DefaultRouter()
router.register(r'leads', LeadViewSet)
router.register(r'quotes', QuoteViewSet)
router.register(r'invoices', SalesInvoiceViewSet)
router.register(r'dashboard', SalesDashboardViewSet, basename='sales-dashboard')

urlpatterns = [
    path('', include(router.urls)),
]
