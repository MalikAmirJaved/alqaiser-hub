from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    CompanySettingsView,
    WorkingDaysView,
    PublicHolidaysView,
    SettingHistoryView,
    WelcomeDesignationSetupView,
    DesignationEmployeesView,
    DesignationViewSet,
)

router = DefaultRouter()
router.register(r'designations', DesignationViewSet, basename='designation')

urlpatterns = [
    path('settings/', CompanySettingsView.as_view(), name='company-settings'),
    path('settings/working-days/', WorkingDaysView.as_view(), name='working-days'),
    path('settings/public-holidays/', PublicHolidaysView.as_view(), name='public-holidays'),
    path('settings/public-holidays/<uuid:holiday_id>/', PublicHolidaysView.as_view(), name='public-holiday-delete'),
    path('settings/designations/setup/', WelcomeDesignationSetupView.as_view(), name='welcome-designation-setup'),
    path('settings/history/', SettingHistoryView.as_view(), name='settings-history'),
    path('settings/designations/<uuid:designation_id>/employees/', DesignationEmployeesView.as_view(), name='designation-employees'),
    path('', include(router.urls)),
]