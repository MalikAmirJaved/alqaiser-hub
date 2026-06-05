from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import LeadViewSet, QuoteViewSet, SalesInvoiceViewSet

router = DefaultRouter()
router.register(r'leads', LeadViewSet)
router.register(r'quotes', QuoteViewSet)
router.register(r'invoices', SalesInvoiceViewSet)

urlpatterns = [
    path('', include(router.urls)),
]
