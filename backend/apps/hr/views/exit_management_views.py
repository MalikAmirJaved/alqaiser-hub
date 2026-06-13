# apps/hr/views/exit_management_views.py

import logging
from datetime import datetime, date, timedelta
from django.db import models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Count, Sum, Avg, Q

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import (
    ExitRecord, ExitChecklist, Employee, PayrollRecord,
    Compensation, EmployeeLoan, LeaveRequest,
    CompensationSelectedMonth, CompensationMonthRange,
    LoanSelectedMonth, LoanMonthRange,
)
from apps.compsetting.models import CompanySettings, WorkingDay, PublicHoliday

logger = logging.getLogger(__name__)


class BaseExitView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'exit'
    """Base class for exit management views with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _get_company_context(self, request):
        """Validate and return company/branch context"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            raise ValueError("User is not associated with any company")
        
        return company_id, branch_id
    
    def _serialize_exit_record(self, exit_record):
        """Serialize exit record with UUIDs"""
        return {
            "id": str(exit_record._id),
            "employee_id": str(exit_record.employee._id) if exit_record.employee else None,
            "employee_name": exit_record.employee_name,
            "department": exit_record.department,
            "designation": exit_record.designation,
            "exit_date": exit_record.exit_date.isoformat() if exit_record.exit_date else None,
            "last_working_day": exit_record.last_working_day.isoformat() if exit_record.last_working_day else None,
            "reason": exit_record.get_reason_display(),
            "reason_value": exit_record.reason,
            "notice_served": exit_record.notice_served,
            "clearance_hr": exit_record.clearance_hr,
            "clearance_it": exit_record.clearance_it,
            "clearance_finance": exit_record.clearance_finance,
            "clearance_admin": exit_record.clearance_admin,
            "clearance_status": exit_record.get_clearance_status_display(),
            "clearance_status_value": exit_record.clearance_status,
            "clearance_progress": exit_record.clearance_progress,
            "final_settlement": float(exit_record.final_settlement),
            "final_settlement_status": exit_record.final_settlement_status,
            "notes": exit_record.notes,
            "status": exit_record.get_status_display(),
            "status_value": exit_record.status,
            "created_at": exit_record.created_at.isoformat() if exit_record.created_at else None,
            "updated_at": exit_record.updated_at.isoformat() if exit_record.updated_at else None,
        }


