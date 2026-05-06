from django.contrib.auth import authenticate
from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import AllowAny

User = get_user_model()

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get("username")  # username OR email
        password = request.data.get("password")

        if not identifier or not password:
            return Response({"error": "username/email and password required"}, status=400)

        # 🔥 Determine if identifier is email or username
        if "@" in identifier:
            # Lookup user by email first
            try:
                user = User.objects.get(email__iexact=identifier)
                username = user.username
            except User.DoesNotExist:
                return Response({"error": "Invalid credentials"}, status=400)
        else:
            username = identifier

        # Now authenticate with username (which Django supports)
        user = authenticate(request, username=username, password=password)

        if not user:
            return Response({"error": "Invalid credentials"}, status=400)

        refresh = RefreshToken.for_user(user)
        return Response({
            "refresh": str(refresh),
            "access": str(refresh.access_token),
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "role": getattr(user, "role", None),
            }
        })