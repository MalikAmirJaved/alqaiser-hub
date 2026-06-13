# apps/hr/models.py
import uuid
from django.db import models
from django.conf import settings
from django.core.validators import MinLengthValidator
from django.utils import timezone
from datetime import date

from apps.common.basemodel import BaseModel
from apps.finance.services.payable import PayableModelMixin


from apps.organization.models import Department
from apps.compsetting.models import Designation

def current_year():
    return date.today().year


# =========================================================
# SHIFT TEMPLATE
# =========================================================
class ShiftTemplate(BaseModel):
    """Shift templates for defining working patterns"""
    
    # Company & Branch (from BaseModel: company_id, branch_id)
    name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        verbose_name = "Shift Template"
        verbose_name_plural = "Shift Templates"
        ordering = ['name']
        unique_together = [['company_id', 'name']]
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['branch_id']),
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
        
        if end <= start:
            end += timedelta(days=1)
        
        total_minutes = (end - start).total_seconds() / 60
        return round((total_minutes - self.break_minutes) / 60, 2)


# =========================================================
# ASSET
# =========================================================
class Asset(BaseModel):
    """HR Assets - hardware, equipment, devices"""
    
    name = models.CharField(max_length=255)
    brand = models.CharField(max_length=100, blank=True, null=True)
    model = models.CharField(max_length=100, blank=True, null=True)
    serial_number = models.CharField(max_length=100, blank=True, null=True, unique=True)
    description = models.TextField(blank=True, null=True)
    
    # New fields for simplified asset management
    category = models.CharField(max_length=100, blank=True, null=True, help_text="e.g., Laptop, Monitor, Furniture")
    total_quantity = models.PositiveIntegerField(default=1)
    available_quantity = models.PositiveIntegerField(default=1)
    
    # Purchase Information (optional now)
    purchase_date = models.DateField(null=True, blank=True)
    purchase_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    warranty_until = models.DateField(null=True, blank=True)
    vendor = models.CharField(max_length=255, blank=True, null=True)
    
    # Status
    is_active = models.BooleanField(default=True)
    is_assigned = models.BooleanField(default=False)

    class Meta:
        verbose_name = "Asset"
        verbose_name_plural = "Assets"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['branch_id']),
            models.Index(fields=['serial_number']),
            models.Index(fields=['is_assigned']),
            models.Index(fields=['vendor']),
            models.Index(fields=['category']),  
        ]
    
    def __str__(self):
        return f"{self.name} ({self.brand or 'No Brand'})"
    
    @property
    def warranty_status(self):
        if not self.warranty_until:
            return None
        return self.warranty_until >= date.today()
# =========================================================
# ASSET PURCHASE REQUEST
# =========================================================
class AssetPurchaseRequest(BaseModel):
    """Purchase requests for HR assets - raised from asset library, fulfilled via inventory PO"""

    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='purchase_requests')
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='asset_purchase_requests'
    )
    employee = models.ForeignKey(
        'Employee', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='asset_purchase_requests'
    )
    quantity = models.PositiveIntegerField()
    reason = models.TextField()
    under_date = models.DateField(help_text="Date by which the asset is needed")
    status = models.CharField(
        max_length=30,
        choices=[
            ('PENDING', 'Pending'),
            ('APPROVED', 'Approved'),
            ('PURCHASE_ORDER_CREATED', 'Purchase Order Created'),
            ('CANCELLED', 'Cancelled'),
        ],
        default='PENDING',
        db_index=True
    )
    purchase_order = models.ForeignKey(
        'inventory.PurchaseOrder', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='asset_purchase_requests'
    )
    notes = models.TextField(blank=True, null=True)

    class Meta:
        verbose_name = "Asset Purchase Request"
        verbose_name_plural = "Asset Purchase Requests"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['asset', 'status']),
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['purchase_order']),
        ]

    def __str__(self):
        return f"Request for {self.asset.name} x{self.quantity} ({self.get_status_display()})"


# =========================================================
# ASSET CATEGORY (Kit)
# =========================================================
class AssetCategory(BaseModel):
    """Asset Categories/Kits - bundle multiple assets together"""
    
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    # Assets in this category
    assets = models.ManyToManyField(Asset, related_name='categories', blank=True)
    
    class Meta:
        verbose_name = "Asset Category"
        verbose_name_plural = "Asset Categories"
        ordering = ['name']
        unique_together = [['company_id', 'name']]
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['branch_id']),
            models.Index(fields=['is_active']),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.assets.count()} assets)"
    
    def get_asset_ids(self):
        return list(self.assets.values_list('id', flat=True))


