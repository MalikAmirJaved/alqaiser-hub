from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    AccountViewSet,
    JournalEntryViewSet,
    SupplierBillViewSet,
    CustomerInvoiceViewSet,
    PaymentViewSet,
    BankAccountViewSet,
    BankTransactionViewSet,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet)
router.register(r'journal-entries', JournalEntryViewSet)
router.register(r'supplier-bills', SupplierBillViewSet)
router.register(r'customer-invoices', CustomerInvoiceViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'bank-accounts', BankAccountViewSet)
router.register(r'bank-transactions', BankTransactionViewSet)

urlpatterns = [
    path('', include(router.urls)),
]