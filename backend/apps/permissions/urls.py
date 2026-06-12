from django.urls import path
from .views import UserPermissionsView
from .views_extended import (
    ModulesTreeView, RoleListView,
    UserRolesView, AssignRoleView, RemoveRoleView,
    UserOverridesView, OverrideDetailView, BulkOverrideView,
)

urlpatterns = [
    path('me/', UserPermissionsView.as_view(), name='user-permissions'),
    path('modules/', ModulesTreeView.as_view(), name='modules-tree'),
    path("roles/",                               RoleListView.as_view()),
     path("users/<int:user_id>/roles/",           UserRolesView.as_view()),
     path("users/<int:user_id>/assign-role/",     AssignRoleView.as_view()),
     path("users/<int:user_id>/remove-role/<int:role_id>/", RemoveRoleView.as_view()),
     path("users/<int:user_id>/overrides/",       UserOverridesView.as_view()),
     path("users/<int:user_id>/overrides/<int:override_id>/", OverrideDetailView.as_view()),
     path("users/<int:user_id>/bulk-override/",   BulkOverrideView.as_view()),
]