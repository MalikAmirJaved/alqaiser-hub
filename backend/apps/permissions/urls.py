from django.urls import path
from .views import UserPermissionsView, ModulesTreeView

urlpatterns = [
    path('me/', UserPermissionsView.as_view(), name='user-permissions'),
    path('modules/', ModulesTreeView.as_view(), name='modules-tree'),
]