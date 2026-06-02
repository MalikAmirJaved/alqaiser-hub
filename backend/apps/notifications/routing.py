# apps/notifications/routing.py
from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    # URL pattern with company_id and branch_id (supports both UUIDs and integers)
    re_path(
        r'ws/notifications/(?P<company_id>[^/]+)/(?P<branch_id>[^/]+)/$',
        consumers.NotificationConsumer.as_asgi()
    ),
    # URL pattern without branch (company only)
    re_path(
        r'ws/notifications/(?P<company_id>[^/]+)/$',
        consumers.NotificationConsumer.as_asgi()
    ),
    # URL pattern for personal notifications only
    re_path(
        r'ws/notifications/personal/$',
        consumers.NotificationConsumer.as_asgi()
    ),
]