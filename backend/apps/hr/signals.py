# apps/hr/signals.py
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from channels.layers import get_channel_layer
from asgiref.sync import async_to_sync
from .models import (
    Employee, EmployeeLoan, LeaveRequest, ShiftTemplate,
    Asset, AssetCategory, EmployeeAssetAssignment, PayrollRecord,
    RecruitmentCandidate, ExitRecord, Policy, Compensation,
    ShiftOverride, ShiftDateRangeAssignment
)
from apps.notifications.models import Notification

# ---------- Helper: broadcast real‑time data update ----------
def broadcast_data_update(company_id, branch_id, entity, action=None, record_id=None):
    """Send a data_update message to the company/branch WebSocket group."""
    channel_layer = get_channel_layer()
    group_name = f"notify_c{company_id}_b{branch_id}" if branch_id else f"notify_c{company_id}_bNone"

    async_to_sync(channel_layer.group_send)(
        group_name,
        {
            'type': 'data_update',
            'entity': entity,
            'action': action,
            'record_id': record_id,
        }
    )

# ---------- Model → entity name mapping ----------
MODEL_TO_ENTITY = {
    Employee: 'employees',
    LeaveRequest: 'leaves',
    ShiftTemplate: 'shiftTemplates',
    ShiftOverride: 'shiftOverrides',
    ShiftDateRangeAssignment: 'shiftDateRange',
    Asset: 'assets',
    AssetCategory: 'assetCategories',
    EmployeeAssetAssignment: 'employeeAssets',
    PayrollRecord: 'payroll',
    RecruitmentCandidate: 'recruitment',
    ExitRecord: 'exitRecords',
    Policy: 'policies',
    Compensation: 'compensations',
    EmployeeLoan: 'loans',
}

# ---------- Real‑time data updates (create, update, delete) ----------
@receiver(post_save)
def realtime_data_update_save(sender, instance, created, **kwargs):
    """Broadcast data_update on create or update."""
    if sender in MODEL_TO_ENTITY:
        entity = MODEL_TO_ENTITY[sender]
        action = 'create' if created else 'update'
        record_id = instance.id

        company_id = getattr(instance, 'company_id', None)
        branch_id = getattr(instance, 'branch_id', None)
        if not branch_id and hasattr(instance, 'employee') and instance.employee:
            branch_id = instance.employee.branch_id

        if company_id:
            broadcast_data_update(company_id, branch_id, entity, action, record_id)

@receiver(post_delete)
def realtime_data_update_delete(sender, instance, **kwargs):
    """Broadcast data_update on delete."""
    if sender in MODEL_TO_ENTITY:
        entity = MODEL_TO_ENTITY[sender]
        action = 'delete'
        record_id = instance.id

        company_id = getattr(instance, 'company_id', None)
        branch_id = getattr(instance, 'branch_id', None)
        if not branch_id and hasattr(instance, 'employee') and instance.employee:
            branch_id = instance.employee.branch_id

        if company_id:
            broadcast_data_update(company_id, branch_id, entity, action, record_id)


# ---------- Real‑time notifications (create/update/delete) ----------
# Helper to create notification
def create_notification(company_id, branch_id, title, message, notif_type='info'):
    Notification.objects.create(
        company_id=company_id,
        branch_id=branch_id,
        title=title,
        message=message,
        notification_type=notif_type
    )

# Employee
@receiver(post_save, sender=Employee)
def notify_employee_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    name = instance.full_name
    if created:
        create_notification(company_id, branch_id,
            "New Employee Onboarded",
            f"Employee {name} ({instance.employee_id}) has been added.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "Employee Updated",
            f"Employee {name} ({instance.employee_id}) details have been updated.",
            "info")

@receiver(post_delete, sender=Employee)
def notify_employee_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Employee Record Removed",
        f"Employee {instance.full_name} ({instance.employee_id}) has been deleted.",
        "warning")

# EmployeeLoan
@receiver(post_save, sender=EmployeeLoan)
def notify_loan_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    emp_name = instance.employee.full_name
    amount = instance.principal_amount
    if created:
        create_notification(company_id, branch_id,
            "New Loan Request",
            f"A loan request of {amount} has been made by {emp_name}.",
            "warning")
    else:
        create_notification(company_id, branch_id,
            "Loan Request Updated",
            f"Loan request for {emp_name} has been updated (new status: {instance.status}).",
            "info")

