from django.urls import path
from .views import LoginView, MeView, LogoutView, CookieTokenRefreshView

urlpatterns = [
    path('login/', LoginView.as_view(), name='login'),
    path('me/', MeView.as_view(), name='me'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('token/refresh/', CookieTokenRefreshView.as_view(), name='token_refresh'),
]