# =========================================================
# EMPLOYEE
# =========================================================
class Employee(BaseModel):
    """Employee records"""
    
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
        choices=[('MALE', 'Male'), ('FEMALE', 'Female'), ('OTHER', 'Other')],
        default='MALE'
    )
    marital_status = models.CharField(
        max_length=20,
        choices=[('SINGLE', 'Single'), ('MARRIED', 'Married'), ('DIVORCED', 'Divorced'), ('WIDOWED', 'Widowed')],
        default='SINGLE'
    )
    
    # Contact Information
    phone = models.CharField(max_length=20)
    email = models.EmailField(blank=True, null=True)
    personal_email = models.EmailField(blank=True, null=True)

    # If this employee was used to create a system user, link it here
    isfrom_user = models.ForeignKey(
        'organization.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='employee_profile'
    )
    
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
        choices=[('STAFF', 'Staff'), ('BRANCH_ADMIN', 'Branch Admin'), ('COMPANY_ADMIN', 'Company Admin')],
        default='STAFF'
    )
    department = models.ForeignKey(
        Department,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )

    designation = models.ForeignKey(
        Designation,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='employees'
    )

    employment_type = models.CharField(
        max_length=50,
        choices=[('FULL_TIME', 'Full Time'), ('PART_TIME', 'Part Time'), ('CONTRACT', 'Contract'), ('INTERN', 'Intern')],
        default='FULL_TIME'
    )
    employment_status = models.CharField(
        max_length=50,
        choices=[('ACTIVE', 'Active'), ('ON_LEAVE', 'On Leave'), ('SUSPENDED', 'Suspended'), ('TERMINATED', 'Terminated'), ('RESIGNED', 'Resigned')],
        default='ACTIVE'
    )
    
    # Dates
    joining_date = models.DateField()
    confirmation_date = models.DateField(null=True, blank=True)
    probation_days = models.PositiveIntegerField(default=180)
    
    # Work
    work_location = models.CharField(
        max_length=50,
        choices=[('OFFICE', 'Office'), ('REMOTE', 'Remote'), ('HYBRID', 'Hybrid')],
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
    
    class Meta:
        verbose_name = "Employee"
        verbose_name_plural = "Employees"
        ordering = ['first_name', 'last_name']
        unique_together = [['company_id', 'employee_id']]
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['branch_id']),
            models.Index(fields=['department']),
            models.Index(fields=['employment_status']),
            models.Index(fields=['cnic']),
        ]
    
    def __str__(self):
        return f"{self.employee_id} - {self.first_name} {self.last_name or ''}"
    
    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name or ''}".strip()


# =========================================================
# EMPLOYEE ASSET ASSIGNMENT
# =========================================================
class EmployeeAssetAssignment(BaseModel):
    """Individual asset assignments (generated from direct assignment or kit expansion)"""
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='asset_assignments')
    asset = models.ForeignKey(Asset, on_delete=models.CASCADE, related_name='employee_assignments')
    
    # Track source: direct or from kit
    source_type = models.CharField(
        max_length=20,
        choices=[('DIRECT', 'Direct Assignment'), ('KIT', 'Kit Assignment')],
        default='DIRECT'
    )
    source_kit = models.ForeignKey(
        AssetCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='kit_assignments'
    )
    quantity = models.PositiveIntegerField(default=1, help_text="Number of units assigned")
    assigned_date = models.DateField()
    returned_date = models.DateField(null=True, blank=True)
    expected_return_date = models.DateField(null=True, blank=True)
    
    status = models.CharField(
        max_length=20,
        choices=[('ACTIVE', 'Active'), ('RETURNED', 'Returned'), ('LOST', 'Lost'), ('DAMAGED', 'Damaged')],
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
    
    class Meta:
        ordering = ['-assigned_date']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['asset', 'status']),
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['source_kit']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'asset'],
                condition=models.Q(status='ACTIVE'),
                name='unique_active_assignment'
            )
        ]


# =========================================================
# EMPLOYEE DEFAULT SHIFT
# =========================================================
class EmployeeDefaultShift(BaseModel):
    """Track employee default shift history"""
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='default_shifts')
    template = models.ForeignKey(ShiftTemplate, on_delete=models.CASCADE, related_name='employee_default_shifts')
    
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    class Meta:
        verbose_name = "Employee Default Shift"
        verbose_name_plural = "Employee Default Shifts"
        ordering = ['-effective_from']
        indexes = [
            models.Index(fields=['employee', 'effective_from']),
        ]


