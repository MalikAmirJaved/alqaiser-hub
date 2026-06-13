from django.urls import re_path
from . import consumers

websocket_urlpatterns = [
    re_path(r'ws/notifications/(?P<company_id>\w+)/(?P<branch_id>\w+)/$', consumers.NotificationConsumer.as_asgi()),
]
