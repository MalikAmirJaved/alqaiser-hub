from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.organization.models import Company, Branch, Department, UserCompanyContext

User = get_user_model()


class CompanyModelTest(TestCase):
    def test_create_company(self):
        c = Company.objects.create(
            name='Acme', short_name='AC', city='Dubai', country='UAE', email='a@acme.com'
        )
        self.assertEqual(c.name, 'Acme')
        self.assertIsNotNone(c._id)

    def test_unique_short_name(self):
        Company.objects.create(name='A', short_name='X', city='C', country='C', email='a@a.com')
        with self.assertRaises(Exception):
            Company.objects.create(name='B', short_name='X', city='C', country='C', email='b@b.com')

    def test_unique_email(self):
        Company.objects.create(name='A', short_name='A', city='C', country='C', email='dup@test.com')
        with self.assertRaises(Exception):
            Company.objects.create(name='B', short_name='B', city='C', country='C', email='dup@test.com')

    def test_soft_delete_flag(self):
        c = Company.objects.create(
            name='Del', short_name='DL', city='C', country='C', email='del@test.com'
        )
        c.is_deleted = True
        c.save()
        c.refresh_from_db()
        self.assertTrue(c.is_deleted)


class BranchModelTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@test.com'
        )

    def test_create_branch(self):
        b = Branch.objects.create(
            company=self.company, name='Main', code='M01', city='C', country='C', email='m@test.com'
        )
        self.assertEqual(b.company, self.company)

    def test_unique_email(self):
        Branch.objects.create(
            company=self.company, name='A', code='A1', city='C', country='C', email='dup@test.com'
        )
        with self.assertRaises(Exception):
            Branch.objects.create(
                company=self.company, name='B', code='B1', city='C', country='C', email='dup@test.com'
            )

    def test_currency_default(self):
        b = Branch.objects.create(
            company=self.company, name='B', code='B', city='C', country='C', email='b@t.com'
        )
        self.assertEqual(b.currency_code, 'USD')


class DepartmentModelTest(TestCase):
    def test_create_department(self):
        d = Department.objects.create(
            name='HR', code='HR01', company_id=1, branch_id=1
        )
        self.assertEqual(str(d), 'HR01 - HR')

    def test_is_active_default(self):
        d = Department.objects.create(name='IT', code='IT01', company_id=1, branch_id=1)
        self.assertTrue(d.is_active)

    def test_unique_together_company_code(self):
        Department.objects.create(name='A', code='X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Department.objects.create(name='B', code='X', company_id=1, branch_id=1)

    def test_different_company_same_code_ok(self):
        Department.objects.create(name='A', code='X', company_id=1, branch_id=1)
        d = Department.objects.create(name='B', code='X', company_id=2, branch_id=2)
        self.assertIsNotNone(d._id)


class UserModelTest(TestCase):
    def test_create_user(self):
        u = User.objects.create_user(
            username='testuser', email='test@test.com', password='pass123',
            role='staff'
        )
        self.assertEqual(str(u), 'testuser')
        self.assertTrue(u.check_password('pass123'))

    def test_user_uuid(self):
        u = User.objects.create_user(
            username='uuid', email='uuid@test.com', password='pass123'
        )
        self.assertIsNotNone(u._id)

    def test_default_role(self):
        u = User.objects.create_user(
            username='defrole', email='dr@test.com', password='pass123'
        )
        self.assertEqual(u.role, 'staff')

    def test_default_status(self):
        u = User.objects.create_user(
            username='defstatus', email='ds@test.com', password='pass123'
        )
        self.assertEqual(u.status, 'active')

    def test_soft_delete_flag(self):
        u = User.objects.create_user(
            username='softdel', email='sd@test.com', password='pass123'
        )
        u.is_deleted = True
        u.save()
        u.refresh_from_db()
        self.assertTrue(u.is_deleted)

    def test_unique_email(self):
        User.objects.create_user(username='a', email='dup@t.com', password='pass')
        with self.assertRaises(Exception):
            User.objects.create_user(username='b', email='dup@t.com', password='pass')


class UserCompanyContextTest(TestCase):
    def test_create_context(self):
        c = Company.objects.create(
            name='C', short_name='C', city='C', country='C', email='c@c.com'
        )
        b = Branch.objects.create(
            company=c, name='B', code='B', city='C', country='C', email='b@b.com'
        )
        u = User.objects.create_user(
            username='ctx', email='ctx@test.com', password='pass123', company=c, branch=b
        )
        ctx = UserCompanyContext.objects.create(
            user=u, current_company=c, current_branch=b
        )
        self.assertEqual(ctx.user, u)
        self.assertIn(u.username, str(ctx))
