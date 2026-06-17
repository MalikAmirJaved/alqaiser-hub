# apps/hr/urls.py
from django.urls import path
from apps.hr.views.shift_template_views import ShiftTemplateView
from apps.hr.views.asset_views import AssetView, AssetStatsView
from apps.hr.views.asset_category_views import AssetCategoryView, AssetCategoryStatsView
from apps.hr.views.asset_purchase_request_views import AssetPurchaseRequestView
from apps.hr.views.employee_views import EmployeeView, EmployeeStatsView, ActiveEmployeesView
from apps.hr.views.payroll_views import (
    PayrollView, PayrollStatsView, PayrollPreviewView, PayrollAdvanceView,
    EmployeeLoanView, CompensationView, CompensationStatusUpdateView,
    LoanStatusUpdateView, LoanApproveView, LoanPayView,
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
    LeaveStatsView,
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

from apps.hr.views.exit_management_views import (
    ExitRecordView,
    ExitStatsView,
    ExitFinalSettlementView,
    ExitChecklistView,
    ExitBulkActionView,
    ExitClearDuesView,
    ExitEmployeeAssetsView,
    ExitReturnAssetView,
)

from apps.hr.views.promotion_views import PromotionView

from apps.hr.views.policy_views import (
    PolicyView,
    PolicyStatsView,
    PolicyBulkActionView,
    PolicyVersionView,
    PolicyCategoryView,
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
    path('employees/active/', ActiveEmployeesView.as_view(), name='active-employees'),
    path('employees/', EmployeeView.as_view(), name='employees'),
    path('employees/stats/', EmployeeStatsView.as_view(), name='employee-stats'),
    
    # Promotions
    path('promotions/', PromotionView.as_view(), name='promotions'),
    path('promotions/<str:pk>/', PromotionView.as_view(), name='promotion-detail'),

    # Payroll
    path('payroll/', PayrollView.as_view(), name='payroll'),
    path('payroll/stats/', PayrollStatsView.as_view(), name='payroll-stats'),
    path('payroll/preview/', PayrollPreviewView.as_view(), name='payroll-preview'),
    path('payroll/advance/', PayrollAdvanceView.as_view(), name='payroll-advance'),

    # Loans (with individual update/delete support)
    path('loans/', EmployeeLoanView.as_view(), name='employee-loans'),
    path('loans/status/', LoanStatusUpdateView.as_view(), name='loan-status-update'),
    path('loans/approve/', LoanApproveView.as_view(), name='loan-approve'),
    path('loans/pay/', LoanPayView.as_view(), name='loan-pay'),
    path('loans/<str:pk>/', EmployeeLoanView.as_view(), name='employee-loan-detail'),

    # Compensations
    path('compensations/status/', CompensationStatusUpdateView.as_view(), name='compensation-status'),
    path('compensations/', CompensationView.as_view(), name='compensations'),
    path('compensations/<str:pk>/', CompensationView.as_view(), name='compensation-detail'),

    # Asset Purchase Requests
    path('asset-purchase-requests/', AssetPurchaseRequestView.as_view(), name='asset-purchase-requests'),

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
    path('leaves/stats/', LeaveStatsView.as_view(), name='leave-stats'),

    # recruitment Management
    path('recruitment/candidates/', RecruitmentCandidateView.as_view(), name='recruitment-candidates'),
    path('recruitment/stats/', RecruitmentStatsView.as_view(), name='recruitment-stats'),
    path('recruitment/activities/', RecruitmentActivityLogView.as_view(), name='recruitment-activities'),
    path('recruitment/activities/<str:candidate_id>/', RecruitmentActivityLogView.as_view(), name='recruitment-candidate-activities'),
    path('recruitment/bulk-action/', RecruitmentBulkActionView.as_view(), name='recruitment-bulk-action'),

    path('recruitment/candidates/<str:candidate_id>/detail/', RecruitmentCandidateDetailView.as_view(), name='recruitment-candidate-detail'),
    
    # ✅ IMPORTANT: Bulk endpoints must come BEFORE the generic <str:round_id> pattern
    path('recruitment/candidates/<str:candidate_id>/rounds/bulk/', RoundBulkCreateView.as_view(), name='rounds-bulk-create'),
    path('recruitment/candidates/<str:candidate_id>/rounds/bulk-status/', RoundStatusBulkUpdateView.as_view(), name='rounds-bulk-status'),
    
    # Generic round operations (list, create single round, retrieve, update, delete)
    path('recruitment/candidates/<str:candidate_id>/rounds/', InterviewRoundView.as_view(), name='interview-rounds'),
    path('recruitment/candidates/<str:candidate_id>/rounds/<str:round_id>/', InterviewRoundView.as_view(), name='interview-round-detail'),

    # Exit Management
    path('exits/', ExitRecordView.as_view(), name='exit-records'),
    path('exits/stats/', ExitStatsView.as_view(), name='exit-stats'),
    path('exits/final-settlement/', ExitFinalSettlementView.as_view(), name='exit-final-settlement'),
    path('exits/checklist/', ExitChecklistView.as_view(), name='exit-checklist'),
    path('exits/clear-dues/', ExitClearDuesView.as_view(), name='exit-clear-dues'),
    path('exits/bulk-action/', ExitBulkActionView.as_view(), name='exit-bulk-action'),
    path('exits/<str:exit_id>/assets/', ExitEmployeeAssetsView.as_view(), name='exit-employee-assets'),
    path('exits/<str:exit_id>/return-asset/', ExitReturnAssetView.as_view(), name='exit-return-asset'),

    # Policy Management
    path('policies/', PolicyView.as_view(), name='policies'),
    path('policies/stats/', PolicyStatsView.as_view(), name='policy-stats'),
    path('policies/bulk-action/', PolicyBulkActionView.as_view(), name='policy-bulk-action'),
    
    # Policy Detail with ID
    path('policies/<str:pk>/', PolicyView.as_view(), name='policy-detail'),
    
    # Policy Versions
    path('policies/<str:policy_id>/versions/', PolicyVersionView.as_view(), name='policy-versions'),
    
    # Custom Categories
    path('policies/categories/', PolicyCategoryView.as_view(), name='policy-categories'),
]