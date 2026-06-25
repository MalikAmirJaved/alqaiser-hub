from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from apps.organization.models import Company, Branch, Department
from apps.permissions.models import Module, Resource, Action, Permission, Role, RolePermission, UserRole

User = get_user_model()


class BaseTestCase(TestCase):
    """Shared test base with common fixtures for all modules."""

    @classmethod
    def setUpTestData(cls):
        cls.company = Company.objects.create(
            name='Test Company', short_name='TC', city='Lahore',
            country='Pakistan', email='test@company.com'
        )
        cls.branch = Branch.objects.create(
            company=cls.company, name='Head Office', code='HQ01',
            city='Lahore', country='Pakistan', email='hq@test.com', is_hq=True
        )
        cls.department = Department.objects.create(
            name='Engineering', code='ENG', company_id=cls.company.id,
            branch_id=cls.branch.id
        )
        cls.admin = User.objects.create_user(
            username='admin', email='admin@test.com', password='testpass123',
            company=cls.company, branch=cls.branch, role='COMPANY_ADMIN',
            is_superuser=True, is_staff=True
        )
        cls.staff = User.objects.create_user(
            username='staff', email='staff@test.com', password='testpass123',
            company=cls.company, branch=cls.branch, role='staff'
        )

    def setUp(self):
        self.client = APIClient()
        self.client.force_authenticate(user=self.admin)


class UnauthenticatedTestCase(BaseTestCase):
    def setUp(self):
        self.client = APIClient()
