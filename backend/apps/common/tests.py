from unittest.mock import MagicMock, patch
from django.contrib.auth import get_user_model
from django.test import TestCase, RequestFactory
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError

from apps.common.authentication import CookieJWTAuthentication
from apps.common.backends import EmailOrUsernameBackend
from apps.common.exceptions import custom_exception_handler
from apps.common.pagination import StandardPagination
from apps.common.middleware import get_current_request, CurrentRequestMiddleware
from apps.common.serializer_fields import UUIDForeignRelatedField

User = get_user_model()


class CookieJWTAuthenticationTest(TestCase):
    def setUp(self):
        self.auth = CookieJWTAuthentication()
        self.factory = RequestFactory()

    def test_returns_none_on_missing_token(self):
        request = self.factory.get('/')
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    def test_returns_none_on_invalid_token(self):
        request = self.factory.get('/', HTTP_COOKIE='access_token=invalid')
        result = self.auth.authenticate(request)
        self.assertIsNone(result)

    @patch('apps.common.authentication.CookieJWTAuthentication.get_validated_token')
    @patch('apps.common.authentication.CookieJWTAuthentication.get_user')
    def test_authenticates_from_cookie(self, mock_get_user, mock_get_token):
        mock_token = MagicMock()
        mock_get_token.return_value = mock_token
        mock_user = MagicMock()
        mock_get_user.return_value = mock_user
        request = self.factory.get('/', HTTP_COOKIE='access_token=faketoken')
        user, token = self.auth.authenticate(request)
        self.assertEqual(user, mock_user)
        self.assertEqual(token, mock_token)

    @patch('apps.common.authentication.CookieJWTAuthentication.get_validated_token')
    @patch('apps.common.authentication.CookieJWTAuthentication.get_user')
    def test_authenticates_from_header(self, mock_get_user, mock_get_token):
        mock_token = MagicMock()
        mock_get_token.return_value = mock_token
        mock_user = MagicMock()
        mock_get_user.return_value = mock_user
        request = self.factory.get('/', HTTP_AUTHORIZATION='Bearer faketoken')
        user, token = self.auth.authenticate(request)
        self.assertEqual(user, mock_user)


class EmailOrUsernameBackendTest(TestCase):
    def setUp(self):
        self.backend = EmailOrUsernameBackend()
        self.user = User.objects.create_user(
            username='testuser', email='test@example.com', password='testpass123'
        )

    def test_authenticate_with_username(self):
        user = self.backend.authenticate(request=None, username='testuser', password='testpass123')
        self.assertEqual(user, self.user)

    def test_authenticate_with_email(self):
        user = self.backend.authenticate(request=None, username='test@example.com', password='testpass123')
        self.assertEqual(user, self.user)

    def test_authenticate_case_insensitive_email(self):
        user = self.backend.authenticate(request=None, username='TEST@EXAMPLE.COM', password='testpass123')
        self.assertEqual(user, self.user)

    def test_wrong_password_returns_none(self):
        user = self.backend.authenticate(request=None, username='testuser', password='wrong')
        self.assertIsNone(user)

    def test_nonexistent_user_returns_none(self):
        user = self.backend.authenticate(request=None, username='nobody', password='pass')
        self.assertIsNone(user)

    def test_inactive_user_returns_none(self):
        self.user.is_active = False
        self.user.save()
        user = self.backend.authenticate(request=None, username='testuser', password='testpass123')
        self.assertIsNone(user)


class CustomExceptionHandlerTest(TestCase):
    def test_handles_not_found(self):
        exc = NotFound(detail='Resource not found')
        response = custom_exception_handler(exc, {})
        self.assertEqual(response.status_code, 404)
        self.assertIn('detail', response.data)

    def test_handles_validation_error(self):
        exc = ValidationError(detail={'field': ['This field is required']})
        response = custom_exception_handler(exc, {})
        self.assertIn('detail', response.data)

    def test_wraps_string_detail(self):
        exc = NotFound(detail='Not found')
        response = custom_exception_handler(exc, {})
        self.assertEqual(response.data['detail'], 'Not found')


class StandardPaginationTest(TestCase):
    def test_default_page_size(self):
        paginator = StandardPagination()
        self.assertEqual(paginator.page_size, 20)

    def test_max_page_size(self):
        paginator = StandardPagination()
        self.assertEqual(paginator.max_page_size, 10000)

    def test_page_size_query_param(self):
        paginator = StandardPagination()
        self.assertEqual(paginator.page_size_query_param, 'page_size')


class UUIDForeignRelatedFieldTest(TestCase):
    def setUp(self):
        self.field = UUIDForeignRelatedField(queryset=User.objects.all())

    def test_to_representation(self):
        user = User(username='test', email='t@t.com')
        user.pk = 1
        user._id = 'test-uuid-1234'
        result = self.field.to_representation(user)
        self.assertEqual(result, 'test-uuid-1234')


class MiddlewareTest(TestCase):
    def test_get_current_request_returns_none_outside_request(self):
        req = get_current_request()
        self.assertIsNone(req)


class CurrentRequestMiddlewareTest(TestCase):
    def test_stores_request(self):
        middleware = CurrentRequestMiddleware(lambda r: MagicMock())
        mock_request = MagicMock()
        middleware(mock_request)
        self.assertIsNone(get_current_request())
