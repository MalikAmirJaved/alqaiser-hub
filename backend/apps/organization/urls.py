from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    UserContextView, SwitchCompanyView, UserProfileView, 
    BranchCreateView, BranchDetailView, UserListView, 
    UserDetailView, ActiveUsersView, DepartmentViewSet
)

router = DefaultRouter()
router.register(r'departments', DepartmentViewSet, basename='department')

urlpatterns = [
    path('context/', UserContextView.as_view(), name='user-context'),
    path('switch-company/', SwitchCompanyView.as_view(), name='switch-company'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('branches/', BranchCreateView.as_view(), name='branch-create'),
    path('branches/detail/', BranchDetailView.as_view(), name='branch-detail'),
    path('users/active/', ActiveUsersView.as_view(), name='active-users'),
    path('users/', UserListView.as_view(), name='user-list'),
    path('users/<int:pk>/', UserDetailView.as_view(), name='user-detail'),
    path('', include(router.urls)),
]