# =========================================================
# COMPENSATION
# =========================================================
class Compensation(BaseModel):
    """Employee compensation/benefits structure"""
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='compensations')
    
    # Salary Structure
    house_rent_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    medical_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    transport_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=0)
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
    
    # Frequency Type
    frequency_type = models.CharField(
        max_length=20,
        choices=[
            ('ONE_TIME', 'One Time'),
            ('SELECTED_MONTH', 'Selected Month'),
            ('MONTH_RANGE', 'Month Range'),
        ],
        default='MONTH_RANGE'
    )
    
    # Status & Dates
    status = models.CharField(
        max_length=20,
        choices=[('ACTIVE', 'Active'), ('INACTIVE', 'Inactive')],
        default='ACTIVE'
    )
    review_date = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        verbose_name = "Compensation"
        verbose_name_plural = "Compensations"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee']),
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['frequency_type']),
        ]
    
    @property
    def total_allowances(self):
        return (
            self.house_rent_allowance +
            self.medical_allowance +
            self.transport_allowance +
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


class CompensationSelectedMonth(BaseModel):
    """Selected months for compensation with SELECTED_MONTH frequency"""
    
    compensation = models.ForeignKey(Compensation, on_delete=models.CASCADE, related_name='selected_months')
    month = models.PositiveSmallIntegerField(help_text="1-12")
    year = models.PositiveSmallIntegerField()
    
    class Meta:
        verbose_name = "Compensation Selected Month"
        verbose_name_plural = "Compensation Selected Months"
        ordering = ['year', 'month']
        unique_together = ('compensation', 'month', 'year')
        indexes = [
            models.Index(fields=['compensation']),
        ]


class CompensationMonthRange(BaseModel):
    """Month range for compensation with MONTH_RANGE frequency"""
    
    compensation = models.OneToOneField(Compensation, on_delete=models.CASCADE, related_name='month_range')
    start_month = models.PositiveSmallIntegerField(help_text="1-12")
    start_year = models.PositiveSmallIntegerField()
    end_month = models.PositiveSmallIntegerField(help_text="1-12")
    end_year = models.PositiveSmallIntegerField()
    
    class Meta:
        verbose_name = "Compensation Month Range"
        verbose_name_plural = "Compensation Month Ranges"


# =========================================================
# EMPLOYEE LOAN
# =========================================================
class EmployeeLoan(BaseModel):
    """Employee loans/advances"""
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='loans')
    
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
    remaining_amount = models.DecimalField(max_digits=12, decimal_places=2)
    paid_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    paid_months = models.PositiveIntegerField(default=0)
    
    # Interest
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_payable = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Frequency Type
    frequency_type = models.CharField(
        max_length=20,
        choices=[
            ('ONE_TIME', 'One Time'),
            ('SELECTED_MONTH', 'Selected Month'),
            ('MONTH_RANGE', 'Month Range'),
        ],
        default='MONTH_RANGE'
    )
    
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
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_loans'
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, null=True)
    transaction_number = models.CharField(max_length=100, blank=True, null=True)
    
    class Meta:
        verbose_name = "Employee Loan"
        verbose_name_plural = "Employee Loans"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['frequency_type']),
        ]


class LoanSelectedMonth(BaseModel):
    """Selected months for loan with SELECTED_MONTH frequency"""
    
    loan = models.ForeignKey(EmployeeLoan, on_delete=models.CASCADE, related_name='selected_months')
    month = models.PositiveSmallIntegerField(help_text="1-12")
    year = models.PositiveSmallIntegerField()
    deduction = models.DecimalField(max_digits=12, decimal_places=2, help_text="Auto-calculated but editable")
    
    class Meta:
        verbose_name = "Loan Selected Month"
        verbose_name_plural = "Loan Selected Months"
        ordering = ['year', 'month']
        unique_together = ('loan', 'month', 'year')
        indexes = [
            models.Index(fields=['loan']),
        ]


class LoanMonthRange(BaseModel):
    """Month range for loan with MONTH_RANGE frequency"""
    
    loan = models.OneToOneField(EmployeeLoan, on_delete=models.CASCADE, related_name='month_range')
    start_month = models.PositiveSmallIntegerField(help_text="1-12")
    start_year = models.PositiveSmallIntegerField()
    end_month = models.PositiveSmallIntegerField(help_text="1-12")
    end_year = models.PositiveSmallIntegerField()
    deduction = models.DecimalField(max_digits=12, decimal_places=2, help_text="Auto-calculated, not editable")
    
    class Meta:
        verbose_name = "Loan Month Range"
        verbose_name_plural = "Loan Month Ranges"


