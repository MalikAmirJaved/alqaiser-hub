# apps/hr/models.py
import uuid
from django.db import models
from django.conf import settings as django_settings
from apps.organization.models import Company, Branch
from apps.compsetting.models import LeaveType
from datetime import date
from django.core.validators import MinLengthValidator
from django.utils import timezone

def current_year():
    return date.today().year

class TimeStampedModel(models.Model):
    """Abstract base model with timestamp fields"""
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='%(class)s_deleted'
    )

    class Meta:
        abstract = True


class ShiftTemplate(TimeStampedModel):
    """Shift templates for defining working patterns"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='shift_templates'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shift_templates'
    )
    
    # Core Fields
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_shift_templates'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_shift_templates'
    )
    
    class Meta:
        verbose_name = "Shift Template"
        verbose_name_plural = "Shift Templates"
        ordering = ['name']
        unique_together = [('company', 'name')]
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.start_time} - {self.end_time})"
    
    @property
    def working_hours(self):
        """Calculate working hours excluding break"""
        from datetime import datetime, timedelta
        start = datetime.combine(datetime.today(), self.start_time)
        end = datetime.combine(datetime.today(), self.end_time)
        
        # Handle overnight shifts
        if end <= start:
            end += timedelta(days=1)
        
        total_minutes = (end - start).total_seconds() / 60
        return round((total_minutes - self.break_minutes) / 60, 2)
    

class Asset(TimeStampedModel):
    """HR Assets - hardware, equipment, devices"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='hr_assets'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='hr_assets'
    )
    
    # Core Fields
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=100, blank=True, null=True)
    model = models.CharField(max_length=100, blank=True, null=True)
    serial_number = models.CharField(max_length=100, blank=True, null=True, unique=True)
    description = models.TextField(blank=True, null=True)
    
    # Purchase Information
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    vendor = models.CharField(max_length=255, blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_assigned = models.BooleanField(default=False)
    
    # Adding quantity tracking for future stock management
    total_quantity = models.PositiveIntegerField(default=1, null=True, blank=True)  
    available_quantity = models.PositiveIntegerField(default=1, null=True, blank=True)

    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_hr_assets'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_hr_assets'
    )
    
    class Meta:
        verbose_name = "Asset"
        verbose_name_plural = "Assets"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['is_assigned']),
            models.Index(fields=['vendor']),
        ]

    
    def __str__(self):
        return f"{self.name} ({self.brand or 'No Brand'})"
    
    @property
    def warranty_status(self):
        """Check if warranty is active"""
        if not self.warranty_until:
            return None
        from datetime import date
        return self.warranty_until >= date.today()



class AssetCategory(TimeStampedModel):
    """Asset Categories/Kits - bundle multiple assets together"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='asset_categories'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='asset_categories'
    )
    
    # Core Fields
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Assets in this category
    assets = models.ManyToManyField(
        Asset,
        related_name='categories',
        blank=True
    )
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_asset_categories'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_asset_categories'
    )
    
    class Meta:
        verbose_name = "Asset Category"
        verbose_name_plural = "Asset Categories"
        ordering = ['name']
        unique_together = [('company', 'name')]
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.assets.count()} assets)"
    
    def get_asset_ids(self):
        """Return list of asset IDs in this category"""
        return list(self.assets.values_list('id', flat=True))


class Employee(TimeStampedModel):
    """Employee records"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='employees'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )
    
    # Identification
    employee_id = models.CharField(max_length=50, unique=True)
    
    # Personal Information
    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100, blank=True, null=True)
    father_name = models.CharField(max_length=100, blank=True, null=True)
    cnic = models.CharField(max_length=15, blank=True, null=True)
    date_of_birth = models.DateField(null=True, blank=True)
    gender = models.CharField(
        max_length=10,
        choices=[
            ('MALE', 'Male'),
            ('FEMALE', 'Female'),
            ('OTHER', 'Other'),
        ],
        default='MALE'
    )
    marital_status = models.CharField(
        max_length=20,
        choices=[
            ('SINGLE', 'Single'),
            ('MARRIED', 'Married'),
            ('DIVORCED', 'Divorced'),
            ('WIDOWED', 'Widowed'),
        ],
        default='SINGLE'
    )
    
    # Contact Information
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    personal_email = models.EmailField(blank=True, null=True)
    
    # Address
    address_line = models.TextField(blank=True, null=True)
    country = models.CharField(max_length=100, default='PK')
    state = models.CharField(max_length=100, blank=True, null=True)
    city = models.CharField(max_length=100, blank=True, null=True)
    postal_code = models.CharField(max_length=20, blank=True, null=True)
    
    # Emergency Contact
    emergency_contact_name = models.CharField(max_length=100, blank=True, null=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True, null=True)
    emergency_contact_relation = models.CharField(max_length=50, blank=True, null=True)
    
    # Employment Information
    role = models.CharField(
        max_length=50,
        choices=[
            ('STAFF', 'Staff'),
            ('BRANCH_ADMIN', 'Branch Admin'),
            ('COMPANY_ADMIN', 'Company Admin'),
        ],
        default='STAFF'
    )
    department = models.CharField(max_length=100)
    designation = models.CharField(max_length=100, blank=True, null=True)
    employment_type = models.CharField(
        max_length=50,
        choices=[
            ('FULL_TIME', 'Full Time'),
            ('PART_TIME', 'Part Time'),
            ('CONTRACT', 'Contract'),
            ('INTERN', 'Intern'),
        ],
        default='FULL_TIME'
    )
    employment_status = models.CharField(
        max_length=50,
        choices=[
            ('ACTIVE', 'Active'),
            ('ON_LEAVE', 'On Leave'),
            ('SUSPENDED', 'Suspended'),
            ('TERMINATED', 'Terminated'),
            ('RESIGNED', 'Resigned'),
        ],
        default='ACTIVE'
    )
    
    # Dates
    joining_date = models.DateField()
    confirmation_date = models.DateField(null=True, blank=True)
    probation_days = models.PositiveIntegerField(default=180)
    
    # Work
    work_location = models.CharField(
        max_length=50,
        choices=[
            ('OFFICE', 'Office'),
            ('REMOTE', 'Remote'),
            ('HYBRID', 'Hybrid'),
        ],
        default='OFFICE'
    )
    reporting_manager = models.ForeignKey(
        'self',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reportees'
    )
    
    # Default Shift
    default_shift = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees_with_default_shift'
    )
    
    # Bank Information
    bank_name = models.CharField(max_length=100, blank=True, null=True)
    bank_account_number = models.CharField(max_length=50, blank=True, null=True)
    bank_iban = models.CharField(max_length=50, blank=True, null=True)
    salary = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_employees'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_employees'
    )
    
    class Meta:
        verbose_name = "Employee"
        verbose_name_plural = "Employees"
        ordering = ['first_name', 'last_name']
        unique_together = [('company', 'employee_id')]
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['branch']),
            models.Index(fields=['department']),
            models.Index(fields=['employment_status']),
            models.Index(fields=['cnic']),
        ]
    
    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name or ''}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name or ''}".strip()


