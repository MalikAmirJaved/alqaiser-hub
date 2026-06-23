import django_filters
from django_filters import rest_framework as filters

from apps.hr.models import (
    Employee, LeaveRequest, PayrollRecord, EmployeeLoan,
    Compensation, Asset, AssetCategory, AssetPurchaseRequest,
    RecruitmentCandidate, ExitRecord, Policy,
)


class EmployeeFilter(filters.FilterSet):
    department = filters.UUIDFilter(field_name='department___id')
    designation = filters.UUIDFilter(field_name='designation___id')
    reporting_manager = filters.UUIDFilter(field_name='reporting_manager___id')
    default_shift = filters.UUIDFilter(field_name='default_shift___id')

    class Meta:
        model = Employee
        fields = {
            'employment_status': ['exact'],
            'employment_type': ['exact'],
            'gender': ['exact'],
            'work_location': ['exact'],
            'role': ['exact'],
            'joining_date': ['gte', 'lte'],
            'salary': ['gte', 'lte'],
            'city': ['exact', 'icontains'],
            'country': ['exact', 'icontains'],
        }


class LeaveRequestFilter(filters.FilterSet):
    employee = filters.UUIDFilter(field_name='employee___id')

    class Meta:
        model = LeaveRequest
        fields = {
            'leave_type': ['exact'],
            'status': ['exact'],
            'start_date': ['gte', 'lte'],
            'end_date': ['gte', 'lte'],
        }


class PayrollFilter(filters.FilterSet):
    employee = filters.UUIDFilter(field_name='employee___id')

    class Meta:
        model = PayrollRecord
        fields = {
            'month': ['exact'],
            'year': ['exact'],
            'is_cancelled': ['exact'],
            'transaction_type': ['exact'],
        }


class EmployeeLoanFilter(filters.FilterSet):
    employee = filters.UUIDFilter(field_name='employee___id')

    class Meta:
        model = EmployeeLoan
        fields = {
            'loan_type': ['exact'],
            'status': ['exact'],
            'approval': ['exact'],
            'frequency_type': ['exact'],
            'advance_for_month': ['exact'],
            'advance_for_year': ['exact'],
        }


class CompensationFilter(filters.FilterSet):
    employee = filters.UUIDFilter(field_name='employee___id')

    class Meta:
        model = Compensation
        fields = {
            'status': ['exact'],
            'frequency_type': ['exact'],
        }


class AssetFilter(filters.FilterSet):
    class Meta:
        model = Asset
        fields = {
            'name': ['exact', 'icontains'],
            'brand': ['exact', 'icontains'],
            'model': ['exact', 'icontains'],
            'serial_number': ['exact', 'icontains'],
            'vendor': ['exact', 'icontains'],
            'category': ['exact'],
            'is_active': ['exact'],
            'is_assigned': ['exact'],
            'purchase_date': ['gte', 'lte'],
            'purchase_price': ['gte', 'lte'],
        }


class AssetCategoryFilter(filters.FilterSet):
    class Meta:
        model = AssetCategory
        fields = {
            'name': ['exact', 'icontains'],
            'is_active': ['exact'],
        }


class AssetPurchaseRequestFilter(filters.FilterSet):
    asset = filters.UUIDFilter(field_name='asset___id')

    class Meta:
        model = AssetPurchaseRequest
        fields = {
            'status': ['exact'],
        }


class RecruitmentCandidateFilter(filters.FilterSet):
    assigned_to = filters.UUIDFilter(field_name='assigned_to___id')

    class Meta:
        model = RecruitmentCandidate
        fields = {
            'department': ['exact'],
            'stage': ['exact'],
            'status': ['exact'],
            'source': ['exact'],
            'apply_date': ['gte', 'lte'],
            'position': ['exact', 'icontains'],
        }


class ExitRecordFilter(filters.FilterSet):
    employee = filters.UUIDFilter(field_name='employee___id')

    class Meta:
        model = ExitRecord
        fields = {
            'status': ['exact'],
            'reason': ['exact'],
            'exit_date': ['gte', 'lte'],
        }


class PolicyFilter(filters.FilterSet):
    department = filters.UUIDFilter(field_name='department___id')

    class Meta:
        model = Policy
        fields = {
            'status': ['exact'],
            'category': ['exact'],
            'employee_type': ['exact'],
            'is_archived': ['exact'],
        }
