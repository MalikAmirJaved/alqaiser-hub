from django.urls import path
from .views import (
    CompanySettingsView, 
    WorkingDaysView, 
    LeaveTypesView, 
    PublicHolidaysView
)

urlpatterns = [
    path('settings/', CompanySettingsView.as_view(), name='company-settings'),
    path('settings/working-days/', WorkingDaysView.as_view(), name='working-days'),
    path('settings/leave-types/', LeaveTypesView.as_view(), name='leave-types'),
    path('settings/public-holidays/', PublicHolidaysView.as_view(), name='public-holidays'),
    path('settings/public-holidays/<int:holiday_id>/', 
         PublicHolidaysView.as_view(), name='public-holiday-delete'),
]