class EmployeeAssetAssignment(models.Model):
    """Individual asset assignments (generated from direct assignment or kit expansion)"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='employee_asset_assignments')
    branch = models.ForeignKey(Branch, on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_asset_assignments')
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='asset_assignments')
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='employee_assignments')
    
    # Track source: direct or from kit
    source_type = models.CharField(
        max_length=20,
        choices=[('DIRECT', 'Direct Assignment'), ('KIT', 'Kit Assignment')],
        default='DIRECT'
    )
    source_kit = models.ForeignKey(
        AssetCategory,  # This IS the Kit model
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='kit_assignments'
    )
    
    assigned_date = models.DateField()
    returned_date = models.DateField(null=True, blank=True)
    expected_return_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(
        max_length=20,
        choices=[
            ('ACTIVE', 'Active'),
            ('RETURNED', 'Returned'),
            ('LOST', 'Lost'),
            ('DAMAGED', 'Damaged'),
        ],
        default='ACTIVE'
    )
    condition_on_assignment = models.CharField(
        max_length=20,
        choices=[('NEW', 'New'), ('GOOD', 'Good'), ('FAIR', 'Fair'), ('POOR', 'Poor')],
        default='GOOD'
    )
    condition_on_return = models.CharField(
        max_length=20,
        choices=[('GOOD', 'Good'), ('FAIR', 'Fair'), ('POOR', 'Poor'), ('DAMAGED', 'Damaged')],
        null=True,
        blank=True
    )
    notes = models.TextField(blank=True, null=True)
    return_notes = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_asset_assignments')
    updated_by = models.ForeignKey(django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_asset_assignments')
    
    class Meta:
        ordering = ['-assigned_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['asset', 'status']),
            models.Index(fields=['company', 'status']),
            models.Index(fields=['source_kit']),
        ]
        constraints = [
            # Prevent duplicate active assignments of same asset to same employee
            models.UniqueConstraint(
                fields=['employee', 'asset'],
                condition=models.Q(status='ACTIVE'),
                name='unique_active_assignment'
            )
        ]

class EmployeeDefaultShift(TimeStampedModel):
    """Track employee default shift history"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='employee_default_shifts'
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='default_shifts'
    )
    template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.CASCADE,
        related_name='employee_default_shifts'
    )
    
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_default_shifts'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_default_shifts'
    )
    
    class Meta:
        verbose_name = "Employee Default Shift"
        verbose_name_plural = "Employee Default Shifts"
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['employee', 'effective_from']),
        ]


class Compensation(TimeStampedModel):
    """Employee compensation/benefits structure"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='compensations'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='compensations'
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='compensations'
    )
    
    # Salary Structure
    grade = models.CharField(max_length=50, blank=True, null=True)
    house_rent_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medical_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    fuel_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    phone_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    utilities_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    education_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    other_allowances = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Employer Contributions
    employer_pf = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    employer_eobi = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Additional
    overtime_rate = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    bonus_percentage = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Status & Dates
    is_active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=20,
        choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')],
        default='ACTIVE'
    )
    effective_date = models.DateField()
    review_date = models.DateField(null=True, blank=True)
    
    # Notes
    notes = models.TextField(blank=True, null=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_compensations'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_compensations'
    )
    
    class Meta:
        verbose_name = "Compensation"
        verbose_name_plural = "Compensations"
        ordering = ['-effective_date']
        indexes = [
            models.Index(fields=['employee', 'is_active']),
            models.Index(fields=['company', 'is_active']),
        ]
    
    def __str__(self):
        return f"{self.employee.employee_id} - Compensation ({self.grade or 'N/A'})"
    
    @property
    def total_allowances(self):
        return (
            self.house_rent_allowance +
            self.medical_allowance +
            self.transport_allowance +
            self.fuel_allowance +
            self.phone_allowance +
            self.utilities_allowance +
            self.education_allowance +
            self.other_allowances
        )
    
    @property
    def total_ctc(self):
        return self.total_allowances + self.employer_pf + self.employer_eobi
    
    @property
    def total_monthly(self):
        return self.total_allowances


class EmployeeLoan(TimeStampedModel):
    """Employee loans/advances"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='employee_loans'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_loans'
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='loans'
    )
    
    # Loan Details
    loan_type = models.CharField(
        max_length=50,
        choices=[
            ('PERSONAL_LOAN', 'Personal Loan'),
            ('SALARY_ADVANCE', 'Salary Advance'),
            ('CAR_LOAN', 'Car Loan'),
            ('HOUSE_LOAN', 'House Loan'),
            ('EDUCATION_LOAN', 'Education Loan'),
            ('MEDICAL_LOAN', 'Medical Loan'),
            ('EMERGENCY_LOAN', 'Emergency Loan'),
            ('OTHER', 'Other'),
        ],
        default='PERSONAL_LOAN'
    )
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2)
    monthly_deduction = models.DecimalField(max_digits=12, decimal_places=2)
    remaining_amount = models.DecimalField(max_digits=12, decimal_places=2)
    total_months = models.PositiveIntegerField()
    paid_months = models.PositiveIntegerField(default=0)
    
    # Interest
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Dates
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('ACTIVE', 'Active'),
            ('PAID', 'Paid'),
            ('DEFAULTED', 'Defaulted'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='PENDING'
    )
    
    # Additional Info
    purpose = models.TextField(blank=True, null=True)
    approved_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_loans'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    transaction_number = models.CharField(max_length=100, blank=True, null=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_loans'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_loans'
    )
    
    class Meta:
        verbose_name = "Employee Loan"
        verbose_name_plural = "Employee Loans"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['company', 'status']),
        ]
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.get_loan_type_display()} - {self.status}"
    
    @property
    def remaining_months(self):
        return max(0, self.total_months - self.paid_months)