# =========================================================
# PAYROLL RECORD
# =========================================================
class PayrollRecord(PayableModelMixin, BaseModel):
    """Payroll records for employees. Payments tracked in finance.Payment."""

    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='payroll_records')

    month = models.PositiveSmallIntegerField()
    year = models.PositiveSmallIntegerField()

    base_salary = models.DecimalField(max_digits=12, decimal_places=2)
    bonus = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    deductions = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    net_salary = models.DecimalField(max_digits=12, decimal_places=2)

    # Denormalized totals from child relational tables
    total_compensation = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_loan_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_leave_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=0)

    transaction_type = models.CharField(
        max_length=50,
        choices=[
            ('SALARY', 'Salary'),
            ('BONUS', 'Bonus'),
            ('ADVANCE', 'Advance'),
            ('REIMBURSEMENT', 'Reimbursement'),
        ],
        default='SALARY',
    )

    is_cancelled = models.BooleanField(default=False)
    custom_note = models.TextField(blank=True, null=True)
    deduction_breakdown = models.JSONField(default=dict, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "Payroll Record"
        verbose_name_plural = "Payroll Records"
        ordering = ['-year', '-month', '-created_at']
        unique_together = [('employee', 'month', 'year')]
        indexes = [
            models.Index(fields=['company_id', 'month', 'year']),
            models.Index(fields=['employee', 'is_cancelled']),
        ]


# =========================================================
# PAYROLL DEDUCTION DETAIL (relationa
# =========================================================
class PayrollDeductionDetail(BaseModel):
    """Relational table for payroll deduction details"""
    
    DEDUCTION_TYPES = [
        ('LEAVE', 'Leave Deduction'),
        ('LOAN_PRINCIPAL', 'Loan Principal'),
        ('LOAN_INTEREST', 'Loan Interest'),
        ('CUSTOM', 'Custom Deduction'),
    ]
    
    payroll = models.ForeignKey('PayrollRecord', on_delete=models.CASCADE, related_name='deduction_details')
    deduction_type = models.CharField(max_length=20, choices=DEDUCTION_TYPES)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255, blank=True, null=True)
    
    # For leave deductions
    leave_days = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    
    # For loan deductions
    loan = models.ForeignKey('EmployeeLoan', on_delete=models.SET_NULL, null=True, blank=True, related_name='payroll_deductions')
    
    class Meta:
        verbose_name = "Payroll Deduction Detail"
        verbose_name_plural = "Payroll Deduction Details"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['payroll', 'deduction_type']),
            models.Index(fields=['loan']),
        ]
    
    def __str__(self):
        return f"{self.get_deduction_type_display()} - {self.amount}"


# =========================================================
# PAYROLL COMPENSATION (relational link)
# =========================================================
class PayrollCompensation(BaseModel):
    """Relational link between PayrollRecord and Compensation for the payroll month"""

    payroll = models.ForeignKey(PayrollRecord, on_delete=models.CASCADE, related_name='payroll_compensations')
    compensation = models.ForeignKey(Compensation, on_delete=models.CASCADE, related_name='payroll_records')
    amount = models.DecimalField(max_digits=12, decimal_places=2, help_text="Compensation amount applied for this payroll month")

    class Meta:
        verbose_name = "Payroll Compensation"
        verbose_name_plural = "Payroll Compensations"
        unique_together = ('payroll', 'compensation')
        indexes = [
            models.Index(fields=['payroll', 'compensation']),
        ]

    def __str__(self):
        return f"PayrollCompensation({self.amount})"


# =========================================================
# PAYROLL LOAN DEDUCTION (relational link)
# =========================================================
class PayrollLoanDeduction(BaseModel):
    """Relational link between PayrollRecord and EmployeeLoan deduction"""

    payroll = models.ForeignKey(PayrollRecord, on_delete=models.CASCADE, related_name='payroll_loan_deductions')
    loan = models.ForeignKey(EmployeeLoan, on_delete=models.CASCADE, related_name='payroll_loan_deductions')
    principal_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    interest_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "Payroll Loan Deduction"
        verbose_name_plural = "Payroll Loan Deductions"
        indexes = [
            models.Index(fields=['payroll']),
            models.Index(fields=['loan']),
        ]

    def __str__(self):
        return f"PayrollLoanDeduction({self.total_amount})"


