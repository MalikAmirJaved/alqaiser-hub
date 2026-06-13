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

# Utility function to broadcast data update
def broadcast_data_update(company_id, branch_id, entity, action=None, record_id=None):
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

# Maps models to React Query keys to invalidate on the frontend
ENTITY_MAP = {
    Employee: ['employees', 'employeeStats'],
    LeaveRequest: ['leaves', 'leaveStats', 'leaveBalances'],
    ShiftTemplate: ['shiftTemplates'],
    ShiftOverride: ['shiftOverrides', 'resolvedShifts', 'shiftStatistics'],
    ShiftDateRangeAssignment: ['shiftDateRange', 'resolvedShifts', 'shiftStatistics'],
    Asset: ['assets', 'assetStats'],
    AssetCategory: ['assetCategories'],
    EmployeeAssetAssignment: ['employeeAssets', 'assetStats'],
    PayrollRecord: ['payroll', 'payrollStats'],
    RecruitmentCandidate: ['recruitment', 'recruitmentStats'],
    ExitRecord: ['exitRecords', 'exitMetrics'],
    Policy: ['policies'],
    Compensation: ['compensations'],
    EmployeeLoan: ['loans'],
}

@receiver([post_save, post_delete])
def realtime_data_update(sender, instance, **kwargs):
    if sender in ENTITY_MAP:
        entities = ENTITY_MAP[sender]
        company_id = getattr(instance, 'company_id', None)
        branch_id = getattr(instance, 'branch_id', None)
        # If model has employee relation, get branch from employee
        if not branch_id and hasattr(instance, 'employee') and instance.employee:
            branch_id = instance.employee.branch_id
            
        broadcast_data_update(company_id, branch_id, entities)


# ==========================================
# CREATION NOTIFICATIONS
# ==========================================

@receiver(post_save, sender=Employee)
def notify_new_employee(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="New Employee Onboarded",
            message=f"Employee {instance.first_name} {instance.last_name or ''} ({instance.employee_id}) has been added.",
            notification_type="info"
        )

@receiver(post_save, sender=EmployeeLoan)
def notify_new_loan(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="New Loan Request",
            message=f"A new loan request of {instance.principal_amount} has been made by {instance.employee.first_name}.",
            notification_type="warning"
        )

@receiver(post_save, sender=LeaveRequest)
def notify_leave_request(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.employee.branch_id if hasattr(instance, 'employee') else None,
            title="New Leave Request",
            message=f"Leave request submitted by {instance.employee.first_name}.",
            notification_type="warning"
        )

@receiver(post_save, sender=ShiftTemplate)
def notify_shift_template(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="New Shift Template",
            message=f"A new shift template '{instance.name}' has been created.",
            notification_type="info"
        )

@receiver(post_save, sender=Asset)
def notify_new_asset(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="New Asset Added",
            message=f"Asset '{instance.name}' has been registered.",
            notification_type="info"
        )

@receiver(post_save, sender=EmployeeAssetAssignment)
def notify_asset_assignment(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="Asset Assigned",
            message=f"Asset '{instance.asset.name}' assigned to {instance.employee.first_name}.",
            notification_type="info"
        )

@receiver(post_save, sender=PayrollRecord)
def notify_payroll(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="Payroll Record Generated",
            message=f"Payroll for {instance.employee.first_name} has been processed for {instance.month}/{instance.year}.",
            notification_type="success"
        )

@receiver(post_save, sender=RecruitmentCandidate)
def notify_new_candidate(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="New Candidate Application",
            message=f"Candidate {instance.first_name} {instance.last_name or ''} applied.",
            notification_type="info"
        )

@receiver(post_save, sender=ExitRecord)
def notify_exit_record(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.employee.branch_id,
            title="Employee Exit Initiated",
            message=f"Exit process started for {instance.employee.first_name}.",
            notification_type="warning"
        )

@receiver(post_save, sender=Policy)
def notify_new_policy(sender, instance, created, **kwargs):
    if created:
        Notification.objects.create(
            company_id=instance.company_id,
            branch_id=instance.branch_id,
            title="New HR Policy Published",
            message=f"Policy: {instance.title}",
            notification_type="info"
        )

@receiver(post_save, sender=Asset)
def realtime_asset_update(sender, instance, created, **kwargs):
    broadcast_data_update(
        company_id=instance.company_id,
        branch_id=instance.branch_id,
        entity='assets',
        action='create' if created else 'update',
        record_id=instance.id
    )

@receiver(post_delete, sender=Asset)
def realtime_asset_delete(sender, instance, **kwargs):
    broadcast_data_update(
        company_id=instance.company_id,
        branch_id=instance.branch_id,
        entity='assets',
        action='delete',
        record_id=instance.id
    )











