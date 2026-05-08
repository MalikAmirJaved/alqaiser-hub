from django.urls import path
from .views import (
    CompanySettingsView,
    WorkingDaysView,
    LeaveTypesView,
    PublicHolidaysView,
    SettingHistoryView,
)

urlpatterns = [
    # Main settings
    path('settings/', CompanySettingsView.as_view(), name='company-settings'),
    
    # Working days
    path('settings/working-days/', WorkingDaysView.as_view(), name='working-days'),
    
    # Leave types CRUD
    path('settings/leave-types/', LeaveTypesView.as_view(), name='leave-types'),
    
    # Public holidays CRUD
    path('settings/public-holidays/', PublicHolidaysView.as_view(), name='public-holidays'),
    path('settings/public-holidays/<int:holiday_id>/', 
         PublicHolidaysView.as_view(), name='public-holiday-delete'),
    
    # History/Audit
    path('settings/history/', SettingHistoryView.as_view(), name='settings-history'),
]