# =========================================================
# PAYROLL LEAVE DEDUCTION (relational link)
# =========================================================
class PayrollLeaveDeduction(BaseModel):
    """Relational link between PayrollRecord and Leave deduction"""

    payroll = models.ForeignKey(PayrollRecord, on_delete=models.CASCADE, related_name='payroll_leave_deductions')
    leave_request = models.ForeignKey('LeaveRequest', on_delete=models.CASCADE, related_name='payroll_deductions')
    working_days = models.DecimalField(max_digits=5, decimal_places=1)
    amount = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        verbose_name = "Payroll Leave Deduction"
        verbose_name_plural = "Payroll Leave Deductions"
        indexes = [
            models.Index(fields=['payroll']),
            models.Index(fields=['leave_request']),
        ]

    def __str__(self):
        return f"PayrollLeaveDeduction({self.working_days}d, {self.amount})"


# =========================================================
# SHIFT OVERRIDE
# =========================================================
class ShiftOverride(BaseModel):
    """Temporary shift overrides for specific dates"""
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shift_overrides')
    shift_template = models.ForeignKey(ShiftTemplate, on_delete=models.CASCADE, related_name='shift_overrides')
    
    date = models.DateField()
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'hr_shift_overrides'
        verbose_name = "Shift Override"
        verbose_name_plural = "Shift Overrides"
        ordering = ['-date']
        indexes = [
            models.Index(fields=['company_id', 'employee', 'date']),
            models.Index(fields=['company_id', 'date']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['shift_template']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'date'],
                name='unique_employee_shift_override'
            )
        ]


# =========================================================
# SHIFT DATE RANGE ASSIGNMENT
# =========================================================
class ShiftDateRangeAssignment(BaseModel):
    """Date range shift assignments for employees"""
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='date_range_assignments')
    shift_template = models.ForeignKey(ShiftTemplate, on_delete=models.CASCADE, related_name='date_range_assignments')
    
    start_date = models.DateField()
    end_date = models.DateField()
    
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_active = models.BooleanField(default=True)
    
    class Meta:
        db_table = 'hr_shift_date_range_assignments'
        verbose_name = "Shift Date Range Assignment"
        verbose_name_plural = "Shift Date Range Assignments"
        ordering = ['-start_date']
        indexes = [
            models.Index(fields=['company_id', 'employee']),
            models.Index(fields=['company_id', 'start_date', 'end_date']),
            models.Index(fields=['employee', 'start_date', 'end_date']),
            models.Index(fields=['is_active']),
        ]


# =========================================================
# SHIFT CHANGE HISTORY
# =========================================================
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
    
    company_id = models.IntegerField(db_index=True)
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shift_change_history')
    
    change_type = models.CharField(max_length=30, choices=CHANGE_TYPES)
    
    from_template = models.ForeignKey(ShiftTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='from_shift_changes')
    to_template = models.ForeignKey(ShiftTemplate, on_delete=models.SET_NULL, null=True, blank=True, related_name='to_shift_changes')
    
    from_template_name = models.CharField(max_length=100, blank=True, null=True)
    to_template_name = models.CharField(max_length=100, blank=True, null=True)
    
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    
    reason = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    metadata = models.JSONField(default=dict, blank=True)
    
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='shift_changes_made')
    changed_by_name = models.CharField(max_length=255, blank=True, null=True)
    changed_at = models.DateTimeField(auto_now_add=True, null=True, blank=True)
    
    class Meta:
        db_table = 'hr_shift_change_history'
        verbose_name = "Shift Change History"
        verbose_name_plural = "Shift Change Histories"
        ordering = ['-changed_at']
        indexes = [
            models.Index(fields=['company_id', 'employee']),
            models.Index(fields=['company_id', 'changed_at']),
            models.Index(fields=['employee', 'changed_at']),
            models.Index(fields=['change_type']),
            models.Index(fields=['effective_from', 'effective_to']),
        ]


