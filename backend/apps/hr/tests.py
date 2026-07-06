from datetime import date, time, timedelta
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.hr.models import (
    ShiftTemplate, Asset, AssetPurchaseRequest, AssetCategory,
    Employee, EmployeeProfilePic, EmployeeDocument, EmployeePromotion,
    EmployeeAssetAssignment, EmployeeDefaultShift,
    Compensation, CompensationSelectedMonth, CompensationMonthRange,
    EmployeeLoan, LoanSelectedMonth, LoanMonthRange,
    PayrollRecord, PayrollDeductionDetail, PayrollCompensation,
    PayrollLoanDeduction, PayrollLeaveDeduction,
    ShiftOverride, ShiftDateRangeAssignment, ShiftChangeHistory,
    EmployeeShiftSchedule,
    LeaveRequest, RecruitmentCandidate, RecruitmentActivityLog,
    InterviewRound, ExitRecord, ExitChecklist,
    Policy, PolicyVersion, PolicyCategory,
)

User = get_user_model()


# =========================================================
# 1. SHIFT TEMPLATE
# =========================================================
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


# =========================================================
# 2. ASSET
# =========================================================
class AssetTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')

    def test_create(self):
        a = Asset.objects.create(
            name='Laptop', brand='Dell', model='XPS 15',
            serial_number='SN001', company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(a.name, 'Laptop')
        self.assertTrue(a.is_active)
        self.assertFalse(a.is_assigned)

    def test_defaults(self):
        a = Asset.objects.create(name='Monitor', company_id=1, branch_id=1)
        self.assertEqual(a.total_quantity, 1)
        self.assertEqual(a.available_quantity, 1)
        self.assertTrue(a.is_active)

    def test_warranty_status_active(self):
        a = Asset.objects.create(
            name='Phone', warranty_until=date.today() + timedelta(days=30),
            company_id=1, branch_id=1
        )
        self.assertTrue(a.warranty_status)

    def test_warranty_status_expired(self):
        a = Asset.objects.create(
            name='Old Laptop', warranty_until=date.today() - timedelta(days=1),
            company_id=1, branch_id=1
        )
        self.assertFalse(a.warranty_status)

    def test_warranty_status_none(self):
        a = Asset.objects.create(name='Chair', company_id=1, branch_id=1)
        self.assertIsNone(a.warranty_status)

    def test_unique_serial(self):
        Asset.objects.create(name='A', serial_number='SN-X', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Asset.objects.create(name='B', serial_number='SN-X', company_id=1, branch_id=1)


# =========================================================
# 3. ASSET CATEGORY
# =========================================================
class AssetCategoryTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.asset1 = Asset.objects.create(name='Laptop', company_id=1, branch_id=1, created_by=self.user)
        self.asset2 = Asset.objects.create(name='Mouse', company_id=1, branch_id=1, created_by=self.user)

    def test_create(self):
        cat = AssetCategory.objects.create(
            name='IT Kit', company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(cat.name, 'IT Kit')
        self.assertTrue(cat.is_active)

    def test_m2m_assets(self):
        cat = AssetCategory.objects.create(name='Kit', company_id=1, branch_id=1)
        cat.assets.add(self.asset1, self.asset2)
        self.assertEqual(cat.assets.count(), 2)
        self.assertIn(self.asset1.id, cat.get_asset_ids())

    def test_unique_together(self):
        AssetCategory.objects.create(name='A', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            AssetCategory.objects.create(name='A', company_id=1, branch_id=1)


# =========================================================
# 4. EMPLOYEE
# =========================================================
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


# =========================================================
# 5. EMPLOYEE DOCUMENT
# =========================================================
class EmployeeDocumentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='DOC001', first_name='Doc', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        doc = EmployeeDocument.objects.create(
            employee=self.employee, document_type='EDUCATION',
            title='Bachelor Degree', file_url='/docs/degree.pdf',
            original_filename='degree.pdf', company_id=1, branch_id=1
        )
        self.assertEqual(doc.document_type, 'EDUCATION')
        self.assertEqual(doc.title, 'Bachelor Degree')

    def test_document_type_choices(self):
        for dtype in ['EDUCATION', 'EXPERIENCE', 'OTHER']:
            doc = EmployeeDocument.objects.create(
                employee=self.employee, document_type=dtype,
                file_url=f'/docs/{dtype}.pdf',
                original_filename=f'{dtype}.pdf', company_id=1, branch_id=1
            )
            self.assertEqual(doc.document_type, dtype)


# =========================================================
# 6. EMPLOYEE PROMOTION
# =========================================================
class EmployeePromotionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='PRM001', first_name='Promote', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        promo = EmployeePromotion.objects.create(
            employee=self.employee,
            previous_salary=Decimal('5000'), new_salary=Decimal('6000'),
            effective_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(promo.previous_salary, Decimal('5000'))
        self.assertEqual(promo.new_salary, Decimal('6000'))

    def test_approval_fields(self):
        promo = EmployeePromotion.objects.create(
            employee=self.employee,
            previous_salary=Decimal('5000'), new_salary=Decimal('7000'),
            effective_date=date.today(), company_id=1, branch_id=1,
            approved_by=self.user
        )
        self.assertIsNotNone(promo.approved_by)


# =========================================================
# 7. EMPLOYEE ASSET ASSIGNMENT
# =========================================================
class EmployeeAssetAssignmentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='A001', first_name='Asset', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        asset = Asset.objects.create(
            name='Laptop', company_id=1, branch_id=1, created_by=self.user
        )
        assignment = EmployeeAssetAssignment.objects.create(
            employee=self.employee, asset=asset,
            assigned_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(assignment.status, 'ACTIVE')
        self.assertEqual(assignment.quantity, 1)
        self.assertEqual(assignment.source_type, 'DIRECT')

    def test_status_choices(self):
        asset = Asset.objects.create(
            name='Phone', company_id=1, branch_id=1, created_by=self.user
        )
        a = EmployeeAssetAssignment.objects.create(
            employee=self.employee, asset=asset,
            assigned_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(a.status, 'ACTIVE')
        self.assertEqual(a.condition_on_assignment, 'GOOD')


# =========================================================
# 8. EMPLOYEE DEFAULT SHIFT
# =========================================================
class EmployeeDefaultShiftTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='DS001', first_name='Shift', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.shift = ShiftTemplate.objects.create(
            name='Morning', start_time=time(9, 0), end_time=time(18, 0),
            company_id=1, branch_id=1, created_by=self.user
        )

    def test_create(self):
        eds = EmployeeDefaultShift.objects.create(
            employee=self.employee, template=self.shift,
            effective_from=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(eds.effective_from, date.today())
        self.assertIsNone(eds.effective_to)


# =========================================================
# 9. COMPENSATION
# =========================================================
class CompensationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='CMP001', first_name='Comp', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        c = Compensation.objects.create(
            employee=self.employee,
            house_rent_allowance=Decimal('10000'),
            medical_allowance=Decimal('5000'),
            transport_allowance=Decimal('3000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(c.status, 'PENDING')
        self.assertEqual(c.frequency_type, 'MONTH_RANGE')

    def test_total_allowances(self):
        c = Compensation.objects.create(
            employee=self.employee,
            house_rent_allowance=Decimal('10000'),
            medical_allowance=Decimal('5000'),
            transport_allowance=Decimal('3000'),
            phone_allowance=Decimal('1000'),
            utilities_allowance=Decimal('500'),
            education_allowance=Decimal('2000'),
            other_allowances=Decimal('1500'),
            company_id=1, branch_id=1
        )
        self.assertEqual(c.total_allowances, Decimal('23000'))
        self.assertEqual(c.total_ctc, Decimal('23000'))
        self.assertEqual(c.total_monthly, Decimal('23000'))


# =========================================================
# 10. COMPENSATION SELECTED MONTH
# =========================================================
class CompensationSelectedMonthTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='CSM001', first_name='CSM', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.compensation = Compensation.objects.create(
            employee=self.employee, frequency_type='SELECTED_MONTH',
            company_id=1, branch_id=1
        )

    def test_create(self):
        csm = CompensationSelectedMonth.objects.create(
            compensation=self.compensation, month=6, year=2025,
            company_id=1, branch_id=1
        )
        self.assertEqual(csm.month, 6)
        self.assertEqual(csm.year, 2025)

    def test_unique_together(self):
        CompensationSelectedMonth.objects.create(
            compensation=self.compensation, month=6, year=2025,
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            CompensationSelectedMonth.objects.create(
                compensation=self.compensation, month=6, year=2025,
                company_id=1, branch_id=1
            )


# =========================================================
# 11. COMPENSATION MONTH RANGE
# =========================================================
class CompensationMonthRangeTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='CMR001', first_name='CMR', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.compensation = Compensation.objects.create(
            employee=self.employee, frequency_type='MONTH_RANGE',
            company_id=1, branch_id=1
        )

    def test_create(self):
        cmr = CompensationMonthRange.objects.create(
            compensation=self.compensation,
            start_month=1, start_year=2025,
            end_month=12, end_year=2025,
            company_id=1, branch_id=1
        )
        self.assertEqual(cmr.start_month, 1)
        self.assertEqual(cmr.end_year, 2025)


# =========================================================
# 12. EMPLOYEE LOAN
# =========================================================
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


# =========================================================
# 13. LOAN SELECTED MONTH
# =========================================================
class LoanSelectedMonthTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='LSM001', first_name='LSM', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.loan = EmployeeLoan.objects.create(
            employee=self.employee, loan_type='PERSONAL_LOAN',
            principal_amount=Decimal('12000'), remaining_amount=Decimal('12000'),
            total_payable=Decimal('12000'), frequency_type='SELECTED_MONTH',
            company_id=1, branch_id=1
        )

    def test_create(self):
        lsm = LoanSelectedMonth.objects.create(
            loan=self.loan, month=6, year=2025,
            deduction=Decimal('1000'), company_id=1, branch_id=1
        )
        self.assertEqual(lsm.deduction, Decimal('1000'))

    def test_unique_together(self):
        LoanSelectedMonth.objects.create(
            loan=self.loan, month=6, year=2025,
            deduction=Decimal('1000'), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            LoanSelectedMonth.objects.create(
                loan=self.loan, month=6, year=2025,
                deduction=Decimal('1000'), company_id=1, branch_id=1
            )


# =========================================================
# 14. LOAN MONTH RANGE
# =========================================================
class LoanMonthRangeTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='LMR001', first_name='LMR', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.loan = EmployeeLoan.objects.create(
            employee=self.employee, loan_type='CAR_LOAN',
            principal_amount=Decimal('60000'), remaining_amount=Decimal('60000'),
            total_payable=Decimal('60000'), frequency_type='MONTH_RANGE',
            company_id=1, branch_id=1
        )

    def test_create(self):
        lmr = LoanMonthRange.objects.create(
            loan=self.loan,
            start_month=1, start_year=2025,
            end_month=12, end_year=2025,
            deduction=Decimal('5000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(lmr.deduction, Decimal('5000'))


# =========================================================
# 15. PAYROLL RECORD
# =========================================================
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
        self.assertEqual(pr.transaction_type, 'SALARY')

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

    def test_totals_default(self):
        pr = PayrollRecord.objects.create(
            employee=self.employee, month=7, year=2025,
            base_salary=Decimal('5000'), net_salary=Decimal('5000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(pr.total_compensation, 0)
        self.assertEqual(pr.total_loan_deduction, 0)
        self.assertEqual(pr.total_leave_deduction, 0)


# =========================================================
# 16. PAYROLL DEDUCTION DETAIL
# =========================================================
class PayrollDeductionDetailTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='PDD001', first_name='PDD', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.payroll = PayrollRecord.objects.create(
            employee=self.employee, month=6, year=2025,
            base_salary=Decimal('5000'), net_salary=Decimal('4500'),
            company_id=1, branch_id=1
        )

    def test_create_leave_deduction(self):
        detail = PayrollDeductionDetail.objects.create(
            payroll=self.payroll, deduction_type='LEAVE',
            amount=Decimal('500'), leave_days=Decimal('2'),
            description='2 days leave deduction', company_id=1, branch_id=1
        )
        self.assertEqual(detail.deduction_type, 'LEAVE')
        self.assertEqual(detail.amount, Decimal('500'))

    def test_create_loan_deduction(self):
        detail = PayrollDeductionDetail.objects.create(
            payroll=self.payroll, deduction_type='LOAN_PRINCIPAL',
            amount=Decimal('1000'), description='Loan EMI',
            company_id=1, branch_id=1
        )
        self.assertEqual(detail.deduction_type, 'LOAN_PRINCIPAL')


# =========================================================
# 17. PAYROLL COMPENSATION
# =========================================================
class PayrollCompensationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='PC001', first_name='PC', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.payroll = PayrollRecord.objects.create(
            employee=self.employee, month=6, year=2025,
            base_salary=Decimal('5000'), net_salary=Decimal('5000'),
            company_id=1, branch_id=1
        )
        self.compensation = Compensation.objects.create(
            employee=self.employee, house_rent_allowance=Decimal('10000'),
            company_id=1, branch_id=1
        )

    def test_create(self):
        pc = PayrollCompensation.objects.create(
            payroll=self.payroll, compensation=self.compensation,
            amount=Decimal('10000'), company_id=1, branch_id=1
        )
        self.assertEqual(pc.amount, Decimal('10000'))

    def test_unique_together(self):
        PayrollCompensation.objects.create(
            payroll=self.payroll, compensation=self.compensation,
            amount=Decimal('10000'), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            PayrollCompensation.objects.create(
                payroll=self.payroll, compensation=self.compensation,
                amount=Decimal('10000'), company_id=1, branch_id=1
            )


# =========================================================
# 18. PAYROLL LOAN DEDUCTION
# =========================================================
class PayrollLoanDeductionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='PLD001', first_name='PLD', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.payroll = PayrollRecord.objects.create(
            employee=self.employee, month=6, year=2025,
            base_salary=Decimal('5000'), net_salary=Decimal('4000'),
            company_id=1, branch_id=1
        )
        self.loan = EmployeeLoan.objects.create(
            employee=self.employee, loan_type='PERSONAL_LOAN',
            principal_amount=Decimal('10000'), remaining_amount=Decimal('8000'),
            total_payable=Decimal('10000'), company_id=1, branch_id=1
        )

    def test_create(self):
        pld = PayrollLoanDeduction.objects.create(
            payroll=self.payroll, loan=self.loan,
            principal_amount=Decimal('833.33'),
            interest_amount=Decimal('166.67'),
            total_amount=Decimal('1000'),
            company_id=1, branch_id=1
        )
        self.assertEqual(pld.total_amount, Decimal('1000'))


# =========================================================
# 19. PAYROLL LEAVE DEDUCTION
# =========================================================
class PayrollLeaveDeductionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='PLV001', first_name='PLV', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.payroll = PayrollRecord.objects.create(
            employee=self.employee, month=6, year=2025,
            base_salary=Decimal('5000'), net_salary=Decimal('4500'),
            company_id=1, branch_id=1
        )
        self.leave = LeaveRequest.objects.create(
            employee=self.employee, leave_type='CASUAL',
            leave_sub_type='FULL_DAY',
            start_date=date(2025, 6, 1), end_date=date(2025, 6, 1),
            reason='Test', company_id=1, branch_id=1
        )

    def test_create(self):
        pld = PayrollLeaveDeduction.objects.create(
            payroll=self.payroll, leave_request=self.leave,
            working_days=Decimal('1'), amount=Decimal('227.27'),
            company_id=1, branch_id=1
        )
        self.assertEqual(pld.working_days, Decimal('1'))


# =========================================================
# 20. SHIFT OVERRIDE
# =========================================================
class ShiftOverrideTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='SO001', first_name='SO', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.shift = ShiftTemplate.objects.create(
            name='Night', start_time=time(22, 0), end_time=time(6, 0),
            company_id=1, branch_id=1, created_by=self.user
        )

    def test_create(self):
        so = ShiftOverride.objects.create(
            employee=self.employee, shift_template=self.shift,
            date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(so.shift_template, self.shift)

    def test_unique_employee_date(self):
        ShiftOverride.objects.create(
            employee=self.employee, shift_template=self.shift,
            date=date(2025, 7, 1), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            ShiftOverride.objects.create(
                employee=self.employee, shift_template=self.shift,
                date=date(2025, 7, 1), company_id=1, branch_id=1
            )


# =========================================================
# 21. SHIFT DATE RANGE ASSIGNMENT
# =========================================================
class ShiftDateRangeAssignmentTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='SDRA001', first_name='SDRA', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.shift = ShiftTemplate.objects.create(
            name='Evening', start_time=time(14, 0), end_time=time(22, 0),
            company_id=1, branch_id=1, created_by=self.user
        )

    def test_create(self):
        sdra = ShiftDateRangeAssignment.objects.create(
            employee=self.employee, shift_template=self.shift,
            start_date=date(2025, 7, 1), end_date=date(2025, 7, 31),
            company_id=1, branch_id=1
        )
        self.assertTrue(sdra.is_active)


# =========================================================
# 22. SHIFT CHANGE HISTORY
# =========================================================
class ShiftChangeHistoryTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='SCH001', first_name='SCH', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        sch = ShiftChangeHistory.objects.create(
            employee=self.employee, change_type='DEFAULT_CHANGE',
            effective_from=date.today(), company_id=1
        )
        self.assertEqual(sch.change_type, 'DEFAULT_CHANGE')
        self.assertIsNotNone(sch._id)

    def test_change_type_choices(self):
        for ct in ['DEFAULT_CHANGE', 'TEMPORARY_OVERRIDE', 'DATE_RANGE_ASSIGNMENT',
                    'BULK_ASSIGNMENT', 'AUTO_ASSIGNMENT']:
            sch = ShiftChangeHistory.objects.create(
                employee=self.employee, change_type=ct,
                effective_from=date.today(), company_id=1
            )
            self.assertEqual(sch.change_type, ct)


# =========================================================
# 23. EMPLOYEE SHIFT SCHEDULE
# =========================================================
class EmployeeShiftScheduleTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='ESS001', first_name='ESS', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.shift = ShiftTemplate.objects.create(
            name='Morning', start_time=time(9, 0), end_time=time(18, 0),
            break_minutes=60, company_id=1, branch_id=1, created_by=self.user
        )

    def test_create(self):
        ess = EmployeeShiftSchedule.objects.create(
            employee=self.employee, shift_template=self.shift,
            date=date.today(), shift_name='Morning',
            start_time=time(9, 0), end_time=time(18, 0),
            break_minutes=60, working_hours=Decimal('8.00'),
            company_id=1
        )
        self.assertEqual(ess.source_type, 'DEFAULT')

    def test_unique_employee_date(self):
        EmployeeShiftSchedule.objects.create(
            employee=self.employee, shift_template=self.shift,
            date=date(2025, 7, 1), shift_name='Morning',
            start_time=time(9, 0), end_time=time(18, 0),
            company_id=1
        )
        with self.assertRaises(Exception):
            EmployeeShiftSchedule.objects.create(
                employee=self.employee, shift_template=self.shift,
                date=date(2025, 7, 1), shift_name='Morning',
                start_time=time(9, 0), end_time=time(18, 0),
                company_id=1
            )


# =========================================================
# 24. LEAVE REQUEST
# =========================================================
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

    def test_half_day_leave(self):
        lr = LeaveRequest.objects.create(
            employee=self.employee, leave_type='SICK',
            leave_sub_type='HALF',
            start_date=date(2025, 7, 1), end_date=date(2025, 7, 1),
            reason='Half day', company_id=1, branch_id=1
        )
        self.assertTrue(lr.is_half_day)
        self.assertEqual(lr.total_days, 0.5)


# =========================================================
# 25. RECRUITMENT CANDIDATE
# =========================================================
class RecruitmentCandidateTest(TestCase):
    def test_create(self):
        c = RecruitmentCandidate.objects.create(
            name='John Smith', position='Developer', department='Engineering',
            apply_date=date.today(), company_id=1, branch_id=1
        )
        self.assertEqual(c.stage, 'Applied')
        self.assertEqual(c.status, 'Active')

    def test_stage_choices(self):
        for stage in ['Applied', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected']:
            c = RecruitmentCandidate.objects.create(
                name=f'Candidate-{stage}', position='Dev', department='Eng',
                apply_date=date.today(), stage=stage, company_id=1, branch_id=1
            )
            self.assertEqual(c.stage, stage)


# =========================================================
# 26. RECRUITMENT ACTIVITY LOG
# =========================================================
class RecruitmentActivityLogTest(TestCase):
    def setUp(self):
        self.candidate = RecruitmentCandidate.objects.create(
            name='Test Candidate', position='Dev', department='Eng',
            apply_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        log = RecruitmentActivityLog.objects.create(
            candidate=self.candidate, action='CREATED',
            new_value='Candidate created',
            company_id=1, branch_id=1
        )
        self.assertEqual(log.action, 'CREATED')

    def test_action_choices(self):
        for action in ['CREATED', 'STAGE_CHANGED', 'INTERVIEW_SCHEDULED',
                       'OFFER_SENT', 'OFFER_ACCEPTED', 'HIRED', 'REJECTED']:
            log = RecruitmentActivityLog.objects.create(
                candidate=self.candidate, action=action,
                company_id=1, branch_id=1
            )
            self.assertEqual(log.action, action)


# =========================================================
# 27. INTERVIEW ROUND
# =========================================================
class InterviewRoundTest(TestCase):
    def setUp(self):
        self.candidate = RecruitmentCandidate.objects.create(
            name='Interviewee', position='Dev', department='Eng',
            apply_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        ir = InterviewRound.objects.create(
            candidate=self.candidate, round_number=1,
            round_title='Technical Round 1', interview_type='TECHNICAL',
        )
        self.assertEqual(ir.status, 'PENDING')
        self.assertEqual(ir.round_number, 1)

    def test_unique_together(self):
        InterviewRound.objects.create(
            candidate=self.candidate, round_number=1,
            round_title='R1',
        )
        with self.assertRaises(Exception):
            InterviewRound.objects.create(
                candidate=self.candidate, round_number=1,
                round_title='R1 Dup',
            )

    def test_interview_type_choices(self):
        for i, itype in enumerate(['TECHNICAL', 'HR', 'MANAGERIAL', 'CODING', 'ASSIGNMENT'], start=2):
            ir = InterviewRound.objects.create(
                candidate=self.candidate, round_number=i,
                round_title=f'{itype} Round', interview_type=itype,
            )
            self.assertEqual(ir.interview_type, itype)


# =========================================================
# 28. EXIT RECORD
# =========================================================
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

    def test_reason_choices(self):
        for reason in ['RESIGNATION', 'TERMINATION', 'CONTRACT_END', 'RETIREMENT', 'OTHER']:
            employee = Employee.objects.create(
                employee_id=f'R{reason[:3]}', first_name=reason, phone='1',
                joining_date=date.today(), company_id=1, branch_id=1
            )
            er = ExitRecord.objects.create(
                employee=employee, exit_date=date.today(),
                reason=reason, company_id=1, branch_id=1
            )
            self.assertEqual(er.reason, reason)


# =========================================================
# 29. EXIT CHECKLIST
# =========================================================
class ExitChecklistTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.employee = Employee.objects.create(
            employee_id='ECL001', first_name='ECL', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )
        self.exit_record = ExitRecord.objects.create(
            employee=self.employee, exit_date=date.today(),
            company_id=1, branch_id=1
        )

    def test_create(self):
        ecl = ExitChecklist.objects.create(
            exit_record=self.exit_record, item_type='HR',
            item_name='Return ID Card', status='PENDING',
            company_id=1, branch_id=1
        )
        self.assertEqual(ecl.item_type, 'HR')
        self.assertEqual(ecl.status, 'PENDING')

    def test_checklist_types(self):
        for ctype in ['HR', 'IT', 'FINANCE', 'ADMIN', 'GENERAL']:
            ecl = ExitChecklist.objects.create(
                exit_record=self.exit_record, item_type=ctype,
                item_name=f'{ctype} Item', company_id=1, branch_id=1
            )
            self.assertEqual(ecl.item_type, ctype)

    def test_status_choices(self):
        for status in ['PENDING', 'COMPLETED', 'WAIVED', 'NOT_APPLICABLE']:
            ecl = ExitChecklist.objects.create(
                exit_record=self.exit_record, item_name='Item',
                status=status, company_id=1, branch_id=1
            )
            self.assertEqual(ecl.status, status)


# =========================================================
# 30. POLICY
# =========================================================
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

    def test_unique_company_code(self):
        Policy.objects.create(
            code='POL-X', title='X', content='X',
            company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            Policy.objects.create(
                code='POL-X', title='X Dup', content='X',
                company_id=1, branch_id=1
            )


# =========================================================
# 31. POLICY VERSION
# =========================================================
class PolicyVersionTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(username='u', email='u@t.com', password='p')
        self.policy = Policy.objects.create(
            code='PV001', title='Policy', content='Content',
            company_id=1, branch_id=1
        )

    def test_create(self):
        pv = PolicyVersion.objects.create(
            policy=self.policy, version='1.0',
            content='Version 1 content', changed_by=self.user,
            company_id=1, branch_id=1
        )
        self.assertEqual(pv.version, '1.0')

    def test_multiple_versions(self):
        PolicyVersion.objects.create(
            policy=self.policy, version='1.0',
            content='V1', company_id=1, branch_id=1
        )
        pv2 = PolicyVersion.objects.create(
            policy=self.policy, version='2.0',
            content='V2', company_id=1, branch_id=1
        )
        self.assertEqual(pv2.version, '2.0')
        self.assertEqual(self.policy.versions.count(), 2)


# =========================================================
# 32. POLICY CATEGORY
# =========================================================
class PolicyCategoryTest(TestCase):
    def test_create(self):
        pc = PolicyCategory.objects.create(
            name='Employment', company_id=1, branch_id=1
        )
        self.assertEqual(pc.name, 'Employment')
        self.assertTrue(pc.is_active)

    def test_unique_together(self):
        PolicyCategory.objects.create(name='A', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            PolicyCategory.objects.create(name='A', company_id=1, branch_id=1)


# =========================================================
# 33. EMPLOYEE PROFILE PICTURE
# =========================================================
class EmployeeProfilePicTest(TestCase):
    def setUp(self):
        self.employee = Employee.objects.create(
            employee_id='PP001', first_name='PP', phone='1',
            joining_date=date.today(), company_id=1, branch_id=1
        )

    def test_create(self):
        pic = EmployeeProfilePic.objects.create(
            employee=self.employee, file_url='/media/profile.jpg',
            original_filename='profile.jpg', is_primary=True,
            company_id=1, branch_id=1
        )
        self.assertTrue(pic.is_primary)
        self.assertTrue(pic.is_face_validated)

    def test_non_primary(self):
        pic = EmployeeProfilePic.objects.create(
            employee=self.employee, file_url='/media/other.jpg',
            original_filename='other.jpg', is_primary=False,
            company_id=1, branch_id=1
        )
        self.assertFalse(pic.is_primary)
