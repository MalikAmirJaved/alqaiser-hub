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
from decimal import Decimal
from django.db import transaction as db_transaction

from apps.hr.models import (
    ExitRecord, ExitChecklist, Employee, PayrollRecord,
    Compensation, EmployeeLoan, LeaveRequest,
    CompensationSelectedMonth, CompensationMonthRange,
    LoanSelectedMonth, LoanMonthRange,
    PayrollLoanDeduction,
    EmployeeAssetAssignment, Asset
)
from apps.finance.services.payable import create_payment_for
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
            "exit_date": exit_record.exit_date.isoformat() if exit_record.exit_date else None,
            "last_working_day": exit_record.last_working_day.isoformat() if exit_record.last_working_day else None,
            "reason": exit_record.get_reason_display(),
            "reason_value": exit_record.reason,
            "notice_served": exit_record.notice_served,
            "final_settlement": float(exit_record.final_settlement or 0),
            "settlement_notes": exit_record.settlement_notes,
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
                Q(notes__icontains=search)
            )
        
        # Support direct UUID lookup for detail page
        pk = request.query_params.get('pk')
        if pk:
            query = query.filter(_id=pk)
        
        status_filter = request.query_params.get('status')
        reason_filter = request.query_params.get('reason')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if status_filter:
            query = query.filter(status=status_filter)
        if reason_filter:
            query = query.filter(reason=reason_filter)
        if date_from:
            query = query.filter(exit_date__gte=date_from)
        if date_to:
            query = query.filter(exit_date__lte=date_to)
        
        order_by = request.query_params.get('order_by', '-created_at')
        allowed_order_fields = [
            'created_at', '-created_at', 'exit_date', '-exit_date',
            'employee_name', '-employee_name',
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
        
        required_fields = ['employee_id', 'exit_date', 'last_working_day', 'reason']
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
            status='PENDING',
            is_deleted=False
        ).first()
        
        if existing_exit:
            return Response(
                {'error': 'Employee already has a pending exit record'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        exit_date = datetime.strptime(request.data['exit_date'], '%Y-%m-%d').date()
        last_working_day = datetime.strptime(request.data['last_working_day'], '%Y-%m-%d').date()
        
        
        exit_record = ExitRecord.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            employee_name=employee.full_name,
            exit_date=exit_date,
            last_working_day=last_working_day,
            reason=request.data['reason'],
            notice_served=request.data.get('notice_served', True),
            final_settlement=request.data.get('final_settlement', 0),
            settlement_notes=request.data.get('settlement_notes', ''),
            notes=request.data.get('notes', ''),
            created_by=request.user,
            updated_by=request.user,
        )
        
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

    @db_transaction.atomic
    def _apply_final_settlement(self, employee, company_id, branch_id, exit_record, user):
        """
        Apply final settlement side effects when exit is CONFIRMED:
        - Deactivate active compensation
        - Cancel pending/approved leaves after LWD
        - Settle all outstanding personal loans (mark as RETURNED)
        - Settle all outstanding salary advances (mark as RETURNED)
        - Create a final PayrollRecord with CONFIRMED payment
        - Update exit_record.final_settlement with calculated amount
        """
        result = {}
        lwd = exit_record.last_working_day or exit_record.exit_date
        month = lwd.month
        year = lwd.year

        # ── 1. Deactivate compensation ──
        active_comp = Compensation.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).first()
        if active_comp:
            active_comp.status = 'INACTIVE'
            active_comp.updated_by = user
            active_comp.save(update_fields=['status', 'updated_by'])
            result['compensation_deactivated'] = str(active_comp._id)

        # ── 2. Cancel pending/approved leaves after LWD ──
        cancelled_leaves = LeaveRequest.objects.filter(
            employee=employee,
            status__in=['PENDING', 'APPROVED'],
            start_date__gt=lwd,
            is_deleted=False
        )
        cancelled_count = cancelled_leaves.count()
        cancelled_leaves.update(
            status='CANCELLED',
            updated_by=user,
        )
        result['leaves_cancelled'] = cancelled_count

        # ── 3. Settle all outstanding personal loans ──
        outstanding_loans = EmployeeLoan.objects.filter(
            employee=employee,
            status='PAID',
            is_deleted=False
        ).exclude(loan_type='SALARY_ADVANCE')
        total_loan_settled = 0
        for loan in outstanding_loans:
            remaining = float(loan.remaining_amount or 0)
            if remaining > 0:
                total_loan_settled += remaining
            loan.remaining_amount = 0
            loan.paid_amount = float(loan.total_payable)
            loan.status = 'RETURNED'
            loan.updated_by = user
            loan.save(update_fields=['remaining_amount', 'paid_amount', 'status', 'updated_by'])
        result['loans_settled'] = outstanding_loans.count()
        result['loan_settlement_amount'] = total_loan_settled

        # ── 4. Settle all outstanding salary advances ──
        outstanding_advances = EmployeeLoan.objects.filter(
            employee=employee,
            loan_type='SALARY_ADVANCE',
            status='PAID',
            is_deleted=False
        )
        total_advance_settled = 0
        for adv in outstanding_advances:
            remaining = float(adv.remaining_amount or 0)
            if remaining > 0:
                total_advance_settled += remaining
            adv.remaining_amount = 0
            adv.paid_amount = float(adv.total_payable)
            adv.status = 'RETURNED'
            adv.updated_by = user
            adv.save(update_fields=['remaining_amount', 'paid_amount', 'status', 'updated_by'])
        result['advances_settled'] = outstanding_advances.count()
        result['advance_settlement_amount'] = total_advance_settled

        # ── 5. Create final PayrollRecord with CONFIRMED payment (only if settlement > 0) ──
        settlement_amount = exit_record.final_settlement or 0
        transaction_number = f"EXIT-{year}{str(month).zfill(2)}-{employee.employee_id}"

        if settlement_amount > 0:
            final_payroll, created = PayrollRecord.objects.update_or_create(
                employee=employee,
                month=month,
                year=year,
                is_deleted=False,
                defaults={
                    'company_id': company_id,
                    'branch_id': branch_id,
                    'base_salary': Decimal(str(settlement_amount)),
                    'bonus': 0,
                    'deductions': Decimal(str(total_loan_settled + total_advance_settled)),
                    'net_salary': Decimal(str(settlement_amount)),
                    'total_compensation': 0,
                    'total_loan_deduction': Decimal(str(total_loan_settled + total_advance_settled)),
                    'total_leave_deduction': 0,
                    'transaction_type': 'FINAL_SETTLEMENT',
                    'custom_note': f'Exit settlement - {exit_record.get_reason_display()}',
                    'processed_at': timezone.now(),
                    'created_by': user,
                    'updated_by': user,
                }
            )
            result['payroll_id'] = str(final_payroll._id)
            result['payroll_created'] = created

            # ── 6. Create CONFIRMED payment → goes to finance ──
            payment = create_payment_for(
                final_payroll,
                amount=Decimal(str(settlement_amount)),
                payment_date=date.today(),
                user=user,
                payment_method='BANK_TRANSFER',
                reference_number=transaction_number,
                notes=f'Exit settlement for {employee.full_name} - {exit_record.get_reason_display()}',
                auto_confirm=False,
            )
            payment.status = 'CONFIRMED'
            payment.save(update_fields=['status', 'updated_at'])
            result['payment_id'] = str(payment._id)
            result['transaction_number'] = transaction_number

            result['settlement_note'] = (
                f'Settlement: {settlement_amount:.2f} | '
                f'Loans settled: {total_loan_settled:.2f} | '
                f'Advances settled: {total_advance_settled:.2f} '
                f'| Payroll: {final_payroll.transaction_number}'
            )
        else:
            result['settlement_note'] = (
                f'No payout — employee owes company {abs(settlement_amount):.2f} | '
                f'Loans settled: {total_loan_settled:.2f} | '
                f'Advances settled: {total_advance_settled:.2f}'
            )

        # Update exit record with calculated settlement
        exit_record.final_settlement = settlement_amount
        exit_record.settlement_notes = result.get('settlement_note', '')
        exit_record.save(update_fields=['final_settlement', 'settlement_notes'])

        return result
    

    def patch(self, request):
        """Update exit record using UUID"""
        company_id, branch_id = self._get_company_context(request)
        
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
        
        # Lock editing once status is confirmed or rejected
        if exit_record.status in ('CONFIRMED', 'REJECTED'):
            return Response(
                {'error': f'Exit record is locked. Status is already {exit_record.status.lower()}.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updatable_fields = [
            'exit_date', 'last_working_day', 'reason', 'notice_served',
            'final_settlement', 'settlement_notes', 'notes', 'status'
        ]
        
        for field in updatable_fields:
            if field in request.data:
                if field in ['exit_date', 'last_working_day'] and request.data[field]:
                    setattr(exit_record, field, datetime.strptime(request.data[field], '%Y-%m-%d').date())
                else:
                    setattr(exit_record, field, request.data[field])
        
        # Apply final settlement side effects when exit is confirmed
        if request.data.get('status') == 'CONFIRMED':
            employee = exit_record.employee
            if employee and employee.employment_status not in ['RESIGNED', 'TERMINATED']:
                employee.employment_status = 'RESIGNED' if exit_record.reason == 'RESIGNATION' else 'TERMINATED'
                employee.save(update_fields=['employment_status'])

            # Apply settlement: deactivate comp, cancel leaves, settle loans, create payroll
            try:
                settlement_result = self._apply_final_settlement(
                    employee, company_id, branch_id, exit_record, request.user
                )
            except Exception as e:
                logger.error(f"Failed to apply final settlement for {employee.full_name}: {e}", exc_info=True)
                return Response(
                    {'error': f'Exit confirmed but settlement application failed: {str(e)}'},
                    status=status.HTTP_500_INTERNAL_SERVER_ERROR
                )
        else:
            settlement_result = None

        exit_record.updated_by = request.user
        exit_record.save()

        response_data = {
            "message": "Exit record updated successfully",
            "exit_record": self._serialize_exit_record(exit_record)
        }
        if settlement_result:
            response_data["settlement"] = settlement_result

        return Response(response_data)
    

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
            "pending_exits": base_query.filter(status='PENDING').count(),
            "confirmed_exits": base_query.filter(status='CONFIRMED').count(),
            "rejected_exits": base_query.filter(status='REJECTED').count(),
            "by_reason": list(base_query.values('reason').annotate(count=Count('id')).order_by('-count')),
            "monthly_trend": list(monthly_query.annotate(
                month=models.functions.ExtractMonth('exit_date')
            ).values('month').annotate(count=Count('id')).order_by('month')),
            "notice_compliance_rate": round((base_query.filter(notice_served=True).count() / base_query.count() * 100) if base_query.count() > 0 else 0, 2),
        }
        
        return Response(stats)