class PayrollRecord(TimeStampedModel):
    """Payroll/payment records for employees"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='payroll_records'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='payroll_records'
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='payroll_records'
    )
    
    # Period
    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()
    
    # Salary Details
    base_salary = models.DecimalField(max_digits=12, decimal_places=2)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)
    
    # Transaction Details
    transaction_type = models.CharField(
        max_length=50,
        choices=[
            ('SALARY', 'Salary'),
            ('BONUS', 'Bonus'),
            ('ADVANCE', 'Advance'),
            ('REIMBURSEMENT', 'Reimbursement'),
        ],
        default='SALARY'
    )
    transaction_number = models.CharField(max_length=100, blank=True, null=True)
    payment_method = models.CharField(
        max_length=50,
        choices=[
            ('BANK_TRANSFER', 'Bank Transfer'),
            ('CASH', 'Cash'),
            ('CHEQUE', 'Cheque'),
            ('WALLET', 'Digital Wallet'),
        ],
        default='BANK_TRANSFER'
    )
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=[
            ('PENDING', 'Pending'),
            ('PAID', 'Paid'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='PAID'
    )
    
    # Additional Info
    custom_note = models.TextField(blank=True, null=True)
    deduction_breakdown = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_payroll_records'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_payroll_records'
    )
    
    class Meta:
        verbose_name = "Payroll Record"
        verbose_name_plural = "Payroll Records"
        ordering = ['-year', '-month', '-created_at']
        unique_together = [('employee', 'month', 'year')]
        indexes = [
            models.Index(fields=['company', 'month', 'year']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['transaction_number']),
        ]
    
    def __str__(self):
        return f"{self.employee.employee_id} - {self.month}/{self.year} - {self.status}"


class ShiftOverride(models.Model):
    """Temporary shift overrides for specific dates"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='shift_overrides'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shift_overrides'
    )
    
    # Employee & Shift
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='shift_overrides'
    )
    shift_template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.CASCADE,
        related_name='shift_overrides'
    )
    
    # Date Range
    date = models.DateField()
    
    # Metadata
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_shift_overrides'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_shift_overrides'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hr_shift_overrides'
        verbose_name = "Shift Override"
        verbose_name_plural = "Shift Overrides"
        ordering = ['-date']
        indexes = [
            models.Index(fields=['company', 'employee', 'date']),
            models.Index(fields=['company', 'date']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['shift_template']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'date'],
                name='unique_employee_shift_override'
            )
        ]
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.date} - {self.shift_template.name}"


class ShiftDateRangeAssignment(models.Model):
    """Date range shift assignments for employees"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='shift_date_range_assignments'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shift_date_range_assignments'
    )
    
    # Employee & Shift
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='date_range_assignments'
    )
    shift_template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.CASCADE,
        related_name='date_range_assignments'
    )
    
    # Date Range
    start_date = models.DateField()
    end_date = models.DateField()
    
    # Metadata
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_date_range_assignments'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_date_range_assignments'
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hr_shift_date_range_assignments'
        verbose_name = "Shift Date Range Assignment"
        verbose_name_plural = "Shift Date Range Assignments"
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['company', 'employee']),
            models.Index(fields=['company', 'start_date', 'end_date']),
            models.Index(fields=['employee', 'start_date', 'end_date']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.start_date} to {self.end_date} - {self.shift_template.name}"
    
    def save(self, *args, **kwargs):
        """Ensure end_date is not before start_date"""
        if self.end_date < self.start_date:
            raise ValueError("End date cannot be before start date")
        super().save(*args, **kwargs)


class ShiftChangeHistory(models.Model):
    """Complete history of all shift changes"""
    CHANGE_TYPES = [
        ('DEFAULT_CHANGE', 'Default Shift Change'),
        ('TEMPORARY_OVERRIDE', 'Temporary Override'),
        ('DATE_RANGE_ASSIGNMENT', 'Date Range Assignment'),
        ('BULK_ASSIGNMENT', 'Bulk Assignment'),
        ('AUTO_ASSIGNMENT', 'Auto Assignment'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='shift_change_history'
    )
    
    # Employee
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='shift_change_history'
    )
    
    # Change Details
    change_type = models.CharField(max_length=30, choices=CHANGE_TYPES)
    
    from_template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='from_shift_changes'
    )
    to_template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='to_shift_changes'
    )
    
    from_template_name = models.CharField(max_length=100, blank=True, null=True)
    to_template_name = models.CharField(max_length=100, blank=True, null=True)
    
    # Effective Dates
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    # Metadata
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)  # Additional data
    
    # Audit
    changed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='shift_changes_made'
    )
    changed_by_name = models.CharField(max_length=255, blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True)
    
    class Meta:
        db_table = 'hr_shift_change_history'
        verbose_name = "Shift Change History"
        verbose_name_plural = "Shift Change Histories"
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['company', 'employee']),
            models.Index(fields=['company', 'changed_at']),
            models.Index(fields=['employee', 'changed_at']),
            models.Index(fields=['change_type']),
            models.Index(fields=['effective_from', 'effective_to']),
        ]
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.change_type} - {self.changed_at.date()}"
    
    def save(self, *args, **kwargs):
        """Auto-populate template names if not provided"""
        if not self.from_template_name and self.from_template:
            self.from_template_name = self.from_template.name
        if not self.to_template_name and self.to_template:
            self.to_template_name = self.to_template.name
        super().save(*args, **kwargs)


class EmployeeShiftSchedule(models.Model):
    """Pre-computed shift schedule for performance optimization"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='shift_schedules'
    )
    
    # Employee & Shift
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='shift_schedules'
    )
    shift_template = models.ForeignKey(
        ShiftTemplate,
        on_delete=models.CASCADE,
        related_name='shift_schedules'
    )
    
    # Date
    date = models.DateField()
    
    # Source
    source_type = models.CharField(
        max_length=30,
        choices=[
            ('DEFAULT', 'Default Shift'),
            ('OVERRIDE', 'Temporary Override'),
            ('DATE_RANGE', 'Date Range Assignment'),
        ],
        default='DEFAULT'
    )
    source_id = models.CharField(max_length=100, blank=True, null=True)  # ID of source record
    
    # Cached shift details for quick access
    shift_name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    
    # Computed fields
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    # Audit
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hr_employee_shift_schedules'
        verbose_name = "Employee Shift Schedule"
        verbose_name_plural = "Employee Shift Schedules"
        ordering = ['-date']
        indexes = [
            models.Index(fields=['company', 'date']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['company', 'employee', 'date']),
            models.Index(fields=['shift_template']),
            models.Index(fields=['source_type']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'date'],
                name='unique_employee_date_schedule'
            )
        ]
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.date} - {self.shift_name}"


