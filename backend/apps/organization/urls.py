from django.urls import path
from .views import (
    UserContextView, ModulesView, UserPermissionsView, SwitchCompanyView
)

urlpatterns = [
    path('context/', UserContextView.as_view(), name='user-context'),
    path('modules/', ModulesView.as_view(), name='modules'),
    path('permissions/', UserPermissionsView.as_view(), name='user-permissions'),
    path('switch-company/', SwitchCompanyView.as_view(), name='switch-company'),
]