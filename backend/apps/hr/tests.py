from datetime import date, time, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.hr.models import (
    ShiftTemplate, Employee, LeaveRequest, EmployeeAssetAssignment,
    PayrollRecord, EmployeeLoan, RecruitmentCandidate, ExitRecord, Policy,
)

User = get_user_model()


class ShiftTemplateTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')

    def test_create(self):
        s = ShiftTemplate.objects.create(
            name='Morning', start_time=time(9, 0), end_time=time(18, 0),
            break_minutes=60, company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(s.name, 'Morning')
        self.assertTrue(s.is_active)

    def test_working_hours(self):
        s = ShiftTemplate.objects.create(
            name='Full', start_time=time(9, 0), end_time=time(18, 0),
            break_minutes=60, company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(s.working_hours, 8.0)

    def test_working_hours_no_break(self):
        s = ShiftTemplate.objects.create(
            name='NoBreak', start_time=time(8, 0), end_time=time(17, 0),
            break_minutes=0, company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(s.working_hours, 9.0)

    def test_unique_together(self):
        ShiftTemplate.objects.create(
            name='A', start_time=time(9, 0), end_time=time(17, 0),
            company_id=1, branch_id=1, created_by=self.user
        )
        with self.assertRaises(Exception):
            ShiftTemplate.objects.create(
                name='A', start_time=time(9, 0), end_time=time(17, 0),
                company_id=1, branch_id=1, created_by=self.user
            )


class EmployeeTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')

    def test_create(self):
        e = Employee.objects.create(
            employee_id='EMP001', first_name='John', last_name='Doe',
            phone='123', joining_date=date.today(),
            company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(e.full_name, 'John Doe')

    def test_full_name_no_last(self):
        e = Employee.objects.create(
            employee_id='EMP002', first_name='Jane',
            phone='123', joining_date=date.today(),
            company_id=1, branch_id=1, created_by=self.user
        )
        self.assertIn('Jane', e.full_name)

    def test_defaults(self):
        e = Employee.objects.create(
            employee_id='EMP003', first_name='X',
            phone='123', joining_date=date.today(),
            company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(e.gender, 'MALE')
        self.assertEqual(e.employment_type, 'FULL_TIME')
        self.assertEqual(e.employment_status, 'ACTIVE')
        self.assertEqual(e.role, 'STAFF')
        self.assertEqual(e.salary, 0)

    def test_unique_together(self):
        Employee.objects.create(
            employee_id='EMP004', first_name='A', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            Employee.objects.create(
                employee_id='EMP004', first_name='B', phone='2',
                joining_date=date.today(), company_id=1, branch_id=1
            )

    def test_unique_across_companies(self):
        Employee.objects.create(
            employee_id='EMP005', first_name='A', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            Employee.objects.create(
                employee_id='EMP005', first_name='B', phone='2',
                joining_date=date.today(), company_id=2, branch_id=2
            )


class LeaveRequestTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='L001', first_name='Leave', phone='1',
            joining_date=date(2024, 1, 1), company_id=1, branch_id=1
        )

    def test_create_full_day(self):
        lr = LeaveRequest.objects.create(
            employee=self.employee, leave_type='CASUAL',
            leave_sub_type='FULL_DAY',
            start_date=date(2025, 6, 1), end_date=date(2025, 6, 3),
            reason='Vacation', company_id=1, branch_id=1
        )
        self.assertEqual(lr.total_days, 3)

    def test_save_calculates_total_days(self):
        lr = LeaveRequest.objects.create(
            employee=self.employee, leave_type='SICK',
            leave_sub_type='FULL_DAY',
            start_date=date(2025, 6, 10), end_date=date(2025, 6, 12),
            reason='Illness', company_id=1, branch_id=1
        )
        self.assertEqual(lr.total_days, 3)

    def test_save_single_day(self):
        lr = LeaveRequest.objects.create(
            employee=self.employee, leave_type='CASUAL',
            leave_sub_type='FULL_DAY',
            start_date=date(2025, 6, 15), end_date=date(2025, 6, 15),
            reason='Day off', company_id=1, branch_id=1
        )
        self.assertEqual(lr.total_days, 1)

    def test_save_sets_is_half_day_false_for_full_day(self):
        lr = LeaveRequest.objects.create(
            employee=self.employee, leave_type='CASUAL',
            leave_sub_type='FULL_DAY',
            start_date=date(2025, 6, 1), end_date=date(2025, 6, 1),
            reason='Test', company_id=1, branch_id=1
        )
        self.assertFalse(lr.is_half_day)

    def test_status_default(self):
        lr = LeaveRequest.objects.create(
            employee=self.employee, leave_type='CASUAL',
            leave_sub_type='FULL_DAY',
            start_date=date(2025, 7, 1), end_date=date(2025, 7, 1),
            reason='Test', company_id=1, branch_id=1
        )
        self.assertEqual(lr.status, 'PENDING')


class EmployeeAssetAssignmentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='A001', first_name='Asset', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        from apps.hr.models import Asset
        asset = Asset.objects.create(
            name='Laptop', company_id=1, branch_id=1, created_by=self.user
        )
        assignment = EmployeeAssetAssignment.objects.create(
            employee=self.employee, asset=asset,
            assigned_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(assignment.status, 'ACTIVE')
        self.assertEqual(assignment.quantity, 1)

    def test_status_choices(self):
        from apps.hr.models import Asset
        asset = Asset.objects.create(
            name='Phone', company_id=1, branch_id=1, created_by=self.user
        )
        a = EmployeeAssetAssignment.objects.create(
            employee=self.employee, asset=asset,
            assigned_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(a.status, 'ACTIVE')


class PayrollRecordTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='P001', first_name='Pay', phone='1',
            joining_date=date(2024, 1, 1), company_id=1, branch_id=1
        )

    def test_create(self):
        pr = PayrollRecord.objects.create(
            employee=self.employee, month=6, year=2025,
            base_salary=Decimal('5000.00'), net_salary=Decimal('4500.00'),
            company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(pr.month, 6)
        self.assertEqual(pr.year, 2025)
        self.assertFalse(pr.is_cancelled)

    def test_unique_together(self):
        PayrollRecord.objects.create(
            employee=self.employee, month=6, year=2025,
            base_salary=Decimal('5000'), net_salary=Decimal('5000'),
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            PayrollRecord.objects.create(
                employee=self.employee, month=6, year=2025,
                base_salary=Decimal('5000'), net_salary=Decimal('5000'),
                company_id=1, branch_id=1
            )


class EmployeeLoanTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='L002', first_name='Loan', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        loan = EmployeeLoan.objects.create(
            employee=self.employee, loan_type='PERSONAL_LOAN',
            principal_amount=Decimal('10000'), remaining_amount=Decimal('10000'),
            total_payable=Decimal('10000'), company_id=1, branch_id=1
        )
        self.assertEqual(loan.status, 'UNPAID')
        self.assertEqual(loan.approval, 'PENDING')

    def test_defaults(self):
        loan = EmployeeLoan.objects.create(
            employee=self.employee, loan_type='CAR_LOAN',
            principal_amount=Decimal('50000'), remaining_amount=Decimal('50000'),
            total_payable=Decimal('50000'), company_id=1, branch_id=1
        )
        self.assertEqual(loan.paid_amount, 0)
        self.assertEqual(loan.paid_months, 0)
        self.assertEqual(loan.interest_rate, 0)


class RecruitmentCandidateTest(TestCase):
    def test_create(self):
        c = RecruitmentCandidate.objects.create(
            name='John Smith', position='Developer', department='Engineering',
            apply_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(c.stage, 'Applied')
        self.assertEqual(c.status, 'Active')


class ExitRecordTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='E001', first_name='Exit', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        er = ExitRecord.objects.create(
            employee=self.employee, exit_date=date.today(),
            company_id=1, branch_id=1
        )
        self.assertEqual(er.status, 'PENDING')
        self.assertEqual(er.reason, 'RESIGNATION')

    def test_status_choices(self):
        for status in ['PENDING', 'CONFIRMED', 'REJECTED']:
            employee = Employee.objects.create(
                employee_id=f'EX{status[:3]}', first_name=status, phone='1',
                joining_date=date.today(), company_id=1, branch_id=1
            )
            er = ExitRecord.objects.create(
                employee=employee, exit_date=date.today(),
                status=status, company_id=1, branch_id=1
            )
            self.assertEqual(er.status, status)


class PolicyTest(TestCase):
    def test_create(self):
        p = Policy.objects.create(
            code='POL001', title='Leave Policy', content='Leave policy content',
            company_id=1, branch_id=1
        )
        self.assertEqual(p.status, 'DRAFT')
        self.assertEqual(p.version, '1.0')

    def test_status_choices(self):
        p = Policy.objects.create(
            code='POL002', title='IT Policy', content='IT policy',
            company_id=1, branch_id=1, status='PUBLISHED'
        )
        self.assertEqual(p.status, 'PUBLISHED')