class LeaveRequest(TimeStampedModel):
    """Employee leave requests"""
    
    STATUS_CHOICES = [
        ('DRAFT', 'Draft'),
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    HALF_DAY_CHOICES = [
        ('false', 'Full Day'),
        ('true', 'Half Day'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch Context
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leave_requests'
    )
    
    # Employee Information
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_requests'
    )
    employee_name = models.CharField(max_length=255, blank=True)
    
    # Leave Type
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name='leave_requests'
    )
    leave_type_name = models.CharField(max_length=100, blank=True)
    
    # Leave Details
    leave_year = models.PositiveSmallIntegerField(default=current_year)
    start_date = models.DateField()
    end_date = models.DateField()
    total_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    is_half_day = models.CharField(max_length=5, choices=HALF_DAY_CHOICES, default='false')
    
    # Request Details
    reason = models.TextField()
    contact_number = models.CharField(max_length=20, blank=True, null=True)
    document_url = models.TextField(blank=True, null=True)
    
    # Status Tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    applied_at = models.DateTimeField(auto_now_add=True)
    
    # Approval Tracking
    approved_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leaves'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_leave_requests'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_leave_requests'
    )
    
    class Meta:
        db_table = 'hr_leave_requests'
        verbose_name = "Leave Request"
        verbose_name_plural = "Leave Requests"
        ordering = ['-applied_at']
        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['leave_year']),
            models.Index(fields=['applied_at']),
            models.Index(fields=['company', 'employee', 'status']),
        ]
    
    def __str__(self):
        return f"{self.employee_name} - {self.leave_type_name} - {self.start_date}"
    
    def clean(self):
        """Validate leave request dates"""
        if self.start_date and self.end_date:
            if self.end_date < self.start_date:
                raise ValidationError({'end_date': 'End date cannot be before start date'})
    
    def save(self, *args, **kwargs):
        # Auto-populate names from relations
        if self.employee_id and not self.employee_name:
            self.employee_name = self.employee.full_name if hasattr(self.employee, 'full_name') else str(self.employee)
        
        if self.leave_type_id and not self.leave_type_name:
            self.leave_type_name = self.leave_type.name
        
        # Apply validation
        self.clean()
        
        # Calculate total days if not set
        if self.start_date and self.end_date and self.total_days == 0:
            from .services.leave_calculation import LeaveCalculationService
            self.total_days = LeaveCalculationService.calculate_working_days(
                self.start_date, self.end_date, self.company_id
            )
            if self.is_half_day == 'true' and self.total_days == 1:
                self.total_days = Decimal('0.5')
        
        super().save(*args, **kwargs)


class LeaveBalance(TimeStampedModel):
    """Employee leave balance for each leave type and year"""
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company Context
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='leave_balances'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leave_balances'
    )
    
    # Employee and Leave Type
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='leave_balances'
    )
    employee_name = models.CharField(max_length=255, blank=True)
    
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.PROTECT,
        related_name='leave_balances'
    )
    leave_type_name = models.CharField(max_length=100, blank=True)
    
    # Balance Details
    year = models.PositiveSmallIntegerField()
    allocated = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    used = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    available = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    carry_forward_from = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_leave_balances'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_leave_balances'
    )
    
    class Meta:
        db_table = 'hr_leave_balances'
        verbose_name = "Leave Balance"
        verbose_name_plural = "Leave Balances"
        unique_together = [('company', 'employee', 'leave_type', 'year')]
        indexes = [
            models.Index(fields=['company', 'employee', 'year']),
            models.Index(fields=['employee', 'leave_type', 'year']),
            models.Index(fields=['company', 'year']),
        ]
    
    def __str__(self):
        return f"{self.employee_name} - {self.leave_type_name} - {self.year}: {self.available} days"
    
    def save(self, *args, **kwargs):
        # Auto-populate names
        if self.employee_id and not self.employee_name:
            self.employee_name = self.employee.full_name if hasattr(self.employee, 'full_name') else str(self.employee)
        
        if self.leave_type_id and not self.leave_type_name:
            self.leave_type_name = self.leave_type.name
        
        # Calculate available balance
        self.available = self.allocated - self.used + self.carry_forward_from
        if self.available < 0:
            self.available = Decimal('0')
        
        super().save(*args, **kwargs)


