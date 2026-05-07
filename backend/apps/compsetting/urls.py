from django.urls import path
from .views import CompanySettingsView

urlpatterns = [
    path('settings/', CompanySettingsView.as_view(), name='company-settings'),
]