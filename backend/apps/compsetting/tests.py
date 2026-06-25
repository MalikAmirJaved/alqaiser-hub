from datetime import date, time
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.organization.models import Company, Branch, Department
from apps.compsetting.models import (
    CompanySettings, WorkingDay, PublicHoliday,
    CompanySettingHistory, Designation, TermsAndCondition,
)

User = get_user_model()


class CompanySettingsTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='admin', email='a@t.com', password='pass'
        )
        self.company = Company.objects.create(
            name='TestCo', short_name='TC', city='C', country='C', email='tc@t.com'
        )

    def test_create_settings(self):
        s = CompanySettings.objects.create(company=self.company)
        self.assertEqual(s.currency, 'USD')
        self.assertEqual(str(s), 'Settings for TestCo')

    def test_defaults(self):
        s = CompanySettings.objects.create(company=self.company)
        self.assertEqual(s.tax_rate, 0)
        self.assertEqual(s.timezone, 'UTC')
        self.assertFalse(s.allow_carry_forward)
        self.assertEqual(s.working_hours_per_day, 8)

    def test_one_to_one_constraint(self):
        CompanySettings.objects.create(company=self.company)
        with self.assertRaises(Exception):
            CompanySettings.objects.create(company=self.company)


class WorkingDayTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@t.com'
        )
        self.settings = CompanySettings.objects.create(company=self.company)

    def test_create_working_day(self):
        wd = WorkingDay.objects.create(
            company_settings=self.settings, company=self.company,
            day=0, is_working=True, start_time=time(9, 0), end_time=time(18, 0)
        )
        self.assertIn('Monday', str(wd))

    def test_off_day(self):
        wd = WorkingDay.objects.create(
            company_settings=self.settings, company=self.company,
            day=5, is_working=False
        )
        self.assertIn('Off', str(wd))

    def test_unique_together(self):
        WorkingDay.objects.create(
            company_settings=self.settings, company=self.company, day=0
        )
        with self.assertRaises(Exception):
            WorkingDay.objects.create(
                company_settings=self.settings, company=self.company, day=0
            )

    def test_all_seven_days(self):
        for d in range(7):
            WorkingDay.objects.create(
                company_settings=self.settings, company=self.company, day=d
            )
        self.assertEqual(WorkingDay.objects.count(), 7)


class PublicHolidayTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@t.com'
        )
        self.settings = CompanySettings.objects.create(company=self.company)

    def test_create_holiday(self):
        h = PublicHoliday.objects.create(
            company_settings=self.settings, company=self.company,
            name='Christmas', date=date(2025, 12, 25)
        )
        self.assertEqual(str(h), 'Christmas - 2025-12-25')

    def test_unique_together(self):
        PublicHoliday.objects.create(
            company_settings=self.settings, company=self.company,
            name='Holiday', date=date(2025, 1, 1)
        )
        with self.assertRaises(Exception):
            PublicHoliday.objects.create(
                company_settings=self.settings, company=self.company,
                name='Holiday', date=date(2025, 1, 1)
            )

    def test_different_name_same_date_ok(self):
        PublicHoliday.objects.create(
            company_settings=self.settings, company=self.company,
            name='A', date=date(2025, 1, 1)
        )
        h = PublicHoliday.objects.create(
            company_settings=self.settings, company=self.company,
            name='B', date=date(2025, 1, 1)
        )
        self.assertIsNotNone(h._id)


class CompanySettingHistoryTest(TestCase):
    def test_create_history(self):
        company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@t.com'
        )
        settings = CompanySettings.objects.create(company=company)
        user = User.objects.create_user(username='u', email='u@t.com', password='pass')
        h = CompanySettingHistory.objects.create(
            company_settings=settings, company=company,
            field_name='currency', old_value='USD', new_value='EUR',
            changed_by=user
        )
        self.assertEqual(h.old_value, 'USD')
        self.assertEqual(h.new_value, 'EUR')


class DesignationTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@t.com'
        )
        self.settings = CompanySettings.objects.create(company=self.company)

    def test_create_designation(self):
        d = Designation.objects.create(
            company_settings=self.settings, company=self.company, name='Manager'
        )
        self.assertEqual(str(d), 'Manager - General')

    def test_with_department(self):
        dept = Department.objects.create(
            name='Sales', code='SAL', company_id=self.company.id
        )
        d = Designation.objects.create(
            company_settings=self.settings, company=self.company,
            name='Sales Mgr', department=dept
        )
        self.assertEqual(str(d), 'Sales Mgr - Sales')

    def test_unique_together(self):
        Designation.objects.create(
            company_settings=self.settings, company=self.company, name='Dev'
        )
        with self.assertRaises(Exception):
            Designation.objects.create(
                company_settings=self.settings, company=self.company, name='Dev'
            )


class TermsAndConditionTest(TestCase):
    def setUp(self):
        self.company = Company.objects.create(
            name='Co', short_name='CO', city='C', country='C', email='co@t.com'
        )

    def test_create_terms(self):
        t = TermsAndCondition.objects.create(
            company=self.company, type='quote', content='Payment terms apply'
        )
        self.assertEqual(t.type, 'quote')

    def test_unique_together(self):
        TermsAndCondition.objects.create(company=self.company, type='quote')
        with self.assertRaises(Exception):
            TermsAndCondition.objects.create(company=self.company, type='quote')

    def test_different_types_ok(self):
        TermsAndCondition.objects.create(company=self.company, type='quote')
        t = TermsAndCondition.objects.create(company=self.company, type='invoice')
        self.assertIsNotNone(t._id)
