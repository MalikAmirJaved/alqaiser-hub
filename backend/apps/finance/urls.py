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
    FinanceDashboardViewSet,
)
from .views.payroll import (
    FinancePayrollView,
    FinancePayrollStatsView,
    FinancePayrollPreviewView,
    FinanceEmployeeLoanView,
    FinanceCompensationView,
)

router = DefaultRouter()
router.register(r'accounts', AccountViewSet)
router.register(r'journal-entries', JournalEntryViewSet)
router.register(r'supplier-bills', SupplierBillViewSet)
router.register(r'customer-invoices', CustomerInvoiceViewSet)
router.register(r'payments', PaymentViewSet)
router.register(r'bank-accounts', BankAccountViewSet)
# router.register(r'bank-transactions', BankTransactionViewSet)
router.register(r'reports', ReportViewSet, basename='finance-reports')  
router.register(r'expenses', ExpenseViewSet)  
router.register(r'budgets', BudgetViewSet)
router.register(r'dashboard', FinanceDashboardViewSet, basename='finance-dashboard')

urlpatterns = [
    path('payroll/', FinancePayrollView.as_view(), name='finance-payroll'),
    path('payroll/stats/', FinancePayrollStatsView.as_view(), name='finance-payroll-stats'),
    path('payroll/preview/', FinancePayrollPreviewView.as_view(), name='finance-payroll-preview'),
    path('payroll/loans/', FinanceEmployeeLoanView.as_view(), name='finance-payroll-loans'),
    path('payroll/compensations/', FinanceCompensationView.as_view(), name='finance-payroll-compensations'),
    path('', include(router.urls)),
]