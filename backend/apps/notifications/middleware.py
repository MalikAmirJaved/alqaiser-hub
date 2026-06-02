# apps/notifications/middleware.py
import logging
from channels.middleware import BaseMiddleware
from channels.db import database_sync_to_async
from django.contrib.auth.models import AnonymousUser
from django.conf import settings
import jwt
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token):
    """Get user from JWT token"""
    User = get_user_model()
    try:
        # Try with SECRET_KEY first
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=['HS256'])
        user_id = payload.get('user_id')
        
        if not user_id:
            # Try with 'id' key
            user_id = payload.get('id')
        
        if user_id:
            user = User.objects.get(id=user_id)
            return user
        return AnonymousUser()
        
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return AnonymousUser()
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        return AnonymousUser()
    except Exception as e:
        logger.error(f"Error decoding JWT token: {e}")
        return AnonymousUser()


@database_sync_to_async
def get_user_from_session(session_key):
    """Get user from Django session"""
    from django.contrib.sessions.models import Session
    User = get_user_model()
    
    try:
        session = Session.objects.get(session_key=session_key)
        session_data = session.get_decoded()
        user_id = session_data.get('_auth_user_id')
        
        if user_id:
            return User.objects.get(id=user_id)
        return AnonymousUser()
    except Session.DoesNotExist:
        return AnonymousUser()
    except Exception as e:
        logger.error(f"Error getting user from session: {e}")
        return AnonymousUser()


class JWTAuthCookieMiddleware(BaseMiddleware):
    """Middleware to authenticate WebSocket connections using JWT from cookie"""
    
    async def __call__(self, scope, receive, send):
        headers = dict(scope.get('headers', []))
        
        # Try to get token from cookie
        if b'cookie' in headers:
            cookies = headers[b'cookie'].decode()
            cookie_dict = {}
            
            # Parse cookies
            for cookie in cookies.split(';'):
                if '=' in cookie:
                    key, value = cookie.strip().split('=', 1)
                    cookie_dict[key] = value
            
            # Check for access_token in cookies
            access_token = cookie_dict.get('access_token')
            
            if access_token:
                scope['user'] = await get_user_from_token(access_token)
                logger.debug(f"WebSocket authenticated user via token: {scope['user'].id if scope['user'].is_authenticated else 'Anonymous'}")
            else:
                # Try session authentication as fallback
                session_id = cookie_dict.get('sessionid')
                if session_id:
                    scope['user'] = await get_user_from_session(session_id)
                else:
                    scope['user'] = AnonymousUser()
        else:
            scope['user'] = AnonymousUser()
        
        return await super().__call__(scope, receive, send)