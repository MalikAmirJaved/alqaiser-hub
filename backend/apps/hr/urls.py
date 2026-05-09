# apps/hr/urls.py
from django.urls import path
from apps.hr.views.shift_template_views import ShiftTemplateView
from apps.hr.views.asset_views import AssetView, AssetStatsView
from apps.hr.views.asset_category_views import AssetCategoryView, AssetCategoryStatsView
from apps.hr.views.employee_views import EmployeeView, EmployeeStatsView

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
]