# =========================================================
# EMPLOYEE SHIFT SCHEDULE
# =========================================================
class EmployeeShiftSchedule(models.Model):
    """Pre-computed shift schedule for performance optimization"""
    
    id = models.BigAutoField(primary_key=True)
    _id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    
    company_id = models.IntegerField(db_index=True)
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='shift_schedules')
    shift_template = models.ForeignKey(ShiftTemplate, on_delete=models.CASCADE, related_name='shift_schedules')
    
    date = models.DateField()
    
    source_type = models.CharField(
        max_length=30,
        choices=[
            ('DEFAULT', 'Default Shift'),
            ('OVERRIDE', 'Temporary Override'),
            ('DATE_RANGE', 'Date Range Assignment'),
        ],
        default='DEFAULT'
    )
    source_id = models.CharField(max_length=100, blank=True, null=True)
    
    shift_name = models.CharField(max_length=100)
    start_time = models.TimeField()
    end_time = models.TimeField()
    break_minutes = models.PositiveIntegerField(default=60)
    working_hours = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = 'hr_employee_shift_schedules'
        verbose_name = "Employee Shift Schedule"
        verbose_name_plural = "Employee Shift Schedules"
        ordering = ['-date']
        indexes = [
            models.Index(fields=['company_id', 'date']),
            models.Index(fields=['employee', 'date']),
            models.Index(fields=['company_id', 'employee', 'date']),
            models.Index(fields=['shift_template']),
            models.Index(fields=['source_type']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee', 'date'],
                name='unique_employee_date_schedule'
            )
        ]


# =========================================================
# LEAVE REQUEST
# =========================================================
class LeaveRequest(BaseModel):
    """Simplified employee leave requests - no balance tracking"""
    
    LEAVE_TYPE_CHOICES = [
        ('CASUAL', 'Casual Leave'),
        ('SICK', 'Sick Leave'),
        ('ANNUAL', 'Annual Leave'),
        ('MATERNITY', 'Maternity Leave'),
        ('PATERNITY', 'Paternity Leave'),
        ('BEREAVEMENT', 'Bereavement Leave'),
        ('OTHER', 'Other'),
    ]
    
    STATUS_CHOICES = [
        ('PENDING', 'Pending'),
        ('APPROVED', 'Approved'),
        ('REJECTED', 'Rejected'),
        ('CANCELLED', 'Cancelled'),
    ]
    
    # Relations
    employee = models.ForeignKey('Employee', on_delete=models.CASCADE, related_name='leave_requests')
    
    # Leave Details
    leave_type = models.CharField(max_length=20, choices=LEAVE_TYPE_CHOICES, default='CASUAL')
    start_date = models.DateField()
    end_date = models.DateField()
    is_half_day = models.BooleanField(default=False)
    reason = models.TextField()
    emergency_contact = models.CharField(max_length=50, blank=True, null=True)
    
    # Calculated field (optional - can be computed on the fly)
    total_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    
    # Status & Approval
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='PENDING')
    applied_at = models.DateTimeField(auto_now_add=True)
    
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_leave_requests'
    )
    approval_date = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'hr_leave_requests'
        verbose_name = "Leave Request"
        verbose_name_plural = "Leave Requests"
        ordering = ['-applied_at']
        indexes = [
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['start_date', 'end_date']),
            models.Index(fields=['applied_at']),
            models.Index(fields=['company_id', 'employee', 'status']),
        ]
    
    def __str__(self):
        return f"{self.employee.full_name} - {self.get_leave_type_display()} ({self.start_date} to {self.end_date})"
    
    def save(self, *args, **kwargs):
        """Auto-calculate total days before saving"""
        if self.start_date and self.end_date:
            delta = (self.end_date - self.start_date).days + 1
            self.total_days = delta - 0.5 if self.is_half_day and delta == 1 else float(delta)
        super().save(*args, **kwargs)


# =========================================================
# RECRUITMENT CANDIDATE
# =========================================================
class RecruitmentCandidate(BaseModel):
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
    assigned_to = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_candidates')
    assigned_name = models.CharField(max_length=255, blank=True, null=True)
    
    # Documents & Notes
    resume_url = models.TextField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    
    # Additional Fields
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
    interviewers = models.TextField(blank=True, null=True)
    
    # Offer details
    offer_sent_date = models.DateField(blank=True, null=True)
    offer_accepted_date = models.DateField(blank=True, null=True)
    offer_amount = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    joining_date = models.DateField(blank=True, null=True)
    
    # Rejection reason
    rejection_reason = models.TextField(blank=True, null=True)
    rejection_date = models.DateField(blank=True, null=True)
    
    class Meta:
        db_table = 'hr_recruitment_candidates'
        verbose_name = "Recruitment Candidate"
        verbose_name_plural = "Recruitment Candidates"
        ordering = ['-apply_date', '-created_at']
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['company_id', 'stage', 'status']),
            models.Index(fields=['company_id', 'department']),
            models.Index(fields=['company_id', 'position']),
            models.Index(fields=['assigned_to', 'stage']),
            models.Index(fields=['apply_date']),
            models.Index(fields=['source']),
            models.Index(fields=['name', 'email']),
        ]