@receiver(post_delete, sender=EmployeeLoan)
def notify_loan_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Loan Request Removed",
        f"Loan request for {instance.employee.full_name} has been deleted.",
        "warning")

# LeaveRequest
@receiver(post_save, sender=LeaveRequest)
def notify_leave_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.employee.branch_id if instance.employee else None
    emp_name = instance.employee_name
    if created:
        create_notification(company_id, branch_id,
            "New Leave Request",
            f"Leave request submitted by {emp_name} from {instance.start_date} to {instance.end_date}.",
            "warning")
    else:
        # Only notify if status changed significantly
        if 'status' in kwargs.get('update_fields', []) or hasattr(instance, '_status_changed'):
            create_notification(company_id, branch_id,
                "Leave Request Status Changed",
                f"Leave request for {emp_name} is now {instance.status}.",
                "info")

@receiver(post_delete, sender=LeaveRequest)
def notify_leave_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.employee.branch_id,
        "Leave Request Cancelled",
        f"Leave request for {instance.employee_name} has been cancelled.",
        "info")

# ShiftTemplate
@receiver(post_save, sender=ShiftTemplate)
def notify_shift_template_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    if created:
        create_notification(company_id, branch_id,
            "New Shift Template",
            f"Shift template '{instance.name}' has been created.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "Shift Template Updated",
            f"Shift template '{instance.name}' has been updated.",
            "info")

@receiver(post_delete, sender=ShiftTemplate)
def notify_shift_template_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Shift Template Removed",
        f"Shift template '{instance.name}' has been deleted.",
        "warning")

# Asset
@receiver(post_save, sender=Asset)
def notify_asset_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    if created:
        create_notification(company_id, branch_id,
            "New Asset Added",
            f"Asset '{instance.name}' has been registered.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "Asset Updated",
            f"Asset '{instance.name}' details have been updated.",
            "info")

@receiver(post_delete, sender=Asset)
def notify_asset_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Asset Removed",
        f"Asset '{instance.name}' has been deleted.",
        "warning")

# AssetCategory
@receiver(post_save, sender=AssetCategory)
def notify_category_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    if created:
        create_notification(company_id, branch_id,
            "New Asset Category/Kit",
            f"Category '{instance.name}' has been created.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "Asset Category Updated",
            f"Category '{instance.name}' has been updated.",
            "info")

@receiver(post_delete, sender=AssetCategory)
def notify_category_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Asset Category Removed",
        f"Category '{instance.name}' has been deleted.",
        "warning")

# EmployeeAssetAssignment
@receiver(post_save, sender=EmployeeAssetAssignment)
def notify_assignment_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    emp_name = instance.employee.full_name
    asset_name = instance.asset.name
    if created:
        create_notification(company_id, branch_id,
            "Asset Assigned",
            f"Asset '{asset_name}' has been assigned to {emp_name}.",
            "info")
    else:
        # status change (returned, lost, etc.)
        if 'status' in kwargs.get('update_fields', []):
            create_notification(company_id, branch_id,
                "Asset Assignment Status Changed",
                f"Asset '{asset_name}' assigned to {emp_name} is now {instance.status}.",
                "info")

@receiver(post_delete, sender=EmployeeAssetAssignment)
def notify_assignment_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Asset Assignment Removed",
        f"Assignment of '{instance.asset.name}' to {instance.employee.full_name} has been removed.",
        "warning")

# PayrollRecord
@receiver(post_save, sender=PayrollRecord)
def notify_payroll_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    emp_name = instance.employee.full_name
    if created:
        create_notification(company_id, branch_id,
            "Payroll Record Generated",
            f"Payroll for {emp_name} ({instance.month}/{instance.year}) has been processed.",
            "success")
    else:
        create_notification(company_id, branch_id,
            "Payroll Record Updated",
            f"Payroll for {emp_name} ({instance.month}/{instance.year}) has been updated.",
            "info")

@receiver(post_delete, sender=PayrollRecord)
def notify_payroll_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Payroll Record Removed",
        f"Payroll for {instance.employee.full_name} ({instance.month}/{instance.year}) has been deleted.",
        "warning")

