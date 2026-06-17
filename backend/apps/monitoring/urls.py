from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteViewSet, NvrViewSet, CameraViewSet

router = DefaultRouter()
router.register(r'sites', SiteViewSet, basename='site')
router.register(r'nvrs', NvrViewSet, basename='nvr')
router.register(r'cameras', CameraViewSet, basename='camera')

urlpatterns = [
    path('', include(router.urls)),
]