# =========================================================
# RECRUITMENT ACTIVITY LOG
# =========================================================
class RecruitmentActivityLog(BaseModel):
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
    
    candidate = models.ForeignKey(RecruitmentCandidate, on_delete=models.CASCADE, related_name='activity_logs')
    
    action = models.CharField(max_length=30, choices=ACTION_CHOICES, db_index=True)
    
    old_value = models.TextField(blank=True, null=True)
    new_value = models.TextField(blank=True, null=True)
    
    metadata = models.JSONField(default=dict, blank=True)
    
    ip_address = models.GenericIPAddressField(blank=True, null=True)
    user_agent = models.TextField(blank=True, null=True)
    
    performed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='recruitment_activities')
    
    class Meta:
        db_table = 'hr_recruitment_activity_logs'
        verbose_name = "Recruitment Activity Log"
        verbose_name_plural = "Recruitment Activity Logs"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'candidate']),
            models.Index(fields=['company_id', 'action', 'created_at']),
            models.Index(fields=['performed_by']),
        ]


# =========================================================
# INTERVIEW ROUND
# =========================================================
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
    
    candidate = models.ForeignKey(RecruitmentCandidate, on_delete=models.CASCADE, related_name='interview_rounds')
    
    round_number = models.PositiveSmallIntegerField()
    round_title = models.CharField(max_length=255)
    interview_type = models.CharField(max_length=50, choices=INTERVIEW_TYPE_CHOICES, default='TECHNICAL')
    
    status = models.CharField(max_length=20, choices=ROUND_STATUS_CHOICES, default='PENDING')
    
    interview_date = models.DateTimeField(null=True, blank=True)
    interviewer = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='conducted_interviews')
    interviewer_name = models.CharField(max_length=255, blank=True, null=True)
    
    feedback = models.TextField(blank=True, null=True)
    rating = models.PositiveSmallIntegerField(null=True, blank=True, help_text="Rating out of 10")
    
    notes = models.TextField(blank=True, null=True)
    meeting_link = models.URLField(blank=True, null=True)
    duration_minutes = models.PositiveIntegerField(null=True, blank=True)
    
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


# =========================================================
# EXIT RECORD
# =========================================================
class ExitRecord(BaseModel):
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
    
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='exit_records')
    employee_name = models.CharField(max_length=255, blank=True, db_index=True)
    department = models.CharField(max_length=100, db_index=True)
    designation = models.CharField(max_length=100, blank=True, null=True)
    
    exit_date = models.DateField(db_index=True)
    last_working_day = models.DateField(null=True, blank=True)
    reason = models.CharField(max_length=50, choices=EXIT_REASONS, default='RESIGNATION', db_index=True)
    notice_served = models.BooleanField(default=True)
    
    clearance_hr = models.BooleanField(default=False, verbose_name="HR Clearance")
    clearance_it = models.BooleanField(default=False, verbose_name="IT Clearance")
    clearance_finance = models.BooleanField(default=False, verbose_name="Finance Clearance")
    clearance_admin = models.BooleanField(default=False, verbose_name="Admin Clearance")
    clearance_status = models.CharField(max_length=20, choices=CLEARANCE_STATUS, default='PENDING', db_index=True)
    
    final_settlement = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    notes = models.TextField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=RECORD_STATUS, default='ACTIVE', db_index=True)
    
    @property
    def clearance_progress(self):
        """Calculate clearance progress percentage based on four department clearances."""
        total = 4
        completed = sum([
            self.clearance_hr,
            self.clearance_it,
            self.clearance_finance,
            self.clearance_admin
        ])
        return int((completed / total) * 100) if total > 0 else 0
    
    class Meta:
        db_table = 'hr_exit_records'
        verbose_name = "Exit Record"
        verbose_name_plural = "Exit Records"
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'is_deleted']),
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['company_id', 'clearance_status']),
            models.Index(fields=['company_id', 'reason']),
            models.Index(fields=['employee', 'status']),
            models.Index(fields=['department', 'status']),
            models.Index(fields=['exit_date']),
            models.Index(fields=['last_working_day']),
            models.Index(fields=['company_id', 'clearance_status', 'status'], name='exit_clearance_status_idx'),
            models.Index(fields=['company_id', 'department', 'reason'], name='exit_dept_reason_idx'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['employee'],
                condition=models.Q(status='ACTIVE', is_deleted=False),
                name='unique_active_exit_per_employee'
            )
        ]