class LeaveBalanceHistory(TimeStampedModel):
    """Audit trail for leave balance changes"""
    
    ACTION_CHOICES = [
        ('ALLOCATION', 'Initial Allocation'),
        ('CARRY_FORWARD', 'Carry Forward'),
        ('LEAVE_APPROVED', 'Leave Approved'),
        ('LEAVE_CANCELLED', 'Leave Cancelled'),
        ('MANUAL_ADJUSTMENT', 'Manual Adjustment'),
        ('YEAR_END_PROCESS', 'Year End Process'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='leave_balance_histories')
    
    balance = models.ForeignKey(LeaveBalance, on_delete=models.CASCADE, related_name='history')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='leave_balance_histories')
    leave_type = models.ForeignKey(LeaveType, on_delete=models.PROTECT, related_name='balance_histories')
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    
    previous_used = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    new_used = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    delta = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    
    previous_available = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    new_available = models.DecimalField(max_digits=8, decimal_places=1, default=0)
    
    # Related leave request (if applicable)
    leave_request = models.ForeignKey(
        LeaveRequest,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='balance_changes'
    )
    
    notes = models.TextField(blank=True, null=True)
    
    # Audit
    performed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leave_balance_changes'
    )
    
    class Meta:
        db_table = 'hr_leave_balance_histories'
        verbose_name = "Leave Balance History"
        verbose_name_plural = "Leave Balance Histories"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'balance']),
            models.Index(fields=['employee', '-created_at']),
            models.Index(fields=['action']),
        ]
    
    def __str__(self):
        return f"{self.action} - {self.employee} - {self.delta} days"


class YearEndCarryForward(TimeStampedModel):
    """Track year-end leave carry forward processing"""
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PROCESSING', 'Processing'),
        ('COMPLETED', 'Completed'),
        ('FAILED', 'Failed'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='year_end_carry_forwards')
    
    from_year = models.PositiveSmallIntegerField()
    to_year = models.PositiveSmallIntegerField()
    
    processed_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    
    total_employees_processed = models.PositiveIntegerField(default=0)
    total_balances_updated = models.PositiveIntegerField(default=0)
    total_days_carried = models.DecimalField(max_digits=12, decimal_places=1, default=0)
    
    error_log = models.TextField(blank=True, null=True)
    
    # Audit
    processed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='carry_forward_processes'
    )
    
    class Meta:
        db_table = 'hr_year_end_carry_forward'
        verbose_name = "Year End Carry Forward"
        verbose_name_plural = "Year End Carry Forwards"
        indexes = [
            models.Index(fields=['company', 'from_year', 'to_year']),
            models.Index(fields=['status']),
        ]
    
    def __str__(self):
        return f"Carry forward from {self.from_year} to {self.to_year} - {self.status}"
    

class RecruitmentCandidate(TimeStampedModel):
    """Recruitment/Candidate tracking"""
    
    STAGE_CHOICES = [
        ('Applied', 'Applied'),
        ('Screening', 'Screening'),
        ('Interview', 'Interview'),
        ('Offer', 'Offer Sent'),
        ('Hired', 'Hired'),
        ('Rejected', 'Rejected'),
    ]
    
    STATUS_CHOICES = [
        ('Active', 'Active'),
        ('Closed', 'Closed'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch Context
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='recruitment_candidates'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recruitment_candidates'
    )
    
    # Candidate Information
    name = models.CharField(max_length=255, db_index=True)
    email = models.EmailField(blank=True, null=True, db_index=True)
    phone = models.CharField(max_length=20, blank=True, null=True)
    
    # Position Details
    position = models.CharField(max_length=255, db_index=True)
    department = models.CharField(max_length=100, db_index=True)
    
    # Recruitment Stages
    stage = models.CharField(max_length=20, choices=STAGE_CHOICES, default='Applied', db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='Active', db_index=True)
    
    # Dates
    apply_date = models.DateField(db_index=True)
    interview_date = models.DateField(null=True, blank=True)
    
    # Assignment
    assigned_to = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_candidates'
    )
    assigned_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Documents & Notes
    resume_url = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Additional Fields for scalability
    source = models.CharField(
        max_length=50,
        choices=[
            ('WEBSITE', 'Company Website'),
            ('LINKEDIN', 'LinkedIn'),
            ('INDEED', 'Indeed'),
            ('REFERRAL', 'Employee Referral'),
            ('AGENCY', 'Recruitment Agency'),
            ('WALKIN', 'Walk-in'),
            ('OTHER', 'Other'),
        ],
        blank=True,
        null=True,
        db_index=True
    )
    expected_salary = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    current_company = models.CharField(max_length=255, blank=True, null=True)
    current_position = models.CharField(max_length=255, blank=True, null=True)
    years_of_experience = models.DecimalField(max_digits=4, decimal_places=1, blank=True, null=True)
    notice_period_days = models.PositiveIntegerField(blank=True, null=True)
    
    # Interview tracking
    interview_round = models.PositiveSmallIntegerField(default=0)
    interview_notes = models.TextField(blank=True, null=True)
    interviewers = models.TextField(blank=True, null=True)  # JSON or comma-separated IDs
    
    # Offer details
    offer_sent_date = models.DateField(blank=True, null=True)
    offer_accepted_date = models.DateField(blank=True, null=True)
    offer_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    joining_date = models.DateField(blank=True, null=True)
    
    # Rejection reason
    rejection_reason = models.TextField(blank=True, null=True)
    rejection_date = models.DateField(blank=True, null=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_recruitment_candidates'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_recruitment_candidates'
    )
    
    class Meta:
        db_table = 'hr_recruitment_candidates'
        verbose_name = "Recruitment Candidate"
        verbose_name_plural = "Recruitment Candidates"
        ordering = ['-apply_date', '-created_at']
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['company', 'stage', 'status']),
            models.Index(fields=['company', 'department']),
            models.Index(fields=['company', 'position']),
            models.Index(fields=['assigned_to', 'stage']),
            models.Index(fields=['apply_date']),
            models.Index(fields=['source']),
            models.Index(fields=['name', 'email']),  # For search
        ]
    
    def __str__(self):
        return f"{self.name} - {self.position} ({self.stage})"
    
    def save(self, *args, **kwargs):
        # Auto-populate assigned_name if assigned_to is set
        if self.assigned_to_id and not self.assigned_name:
            self.assigned_name = self.assigned_to.full_name
        super().save(*args, **kwargs)
    @property
    def current_round(self):
        """Get current active/pending round"""
        rounds = self.interview_rounds.all()
        for round_obj in rounds:
            if round_obj.status in ['PENDING', 'SCHEDULED']:
                return round_obj.round_number
        return None
    
    @property
    def highest_round(self):
        """Get highest round number"""
        rounds = self.interview_rounds.all()
        if rounds.exists():
            return max(rounds.values_list('round_number', flat=True))
        return 0
    
    @property
    def overall_status(self):
        """Calculate overall candidate status based on rounds"""
        rounds = self.interview_rounds.all()
        if not rounds.exists():
            return self.stage
        
        # If any round failed, candidate is Rejected
        if rounds.filter(status='FAILED').exists():
            return 'Rejected'
        
        # If all rounds passed, candidate can move to Offer
        if rounds.filter(status='PASSED').count() == rounds.count():
            return 'Offer' if self.stage != 'Hired' else self.stage
        
        # If any round is scheduled or pending
        if rounds.filter(status__in=['SCHEDULED', 'PENDING']).exists():
            return 'Interview'
        
        return self.stage


