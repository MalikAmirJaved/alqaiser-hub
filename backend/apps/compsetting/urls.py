from django.urls import path
from .views import (
    CompanySettingsView,
    WorkingDaysView,
    PublicHolidaysView,
    SettingHistoryView,
    DesignationView,
    WelcomeDesignationSetupView,
)

urlpatterns = [
    path('settings/', CompanySettingsView.as_view(), name='company-settings'),
    path('settings/working-days/', WorkingDaysView.as_view(), name='working-days'),
    path('settings/public-holidays/', PublicHolidaysView.as_view(), name='public-holidays'),
    # Use <uuid:holiday_id> to match UUID
    path('settings/public-holidays/<uuid:holiday_id>/', PublicHolidaysView.as_view(), name='public-holiday-delete'),
    path('settings/designations/', DesignationView.as_view(), name='designations'),
    path('settings/designations/setup/', WelcomeDesignationSetupView.as_view(), name='welcome-designation-setup'),
    path('settings/history/', SettingHistoryView.as_view(), name='settings-history'),
]