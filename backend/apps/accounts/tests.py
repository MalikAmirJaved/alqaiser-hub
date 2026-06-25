from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from apps.organization.models import Company, Branch

User = get_user_model()


class LoginViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@test.com'
        )
        self.branch = Branch.objects.create(
            company=self.company, name='HO', code='HQ', city='C', country='C', email='ho@test.com'
        )
        self.user = User.objects.create_user(
            username='testuser', email='test@test.com', password='testpass123',
            company=self.company, branch=self.branch
        )

    def test_login_success(self):
        resp = self.client.post('/api/accounts/login/', {
            'username': 'testuser', 'password': 'testpass123'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertIn('user', resp.data)

    def test_login_with_email(self):
        resp = self.client.post('/api/accounts/login/', {
            'username': 'test@test.com', 'password': 'testpass123'
        }, format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_login_missing_fields(self):
        resp = self.client.post('/api/accounts/login/', {'username': 'u'}, format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_login_wrong_password(self):
        resp = self.client.post('/api/accounts/login/', {
            'username': 'testuser', 'password': 'wrong'
        }, format='json')
        self.assertIn(resp.status_code, [status.HTTP_400_BAD_REQUEST, status.HTTP_401_UNAUTHORIZED])

    def test_login_inactive_user(self):
        self.user.is_active = False
        self.user.save()
        resp = self.client.post('/api/accounts/login/', {
            'username': 'testuser', 'password': 'testpass123'
        }, format='json')
        self.assertIn(resp.status_code, [status.HTTP_403_FORBIDDEN, status.HTTP_400_BAD_REQUEST])


class MeViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@test.com'
        )
        self.branch = Branch.objects.create(
            company=self.company, name='HO', code='HQ', city='C', country='C', email='ho@test.com'
        )
        self.user = User.objects.create_user(
            username='me', email='me@test.com', password='pass123',
            company=self.company, branch=self.branch
        )

    def test_me_authenticated(self):
        self.client.force_authenticate(user=self.user)
        resp = self.client.get('/api/accounts/me/')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data['username'], 'me')

    def test_me_unauthenticated(self):
        resp = self.client.get('/api/accounts/me/')
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class LogoutViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_logout(self):
        resp = self.client.post('/api/accounts/logout/', format='json')
        self.assertEqual(resp.status_code, status.HTTP_200_OK)


class CookieTokenRefreshViewTest(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_refresh_missing_cookie(self):
        resp = self.client.post('/api/accounts/token/refresh/', format='json')
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)


class UserSerializerTest(TestCase):
    def test_serializer_fields(self):
        from apps.accounts.serializers import UserSerializer
        user = User(username='test', email='t@t.com')
        user.pk = 1
        s = UserSerializer(user)
        self.assertIn('username', s.data)
        self.assertIn('email', s.data)
