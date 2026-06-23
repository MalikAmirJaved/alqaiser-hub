"""
Management command: seed_data
Seeds the database with fake records for ALL major models.
All records use company_id=1 and branch_id=1.

Usage:
    python manage.py seed_data
    python manage.py seed_data --count 500
    python manage.py seed_data --clear   # Delete all seeded data first
"""
import random
import uuid
from decimal import Decimal
from datetime import date, timedelta, time

from django.core.management.base import BaseCommand
from django.contrib.auth.hashers import make_password
from django.contrib.contenttypes.models import ContentType
from django.db import transaction
from faker import Faker

from apps.organization.models import Company, Branch, User, Department
from apps.compsetting.models import CompanySettings, Designation, TermsAndCondition
from apps.hr.models import (
    ShiftTemplate, Asset, AssetCategory, Employee, EmployeeDocument,
    EmployeePromotion, EmployeeAssetAssignment, Compensation,
    EmployeeLoan, LeaveRequest, PayrollRecord, Policy, PolicyCategory,
    RecruitmentCandidate, ExitRecord,
)
from apps.inventory.models import (
    Category, Brand, Warehouse, Product, Supplier, ProductVariant,
    VariantAttribute, VariantImage, StockItem, Customer,
    PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine,
    SalesOrder, SalesOrderLine, SalesReturn, SalesReturnLine,
    StockTransfer, StockReservation, Alert, InventoryTransaction,
)
from apps.finance.models import (
    Account, BankAccount, JournalEntry, JournalLine,
    Payment, Expense, Budget, SupplierBill,
    CustomerInvoice, CustomerInvoiceLine, BankTransaction,
)
from apps.sales.models import Lead, Quote, QuoteLine
from apps.monitoring.models import Site, Nvr, Camera
from apps.notifications.models import Notification

fake = Faker()
COMPANY_ID = 1
BRANCH_ID = 1


