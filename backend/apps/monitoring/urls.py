from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import SiteViewSet, NvrViewSet, CameraViewSet, start_stream, stop_stream, stream_status

router = DefaultRouter()
router.register(r'sites', SiteViewSet, basename='site')
router.register(r'nvrs', NvrViewSet, basename='nvr')
router.register(r'cameras', CameraViewSet, basename='camera')

urlpatterns = [
    path('', include(router.urls)),
    path('stream/start/', start_stream, name='monitoring-stream-start'),
    path('stream/stop/', stop_stream, name='monitoring-stream-stop'),
    path('stream/status/', stream_status, name='monitoring-stream-status'),
]