class RecruitmentActivityLog(TimeStampedModel):
    """Track all activities/changes for recruitment candidates"""
    
    ACTION_CHOICES = [
        ('CREATED', 'Candidate Created'),
        ('STAGE_CHANGED', 'Stage Changed'),
        ('INTERVIEW_SCHEDULED', 'Interview Scheduled'),
        ('OFFER_SENT', 'Offer Sent'),
        ('OFFER_ACCEPTED', 'Offer Accepted'),
        ('OFFER_REJECTED', 'Offer Rejected'),
        ('HIRED', 'Hired'),
        ('REJECTED', 'Rejected'),
        ('NOTE_ADDED', 'Note Added'),
        ('ASSIGNMENT_CHANGED', 'Assignment Changed'),
        ('DOCUMENT_ADDED', 'Document Added'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='recruitment_activity_logs'
    )
    
    candidate = models.ForeignKey(
        RecruitmentCandidate,
        on_delete=models.CASCADE,
        related_name='activity_logs'
    )
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)
    
    # Old and new values for changes
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    
    # Additional metadata
    metadata = models.JSONField(default=dict, blank=True)
    
    # IP and user agent for audit
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    
    # Audit
    performed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='recruitment_activities'
    )
    
    class Meta:
        db_table = 'hr_recruitment_activity_logs'
        verbose_name = "Recruitment Activity Log"
        verbose_name_plural = "Recruitment Activity Logs"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'candidate']),
            models.Index(fields=['company', 'action', 'created_at']),
            models.Index(fields=['performed_by']),
        ]
    
    def __str__(self):
        return f"{self.candidate.name} - {self.action} - {self.created_at}"


