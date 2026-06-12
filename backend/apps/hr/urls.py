# apps/hr/urls.py
from django.urls import path
from apps.hr.views.shift_template_views import ShiftTemplateView
from apps.hr.views.asset_views import AssetView, AssetStatsView
from apps.hr.views.asset_category_views import AssetCategoryView, AssetCategoryStatsView
from apps.hr.views.employee_views import EmployeeView, EmployeeStatsView
from apps.hr.views.payroll_views import (
    PayrollView, PayrollStatsView, 
    EmployeeLoanView, CompensationView,
    LoanStatusUpdateView 
)
from apps.hr.views.employee_asset_views import (
    EmployeeAssetAssignmentView,
    AvailableAssetsView,
    BulkAssignmentView
)

from apps.hr.views.shift_management_views import (
    EmployeeShiftResolveView, ShiftOverrideView, ShiftDateRangeView,
    BulkShiftAssignmentView, ShiftHistoryView, ShiftStatisticsView,
    ShiftScheduleGenerateView
)

from apps.hr.views.leave_views import (
    LeaveRequestView,
    LeaveApprovalView,
    LeaveBalanceView,
    LeaveStatsView,
    LeaveHistoryView,
    YearEndCarryForwardView,
)

from apps.hr.views.recruitment_views import (
    RecruitmentCandidateView,
    RecruitmentStatsView,
    RecruitmentActivityLogView,
    RecruitmentBulkActionView,
    InterviewRoundView,
    RoundBulkCreateView,
    RoundStatusBulkUpdateView,
    RecruitmentCandidateDetailView,
)

urlpatterns = [
    # Shift Templates
    path('shift-templates/', ShiftTemplateView.as_view(), name='shift-templates'),
    
    # Assets
    path('assets/', AssetView.as_view(), name='assets'),
    path('assets/stats/', AssetStatsView.as_view(), name='asset-stats'),
    
    # Asset Categories
    path('asset-categories/', AssetCategoryView.as_view(), name='asset-categories'),
    path('asset-categories/stats/', AssetCategoryStatsView.as_view(), name='asset-category-stats'),
    
    # Employees
    path('employees/', EmployeeView.as_view(), name='employees'),
    path('employees/stats/', EmployeeStatsView.as_view(), name='employee-stats'),
    
    # Payroll
    path('payroll/', PayrollView.as_view(), name='payroll'),
    path('payroll/stats/', PayrollStatsView.as_view(), name='payroll-stats'),
    
    # Loans (with individual update/delete support)
    path('loans/', EmployeeLoanView.as_view(), name='employee-loans'),
    path('loans/status/', LoanStatusUpdateView.as_view(), name='loan-status-update'),  # New endpoint

    # Compensations
    path('compensations/', CompensationView.as_view(), name='compensations'),

    # employee assets
    path('employee-assets/assignments/', EmployeeAssetAssignmentView.as_view(), name='employee-asset-assignments'),
    path('employee-assets/available/', AvailableAssetsView.as_view(), name='available-assets'),
    path('employee-assets/bulk/', BulkAssignmentView.as_view(), name='bulk-assignments'),

    # Shift Management Endpoints
    path('shifts/resolve/', EmployeeShiftResolveView.as_view(), name='shift-resolve'),
    path('shifts/overrides/', ShiftOverrideView.as_view(), name='shift-overrides'),
    path('shifts/date-range/', ShiftDateRangeView.as_view(), name='shift-date-range'),
    path('shifts/bulk/', BulkShiftAssignmentView.as_view(), name='shift-bulk'),
    path('shifts/history/', ShiftHistoryView.as_view(), name='shift-history'),
    path('shifts/stats/', ShiftStatisticsView.as_view(), name='shift-stats'),
    path('shifts/generate-schedule/', ShiftScheduleGenerateView.as_view(), name='shift-generate-schedule'),

    # leave Management
    path('leaves/', LeaveRequestView.as_view(), name='leave-requests'),
    path('leaves/approve/', LeaveApprovalView.as_view(), name='leave-approve'),
    path('leaves/balances/', LeaveBalanceView.as_view(), name='leave-balances'),
    path('leaves/stats/', LeaveStatsView.as_view(), name='leave-stats'),
    path('leaves/history/', LeaveHistoryView.as_view(), name='leave-history'),
    path('leaves/carry-forward/', YearEndCarryForwardView.as_view(), name='leave-carry-forward'),

    # recruitment Management
    path('recruitment/candidates/', RecruitmentCandidateView.as_view(), name='recruitment-candidates'),
    path('recruitment/stats/', RecruitmentStatsView.as_view(), name='recruitment-stats'),
    path('recruitment/activities/', RecruitmentActivityLogView.as_view(), name='recruitment-activities'),
    path('recruitment/activities/<int:candidate_id>/', RecruitmentActivityLogView.as_view(), name='recruitment-candidate-activities'),
    path('recruitment/bulk-action/', RecruitmentBulkActionView.as_view(), name='recruitment-bulk-action'),

path('recruitment/candidates/<int:candidate_id>/detail/', RecruitmentCandidateDetailView.as_view(), name='recruitment-candidate-detail'),
    path('recruitment/candidates/<int:candidate_id>/rounds/', InterviewRoundView.as_view(), name='interview-rounds'),
    path('recruitment/candidates/<int:candidate_id>/rounds/<int:round_id>/', InterviewRoundView.as_view(), name='interview-round-detail'),
    path('recruitment/candidates/<int:candidate_id>/rounds/bulk/', RoundBulkCreateView.as_view(), name='rounds-bulk-create'),
    path('recruitment/candidates/<int:candidate_id>/rounds/bulk-status/', RoundStatusBulkUpdateView.as_view(), name='rounds-bulk-status'),
]