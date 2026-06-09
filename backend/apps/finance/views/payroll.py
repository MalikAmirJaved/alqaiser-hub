"""Finance module access to HR payroll (same logic, finance permissions)."""
from apps.hr.views.payroll_views import (
    CompensationView,
    EmployeeLoanView,
    PayrollPreviewView,
    PayrollStatsView,
    PayrollView,
)

__all__ = [
    'PayrollView',
    'PayrollStatsView',
    'PayrollPreviewView',
    'EmployeeLoanView',
    'CompensationView',
]


class FinancePayrollView(PayrollView):
    permission_module = 'FINANCE'
    permission_resource = 'payroll'


class FinancePayrollStatsView(PayrollStatsView):
    permission_module = 'FINANCE'
    permission_resource = 'payroll'


class FinancePayrollPreviewView(PayrollPreviewView):
    permission_module = 'FINANCE'
    permission_resource = 'payroll'


class FinanceEmployeeLoanView(EmployeeLoanView):
    permission_module = 'FINANCE'
    permission_resource = 'payroll'


class FinanceCompensationView(CompensationView):
    permission_module = 'FINANCE'
    permission_resource = 'payroll'