class InterviewRound(models.Model):
    """Individual interview rounds for recruitment candidates"""
    
    ROUND_STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('PASSED', 'Passed'),
        ('FAILED', 'Failed'),
        ('SCHEDULED', 'Scheduled'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    INTERVIEW_TYPE_CHOICES = [
        ('TECHNICAL', 'Technical Interview'),
        ('HR', 'HR Interview'),
        ('MANAGERIAL', 'Managerial Interview'),
        ('CODING', 'Coding Test'),
        ('ASSIGNMENT', 'Assignment Review'),
        ('BEHAVIORAL', 'Behavioral Assessment'),
        ('GROUP', 'Group Discussion'),
        ('PRESENTATION', 'Presentation'),
        ('OTHER', 'Other'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    candidate = models.ForeignKey(
        RecruitmentCandidate,
        on_delete=models.CASCADE,
        related_name='interview_rounds'
    )
    
    # Round Information
    round_number = models.PositiveSmallIntegerField()
    round_title = models.CharField(max_length=255)
    interview_type = models.CharField(max_length=50, choices=INTERVIEW_TYPE_CHOICES, default='TECHNICAL')
    
    # Round Status
    status = models.CharField(max_length=20, choices=ROUND_STATUS_CHOICES, default='PENDING')
    
    # Interview Details
    interview_date = models.DateTimeField(null=True, blank=True)
    interviewer = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='conducted_interviews'
    )
    interviewer_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Round Feedback
    feedback = models.TextField(blank=True, null=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Rating out of 10")
    
    # Additional Metadata
    notes = models.TextField(blank=True, null=True)
    meeting_link = models.URLField(blank=True, null=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hr_interview_rounds'
        verbose_name = "Interview Round"
        verbose_name_plural = "Interview Rounds"
        ordering = ['candidate', 'round_number']
        unique_together = [('candidate', 'round_number')]
        indexes = [
            models.Index(fields=['candidate', 'round_number']),
            models.Index(fields=['candidate', 'status']),
            models.Index(fields=['interviewer']),
            models.Index(fields=['interview_date']),
        ]
    
    def __str__(self):
        return f"{self.candidate.name} - Round {self.round_number}: {self.round_title} ({self.status})"
    
    def save(self, *args, **kwargs):
        if self.interviewer_id and not self.interviewer_name:
            self.interviewer_name = self.interviewer.full_name
        super().save(*args, **kwargs)


class ExitRecord(TimeStampedModel):
    """Employee exit/offboarding management"""
    
    EXIT_REASONS = [
        ('RESIGNATION', 'Resignation'),
        ('TERMINATION', 'Termination'),
        ('CONTRACT_END', 'Contract End'),
        ('RETIREMENT', 'Retirement'),
        ('OTHER', 'Other'),
    ]
    
    CLEARANCE_STATUS = [
        ('PENDING', 'Pending'),
        ('IN_PROGRESS', 'In Progress'),
        ('APPROVED', 'Approved'),
        ('COMPLETED', 'Completed'),
    ]
    
    RECORD_STATUS = [
        ('ACTIVE', 'Active'),
        ('CLOSED', 'Closed'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company & Branch Context
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='exit_records'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exit_records'
    )
    
    # Employee Information
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='exit_records'
    )
    employee_name = models.CharField(max_length=255, blank=True, db_index=True)
    department = models.CharField(max_length=100, db_index=True)
    designation = models.CharField(max_length=100, blank=True, null=True)
    
    # Exit Details
    exit_date = models.DateField(db_index=True)
    last_working_day = models.DateField(null=True, blank=True)
    reason = models.CharField(
        max_length=50,
        choices=EXIT_REASONS,
        default='RESIGNATION',
        db_index=True
    )
    notice_served = models.BooleanField(default=True)
    
    # Clearance Tracking
    clearance_hr = models.BooleanField(default=False, verbose_name="HR Clearance")
    clearance_it = models.BooleanField(default=False, verbose_name="IT Clearance")
    clearance_finance = models.BooleanField(default=False, verbose_name="Finance Clearance")
    clearance_admin = models.BooleanField(default=False, verbose_name="Admin Clearance")
    clearance_status = models.CharField(
        max_length=20,
        choices=CLEARANCE_STATUS,
        default='PENDING',
        db_index=True
    )
    
    # Settlement
    final_settlement = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=0,
        help_text="Final settlement amount in company currency"
    )
    
    # Additional Information
    notes = models.TextField(blank=True, null=True, help_text="Handover details, asset returns, etc.")
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=RECORD_STATUS,
        default='ACTIVE',
        db_index=True
    )
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_exit_records'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_exit_records'
    )
    
    class Meta:
        db_table = 'hr_exit_records'
        verbose_name = "Exit Record"
        verbose_name_plural = "Exit Records"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company', 'is_deleted']),
            models.Index(fields=['company', 'status']),
            models.Index(fields=['company', 'clearance_status']),
            models.Index(fields=['company', 'reason']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['department', 'status']),
            models.Index(fields=['exit_date']),
            models.Index(fields=['last_working_day']),
            # Composite indexes for common queries
            models.Index(
                fields=['company', 'clearance_status', 'status'],
                name='exit_clearance_status_idx'
            ),
            models.Index(
                fields=['company', 'department', 'reason'],
                name='exit_dept_reason_idx'
            ),
        ]
        constraints = [
            # Ensure only one active exit record per employee
            models.UniqueConstraint(
                fields=['employee'],
                condition=models.Q(status='ACTIVE', is_deleted=False),
                name='unique_active_exit_per_employee'
            )
        ]
    
    def __str__(self):
        return f"{self.employee_name} - {self.reason} ({self.exit_date})"
    
    def save(self, *args, **kwargs):
        # Auto-populate employee details
        if self.employee_id and not self.employee_name:
            self.employee_name = self.employee.full_name if hasattr(self.employee, 'full_name') else str(self.employee)
        
        if self.employee_id and not self.department:
            self.department = self.employee.department
        
        if self.employee_id and not self.designation:
            self.designation = self.employee.designation
        
        # Auto-calculate clearance status
        all_clearances = [self.clearance_hr, self.clearance_it, 
                         self.clearance_finance, self.clearance_admin]
        completed_clearances = sum(all_clearances)
        
        if completed_clearances == 4:
            self.clearance_status = 'COMPLETED'
        elif completed_clearances > 0:
            self.clearance_status = 'IN_PROGRESS'
        else:
            self.clearance_status = 'PENDING'
        
        super().save(*args, **kwargs)
    
    @property
    def clearance_progress(self):
        """Calculate clearance progress percentage"""
        clearances = [self.clearance_hr, self.clearance_it, 
                     self.clearance_finance, self.clearance_admin]
        return int((sum(clearances) / 4) * 100)
    
    @property
    def is_clearance_complete(self):
        """Check if all clearances are completed"""
        return all([self.clearance_hr, self.clearance_it, 
                   self.clearance_finance, self.clearance_admin])


class ExitChecklist(TimeStampedModel):
    """Detailed exit checklist items"""
    
    CHECKLIST_TYPES = [
        ('HR', 'HR'),
        ('IT', 'IT'),
        ('FINANCE', 'Finance'),
        ('ADMIN', 'Admin'),
        ('GENERAL', 'General'),
    ]
    
    CHECKLIST_STATUS = [
        ('PENDING', 'Pending'),
        ('COMPLETED', 'Completed'),
        ('WAIVED', 'Waived'),
        ('NOT_APPLICABLE', 'Not Applicable'),
    ]
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    # Company Context
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='exit_checklists'
    )
    
    # Exit Record
    exit_record = models.ForeignKey(
        ExitRecord,
        on_delete=models.CASCADE,
        related_name='checklist_items'
    )
    
    # Item Details
    item_type = models.CharField(
        max_length=20,
        choices=CHECKLIST_TYPES,
        default='GENERAL'
    )
    item_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    # Status
    status = models.CharField(
        max_length=20,
        choices=CHECKLIST_STATUS,
        default='PENDING'
    )
    
    # Responsible Person
    assigned_to = models.ForeignKey(
        Employee,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='exit_checklist_items'
    )
    assigned_to_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Completion
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_exit_checklists'
    )
    
    # Notes
    notes = models.TextField(blank=True, null=True)
    
    # Audit
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_exit_checklists'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_exit_checklists'
    )
    
    class Meta:
        db_table = 'hr_exit_checklists'
        verbose_name = "Exit Checklist"
        verbose_name_plural = "Exit Checklists"
        ordering = ['item_type', 'item_name']
        indexes = [
            models.Index(fields=['exit_record', 'status']),
            models.Index(fields=['exit_record', 'item_type']),
            models.Index(fields=['assigned_to', 'status']),
        ]
    
    def __str__(self):
        return f"{self.item_name} ({self.item_type}) - {self.status}"


