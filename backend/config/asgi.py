"""
ASGI config for config project.
"""

import os
from django.urls import path
from django.core.asgi import get_asgi_application
from channels.routing import ProtocolTypeRouter, URLRouter
from channels.security.websocket import OriginValidator

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

django_asgi_app = get_asgi_application()

from apps.notifications.middleware import JWTAuthCookieMiddleware
import apps.notifications.routing
from consumers.permission_consumer import PermissionConsumer 

websocket_urlpatterns = [
    *apps.notifications.routing.websocket_urlpatterns,
    path("ws/permissions/", PermissionConsumer.as_asgi()),    
]

from django.conf import settings

# Build allowed WebSocket origins from ALLOWED_HOSTS + FRONTEND_URL
_allowed_ws_origins = list(settings.ALLOWED_HOSTS)
if settings.FRONTEND_URL:
    _allowed_ws_origins.append(settings.FRONTEND_URL)

# In debug, also allow any origin for convenience
if settings.DEBUG:
    _allowed_ws_origins.append("*")

application = ProtocolTypeRouter({
    "http": django_asgi_app,
    "websocket": OriginValidator(
        JWTAuthCookieMiddleware(
            URLRouter(websocket_urlpatterns)
        ),
        allowed_origins=_allowed_ws_origins,
    ),
})