class Command(BaseCommand):
    help = "Seed database with 1000 fake records per model (company_id=1, branch_id=1)"

    def add_arguments(self, parser):
        parser.add_argument(
            '--count', type=int, default=1000,
            help='Number of records to create per model (default: 1000)',
        )
        parser.add_argument(
            '--clear', action='store_true',
            help='Clear all seeded data before seeding',
        )

    def handle(self, *args, **options):
        count = options['count']

        try:
            self.admin = User.objects.get(username='admin')
        except User.DoesNotExist:
            self.stdout.write(self.style.ERROR(
                'Admin user not found. Run "python manage.py seed_org" first.'
            ))
            return

        if options['clear']:
            self.stdout.write(self.style.WARNING('Clearing all data…'))
            self._clear_all()

        self.stdout.write(self.style.SUCCESS(
            f'\n{"="*60}\n  Seeding {count} records per model\n{"="*60}\n'
        ))

        phases = [
            ('Organization', self._seed_organization),
            ('Compsetting', self._seed_compsetting),
            ('HR', self._seed_hr),
            ('Inventory', self._seed_inventory),
            ('Finance', self._seed_finance),
            ('Sales', self._seed_sales),
            ('Monitoring', self._seed_monitoring),
            ('Notifications', self._seed_notifications),
        ]
        for name, phase_fn in phases:
            try:
                with transaction.atomic():
                    phase_fn(count)
            except Exception as e:
                self.stdout.write(self.style.ERROR(f'  ✗ {name} failed: {e}'))

        self._print_summary()
        self.stdout.write(self.style.SUCCESS('\n✅ Seeding completed!\n'))

    # ── Helpers ──────────────────────────────────────────────────────────────

    def _kw(self):
        """Base kwargs for every BaseModel-derived model."""
        return {
            'company_id': COMPANY_ID,
            'branch_id': BRANCH_ID,
            'created_by': self.admin,
            'updated_by': self.admin,
        }

    def _count(self, Model):
        """Count existing records for a model scoped to COMPANY_ID."""
        return Model.objects.filter(company_id=COMPANY_ID).count()

    def _ids(self, Model, extra_filter=None):
        """Return list of PKs for a model scoped to COMPANY_ID."""
        qs = Model.objects.filter(company_id=COMPANY_ID, is_deleted=False)
        if extra_filter:
            qs = qs.filter(**extra_filter)
        return list(qs.values_list('id', flat=True))

    def _pick(self, id_list):
        """Pick a random id from a list, or None if empty."""
        return random.choice(id_list) if id_list else None

    def _clear_all(self):
        """Delete all records for every seeded model (order matters for FKs)."""
        models_to_clear = [
            Notification, Alert, InventoryTransaction,
            CustomerInvoiceLine, CustomerInvoice, SupplierBill,
            BankTransaction, BankAccount, Expense, Budget,
            Payment, JournalLine, JournalEntry, Account,
            QuoteLine, Quote, Lead,
            GoodsReceiptLine, GoodsReceipt,
            SalesReturnLine, SalesReturn,
            SalesOrderLine, SalesOrder,
            StockTransfer, StockReservation,
            PurchaseOrderLine, PurchaseOrder,
            StockItem, VariantImage, VariantAttribute, ProductVariant,
            Product, Category, Brand, Warehouse, Supplier, Customer,
            ExitRecord, RecruitmentCandidate,
            PayrollRecord, LeaveRequest, EmployeeLoan,
            Compensation, EmployeeAssetAssignment, EmployeeDocument,
            EmployeePromotion, Employee,
            PolicyCategory, Policy,
            AssetCategory, Asset, ShiftTemplate,
            Designation, TermsAndCondition,
            Department, User,
        ]
        for m in models_to_clear:
            m.objects.filter(company_id=COMPANY_ID).delete()
        self.stdout.write('  🗑  All seeded data cleared\n')

    def _print_summary(self):
        self.stdout.write(f'\n{"="*60}')
        self.stdout.write(self.style.SUCCESS('  Seed Summary'))
        self.stdout.write(f'{"="*60}')

        model_counts = [
            ('Department', Department),
            ('User', User),
            ('Designation', Designation),
            ('ShiftTemplate', ShiftTemplate),
            ('Asset', Asset),
            ('AssetCategory', AssetCategory),
            ('Employee', Employee),
            ('EmployeeDocument', EmployeeDocument),
            ('EmployeePromotion', EmployeePromotion),
            ('Compensation', Compensation),
            ('EmployeeLoan', EmployeeLoan),
            ('LeaveRequest', LeaveRequest),
            ('PayrollRecord', PayrollRecord),
            ('Policy', Policy),
            ('PolicyCategory', PolicyCategory),
            ('RecruitmentCandidate', RecruitmentCandidate),
            ('ExitRecord', ExitRecord),
            ('Category', Category),
            ('Brand', Brand),
            ('Warehouse', Warehouse),
            ('Product', Product),
            ('ProductVariant', ProductVariant),
            ('VariantAttribute', VariantAttribute),
            ('VariantImage', VariantImage),
            ('Supplier', Supplier),
            ('Customer', Customer),
            ('StockItem', StockItem),
            ('PurchaseOrder', PurchaseOrder),
            ('PurchaseOrderLine', PurchaseOrderLine),
            ('SalesOrder', SalesOrder),
            ('SalesOrderLine', SalesOrderLine),
            ('StockTransfer', StockTransfer),
            ('Alert', Alert),
            ('Account', Account),
            ('BankAccount', BankAccount),
            ('JournalEntry', JournalEntry),
            ('JournalLine', JournalLine),
            ('Payment', Payment),
            ('Expense', Expense),
            ('Budget', Budget),
            ('SupplierBill', SupplierBill),
            ('CustomerInvoice', CustomerInvoice),
            ('CustomerInvoiceLine', CustomerInvoiceLine),
            ('BankTransaction', BankTransaction),
            ('Lead', Lead),
            ('Quote', Quote),
            ('QuoteLine', QuoteLine),
            ('Site', Site),
            ('Nvr', Nvr),
            ('Camera', Camera),
            ('Notification', Notification),
        ]

        total = 0
        for label, model in model_counts:
            n = model.objects.filter(company_id=COMPANY_ID).count()
            total += n
            self.stdout.write(f'  {label:<30s} {n:>6,d}')

        self.stdout.write(f'  {"─"*40}')
        self.stdout.write(self.style.SUCCESS(f'  {"TOTAL":<30s} {total:>6,d}'))

    # ── Phase 1: Organization ────────────────────────────────────────────────

    def _seed_organization(self, count):
        self.stdout.write(self.style.WARNING('\n── Organization ──'))

        # ── Departments ──
        offset = self._count(Department)
        objs = [
            Department(
                **self._kw(),
                name=f'{fake.job().title()} Dept',
                code=f'DEPT-{offset + i + 1:04d}',
                description=fake.sentence(),
                is_active=True,
            )
            for i in range(count)
        ]
        Department.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} departments (offset {offset})')

        # ── Users ──
        offset = self._count(User)
        roles = ['staff', 'manager', 'COMPANY_ADMIN', 'BRANCH_ADMIN']
        pw = make_password('password123')
        objs = []
        for i in range(count):
            fn = fake.first_name()
            ln = fake.last_name()
            objs.append(User(
                username=f'user_{offset + i + 1:04d}',
                email=f'user_{offset + i + 1:04d}@{fake.free_email_domain()}',
                password=pw,
                first_name=fn,
                last_name=ln,
                full_name=f'{fn} {ln}',
                role=random.choice(roles),
                phone_number=fake.phone_number()[:30],
                company_id=COMPANY_ID,
                branch_id=BRANCH_ID,
                status='active',
                is_active=True,
                is_staff=random.choice([True, False]),
            ))
        User.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} users (offset {offset})')

    # ── Phase 2: Compsetting ─────────────────────────────────────────────────

    def _seed_compsetting(self, count):
        self.stdout.write(self.style.WARNING('\n── Compsetting ──'))

        company = Company.objects.get(id=COMPANY_ID)
        branch = Branch.objects.get(id=BRANCH_ID)
        settings = CompanySettings.objects.filter(company=company).first()

        # ── Designations ──
        dept_ids = self._ids(Department)
        existing_names = set(
            Designation.objects.filter(company=company).values_list('name', flat=True)
        )
        objs = []
        i = 0
        while i < count:
            name = f'{fake.job().title()} {i+1}'
            if name not in existing_names:
                existing_names.add(name)
                objs.append(Designation(
                    name=name,
                    company=company,
                    branch=branch,
                    company_settings=settings,
                    department_id=self._pick(dept_ids),
                    description=fake.sentence(),
                    is_active=True,
                    created_by=self.admin,
                    updated_by=self.admin,
                ))
                i += 1
        Designation.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} designations')

        # ── Terms & Conditions (always create 2) ──
        TermsAndCondition.objects.get_or_create(
            company=company, type='quote',
            defaults={
                'branch': branch,
                'content': 'Payment due within 30 days of invoice date. Late payments may incur a 2% monthly fee.',
                'created_by': self.admin,
                'updated_by': self.admin,
            }
        )
        TermsAndCondition.objects.get_or_create(
            company=company, type='invoice',
            defaults={
                'branch': branch,
                'content': 'All amounts are in USD. Taxes applied as per local regulations.',
                'created_by': self.admin,
                'updated_by': self.admin,
            }
        )
        self.stdout.write('  ✓ 2 terms & conditions')

    # ── Phase 3: HR ──────────────────────────────────────────────────────────

    def _seed_hr(self, count):
        self.stdout.write(self.style.WARNING('\n── HR ──'))

        dept_ids = self._ids(Department)
        desig_ids = self._ids(Designation)

        # ── Shift Templates ──
        existing_shifts = self._count(ShiftTemplate)
        objs = [
            ShiftTemplate(
                **self._kw(),
                name=f'{fake.word().title()} Shift {existing_shifts + i + 1}',
                start_time=time(random.randint(6, 10), random.choice([0, 30])),
                end_time=time(random.randint(14, 22), random.choice([0, 30])),
                break_minutes=random.choice([30, 45, 60]),
                description=fake.sentence(),
                is_active=True,
            )
            for i in range(count)
        ]
        ShiftTemplate.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} shift templates')

        shift_ids = self._ids(ShiftTemplate)

        # ── Assets ──
        cats = ['Laptop', 'Monitor', 'Desk', 'Chair', 'Phone', 'Tablet', 'Printer', 'Headset']
        objs = [
            Asset(
                **self._kw(),
                name=f'{random.choice(cats)} {fake.word().title()}',
                brand=fake.company(),
                model=f'MDL-{random.randint(100, 999)}',
                serial_number=f'SN-{uuid.uuid4().hex[:12].upper()}',
                description=fake.sentence(),
                category=random.choice(cats),
                total_quantity=random.randint(1, 10),
                available_quantity=random.randint(0, 10),
                purchase_date=fake.date_between(start_date='-2y', end_date='today'),
                purchase_price=Decimal(str(random.randint(500, 5000))),
                is_active=True,
            )
            for i in range(count)
        ]
        Asset.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} assets')

        asset_ids = self._ids(Asset)

        # ── Asset Categories ──
        ac_count = min(count, 200)
        objs = [
            AssetCategory(
                **self._kw(),
                name=f'{fake.word().title()} Asset Kit {i+1}',
                description=fake.sentence(),
                is_active=True,
            )
            for i in range(ac_count)
        ]
        AssetCategory.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        # Re-fetch to get IDs (bulk_create with ignore_conflicts doesn't populate PKs)
        created_cats = list(
            AssetCategory.objects.filter(company_id=COMPANY_ID, is_deleted=False)
            .order_by('-id')[:50]
        )
        for ac in created_cats:
            ac.assets.set(
                Asset.objects.filter(
                    company_id=COMPANY_ID, is_deleted=False
                ).order_by('?')[:random.randint(1, 5)]
            )
        self.stdout.write(f'  ✓ {ac_count} asset categories')

        # ── Employees ──
        emp_offset = self._count(Employee)
        objs = []
        for i in range(count):
            fn = fake.first_name()
            ln = fake.last_name()
            objs.append(Employee(
                **self._kw(),
                employee_id=f'EMP-{emp_offset + i + 1:04d}',
                first_name=fn,
                last_name=ln,
                father_name=fake.first_name_male(),
                cnic=f'{random.randint(10000, 99999)}-{random.randint(100000, 999999)}-{random.randint(1, 9)}',
                date_of_birth=fake.date_between(start_date='-40y', end_date='-20y'),
                gender=random.choice(['MALE', 'FEMALE']),
                marital_status=random.choice(['SINGLE', 'MARRIED', 'DIVORCED']),
                phone=fake.phone_number()[:20],
                email=fake.unique.email(),
                personal_email=fake.unique.email(),
                address_line=fake.address(),
                country='PK',
                city=fake.city(),
                state=fake.state(),
                postal_code=str(random.randint(10000, 99999)),
                emergency_contact_name=fake.name(),
                emergency_contact_phone=fake.phone_number()[:20],
                emergency_contact_relation=random.choice(['Father', 'Mother', 'Spouse', 'Sibling']),
                role=random.choice(['STAFF', 'STAFF', 'STAFF', 'BRANCH_ADMIN']),
                department_id=self._pick(dept_ids),
                designation_id=self._pick(desig_ids),
                employment_type=random.choice(['FULL_TIME', 'FULL_TIME', 'PART_TIME', 'CONTRACT']),
                employment_status=random.choice(['ACTIVE', 'ACTIVE', 'ACTIVE', 'ON_LEAVE']),
                joining_date=fake.date_between(start_date='-3y', end_date='today'),
                work_location=random.choice(['OFFICE', 'REMOTE', 'HYBRID']),
                default_shift_id=self._pick(shift_ids),
                salary=Decimal(str(random.randint(30000, 200000))),
                bank_name=random.choice(['HBL', 'MCB', 'UBL', 'ABL', 'NBP', 'Meezan']),
                bank_account_number=str(random.randint(10**10, 10**11 - 1)),
            ))
        Employee.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} employees')

        emp_ids = self._ids(Employee)

        # ── Employee Documents ──
        doc_types = ['EDUCATION', 'EXPERIENCE', 'OTHER']
        objs = [
            EmployeeDocument(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                document_type=random.choice(doc_types),
                title=fake.sentence(nb_words=4),
                file_url=fake.url(),
                original_filename=f'{fake.word()}.pdf',
                file_size=random.randint(10000, 5000000),
                mime_type='application/pdf',
                sort_order=random.randint(0, 5),
            )
            for _ in range(count)
        ]
        EmployeeDocument.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} employee documents')

        # ── Employee Promotions ──
        promo_count = min(count, 500)
        objs = [
            EmployeePromotion(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                previous_salary=Decimal(str(random.randint(30000, 100000))),
                new_salary=Decimal(str(random.randint(100000, 250000))),
                effective_date=fake.date_between(start_date='-1y', end_date='today'),
                notes=fake.sentence(),
            )
            for _ in range(promo_count)
        ]
        EmployeePromotion.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {promo_count} employee promotions')

        # ── Employee Asset Assignments ──
        assign_count = min(count, 500)
        objs = [
            EmployeeAssetAssignment(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                asset_id=self._pick(asset_ids),
                source_type='DIRECT',
                quantity=random.randint(1, 3),
                assigned_date=fake.date_between(start_date='-1y', end_date='today'),
                status=random.choice(['ACTIVE', 'ACTIVE', 'RETURNED']),
                condition_on_assignment=random.choice(['NEW', 'GOOD', 'FAIR']),
                notes=fake.sentence(),
            )
            for _ in range(assign_count)
        ]
        EmployeeAssetAssignment.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {assign_count} employee asset assignments')

        # ── Compensations ──
        objs = [
            Compensation(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                house_rent_allowance=Decimal(str(random.randint(5000, 30000))),
                medical_allowance=Decimal(str(random.randint(2000, 10000))),
                transport_allowance=Decimal(str(random.randint(1000, 5000))),
                phone_allowance=Decimal(str(random.randint(500, 2000))),
                utilities_allowance=Decimal(str(random.randint(1000, 5000))),
                education_allowance=Decimal(str(random.randint(0, 10000))),
                overtime_rate=Decimal(str(random.randint(500, 2000))),
                frequency_type='MONTH_RANGE',
                status=random.choice(['PENDING', 'CONFIRM', 'FULLYPAID']),
                review_date=fake.date_between(start_date='today', end_date='+1y'),
            )
            for _ in range(count)
        ]
        Compensation.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} compensations')

        # ── Employee Loans ──
        loan_count = min(count, 500)
        loan_types = [c[0] for c in EmployeeLoan._meta.get_field('loan_type').choices]
        objs = []
        for _ in range(loan_count):
            principal = Decimal(str(random.randint(10000, 200000)))
            objs.append(EmployeeLoan(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                loan_type=random.choice(loan_types),
                principal_amount=principal,
                remaining_amount=principal,
                paid_amount=Decimal('0.00'),
                paid_months=0,
                interest_rate=Decimal(str(random.choice([0, 2, 5, 8]))),
                total_payable=principal,
                frequency_type='MONTH_RANGE',
                status=random.choice(['UNPAID', 'UNPAID', 'PAID']),
                approval=random.choice(['PENDING', 'CONFIRM', 'REJECTED']),
                bank_name=random.choice(['HBL', 'MCB', 'UBL']),
                purpose=fake.sentence(),
            ))
        EmployeeLoan.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {loan_count} employee loans')

        # ── Leave Requests ──
        leave_types = ['CASUAL', 'SICK', 'ANNUAL', 'MATERNITY', 'PATERNITY', 'BEREAVEMENT']
        objs = []
        for _ in range(count):
            start = fake.date_between(start_date='-1y', end_date='today')
            end = start + timedelta(days=random.randint(0, 5))
            total_days = float((end - start).days + 1)
            objs.append(LeaveRequest(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                leave_type=random.choice(leave_types),
                leave_sub_type='FULL_DAY',
                start_date=start,
                end_date=end,
                is_half_day=False,
                reason=fake.sentence(),
                total_days=Decimal(str(total_days)),
                status=random.choice(['PENDING', 'APPROVED', 'APPROVED', 'REJECTED']),
            ))
        LeaveRequest.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} leave requests')

        # ── Payroll Records ──
        months = [(m, y) for y in [2024, 2025, 2026] for m in range(1, 13)]
        objs = []
        for i in range(count):
            month, year = months[i % len(months)]
            base = Decimal(str(random.randint(30000, 200000)))
            bonus = Decimal(str(random.randint(0, 50000)))
            deductions = Decimal(str(random.randint(0, 20000)))
            objs.append(PayrollRecord(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                month=month,
                year=year,
                base_salary=base,
                bonus=bonus,
                deductions=deductions,
                net_salary=base + bonus - deductions,
                total_compensation=bonus,
                total_loan_deduction=deductions,
                total_leave_deduction=Decimal('0.00'),
                transaction_type='SALARY',
                is_cancelled=False,
            ))
        PayrollRecord.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} payroll records')

        # ── Policies ──
        policy_count = min(count, 500)
        policy_offset = self._count(Policy)
        cats = [c[0] for c in Policy.Category.choices]
        statuses = [s[0] for s in Policy.PolicyStatus.choices]
        objs = [
            Policy(
                **self._kw(),
                code=f'POL-{policy_offset + i + 1:04d}',
                title=f'{fake.catch_phrase()} Policy',
                version='1.0',
                category=random.choice(cats),
                department_id=self._pick(dept_ids),
                employee_type='ALL',
                status=random.choice(statuses),
                content='\n\n'.join(fake.paragraphs(nb=3)),
                is_archived=False,
            )
            for i in range(policy_count)
        ]
        Policy.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {policy_count} policies')

        # ── Policy Categories ──
        pc_offset = self._count(PolicyCategory)
        objs = [
            PolicyCategory(
                **self._kw(),
                name=f'Policy Category {pc_offset + i + 1}',
                description=fake.sentence(),
                is_active=True,
                sorting_order=i + 1,
            )
            for i in range(min(count, 50))
        ]
        PolicyCategory.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {min(count, 50)} policy categories')

        # ── Recruitment Candidates ──
        rc_count = min(count, 500)
        stages = [c[0] for c in RecruitmentCandidate.STAGE_CHOICES]
        sources = [c[0] for c in RecruitmentCandidate._meta.get_field('source').choices if c[0]]
        objs = [
            RecruitmentCandidate(
                **self._kw(),
                name=fake.name(),
                email=fake.unique.email(),
                phone=fake.phone_number()[:20],
                position=fake.job(),
                department=random.choice(['HR', 'Engineering', 'Sales', 'Finance', 'Marketing', 'Operations']),
                stage=random.choice(stages),
                status=random.choice(['Active', 'Closed']),
                apply_date=fake.date_between(start_date='-1y', end_date='today'),
                source=random.choice(sources) if sources else 'OTHER',
                expected_salary=Decimal(str(random.randint(30000, 200000))),
                current_company=fake.company(),
                current_position=fake.job(),
                years_of_experience=Decimal(str(random.randint(0, 15))),
                notice_period_days=random.choice([7, 14, 30, 60, 90]),
            )
            for _ in range(rc_count)
        ]
        RecruitmentCandidate.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {rc_count} recruitment candidates')

        # ── Exit Records ──
        exit_count = min(count, 100)
        reasons = [c[0] for c in ExitRecord.EXIT_REASONS]
        objs = [
            ExitRecord(
                **self._kw(),
                employee_id=self._pick(emp_ids),
                employee_name=fake.name(),
                exit_date=fake.date_between(start_date='-1y', end_date='today'),
                last_working_day=fake.date_between(start_date='-1y', end_date='today'),
                reason=random.choice(reasons),
                notice_served=random.choice([True, True, False]),
                final_settlement=Decimal(str(random.randint(10000, 200000))),
                status=random.choice(['CONFIRMED', 'CONFIRMED', 'REJECTED']),
                notes=fake.sentence(),
            )
            for _ in range(exit_count)
        ]
        ExitRecord.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {exit_count} exit records')

    # ── Phase 4: Inventory ───────────────────────────────────────────────────

    def _seed_inventory(self, count):
        self.stdout.write(self.style.WARNING('\n── Inventory ──'))

        # ── Categories ──
        cat_offset = self._count(Category)
        objs = [
            Category(
                **self._kw(),
                name=f'{fake.word().title()} {fake.word().title()}',
                code=f'CAT-{cat_offset + i + 1:04d}',
                description=fake.sentence(),
            )
            for i in range(count)
        ]
        Category.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} categories')

        # ── Brands ──
        brd_offset = self._count(Brand)
        objs = [
            Brand(
                **self._kw(),
                name=fake.company(),
                code=f'BRD-{brd_offset + i + 1:04d}',
                description=fake.sentence(),
                country_of_origin=fake.country(),
            )
            for i in range(count)
        ]
        Brand.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} brands')

        # ── Warehouses ──
        wh_count = min(count, 20)
        wh_offset = self._count(Warehouse)
        objs = [
            Warehouse(
                **self._kw(),
                warehouse_name=f'{fake.city()} Warehouse {wh_offset + i + 1}',
                code=f'WH-{wh_offset + i + 1:04d}',
                country=fake.country(),
                city=fake.city(),
                state=fake.state(),
                address_line=fake.address(),
                email=fake.company_email(),
                is_active=True,
                description=fake.sentence(),
            )
            for i in range(wh_count)
        ]
        Warehouse.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {wh_count} warehouses')

        cat_ids = self._ids(Category)
        brand_ids = self._ids(Brand)
        wh_ids = self._ids(Warehouse)
        emp_ids = self._ids(Employee)

        # ── Products ──
        units = ['PIECE', 'KG', 'GRAM', 'LITER', 'PACK', 'DOZEN']
        objs = [
            Product(
                **self._kw(),
                product_name=fake.catch_phrase(),
                description=fake.paragraph(),
                category_id=self._pick(cat_ids),
                brand_id=self._pick(brand_ids),
                unit=random.choice(units),
                tax_rate=Decimal(str(random.choice([0, 5, 10, 15, 17]))),
                status=random.choice(['draft', 'active', 'active', 'active']),
                is_active=True,
            )
            for i in range(count)
        ]
        Product.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} products')

        prod_ids = self._ids(Product)

        # ── Product Variants ──
        sku_offset = self._count(ProductVariant)
        objs = [
            ProductVariant(
                **self._kw(),
                product_id=self._pick(prod_ids),
                sku=f'SKU-{sku_offset + i + 1:06d}',
                variant_title=f'{fake.word().title()} - {random.choice(["Red", "Blue", "Green", "Black", "White"])}',
                barcode=str(random.randint(10**12, 10**13 - 1)),
                buying_price=Decimal(str(random.randint(100, 5000))),
                selling_price=Decimal(str(random.randint(200, 10000))),
                min_stock_level=random.randint(5, 20),
                max_stock_level=random.randint(50, 200),
            )
            for i in range(count)
        ]
        ProductVariant.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} product variants')

        var_ids = self._ids(ProductVariant)

        # ── Variant Attributes ──
        keys = ['Color', 'Size', 'Material', 'Weight', 'Style', 'Finish']
        objs = [
            VariantAttribute(
                **self._kw(),
                variant_id=self._pick(var_ids),
                attribute_key=random.choice(keys),
                attribute_value=f'{fake.word().title()} {random.randint(1, 100)}',
            )
            for _ in range(count)
        ]
        VariantAttribute.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} variant attributes')

        # ── Variant Images ──
        objs = [
            VariantImage(
                **self._kw(),
                variant_id=self._pick(var_ids),
                image_url=f'https://picsum.photos/seed/{uuid.uuid4().hex[:8]}/800/600',
                sort_order=i % 5,
                is_primary=(i % 5 == 0),
            )
            for i in range(count)
        ]
        VariantImage.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} variant images')

        # ── Suppliers ──
        sup_offset = self._count(Supplier)
        objs = [
            Supplier(
                **self._kw(),
                name=fake.company(),
                code=f'SUP-{sup_offset + i + 1:04d}',
                contact_person=fake.name(),
                email=fake.company_email(),
                phone=fake.phone_number()[:50],
                address_line=fake.address(),
                country=fake.country(),
                city=fake.city(),
                state=fake.state(),
                postal_code=str(random.randint(10000, 99999)),
                partner_type='supplier',
                status=random.choice(['active', 'active', 'active', 'inactive']),
            )
            for i in range(count)
        ]
        Supplier.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} suppliers')

        # ── Customers ──
        cus_offset = self._count(Customer)
        objs = [
            Customer(
                **self._kw(),
                name=fake.company(),
                customer_code=f'CUS-{cus_offset + i + 1:04d}',
                contact_person=fake.name(),
                email=fake.company_email(),
                phone=fake.phone_number()[:50],
                address_line=fake.address(),
                city=fake.city(),
                state=fake.state(),
                country=fake.country(),
                postal_code=str(random.randint(10000, 99999)),
                is_active=True,
            )
            for i in range(count)
        ]
        Customer.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} customers')

        sup_ids = self._ids(Supplier)
        cus_ids = self._ids(Customer)

        # ── Stock Items ──
        objs = []
        seen = set()
        for _ in range(count):
            vid = self._pick(var_ids)
            wid = self._pick(wh_ids)
            if not vid or not wid:
                continue
            key = (vid, wid)
            if key in seen:
                continue
            seen.add(key)
            on_hand = random.randint(0, 500)
            reserved = random.randint(0, min(on_hand, 50))
            objs.append(StockItem(
                **self._kw(),
                variant_id=vid,
                warehouse_id=wid,
                quantity_on_hand=on_hand,
                quantity_reserved=reserved,
                version=1,
            ))
        StockItem.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {len(objs)} stock items')

        # ── Purchase Orders ──
        po_offset = self._count(PurchaseOrder)
        objs = [
            PurchaseOrder(
                **self._kw(),
                order_number=f'PO-{po_offset + i + 1:06d}',
                supplier_id=self._pick(sup_ids),
                warehouse_id=self._pick(wh_ids),
                inventory_type='FOR_SALE',
                status=random.choice(['DRAFT', 'CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']),
                order_date=fake.date_between(start_date='-1y', end_date='today'),
                expected_delivery_date=fake.date_between(start_date='today', end_date='+30d'),
                total_amount=Decimal(str(random.randint(1000, 500000))),
                notes=fake.sentence(),
            )
            for i in range(count)
        ]
        PurchaseOrder.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} purchase orders')

        po_ids = self._ids(PurchaseOrder)

        # ── Purchase Order Lines ──
        objs = [
            PurchaseOrderLine(
                **self._kw(),
                purchase_order_id=self._pick(po_ids),
                variant_id=self._pick(var_ids),
                quantity_ordered=random.randint(1, 100),
                quantity_received=random.randint(0, 50),
                unit_cost=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                tax_rate=Decimal('17.00'),
                status=random.choice(['PENDING', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED']),
            )
            for _ in range(count)
        ]
        PurchaseOrderLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} purchase order lines')

        pol_ids = self._ids(PurchaseOrderLine)

        # ── Goods Receipts ──
        gr_count = min(count, 500)
        gr_offset = self._count(GoodsReceipt)
        objs = [
            GoodsReceipt(
                **self._kw(),
                receipt_number=f'GR-{gr_offset + i + 1:06d}',
                purchase_order_id=self._pick(po_ids),
                received_date=fake.date_time_between(start_date='-1y', end_date='now'),
                status='COMPLETED',
                notes=fake.sentence(),
            )
            for i in range(gr_count)
        ]
        GoodsReceipt.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {gr_count} goods receipts')

        gr_ids = self._ids(GoodsReceipt)

        # ── Goods Receipt Lines ──
        grl_count = min(count, 500)
        objs = [
            GoodsReceiptLine(
                **self._kw(),
                goods_receipt_id=self._pick(gr_ids),
                purchase_order_line_id=self._pick(pol_ids),
                quantity_received=random.randint(1, 50),
                unit_cost=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                accepted=random.choice([True, True, True, False]),
            )
            for _ in range(grl_count)
        ]
        GoodsReceiptLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {grl_count} goods receipt lines')

        # ── Sales Orders ──
        so_offset = self._count(SalesOrder)
        objs = [
            SalesOrder(
                **self._kw(),
                order_number=f'SO-{so_offset + i + 1:06d}',
                customer_id=self._pick(cus_ids),
                warehouse_id=self._pick(wh_ids),
                status=random.choice(['PENDING', 'DRAFT', 'COMPLETE']),
                order_date=fake.date_between(start_date='-1y', end_date='today'),
                payment_method=random.choice(['CASH', 'BANK_TRANSFER', 'CREDIT']),
                total_amount=Decimal(str(random.randint(1000, 200000))),
                source=random.choice(['INVENTORY', 'SALES_POS', 'SALES_AGENT']),
            )
            for i in range(count)
        ]
        SalesOrder.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} sales orders')

        so_ids = self._ids(SalesOrder)

        # ── Sales Order Lines ──
        objs = [
            SalesOrderLine(
                **self._kw(),
                sales_order_id=self._pick(so_ids),
                variant_id=self._pick(var_ids),
                quantity_ordered=random.randint(1, 50),
                unit_price=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                tax_rate=Decimal('17.00'),
                discount_percent=Decimal(str(random.choice([0, 0, 5, 10, 15]))),
                discount_amount=Decimal('0.00'),
                status=random.choice(['PENDING', 'COMPLETE']),
            )
            for _ in range(count)
        ]
        SalesOrderLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} sales order lines')

        # ── Stock Transfers ──
        trf_count = min(count, 500)
        trf_offset = self._count(StockTransfer)
        objs = []
        for i in range(trf_count):
            src = self._pick(wh_ids)
            dst_candidates = [w for w in wh_ids if w != src] if wh_ids else []
            objs.append(StockTransfer(
                **self._kw(),
                transfer_number=f'TRF-{trf_offset + i + 1:06d}',
                variant_id=self._pick(var_ids),
                source_warehouse_id=src,
                destination_warehouse_id=self._pick(dst_candidates) if dst_candidates else src,
                quantity=random.randint(1, 100),
                status=random.choice(['DRAFT', 'PENDING', 'IN_TRANSIT', 'COMPLETED']),
                planned_date=fake.date_between(start_date='today', end_date='+30d'),
            ))
        StockTransfer.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {trf_count} stock transfers')

        # ── Alerts ──
        alert_types = [t[0] for t in Alert.TYPES]
        severities = [s[0] for s in Alert.SEVERITY]
        objs = [
            Alert(
                **self._kw(),
                type=random.choice(alert_types),
                severity=random.choice(severities),
                title=fake.sentence(nb_words=5),
                message=fake.paragraph(),
                entity_type='productvariant',
                is_read=random.choice([True, False]),
            )
            for _ in range(count)
        ]
        Alert.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} alerts')

        # ── Inventory Transactions ──
        tx_types = [t[0] for t in InventoryTransaction.TRANSACTION_TYPES]
        objs = []
        for i in range(count):
            qty_before = random.randint(0, 500)
            change = random.randint(-50, 100)
            objs.append(InventoryTransaction(
                **self._kw(),
                transaction_id=uuid.uuid4(),
                variant_id=self._pick(var_ids),
                warehouse_id=self._pick(wh_ids),
                quantity_change=change,
                quantity_before=qty_before,
                quantity_after=max(0, qty_before + change),
                unit_cost=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                transaction_type=random.choice(tx_types),
                reason_text=fake.sentence(),
            ))
        InventoryTransaction.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} inventory transactions')

    # ── Phase 5: Finance ─────────────────────────────────────────────────────

    def _seed_finance(self, count):
        self.stdout.write(self.style.WARNING('\n── Finance ──'))

        sup_ids = self._ids(Supplier)
        cus_ids = self._ids(Customer)
        var_ids = self._ids(ProductVariant)
        po_ids = self._ids(PurchaseOrder)
        so_ids = self._ids(SalesOrder)

        # ── Accounts ──
        acct_offset = self._count(Account)
        objs = [
            Account(
                **self._kw(),
                code=f'ACCT-{acct_offset + i + 1:04d}',
                name=f'{fake.word().title()} Account',
                account_type=random.choice(['ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE']),
                is_active=True,
                description=fake.sentence(),
            )
            for i in range(count)
        ]
        Account.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} accounts')

        acct_ids = self._ids(Account)

        # ── Bank Accounts ──
        bank_count = min(count, 100)
        bank_offset = self._count(BankAccount)
        banks = ['HBL', 'MCB', 'UBL', 'ABL', 'NBP', 'Meezan Bank', 'Faysal Bank', 'Silk Bank']
        objs = []
        for i in range(bank_count):
            opening = Decimal(str(random.randint(10000, 1000000)))
            objs.append(BankAccount(
                **self._kw(),
                account_name=f'{fake.company()} Current',
                account_number=f'BANK-{bank_offset + i + 1:06d}',
                bank_name=random.choice(banks),
                opening_balance=opening,
                book_balance=opening,
                cleared_balance=opening,
                currency='USD',
                is_active=True,
            ))
        BankAccount.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {bank_count} bank accounts')

        bank_ids = self._ids(BankAccount)

        # ── Journal Entries ──
        je_offset = self._count(JournalEntry)
        objs = [
            JournalEntry(
                **self._kw(),
                entry_number=f'JE-{je_offset + i + 1:06d}',
                date=fake.date_between(start_date='-1y', end_date='today'),
                description=fake.sentence(),
                is_posted=True,
            )
            for i in range(count)
        ]
        JournalEntry.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} journal entries')

        je_ids = self._ids(JournalEntry)

        # ── Journal Lines ──
        objs = [
            JournalLine(
                **self._kw(),
                journal_entry_id=self._pick(je_ids),
                account_id=self._pick(acct_ids),
                debit=Decimal(str(random.randint(0, 100000))),
                credit=Decimal(str(random.randint(0, 100000))),
            )
            for _ in range(count)
        ]
        JournalLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} journal lines')

        # ── Payments ──
        ct_inv = ContentType.objects.get_for_model(CustomerInvoice)
        ct_bill = ContentType.objects.get_for_model(SupplierBill)
        ct_exp = ContentType.objects.get_for_model(Expense)
        ct_choices = [ct_inv, ct_bill, ct_exp]
        pay_types = ['RECEIPT', 'PAYMENT']
        methods = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'CREDIT_CARD']
        objs = []
        for i in range(count):
            pt = random.choice(pay_types)
            objs.append(Payment(
                **self._kw(),
                payment_type=pt,
                payment_method=random.choice(methods),
                amount=Decimal(str(random.randint(100, 100000))),
                payment_date=fake.date_between(start_date='-1y', end_date='today'),
                reference_number=f'PAY-{i+1:06d}',
                content_type=random.choice(ct_choices),
                status=random.choice(['DRAFT', 'CONFIRMED', 'CONFIRMED', 'CANCELLED']),
            ))
        Payment.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} payments')

        # ── Expenses ──
        exp_offset = self._count(Expense)
        exp_cats = [c[0] for c in Expense.EXPENSE_CATEGORIES]
        objs = [
            Expense(
                **self._kw(),
                expense_number=f'EXP-{exp_offset + i + 1:06d}',
                category=random.choice(exp_cats),
                expense_date=fake.date_between(start_date='-1y', end_date='today'),
                amount=Decimal(str(random.randint(100, 50000))),
                description=fake.sentence(),
                notes=fake.paragraph(),
                supplier_id=self._pick(sup_ids) if random.random() > 0.5 else None,
            )
            for i in range(count)
        ]
        Expense.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} expenses')

        # ── Budgets ──
        objs = []
        for _ in range(count):
            pt = random.choice(['MONTHLY', 'QUARTERLY', 'YEARLY'])
            yr = random.choice([2024, 2025, 2026])
            objs.append(Budget(
                **self._kw(),
                account_id=self._pick(acct_ids),
                period_type=pt,
                year=yr,
                month=random.randint(1, 12) if pt == 'MONTHLY' else None,
                quarter=random.randint(1, 4) if pt == 'QUARTERLY' else None,
                amount=Decimal(str(random.randint(10000, 500000))),
                notes=fake.sentence(),
            ))
        Budget.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} budgets')

        # ── Supplier Bills ──
        bill_count = min(count, 500)
        bill_offset = self._count(SupplierBill)
        objs = [
            SupplierBill(
                **self._kw(),
                bill_number=f'BILL-{bill_offset + i + 1:06d}',
                supplier_id=self._pick(sup_ids),
                purchase_order_id=self._pick(po_ids) if random.random() > 0.5 else None,
                bill_date=fake.date_between(start_date='-1y', end_date='today'),
                due_date=fake.date_between(start_date='today', end_date='+60d'),
                amount=Decimal(str(random.randint(1000, 200000))),
                status=random.choice(['DRAFT', 'CANCELLED']),
                notes=fake.sentence(),
            )
            for i in range(bill_count)
        ]
        SupplierBill.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {bill_count} supplier bills')

        # ── Customer Invoices ──
        inv_count = min(count, 500)
        inv_offset = self._count(CustomerInvoice)
        sources = ['FINANCE', 'SALES_POS', 'SALES_AGENT', 'SALES_QUOTE']
        objs = [
            CustomerInvoice(
                **self._kw(),
                invoice_number=f'INV-{inv_offset + i + 1:06d}',
                customer_id=self._pick(cus_ids),
                sales_order_id=self._pick(so_ids) if random.random() > 0.5 else None,
                invoice_date=fake.date_between(start_date='-1y', end_date='today'),
                due_date=fake.date_between(start_date='today', end_date='+60d'),
                amount=Decimal(str(random.randint(1000, 200000))),
                status=random.choice(['DRAFT', 'CANCELLED']),
                payment_method=random.choice(['CASH', 'BANK_TRANSFER', 'CREDIT']),
                source=random.choice(sources),
                notes=fake.sentence(),
            )
            for i in range(inv_count)
        ]
        CustomerInvoice.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {inv_count} customer invoices')

        ci_ids = self._ids(CustomerInvoice)

        # ── Customer Invoice Lines ──
        cil_count = min(count, 500)
        objs = [
            CustomerInvoiceLine(
                **self._kw(),
                customer_invoice_id=self._pick(ci_ids),
                variant_id=self._pick(var_ids),
                quantity=random.randint(1, 50),
                unit_price=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                tax_rate=Decimal('17.00'),
                discount_amount=Decimal(str(random.randint(0, 5000))),
            )
            for _ in range(cil_count)
        ]
        CustomerInvoiceLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {cil_count} customer invoice lines')

        # ── Bank Transactions ──
        bt_count = min(count, 500)
        tx_types = [t[0] for t in BankTransaction.TRANSACTION_TYPES]
        objs = [
            BankTransaction(
                **self._kw(),
                bank_account_id=self._pick(bank_ids),
                transaction_date=fake.date_between(start_date='-1y', end_date='today'),
                amount=Decimal(str(random.randint(100, 100000))),
                transaction_type=random.choice(tx_types),
                description=fake.sentence(),
                reconciled=random.choice([True, False]),
            )
            for _ in range(bt_count)
        ]
        BankTransaction.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {bt_count} bank transactions')

    # ── Phase 6: Sales ───────────────────────────────────────────────────────

    def _seed_sales(self, count):
        self.stdout.write(self.style.WARNING('\n── Sales ──'))

        cus_ids = self._ids(Customer)
        var_ids = self._ids(ProductVariant)
        so_ids = self._ids(SalesOrder)
        wh_ids = self._ids(Warehouse)

        # ── Leads ──
        sources = [s[0] for s in Lead.SOURCE_CHOICES]
        statuses = [s[0] for s in Lead.STATUS_CHOICES]
        objs = [
            Lead(
                **self._kw(),
                first_name=fake.first_name(),
                last_name=fake.last_name(),
                company_name=fake.company(),
                email=fake.unique.email(),
                phone=fake.phone_number()[:50],
                source=random.choice(sources),
                status=random.choice(statuses),
                notes=fake.paragraph(),
                address_line=fake.address(),
                country=fake.country(),
                city=fake.city(),
                state=fake.state(),
                score=random.randint(0, 100),
                follow_up_date=fake.date_between(start_date='today', end_date='+30d'),
                follow_up_notes=fake.sentence(),
            )
            for i in range(count)
        ]
        Lead.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} leads')

        lead_ids = self._ids(Lead)

        # ── Quotes ──
        qt_offset = self._count(Quote)
        quote_statuses = [s[0] for s in Quote.STATUS_CHOICES]
        objs = [
            Quote(
                **self._kw(),
                quote_number=f'QT-{qt_offset + i + 1:06d}',
                lead_id=self._pick(lead_ids),
                customer_id=self._pick(cus_ids),
                date=fake.date_between(start_date='-1y', end_date='today'),
                expiration_date=fake.date_between(start_date='today', end_date='+60d'),
                total_amount=Decimal(str(random.randint(1000, 200000))),
                status=random.choice(quote_statuses),
                source=random.choice(['SALES_DESKTOP', 'SALES_POS', 'SALES_AGENT']),
                notes=fake.paragraph(),
            )
            for i in range(count)
        ]
        Quote.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} quotes')

        qt_ids = self._ids(Quote)

        # ── Quote Lines ──
        objs = [
            QuoteLine(
                **self._kw(),
                quote_id=self._pick(qt_ids),
                variant_id=self._pick(var_ids),
                quantity=random.randint(1, 50),
                unit_price=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                tax_rate=Decimal('17.00'),
                discount_amount=Decimal(str(random.randint(0, 5000))),
            )
            for _ in range(count)
        ]
        QuoteLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} quote lines')

        # ── Sales Returns ──
        sr_count = min(count, 200)
        sr_offset = self._count(SalesReturn)
        objs = [
            SalesReturn(
                **self._kw(),
                return_number=f'SR-{sr_offset + i + 1:06d}',
                sales_order_id=self._pick(so_ids),
                warehouse_id=self._pick(wh_ids),
                return_date=fake.date_time_between(start_date='-6m', end_date='now'),
                status='COMPLETED',
                reason=fake.sentence(),
            )
            for i in range(sr_count)
        ]
        SalesReturn.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {sr_count} sales returns')

        sr_ids = self._ids(SalesReturn)
        so_line_ids = self._ids(SalesOrderLine)

        # ── Sales Return Lines ──
        srl_count = min(count, 200)
        objs = [
            SalesReturnLine(
                **self._kw(),
                sales_return_id=self._pick(sr_ids),
                sales_order_line_id=self._pick(so_line_ids),
                quantity_returned=random.randint(1, 10),
                refund_amount=Decimal(str(random.randint(100, 10000))),
                restock=random.choice([True, False]),
                unit_cost=Decimal(str(random.randint(100, 5000))).quantize(Decimal('0.0001')),
                reason=fake.sentence(),
            )
            for _ in range(srl_count)
        ]
        SalesReturnLine.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {srl_count} sales return lines')

        # ── Stock Reservations ──
        srsv_count = min(count, 500)
        statuses = [c[0] for c in StockReservation.STATUS_CHOICES]
        objs = [
            StockReservation(
                **self._kw(),
                variant_id=self._pick(var_ids),
                warehouse_id=self._pick(wh_ids),
                quantity=random.randint(1, 50),
                reservation_type=random.choice(['PURCHASE_ORDER', 'SALES_ORDER']),
                reference_id=uuid.uuid4(),
                reserved_until=fake.date_time_between(start_date='now', end_date='+30d'),
                status=random.choice(statuses),
            )
            for _ in range(srsv_count)
        ]
        StockReservation.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {srsv_count} stock reservations')

    # ── Phase 7: Monitoring ──────────────────────────────────────────────────

    def _seed_monitoring(self, count):
        self.stdout.write(self.style.WARNING('\n── Monitoring ──'))

        # ── Sites ──
        site_count = min(count, 100)
        objs = [
            Site(
                **self._kw(),
                name=f'{fake.city()} Site {i+1}',
                location=fake.address(),
                description=fake.sentence(),
            )
            for i in range(site_count)
        ]
        Site.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {site_count} sites')

        site_ids = self._ids(Site)

        # ── NVRs ──
        nvr_count = min(count, 200)
        objs = [
            Nvr(
                **self._kw(),
                site_id=self._pick(site_ids),
                nvr_name=f'NVR-{fake.word().title()}-{i+1}',
                nvr_username=fake.user_name(),
                password=fake.password(length=16),
                ip=f'{random.randint(192, 223)}.{random.randint(0, 255)}.{random.randint(0, 255)}.{random.randint(1, 254)}',
                port=random.choice([80, 443, 8080, 554]),
            )
            for i in range(nvr_count)
        ]
        Nvr.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {nvr_count} NVRs')

        nvr_ids = self._ids(Nvr)

        # ── Cameras ──
        cam_count = min(count, 500)
        objs = []
        for i in range(cam_count):
            objs.append(Camera(
                **self._kw(),
                nvr_id=self._pick(nvr_ids),
                camera=f'Cam-{i+1}',
                channel=(i % 16) + 1,
                zone=f'{fake.word().title()} Zone',
                purpose=fake.sentence(),
            ))
        Camera.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {cam_count} cameras')

    # ── Phase 8: Notifications ───────────────────────────────────────────────

    def _seed_notifications(self, count):
        self.stdout.write(self.style.WARNING('\n── Notifications ──'))

        user_ids = list(
            User.objects.filter(company_id=COMPANY_ID)
            .values_list('id', flat=True)[:100]
        )

        notif_types = ['info', 'success', 'warning', 'error']
        titles = [
            'New order received', 'Stock low alert', 'Payment confirmed',
            'Employee leave request', 'Invoice generated', 'Transfer completed',
            'New lead added', 'Quote approved', 'Salary processed',
            'Asset assigned', 'Expense recorded', 'Budget exceeded',
        ]
        objs = [
            Notification(
                **self._kw(),
                user_id=self._pick(user_ids),
                title=random.choice(titles),
                message=fake.paragraph(),
                is_read=random.choice([True, False]),
                notification_type=random.choice(notif_types),
            )
            for _ in range(count)
        ]
        Notification.objects.bulk_create(objs, batch_size=500, ignore_conflicts=True)
        self.stdout.write(f'  ✓ {count} notifications')