# =========================================================
# EXIT CHECKLIST
# =========================================================
class ExitChecklist(BaseModel):
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
    
    exit_record = models.ForeignKey(ExitRecord, on_delete=models.CASCADE, related_name='checklist_items')
    
    item_type = models.CharField(max_length=20, choices=CHECKLIST_TYPES, default='GENERAL')
    item_name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    
    status = models.CharField(max_length=20, choices=CHECKLIST_STATUS, default='PENDING')
    
    assigned_to = models.ForeignKey(Employee, on_delete=models.SET_NULL, null=True, blank=True, related_name='exit_checklist_items')
    assigned_to_name = models.CharField(max_length=255, blank=True, null=True)
    
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='completed_exit_checklists')
    
    notes = models.TextField(blank=True, null=True)
    
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


# =========================================================
# POLICY
# =========================================================
class Policy(BaseModel):
    """HR Policy model for managing company policies"""
    
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

    # Identification
    code = models.CharField(max_length=50, validators=[MinLengthValidator(3)])
    title = models.CharField(max_length=255)
    version = models.CharField(max_length=20, default="1.0")

    # Classification
    category = models.CharField(max_length=50, choices=Category.choices, db_index=True)
    department = models.CharField(max_length=100, default="ALL", db_index=True)
    employee_type = models.CharField(max_length=20, choices=EmployeeType.choices, default='ALL', db_index=True)

    # Status
    status = models.CharField(max_length=20, choices=PolicyStatus.choices, default='DRAFT', db_index=True)

    # Dates
    effective_date = models.DateField()
    review_date = models.DateField(null=True, blank=True)
    expiry_date = models.DateField(null=True, blank=True)
    approval_date = models.DateField(null=True, blank=True)

    # Content
    content = models.TextField()
    document_url = models.URLField(max_length=500, null=True, blank=True)
    change_summary = models.TextField(null=True, blank=True)

    # Acknowledgment
    requires_acknowledgment = models.BooleanField(default=False, db_index=True)
    acknowledgment_deadline = models.PositiveIntegerField(null=True, blank=True)

    # Approval
    approved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_policies')

    # Flags
    is_archived = models.BooleanField(default=False, db_index=True)

    class Meta:
        db_table = 'hr_policies'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'status']),
            models.Index(fields=['company_id', 'category']),
            models.Index(fields=['company_id', 'department']),
            models.Index(fields=['company_id', 'employee_type']),
            models.Index(fields=['code']),
            models.Index(fields=['effective_date']),
        ]
        constraints = [
            models.UniqueConstraint(fields=['company_id', 'code'], name='unique_company_policy_code')
        ]

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
class PolicyAcknowledgment(BaseModel):
    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name='acknowledgments')
    employee = models.ForeignKey(Employee, on_delete=models.CASCADE, related_name='policy_acknowledgments')
    
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
            models.UniqueConstraint(fields=['policy', 'employee'], name='unique_policy_employee_acknowledgment')
        ]


# =========================================================
# POLICY VERSION
# =========================================================
class PolicyVersion(BaseModel):
    policy = models.ForeignKey(Policy, on_delete=models.CASCADE, related_name='versions')
    
    version = models.CharField(max_length=20)
    content = models.TextField()
    document_url = models.URLField(max_length=500, null=True, blank=True)
    change_summary = models.TextField(null=True, blank=True)
    effective_date = models.DateField()
    
    changed_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name='policy_changes')

    class Meta:
        db_table = 'hr_policy_versions'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['policy', 'version']),
        ]


# =========================================================
# POLICY CATEGORY
# =========================================================
class PolicyCategory(BaseModel):
    name = models.CharField(max_length=100)
    description = models.TextField(null=True, blank=True)
    is_active = models.BooleanField(default=True)
    sorting_order = models.IntegerField(default=0)
    color_code = models.CharField(max_length=7, null=True, blank=True)
    icon = models.CharField(max_length=50, null=True, blank=True)

    class Meta:
        db_table = 'hr_policy_categories'
        ordering = ['sorting_order', 'name']
        unique_together = [['company_id', 'name']]