from django.apps import AppConfig
from apps.notifications.registry import register_websocket_model

class HrConfig(AppConfig):
    name = 'apps.hr'
    verbose_name = 'HR Management'

    def ready(self):
        from .models import (
            Employee, LeaveRequest, ShiftTemplate, ShiftOverride, ShiftDateRangeAssignment,
            Asset, AssetCategory, EmployeeAssetAssignment, PayrollRecord,
            RecruitmentCandidate, ExitRecord, Policy, Compensation, EmployeeLoan
        )
        register_websocket_model(Employee, 'employees')
        register_websocket_model(LeaveRequest, 'leaves')
        register_websocket_model(ShiftTemplate, 'shiftTemplates')
        register_websocket_model(ShiftOverride, 'shiftOverrides')
        register_websocket_model(ShiftDateRangeAssignment, 'shiftDateRange')
        register_websocket_model(Asset, 'assets')
        register_websocket_model(AssetCategory, 'assetCategories')
        register_websocket_model(EmployeeAssetAssignment, 'employeeAssets')
        register_websocket_model(PayrollRecord, 'payroll')
        register_websocket_model(RecruitmentCandidate, 'recruitment')
        register_websocket_model(ExitRecord, 'exitRecords')
        register_websocket_model(Policy, 'policies')
        register_websocket_model(Compensation, 'compensations')
        register_websocket_model(EmployeeLoan, 'loans')