# RecruitmentCandidate
@receiver(post_save, sender=RecruitmentCandidate)
def notify_candidate_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    if created:
        create_notification(company_id, branch_id,
            "New Candidate Application",
            f"Candidate {instance.name} applied for {instance.position}.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "Candidate Status Updated",
            f"Candidate {instance.name} is now {instance.stage}.",
            "info")

@receiver(post_delete, sender=RecruitmentCandidate)
def notify_candidate_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Candidate Application Removed",
        f"Candidate {instance.name} has been removed.",
        "warning")

# ExitRecord
@receiver(post_save, sender=ExitRecord)
def notify_exit_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.employee.branch_id if instance.employee else None
    emp_name = instance.employee_name
    if created:
        create_notification(company_id, branch_id,
            "Employee Exit Initiated",
            f"Exit process started for {emp_name}.",
            "warning")
    else:
        # Clearance status change
        if 'clearance_status' in kwargs.get('update_fields', []):
            create_notification(company_id, branch_id,
                "Exit Clearance Updated",
                f"Exit clearance for {emp_name} is now {instance.clearance_status}.",
                "info")
        else:
            create_notification(company_id, branch_id,
                "Exit Record Updated",
                f"Exit record for {emp_name} has been updated.",
                "info")

@receiver(post_delete, sender=ExitRecord)
def notify_exit_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.employee.branch_id,
        "Exit Record Removed",
        f"Exit record for {instance.employee_name} has been removed.",
        "warning")

# Policy
@receiver(post_save, sender=Policy)
def notify_policy_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    if created:
        create_notification(company_id, branch_id,
            "New HR Policy Published",
            f"Policy '{instance.title}' has been created.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "HR Policy Updated",
            f"Policy '{instance.title}' has been updated (version {instance.version}).",
            "info")

@receiver(post_delete, sender=Policy)
def notify_policy_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "HR Policy Removed",
        f"Policy '{instance.title}' has been archived/removed.",
        "warning")

# Compensation
@receiver(post_save, sender=Compensation)
def notify_compensation_change(sender, instance, created, **kwargs):
    company_id = instance.company_id
    branch_id = instance.branch_id
    emp_name = instance.employee.full_name
    if created:
        create_notification(company_id, branch_id,
            "Compensation Added",
            f"Compensation structure added for {emp_name}.",
            "info")
    else:
        create_notification(company_id, branch_id,
            "Compensation Updated",
            f"Compensation for {emp_name} has been updated.",
            "info")

@receiver(post_delete, sender=Compensation)
def notify_compensation_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Compensation Removed",
        f"Compensation for {instance.employee.full_name} has been removed.",
        "warning")

# ShiftOverride
@receiver(post_save, sender=ShiftOverride)
def notify_override_change(sender, instance, created, **kwargs):
    if created:
        create_notification(instance.company_id, instance.branch_id,
            "Shift Override Created",
            f"Shift override for {instance.employee.full_name} on {instance.date}.",
            "info")
    else:
        create_notification(instance.company_id, instance.branch_id,
            "Shift Override Updated",
            f"Shift override for {instance.employee.full_name} on {instance.date} updated.",
            "info")

@receiver(post_delete, sender=ShiftOverride)
def notify_override_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Shift Override Removed",
        f"Shift override for {instance.employee.full_name} on {instance.date} removed.",
        "warning")

# ShiftDateRangeAssignment
@receiver(post_save, sender=ShiftDateRangeAssignment)
def notify_date_range_change(sender, instance, created, **kwargs):
    if created:
        create_notification(instance.company_id, instance.branch_id,
            "Date Range Shift Assignment",
            f"Shift assigned to {instance.employee.full_name} from {instance.start_date} to {instance.end_date}.",
            "info")
    else:
        create_notification(instance.company_id, instance.branch_id,
            "Date Range Shift Updated",
            f"Shift assignment for {instance.employee.full_name} updated.",
            "info")

@receiver(post_delete, sender=ShiftDateRangeAssignment)
def notify_date_range_delete(sender, instance, **kwargs):
    create_notification(instance.company_id, instance.branch_id,
        "Date Range Shift Removed",
        f"Shift assignment for {instance.employee.full_name} removed.",
        "warning")