from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OverallDashboardViewSet

router = DefaultRouter()
router.register(r'dashboard', OverallDashboardViewSet, basename='overall-dashboard')

urlpatterns = [
    path('', include(router.urls)),
]