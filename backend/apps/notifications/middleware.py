import logging
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.conf import settings
import jwt
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

@database_sync_to_async
def get_user(token):
    User = get_user_model()
    try:
        # Django Rest Framework SimpleJWT default algorithm is often HS256
        # The signing key is typically settings.SECRET_KEY
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user = User.objects.get(id=payload['user_id'])
        return user
    except Exception as e:
        logger.error(f"WebSocket JWT Auth error: {e}")
        return AnonymousUser()

class JWTAuthCookieMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        headers = dict(scope.get('headers', []))
        
        if b'cookie' in headers:
            cookies = headers[b'cookie'].decode()
            cookie_dict = {c.split('=')[0].strip(): c.split('=')[1].strip() for c in cookies.split(';') if '=' in c}
            
            # Use access_token from cookie
            access_token = cookie_dict.get('access_token')
            if access_token:
                scope['user'] = await get_user(access_token)
            else:
                scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()
            
        return await super().__call__(scope, receive, send)