# =========================================================
# POLICY MODEL
# =========================================================
class Policy(TimeStampedModel):
    """
    HR Policy model for managing company policies.
    Multi-company safe + production ready.
    """

    class PolicyStatus(models.TextChoices):
        DRAFT = 'DRAFT', 'Draft'
        PENDING_REVIEW = 'PENDING_REVIEW', 'Pending Review'
        APPROVED = 'APPROVED', 'Approved'
        PUBLISHED = 'PUBLISHED', 'Published'
        ARCHIVED = 'ARCHIVED', 'Archived'
        REVOKED = 'REVOKED', 'Revoked'

    class EmployeeType(models.TextChoices):
        ALL = 'ALL', 'All Employees'
        FULL_TIME = 'FULL_TIME', 'Full Time'
        PART_TIME = 'PART_TIME', 'Part Time'
        CONTRACT = 'CONTRACT', 'Contract'
        INTERN = 'INTERN', 'Intern'

    class Category(models.TextChoices):
        EMPLOYMENT = 'Employment', 'Employment'
        CODE_OF_CONDUCT = 'Code of Conduct', 'Code of Conduct'
        LEAVE_ATTENDANCE = 'Leave & Attendance', 'Leave & Attendance'
        COMPENSATION_BENEFITS = 'Compensation & Benefits', 'Compensation & Benefits'
        HEALTH_SAFETY = 'Health & Safety', 'Health & Safety'
        IT_DATA_SECURITY = 'IT & Data Security', 'IT & Data Security'
        REMOTE_WORK = 'Remote Work', 'Remote Work'
        PERFORMANCE = 'Performance', 'Performance'
        DISCIPLINARY = 'Disciplinary', 'Disciplinary'
        OTHER = 'Other', 'Other'

    # ---------------- COMPANY ----------------
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='policies'
    )

    # ---------------- IDENTIFICATION ----------------
    code = models.CharField(
        max_length=50,
        validators=[MinLengthValidator(3)],
        help_text="Unique policy code (e.g., POL-001)"
    )
    title = models.CharField(max_length=255)
    version = models.CharField(max_length=20, default="1.0")

    # ---------------- CLASSIFICATION ----------------
    category = models.CharField(
        max_length=50,
        choices=Category.choices,
        db_index=True
    )
    department = models.CharField(
        max_length=100,
        default="ALL",
        db_index=True
    )
    employee_type = models.CharField(
        max_length=20,
        choices=EmployeeType.choices,
        default='ALL',
        db_index=True
    )

    # ---------------- STATUS ----------------
    status = models.CharField(
        max_length=20,
        choices=PolicyStatus.choices,
        default='DRAFT',
        db_index=True
    )

    # ---------------- DATES ----------------
    effective_date = models.DateField()
    review_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    approval_date = models.DateField(null=True, blank=True)

    # ---------------- CONTENT ----------------
    content = models.TextField()
    document_url = models.URLField(max_length=500, null=True, blank=True)
    change_summary = models.TextField(null=True, blank=True)

    # ---------------- ACKNOWLEDGEMENT ----------------
    requires_acknowledgment = models.BooleanField(default=False, db_index=True)
    acknowledgment_deadline = models.PositiveIntegerField(null=True, blank=True)

    # ---------------- APPROVAL ----------------
    approved_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_policies'
    )

    # ---------------- AUDIT ----------------
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_policies'
    )

    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_policies'
    )

    # ---------------- FLAGS ----------------
    is_archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'hr_policies'
        ordering = ['-created_at']

        indexes = [
            models.Index(fields=['company', 'status']),
            models.Index(fields=['company', 'category']),
            models.Index(fields=['company', 'department']),
            models.Index(fields=['company', 'employee_type']),
            models.Index(fields=['code']),
            models.Index(fields=['effective_date']),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=['company', 'code'],
                name='unique_company_policy_code'
            )
        ]

    def __str__(self):
        return f"{self.code} - {self.title} (v{self.version})"

    @property
    def is_expired(self):
        if self.expiry_date:
            return self.expiry_date < timezone.now().date()
        return False

    @property
    def needs_review(self):
        if self.review_date:
            return self.review_date <= timezone.now().date()
        return False


# =========================================================
# POLICY ACKNOWLEDGMENT
# =========================================================
class PolicyAcknowledgment(TimeStampedModel):
    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='acknowledgments'
    )

    employee = models.ForeignKey(
        'Employee',
        on_delete=models.CASCADE,
        related_name='policy_acknowledgments'
    )

    acknowledged_at = models.DateTimeField(default=timezone.now)
    acknowledged_via = models.CharField(max_length=50, default='WEB')
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    notes = models.TextField(null=True, blank=True)

    class Meta:
        db_table = 'hr_policy_acknowledgments'
        ordering = ['-acknowledged_at']

        indexes = [
            models.Index(fields=['policy', 'employee']),
            models.Index(fields=['employee', 'acknowledged_at']),
        ]

        constraints = [
            models.UniqueConstraint(
                fields=['policy', 'employee'],
                name='unique_policy_employee_acknowledgment'
            )
        ]

    def __str__(self):
        return f"{self.employee} acknowledged {self.policy}"


# =========================================================
# POLICY VERSION
# =========================================================
class PolicyVersion(TimeStampedModel):
    policy = models.ForeignKey(
        Policy,
        on_delete=models.CASCADE,
        related_name='versions'
    )

    version = models.CharField(max_length=20)
    content = models.TextField()
    document_url = models.URLField(max_length=500, null=True, blank=True)
    change_summary = models.TextField(null=True, blank=True)
    effective_date = models.DateField()

    changed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name='policy_changes'
    )

    class Meta:
        db_table = 'hr_policy_versions'
        ordering = ['-created_at']

        indexes = [
            models.Index(fields=['policy', 'version']),
        ]

    def __str__(self):
        return f"{self.policy.code} - v{self.version}"


# =========================================================
# POLICY CATEGORY
# =========================================================
class PolicyCategory(TimeStampedModel):
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='policy_categories'
    )

    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sorting_order = models.IntegerField(default=0)
    color_code = models.CharField(max_length=7, null=True, blank=True)
    icon = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'hr_policy_categories'
        ordering = ['sorting_order', 'name']

    def __str__(self):
        return self.name