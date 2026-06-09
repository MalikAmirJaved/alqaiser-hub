# apps/hr/models.py
import uuid
from django.db import models
from django.conf import settings as django_settings
from apps.organization.models import Company, Branch

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


class EmployeeAssetAssignment(TimeStampedModel):
    """Track asset assignments to employees"""
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company = models.ForeignKey(
        Company,
        on_delete=models.CASCADE,
        related_name='employee_asset_assignments'
    )
    branch = models.ForeignKey(
        Branch,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_asset_assignments'
    )
    
    employee = models.ForeignKey(
        Employee,
        on_delete=models.CASCADE,
        related_name='asset_assignments'
    )
    asset = models.ForeignKey(
        Asset,
        on_delete=models.CASCADE,
        related_name='employee_assignments'
    )
    category = models.ForeignKey(
        AssetCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employee_assignments'
    )
    
    assigned_date = models.DateField()
    returned_date = models.DateField(null=True, blank=True)
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
    condition = models.CharField(
        max_length=20,
        choices=[
            ('NEW', 'New'),
            ('GOOD', 'Good'),
            ('FAIR', 'Fair'),
            ('POOR', 'Poor'),
        ],
        default='NEW'
    )
    notes = models.TextField(blank=True, null=True)
    
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='created_asset_assignments'
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='updated_asset_assignments'
    )
    
    class Meta:
        verbose_name = "Employee Asset Assignment"
        verbose_name_plural = "Employee Asset Assignments"
        ordering = ['-assigned_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['asset', 'status']),
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
