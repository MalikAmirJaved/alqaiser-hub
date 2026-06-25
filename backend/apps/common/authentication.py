from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework.exceptions import AuthenticationFailed
import logging

logger = logging.getLogger(__name__)


class CookieJWTAuthentication(JWTAuthentication):
    """
    Reads JWT access token from HttpOnly cookie instead of Authorization header.
    Falls back to Authorization header for API clients / Swagger.
    """

    def authenticate(self, request):
        # 1. Try cookie first
        raw_token = request.COOKIES.get("access_token")

        # 2. Fall back to Authorization: Bearer <token> header
        if raw_token is None:
            header = self.get_header(request)
            if header is None:
                return None
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None

        try:
            validated_token = self.get_validated_token(raw_token)
        except (TokenError, InvalidToken) as e:
            logger.debug(f"Invalid JWT token in cookie: {e}")
            return None

        try:
            user = self.get_user(validated_token)
        except AuthenticationFailed:
            return None

        return user, validated_token