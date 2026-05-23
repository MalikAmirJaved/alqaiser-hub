from django.urls import path
from .views import (
    UserContextView, SwitchCompanyView, UserProfileView, BranchCreateView,BranchDetailView
)

urlpatterns = [
    path('context/', UserContextView.as_view(), name='user-context'),
    path('switch-company/', SwitchCompanyView.as_view(), name='switch-company'),
    path('profile/', UserProfileView.as_view(), name='user-profile'),
    path('branches/', BranchCreateView.as_view(), name='branch-create'),
    path('branches/detail/', BranchDetailView.as_view(), name='branch-detail'),
]