class ExitFinalSettlementView(BaseExitView):
    """Calculate final settlement amount for an employee
    Uses same calendar-day proration logic as PayrollView for consistency.
    """

    def get_permission_action(self):
        return 'view'

    def _is_working_day(self, company_id, dt):
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
        working_days = 0
        current = start_date
        while current <= end_date:
            if self._is_working_day(company_id, current):
                working_days += 1
            current += timedelta(days=1)
        return working_days

    def _is_month_paid(self, employee, month, year):
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

        original_base_salary = float(employee.salary or 0)
        join_date = employee.joining_date

        lwd = None
        if request.data.get('last_working_day'):
            lwd = datetime.strptime(request.data['last_working_day'], '%Y-%m-%d').date()
        else:
            exit_record = ExitRecord.objects.filter(
                employee=employee,
                is_deleted=False,
                status='PENDING'
            ).first()
            if exit_record:
                lwd = exit_record.last_working_day or exit_record.exit_date

        if not join_date or not lwd:
            return Response(
                {'error': 'Employee joining date and last working day are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        lwd_month_start = date(lwd.year, lwd.month, 1)

        prev_month = lwd_month_start - timedelta(days=1)
        prev_month_paid = self._is_month_paid(employee, prev_month.month, prev_month.year)

        if join_date.month == lwd.month and join_date.year == lwd.year:
            period_start = join_date
        elif not prev_month_paid:
            period_start = join_date
        else:
            period_start = lwd_month_start

        period_end = lwd

        # ---- PayrollView-style: iterate per unpaid month ----
        days_in_month = 30
        daily_rate = original_base_salary / days_in_month if original_base_salary > 0 else 0

        compensation = Compensation.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).prefetch_related('selected_months', 'month_range').first()

        total_base_salary = 0
        total_compensation = 0
        total_leave_deduction = 0

        cursor = date(period_start.year, period_start.month, 1)
        while cursor <= period_end:
            month = cursor.month
            year = cursor.year

            month_start = max(period_start, cursor)
            if month == 12:
                month_end = min(period_end, date(year, 12, 31))
            else:
                month_end = min(period_end, date(year, month + 1, 1) - timedelta(days=1))

            calendar_days = (month_end - month_start).days + 1
            prorated_days = min(calendar_days, days_in_month)
            proration_factor = prorated_days / days_in_month

            total_base_salary += original_base_salary * proration_factor

            if compensation:
                freq = compensation.frequency_type
                full_month_comp = 0
                if freq in ('ONE_TIME', 'SELECTED_MONTH'):
                    if compensation.selected_months.filter(month=month, year=year).exists():
                        full_month_comp = float(compensation.total_allowances)
                elif freq == 'MONTH_RANGE':
                    try:
                        mr = compensation.month_range
                        if (mr.start_year, mr.start_month) <= (year, month) <= (mr.end_year, mr.end_month):
                            full_month_comp = float(compensation.total_allowances)
                    except CompensationMonthRange.DoesNotExist:
                        pass
                else:
                    full_month_comp = float(compensation.total_allowances)
                total_compensation += full_month_comp * proration_factor

            if daily_rate > 0:
                approved_leaves = LeaveRequest.objects.filter(
                    employee=employee,
                    status='APPROVED',
                    start_date__lte=month_end,
                    end_date__gte=month_start,
                    is_deleted=False
                )
                for leave in approved_leaves:
                    l_start = max(leave.start_date, month_start)
                    l_end = min(leave.end_date, month_end)
                    leave_working_days = self._count_working_days_in_range(company_id, l_start, l_end)
                    if leave.is_half_day and leave_working_days == 1:
                        leave_working_days = 0.5
                    total_leave_deduction += leave_working_days * daily_rate

            if month == 12:
                cursor = date(year + 1, 1, 1)
            else:
                cursor = date(year, month + 1, 1)

    # ---- Loan deductions (all outstanding: personal loans, NOT salary advances) ----
        active_loans = EmployeeLoan.objects.filter(
            employee=employee,
            status='PAID',
            is_deleted=False
        ).exclude(loan_type='SALARY_ADVANCE')
        total_loan_deduction = sum(float(l.remaining_amount or 0) for l in active_loans)

        # Salary advances outstanding (status='PAID' = not yet returned/deducted)
        advance_loans = EmployeeLoan.objects.filter(
            employee=employee,
            loan_type='SALARY_ADVANCE',
            status='PAID',
            is_deleted=False
        )
        total_advance_outstanding = sum(float(l.remaining_amount or 0) for l in advance_loans)

        net_settlement = total_base_salary + total_compensation - total_leave_deduction - total_loan_deduction - total_advance_outstanding
        net_settlement_payable = max(0, net_settlement)

        return Response({
            'employee_id': str(employee._id),
            'employee_name': employee.full_name,
            'joining_date': join_date.isoformat(),
            'last_working_day': lwd.isoformat(),
            'period_start': period_start.isoformat(),
            'period_end': period_end.isoformat(),
            'prev_month_paid': prev_month_paid,
            'days_in_month': days_in_month,
            'daily_rate': str(daily_rate),
            'original_base_salary': str(original_base_salary),
            'base_salary': str(total_base_salary),
            'compensation': str(total_compensation),
            'leave_deduction': str(total_leave_deduction),
            'loan_deduction': str(total_loan_deduction),
            'advance_deduction': str(total_advance_outstanding),
            'net_settlement': str(net_settlement_payable),
            'net_salary': str(net_settlement_payable),
            'net_settlement_raw': str(net_settlement),  # may be negative — employee owes company
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
        
        return Response({
            "message": "Checklist item updated successfully",
            "item_id": str(checklist_item._id),
            "status": checklist_item.status
        })


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
        
        if action == 'CONFIRM':
            records.update(
                status='CONFIRMED',
                updated_by=request.user
            )
            message = f'Successfully confirmed {records.count()} exit records'
        
        elif action == 'REJECT':
            records.update(
                status='REJECTED',
                updated_by=request.user
            )
            message = f'Successfully rejected {records.count()} exit records'
        
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


class ExitClearDuesView(BaseExitView):
    """Clear negative settlement (employee owes company) by creating a finance receipt"""

    def get_permission_action(self):
        return 'update'

    @db_transaction.atomic
    def post(self, request):
        company_id, branch_id = self._get_company_context(request)

        exit_uuid = request.data.get('exit_id')
        if not exit_uuid:
            return Response(
                {'error': 'exit_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        exit_record = get_object_or_404(
            ExitRecord,
            _id=exit_uuid,
            company_id=company_id,
            is_deleted=False
        )

        # Validate: must be CONFIRMED and have negative settlement
        if exit_record.status != 'CONFIRMED':
            return Response(
                {'error': 'Only CONFIRMED exit records can have dues cleared'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if exit_record.final_settlement >= 0:
            return Response(
                {'error': 'No negative settlement to clear'},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount_due = abs(exit_record.final_settlement)
        employee = exit_record.employee

        # ── Create a finance RECEIPT payment (employee returned money to company) ──
        from django.contrib.contenttypes.models import ContentType
        from apps.finance.models import Payment

        ct = ContentType.objects.get_for_model(ExitRecord, for_concrete_model=False)
        payment = Payment.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            content_type=ct,
            object_id=exit_record.pk,
            payment_type='RECEIPT',
            payment_method='BANK_TRANSFER',
            amount=Decimal(str(amount_due)),
            payment_date=date.today(),
            reference_number=f'DUES-{exit_record._id}'[:50],
            notes=f'Employee dues recovery - {employee.full_name if employee else exit_record.employee_name} - Exit {exit_record._id}',
            status='CONFIRMED',
            created_by=request.user,
            updated_by=request.user,
        )

        # ── Update exit record ──
        old_notes = exit_record.settlement_notes or ''
        exit_record.final_settlement = 0
        exit_record.settlement_notes = (
            f'{old_notes} | Dues cleared: {amount_due:.2f} received on {date.today().isoformat()}'
        )
        exit_record.updated_by = request.user
        exit_record.save(update_fields=['final_settlement', 'settlement_notes', 'updated_by'])

        return Response({
            'message': f'Dues of {amount_due:.2f} cleared successfully',
            'payment_id': str(payment._id),
            'transaction_number': payment.reference_number,
        }, status=status.HTTP_200_OK)


class ExitEmployeeAssetsView(BaseExitView):
    """View and return assets allocated to the employee of an exit record"""

    def get_permission_action(self):
        return 'view'

    def get(self, request, exit_id):
        """Get all ACTIVE asset assignments for this exit's employee"""
        company_id, _ = self._get_company_context(request)
        
        exit_record = get_object_or_404(
            ExitRecord,
            _id=exit_id,
            company_id=company_id,
            is_deleted=False
        )
        
        assignments = EmployeeAssetAssignment.objects.filter(
            employee=exit_record.employee,
            status='ACTIVE',
            is_deleted=False,
            company_id=company_id
        ).select_related('asset')
        
        return Response([
            {
                "id": str(a._id),
                "asset_id": str(a.asset._id),
                "asset_name": a.asset.name,
                "asset_brand": a.asset.brand,
                "asset_serial": a.asset.serial_number,
                "quantity": a.quantity,
                "assigned_date": a.assigned_date.isoformat() if a.assigned_date else None,
                "condition_on_assignment": a.condition_on_assignment,
                "notes": a.notes,
            }
            for a in assignments
        ])


class ExitReturnAssetView(BaseExitView):
    """Return a single asset assignment from an exit record"""

    def get_permission_action(self):
        return 'update'

    def post(self, request, exit_id):
        """Return a specific asset assignment"""
        company_id, _ = self._get_company_context(request)
        
        exit_record = get_object_or_404(
            ExitRecord,
            _id=exit_id,
            company_id=company_id,
            is_deleted=False
        )
        
        if exit_record.status != 'CONFIRMED':
            return Response(
                {'error': 'Asset return is only allowed for confirmed exit records'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        assignment_id = request.data.get('assignment_id')
        if not assignment_id:
            return Response(
                {'error': 'assignment_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        assignment = get_object_or_404(
            EmployeeAssetAssignment,
            _id=assignment_id,
            employee=exit_record.employee,
            status='ACTIVE',
            company_id=company_id,
            is_deleted=False
        )
        
        condition_on_return = request.data.get('condition_on_return', 'GOOD')
        return_notes = request.data.get('return_notes', '')
        returned_date = request.data.get('returned_date', date.today().isoformat())
        
        if isinstance(returned_date, str):
            returned_date = datetime.strptime(returned_date, '%Y-%m-%d').date()
        
        assignment.status = 'RETURNED'
        assignment.returned_date = returned_date
        assignment.condition_on_return = condition_on_return
        assignment.return_notes = return_notes
        assignment.updated_by = request.user
        assignment.save()
        
        # Restore asset quantity
        asset = assignment.asset
        asset.available_quantity += assignment.quantity
        asset.is_assigned = False
        asset.save(update_fields=['available_quantity', 'is_assigned'])
        
        return Response({
            "message": f'Asset "{asset.name}" returned successfully',
            "assignment_id": str(assignment._id),
        })