class ExitRecordView(BaseExitView):
    """CRUD operations for exit records with UUID support"""
    
    def get(self, request):
        """Get all exit records with filtering"""
        company_id, branch_id = self._get_company_context(request)
        
        query = ExitRecord.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee')
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(Q(branch_id=branch_id) | Q(branch_id__isnull=True))
        
        search = request.query_params.get('search')
        if search:
            query = query.filter(
                Q(employee_name__icontains=search) |
                Q(department__icontains=search) |
                Q(designation__icontains=search) |
                Q(notes__icontains=search)
            )
        
        status_filter = request.query_params.get('status')
        clearance_filter = request.query_params.get('clearance_status')
        reason_filter = request.query_params.get('reason')
        department_filter = request.query_params.get('department')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if status_filter:
            query = query.filter(status=status_filter)
        if clearance_filter:
            query = query.filter(clearance_status=clearance_filter)
        if reason_filter:
            query = query.filter(reason=reason_filter)
        if department_filter:
            query = query.filter(department=department_filter)
        if date_from:
            query = query.filter(exit_date__gte=date_from)
        if date_to:
            query = query.filter(exit_date__lte=date_to)
        
        order_by = request.query_params.get('order_by', '-created_at')
        allowed_order_fields = [
            'created_at', '-created_at', 'exit_date', '-exit_date',
            'employee_name', '-employee_name', 'department', '-department',
            'clearance_status', '-clearance_status'
        ]
        if order_by in allowed_order_fields:
            query = query.order_by(order_by)
        
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 25))
        page_size = min(page_size, 100)
        
        total_count = query.count()
        exit_records = query[(page - 1) * page_size:page * page_size]
        
        return Response({
            "data": [self._serialize_exit_record(record) for record in exit_records],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total_count,
                "total_pages": (total_count + page_size - 1) // page_size
            }
        })
    

    def post(self, request):
        """Create new exit record"""
        company_id, branch_id = self._get_company_context(request)
        
        required_fields = ['employee_id', 'exit_date', 'reason']
        for field in required_fields:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        employee_uuid = request.data['employee_id']
        employee = get_object_or_404(
            Employee,
            _id=employee_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        existing_exit = ExitRecord.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).first()
        
        if existing_exit:
            return Response(
                {'error': 'Employee already has an active exit record'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        exit_date = datetime.strptime(request.data['exit_date'], '%Y-%m-%d').date()
        last_working_day = None
        if request.data.get('last_working_day'):
            last_working_day = datetime.strptime(request.data['last_working_day'], '%Y-%m-%d').date()
        
        exit_record = ExitRecord.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            employee_name=employee.full_name,
            department=request.data.get('department', employee.department),
            designation=request.data.get('designation', employee.designation),
            exit_date=exit_date,
            last_working_day=last_working_day,
            reason=request.data['reason'],
            notice_served=request.data.get('notice_served', True),
            clearance_hr=request.data.get('clearance_hr', False),
            clearance_it=request.data.get('clearance_it', False),
            clearance_finance=request.data.get('clearance_finance', False),
            clearance_admin=request.data.get('clearance_admin', False),
            final_settlement=request.data.get('final_settlement', 0),
            notes=request.data.get('notes', ''),
            status='ACTIVE',
            created_by=request.user,
            updated_by=request.user,
        )
        
        if request.data.get('update_employee_status', False):
            employee.employment_status = 'RESIGNED' if exit_record.reason == 'RESIGNATION' else 'TERMINATED'
            employee.save(update_fields=['employment_status'])
        
        self._create_default_checklist(exit_record, request.user)
        
        return Response({
            "message": "Exit record created successfully",
            "exit_record": self._serialize_exit_record(exit_record)
        }, status=status.HTTP_201_CREATED)
    
    def _create_default_checklist(self, exit_record, user):
        """Create default checklist items for exit record"""
        default_items = [
            {"item_type": "HR", "item_name": "Exit Interview", "description": "Conduct exit interview with employee"},
            {"item_type": "HR", "item_name": "Experience Letter", "description": "Prepare experience/relieving letter"},
            {"item_type": "HR", "item_name": "Final Settlement Calculation", "description": "Calculate final dues and settlements"},
            {"item_type": "HR", "item_name": "PF/Gratuity Processing", "description": "Process provident fund or gratuity if applicable"},
            {"item_type": "IT", "item_name": "System Access Revocation", "description": "Revoke all system access and credentials"},
            {"item_type": "IT", "item_name": "Email Account", "description": "Backup and deactivate email account"},
            {"item_type": "IT", "item_name": "Software Licenses", "description": "Transfer or revoke software licenses"},
            {"item_type": "IT", "item_name": "Data Backup", "description": "Ensure all work data is backed up"},
            {"item_type": "FINANCE", "item_name": "Pending Expenses", "description": "Clear all pending reimbursements and expenses"},
            {"item_type": "FINANCE", "item_name": "Loan Settlement", "description": "Settle any outstanding loans or advances"},
            {"item_type": "FINANCE", "item_name": "Salary Dues", "description": "Calculate and process pending salary"},
            {"item_type": "FINANCE", "item_name": "Tax Documents", "description": "Prepare tax-related documents"},
            {"item_type": "ADMIN", "item_name": "Asset Return", "description": "Collect all company assets (laptop, phone, ID card, etc.)"},
            {"item_type": "ADMIN", "item_name": "Access Card", "description": "Deactivate office access card"},
            {"item_type": "ADMIN", "item_name": "Parking/Canteen", "description": "Cancel parking and canteen facilities"},
            {"item_type": "ADMIN", "item_name": "Documents Handover", "description": "Collect all company documents and files"},
        ]
        
        checklist_items = []
        for item in default_items:
            checklist_items.append(
                ExitChecklist(
                    company_id=exit_record.company_id,
                    exit_record=exit_record,
                    item_type=item['item_type'],
                    item_name=item['item_name'],
                    description=item.get('description', ''),
                    status='PENDING',
                    created_by=user,
                    updated_by=user,
                )
            )
        
        if checklist_items:
            ExitChecklist.objects.bulk_create(checklist_items)
    

    def patch(self, request):
        """Update exit record using UUID"""
        company_id, _ = self._get_company_context(request)
        
        exit_uuid = request.data.get('id')
        if not exit_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        exit_record = get_object_or_404(
            ExitRecord,
            _id=exit_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        updatable_fields = [
            'exit_date', 'last_working_day', 'reason', 'notice_served',
            'clearance_hr', 'clearance_it', 'clearance_finance', 'clearance_admin',
            'clearance_status', 'final_settlement', 'final_settlement_status',
            'notes', 'status'
        ]
        
        for field in updatable_fields:
            if field in request.data:
                if field in ['exit_date', 'last_working_day'] and request.data[field]:
                    setattr(exit_record, field, datetime.strptime(request.data[field], '%Y-%m-%d').date())
                elif field == 'final_settlement':
                    setattr(exit_record, field, float(request.data[field]))
                else:
                    setattr(exit_record, field, request.data[field])
        
        if request.data.get('status') == 'CLOSED' and exit_record.status != 'CLOSED':
            employee = exit_record.employee
            if employee and employee.employment_status in ['ACTIVE', 'ON_LEAVE']:
                employee.employment_status = 'RESIGNED' if exit_record.reason == 'RESIGNATION' else 'TERMINATED'
                employee.save(update_fields=['employment_status'])
        
        exit_record.updated_by = request.user
        exit_record.save()
        
        return Response({
            "message": "Exit record updated successfully",
            "exit_record": self._serialize_exit_record(exit_record)
        })
    

    def delete(self, request):
        """Soft delete exit record using UUID"""
        company_id, _ = self._get_company_context(request)
        
        exit_uuid = request.data.get('id')
        if not exit_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        exit_record = get_object_or_404(
            ExitRecord,
            _id=exit_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        exit_record.is_deleted = True
        exit_record.deleted_at = timezone.now()
        exit_record.deleted_by = request.user
        exit_record.save()
        
        return Response({'message': 'Exit record deleted successfully'})


class ExitStatsView(BaseExitView):
    """Get exit management statistics"""
    
    def get(self, request):
        company_id, branch_id = self._get_company_context(request)
        
        base_query = ExitRecord.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            base_query = base_query.filter(
                Q(branch_id=branch_id) | Q(branch_id__isnull=True)
            )
        
        year = request.query_params.get('year', date.today().year)
        monthly_query = base_query.filter(exit_date__year=year)
        
        stats = {
            "total_exits": base_query.count(),
            "active_exits": base_query.filter(status='ACTIVE').count(),
            "closed_exits": base_query.filter(status='CLOSED').count(),
            "pending_clearance": base_query.filter(clearance_status='PENDING').count(),
            "in_progress_clearance": base_query.filter(clearance_status='IN_PROGRESS').count(),
            "completed_clearance": base_query.filter(clearance_status='COMPLETED').count(),
            "avg_settlement": float(base_query.aggregate(Avg('final_settlement'))['final_settlement__avg'] or 0),
            "total_settlement": float(base_query.aggregate(Sum('final_settlement'))['final_settlement__sum'] or 0),
            "by_reason": list(base_query.values('reason').annotate(count=Count('id')).order_by('-count')),
            "by_department": list(base_query.values('department').annotate(count=Count('id')).order_by('-count')),
            "monthly_trend": list(monthly_query.annotate(
                month=models.functions.ExtractMonth('exit_date')
            ).values('month').annotate(count=Count('id')).order_by('month')),
            "clearance_completion_rate": round((base_query.filter(clearance_status='COMPLETED').count() / base_query.count() * 100) if base_query.count() > 0 else 0, 2),
            "notice_compliance_rate": round((base_query.filter(notice_served=True).count() / base_query.count() * 100) if base_query.count() > 0 else 0, 2),
        }
        
        return Response(stats)


class ExitFinalSettlementView(BaseExitView):
    """Calculate final settlement amount for an employee
    Uses same working-day logic as PayrollView for consistency.
    """

    def get_permission_action(self):
        return 'view'

    def _is_working_day(self, company_id, dt):
        """Check if a specific date is a working day for the company.
        Mirrors PayrollView._is_working_day logic.
        """
        company_settings = CompanySettings.objects.filter(company_id=company_id).first()
        if not company_settings:
            return True
        working_days_set = set(
            WorkingDay.objects.filter(
                company_settings=company_settings,
                is_working=True
            ).values_list('day', flat=True)
        )
        if dt.weekday() not in working_days_set:
            return False
        if PublicHoliday.objects.filter(
            company_id=company_id,
            date=dt,
            is_deleted=False
        ).exists():
            return False
        return True

    def _count_working_days_in_range(self, company_id, start_date, end_date):
        """Count working days in a date range (inclusive)."""
        working_days = 0
        current = start_date
        while current <= end_date:
            if self._is_working_day(company_id, current):
                working_days += 1
            current += timedelta(days=1)
        return working_days

    def _is_month_paid(self, employee, month, year):
        """Check if a specific month has been paid via payroll."""
        return PayrollRecord.objects.filter(
            employee=employee,
            month=month,
            year=year,
            is_deleted=False,
            is_cancelled=False,
            net_salary__gt=0
        ).exists()

    def post(self, request):
        company_id, _ = self._get_company_context(request)

        employee_uuid = request.data.get('employee_id')
        if not employee_uuid:
            return Response(
                {'error': 'employee_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        employee = get_object_or_404(
            Employee,
            _id=employee_uuid,
            company_id=company_id,
            is_deleted=False
        )

        base_salary = float(employee.salary or 0)
        join_date = employee.joining_date

        # Allow last_working_day from request body (for new exits without record yet),
        # fall back to active exit record's last_working_day or exit_date
        lwd = None
        if request.data.get('last_working_day'):
            lwd = datetime.strptime(request.data['last_working_day'], '%Y-%m-%d').date()
        else:
            exit_record = ExitRecord.objects.filter(
                employee=employee,
                is_deleted=False,
                status='ACTIVE'
            ).first()
            if exit_record:
                lwd = exit_record.last_working_day or exit_record.exit_date

        if not join_date or not lwd:
            return Response(
                {'error': 'Employee joining date and last working day are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ---------- Determine calculation period ----------
        lwd_month_start = date(lwd.year, lwd.month, 1)

        # Check if the month before last_working_day's month was paid
        prev_month = lwd_month_start - timedelta(days=1)
        prev_month_paid = self._is_month_paid(employee, prev_month.month, prev_month.year)

        if join_date.month == lwd.month and join_date.year == lwd.year:
            # Same month: period from joining_date to last_working_day
            period_start = join_date
        elif not prev_month_paid:
            # Previous month not paid: accumulate from joining_date
            period_start = join_date
        else:
            # Previous month paid: only current month portion
            period_start = lwd_month_start

        period_end = lwd

        # ---------- Working days & salary calculation ----------
        total_calendar_days = (period_end - period_start).days + 1
        total_working_days = self._count_working_days_in_range(
            company_id, period_start, period_end
        )
        non_working_days = total_calendar_days - total_working_days

        # Daily rate uses fixed 30 days per month (same as PayrollView)
        days_in_month = 30
        daily_rate = base_salary / days_in_month if base_salary > 0 else 0
        settlement_salary = total_working_days * daily_rate

        # ---------- Compensation allowances (month-aware, same as PayrollView) ----------
        compensation = Compensation.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).prefetch_related('selected_months', 'month_range').first()
        total_compensation = 0
        if compensation:
            freq = compensation.frequency_type
            if freq in ('ONE_TIME', 'SELECTED_MONTH'):
                if compensation.selected_months.filter(
                    month=lwd.month,
                    year=lwd.year
                ).exists():
                    total_compensation = float(compensation.total_allowances)
            elif freq == 'MONTH_RANGE':
                try:
                    mr = compensation.month_range
                    start = (mr.start_year, mr.start_month)
                    end = (mr.end_year, mr.end_month)
                    current = (lwd.year, lwd.month)
                    if start <= current <= end:
                        total_compensation = float(compensation.total_allowances)
                except CompensationMonthRange.DoesNotExist:
                    pass

        # ---------- Loan deductions (all remaining outstanding balances) ----------
        active_loans = EmployeeLoan.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        )
        total_loan_deduction = sum(float(l.remaining_amount or 0) for l in active_loans)

        # ---------- Leave deductions (working days in period, uses _is_working_day like PayrollView) ----------
        leave_deduction = 0
        if daily_rate > 0:
            approved_leaves = LeaveRequest.objects.filter(
                employee=employee,
                status='APPROVED',
                start_date__lte=period_end,
                end_date__gte=period_start,
                is_deleted=False
            )
            for leave in approved_leaves:
                l_start = max(leave.start_date, period_start)
                l_end = min(leave.end_date, period_end)
                leave_working_days = self._count_working_days_in_range(company_id, l_start, l_end)
                if leave.is_half_day and leave_working_days == 1:
                    leave_working_days = 0.5
                leave_deduction += leave_working_days * daily_rate

        net_settlement = settlement_salary + total_compensation - total_loan_deduction - leave_deduction

        net_settlement_val = max(0, net_settlement)

        return Response({
            'employee_id': str(employee._id),
            'employee_name': employee.full_name,
            'joining_date': join_date.isoformat(),
            'last_working_day': lwd.isoformat(),
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat(),
            'prev_month_paid': prev_month_paid,
            'total_calendar_days': total_calendar_days,
            'non_working_days': non_working_days,
            'total_working_days': total_working_days,
            'days_in_month': days_in_month,
            'daily_rate': str(daily_rate),
            'base_salary': str(base_salary),
            'settlement_salary': str(settlement_salary),
            'compensation': str(total_compensation),
            'loan_deduction': str(total_loan_deduction),
            'leave_deduction': str(leave_deduction),
            'net_settlement': str(net_settlement_val),
            'net_salary': str(net_settlement_val),
        })


class ExitChecklistView(BaseExitView):
    """Manage exit checklist items with UUID support"""
    
    def get(self, request):
        """Get checklist items for an exit record"""
        company_id, _ = self._get_company_context(request)
        exit_uuid = request.query_params.get('exit_record_id')
        
        if not exit_uuid:
            return Response(
                {'error': 'exit_record_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        exit_record = get_object_or_404(
            ExitRecord,
            _id=exit_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        checklist_items = ExitChecklist.objects.filter(
            exit_record=exit_record,
            is_deleted=False
        ).order_by('item_type', 'item_name')
        
        return Response([
            {
                "id": str(item._id),
                "exit_record_id": str(item.exit_record._id),
                "item_type": item.item_type,
                "item_name": item.item_name,
                "description": item.description,
                "status": item.status,
                "assigned_to": str(item.assigned_to._id) if item.assigned_to else None,
                "assigned_to_name": item.assigned_to_name,
                "completed_at": item.completed_at.isoformat() if item.completed_at else None,
                "notes": item.notes,
            }
            for item in checklist_items
        ])
    

    def patch(self, request):
        """Update checklist item status using UUID"""
        company_id, _ = self._get_company_context(request)
        
        item_uuid = request.data.get('id')
        if not item_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        checklist_item = get_object_or_404(
            ExitChecklist,
            _id=item_uuid,
            exit_record__company_id=company_id,
            is_deleted=False
        )
        
        if 'status' in request.data:
            checklist_item.status = request.data['status']
            if request.data['status'] == 'COMPLETED':
                checklist_item.completed_at = timezone.now()
                checklist_item.completed_by = request.user
        
        if 'notes' in request.data:
            checklist_item.notes = request.data['notes']
        
        if 'assigned_to' in request.data:
            assigned_to_uuid = request.data['assigned_to']
            if assigned_to_uuid:
                assigned_employee = get_object_or_404(Employee, _id=assigned_to_uuid, company_id=company_id, is_deleted=False)
                checklist_item.assigned_to = assigned_employee
                checklist_item.assigned_to_name = assigned_employee.full_name
            else:
                checklist_item.assigned_to = None
                checklist_item.assigned_to_name = None
        
        checklist_item.updated_by = request.user
        checklist_item.save()
        
        exit_record = checklist_item.exit_record
        self._update_exit_clearance_status(exit_record)
        
        return Response({
            "message": "Checklist item updated successfully",
            "item_id": str(checklist_item._id),
            "status": checklist_item.status
        })
    
    def _update_exit_clearance_status(self, exit_record):
        """Update exit record clearance based on checklist progress"""
        checklist_items = ExitChecklist.objects.filter(
            exit_record=exit_record,
            is_deleted=False
        )
        
        total_items = checklist_items.count()
        if total_items == 0:
            return
        
        for clearance_type in ['HR', 'IT', 'FINANCE', 'ADMIN']:
            type_items = checklist_items.filter(item_type=clearance_type)
            type_completed = type_items.filter(status='COMPLETED').count()
            is_cleared = type_items.count() > 0 and type_completed == type_items.count()
            setattr(exit_record, f'clearance_{clearance_type.lower()}', is_cleared)
        
        exit_record.save()


class ExitBulkActionView(BaseExitView):
    """Bulk actions for exit records with UUID support"""
    

    def post(self, request):
        """Perform bulk actions"""
        company_id, _ = self._get_company_context(request)
        
        action = request.data.get('action')
        record_uuids = request.data.get('ids', [])
        
        if not action or not record_uuids:
            return Response(
                {'error': 'action and ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        records = ExitRecord.objects.filter(
            _id__in=record_uuids,
            company_id=company_id,
            is_deleted=False
        )
        
        if action == 'CLOSE':
            records.update(
                status='CLOSED',
                updated_by=request.user
            )
            message = f'Successfully closed {records.count()} exit records'
        
        elif action == 'REOPEN':
            records.update(
                status='ACTIVE',
                updated_by=request.user
            )
            message = f'Successfully reopened {records.count()} exit records'
        
        elif action == 'DELETE':
            records.update(
                is_deleted=True,
                deleted_at=timezone.now(),
                deleted_by=request.user
            )
            message = f'Successfully deleted {records.count()} exit records'
        
        else:
            return Response(
                {'error': 'Invalid action'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        return Response({
            'message': message,
            'affected_count': records.count()
        })