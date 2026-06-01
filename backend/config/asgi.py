"""
ASGI config for config project.
"""

import os
from django.urls import path
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import AllowedHostsOriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

from apps.notifications.middleware import JWTAuthCookieMiddleware
import apps.notifications.routing
from consumers.permission_consumer import PermissionConsumer 

websocket_urlpatterns = [
    *apps.notifications.routing.websocket_urlpatterns,
    path("ws/permissions/", PermissionConsumer.as_asgi()),    
]

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": AllowedHostsOriginValidator(
        JWTAuthCookieMiddleware(
            URLRouter(websocket_urlpatterns)
        )
    ),
})