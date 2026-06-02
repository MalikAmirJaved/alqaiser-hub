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
    ReportViewSet,
    ExpenseViewSet,
    BudgetViewSet,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet)
router.register(r'journal-entries', JournalEntryViewSet)
router.register(r'supplier-bills', SupplierBillViewSet)
router.register(r'customer-invoices', CustomerInvoiceViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'bank-accounts', BankAccountViewSet)
router.register(r'bank-transactions', BankTransactionViewSet)
router.register(r'reports', ReportViewSet, basename='finance-reports')  
router.register(r'expenses', ExpenseViewSet)  
router.register(r'budgets', BudgetViewSet)

urlpatterns = [
    path('', include(router.urls)),
]