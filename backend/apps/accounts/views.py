import logging
import datetime

from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError

User = get_user_model()


def _set_jwt_cookies(response, refresh):
    """Attach access + refresh JWT tokens as HttpOnly cookies."""
    access_token = refresh.access_token
    jwt_settings = settings.SIMPLE_JWT
    access_lifetime = jwt_settings.get('ACCESS_TOKEN_LIFETIME', datetime.timedelta(minutes=15))
    refresh_lifetime = jwt_settings.get('REFRESH_TOKEN_LIFETIME', datetime.timedelta(days=7))
    secure = not settings.DEBUG

    response.set_cookie(
        key='access_token',
        value=str(access_token),
        httponly=True,
        secure=secure,
        samesite='Lax',
        max_age=int(access_lifetime.total_seconds()),
        path='/',
    )
    response.set_cookie(
        key='refresh_token',
        value=str(refresh),
        httponly=True,
        secure=secure,
        samesite='Lax',
        max_age=int(refresh_lifetime.total_seconds()),
        path='/',
    )
    return response


def _user_payload(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": getattr(user, "role", None),
        "companyId": getattr(user, "company_id", None),
        "branchId": getattr(user, "branch_id", None),
    }


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get("username", "").strip()
        password = request.data.get("password", "")

        if not identifier or not password:
            return Response(
                {"error": "username/email and password are required"},
                status=400,
            )

        # EmailOrUsernameBackend handles both username and email lookup
        user = authenticate(request, username=identifier, password=password)
        if not user:
            return Response({"error": "Invalid credentials"}, status=400)

        if not user.is_active:
            return Response(
                {
                    "error": "Account is inactive",
                    "detail": "Your account has been disabled by an administrator. Please contact support for assistance."
                },
                status=403
            )

        refresh = RefreshToken.for_user(user)
        response = Response({
            "detail": "Login successfully",
            "user": _user_payload(user)
        })

        _set_jwt_cookies(response, refresh)
        return response


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_user_payload(request.user))


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        response = Response({"detail": "Logged out successfully"})
        response.delete_cookie('access_token', path='/')
        response.delete_cookie('refresh_token', path='/')
        return response


class CookieTokenRefreshView(TokenRefreshView):
    """Refreshes access token using the HttpOnly refresh_token cookie."""

    def post(self, request, *args, **kwargs):
        refresh_token = request.COOKIES.get('refresh_token')
        if not refresh_token:
            return Response({"error": "No refresh token cookie found"}, status=400)

        serializer = self.get_serializer(data={"refresh": refresh_token})
        try:
            serializer.is_valid(raise_exception=True)
        except TokenError as e:
            return Response({"error": str(e)}, status=401)

        access_token = serializer.validated_data['access']
        access_lifetime = settings.SIMPLE_JWT.get(
            'ACCESS_TOKEN_LIFETIME', datetime.timedelta(minutes=15)
        )

        response = Response({"detail": "Token refreshed"})
        response.set_cookie(
            key='access_token',
            value=str(access_token),
            httponly=True,
            secure=not settings.DEBUG,
            samesite='Lax',
            max_age=int(access_lifetime.total_seconds()),
            path='/',
        )
        return response