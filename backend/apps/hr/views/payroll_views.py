# apps/hr/views/payroll_views.py
from datetime import datetime, date, timedelta
from decimal import Decimal
from calendar import monthrange
from django.db import models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
import logging
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import (
    Employee, PayrollRecord, EmployeeLoan, Compensation, LeaveRequest, PayrollDeductionDetail,
    CompensationSelectedMonth, CompensationMonthRange, LoanSelectedMonth, LoanMonthRange,
    PayrollCompensation, PayrollLoanDeduction, PayrollLeaveDeduction
)
from apps.compsetting.models import CompanySettings, WorkingDay, PublicHoliday
from apps.finance.services.payable import (
    annotate_total_paid,
    create_payment_for,
    get_latest_confirmed_payment,
)

logger = logging.getLogger(__name__)


class PayrollView(PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'payroll'
    """Payroll management with UUID support - Leave deduction uses working days only"""
    permission_classes = [IsAuthenticated]
    
    # ------------------------------------------------------------------
    # Helper methods for leave deduction (using working days only)
    # ------------------------------------------------------------------
    def _get_month_days(self, year, month):
        first_day = date(year, month, 1)
        if month == 12:
            last_day = date(year + 1, 1, 1) - timedelta(days=1)
        else:
            last_day = date(year, month + 1, 1) - timedelta(days=1)
        return first_day, last_day

    def _get_days_in_month(self, year, month):
        """Fixed 30 days per month for daily rate calculation"""
        return 30  # Always return 30 days

    def _get_fixed_days_in_month(self):
        """Return fixed 30 days for monthly calculations"""
        return 30

    def _is_working_day(self, company_id, dt):
        """
        Check if a specific date is a working day for the company.
        Uses WorkingDay settings (is_working flag) and excludes public holidays.
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
        
        # Check if current day is a working day
        # dt.weekday(): Monday=0, Tuesday=1, Wednesday=2, Thursday=3, Friday=4, Saturday=5, Sunday=6
        if dt.weekday() not in working_days_set:
            return False
        
        # Check if it's a public holiday
        if PublicHoliday.objects.filter(
            company_id=company_id,
            date=dt,
            is_deleted=False
        ).exists():
            return False
        
        return True

    def _get_leave_deduction(self, employee_id, company_id, year, month, daily_rate):
        """
        Calculate deduction for approved leaves in the month,
        counting ONLY working days within each leave period.
        
        Example: 8 calendar days off with 2 weekends = 6 working days deducted.
        """
        first_day, last_day = self._get_month_days(year, month)
        approved_leaves = LeaveRequest.objects.filter(
            employee_id=employee_id,
            status='APPROVED',
            start_date__lte=last_day,
            end_date__gte=first_day,
            is_deleted=False
        )
        total_working_days_on_leave = 0
        
        for leave in approved_leaves:
            start = max(leave.start_date, first_day)
            end = min(leave.end_date, last_day)
            current = start
            days_in_this_leave = 0
            
            # Count only working days in the leave period
            while current <= end:
                if self._is_working_day(company_id, current):
                    days_in_this_leave += 1
                current += timedelta(days=1)
            
            # Handle half-day leave (only if the leave is exactly 1 day)
            if leave.is_half_day and days_in_this_leave == 1:
                days_in_this_leave = 0.5
            
            total_working_days_on_leave += days_in_this_leave
        
        if total_working_days_on_leave > 0:
            logger.info(
                f"Working leave days for employee {employee_id} in {year}-{month}: "
                f"{total_working_days_on_leave}, daily_rate: {daily_rate}"
            )
        
        return total_working_days_on_leave * daily_rate

    # ------------------------------------------------------------------
    # Serializers
    # ------------------------------------------------------------------
    def _serialize_payroll(self, payroll):
        # Relational child records
        compensation_breakdown = [
            {
                "id": str(pc._id),
                "compensation_id": str(pc.compensation._id),
                "amount": str(pc.amount),
            }
            for pc in payroll.payroll_compensations.all()
        ]
        loan_breakdown = [
            {
                "id": str(pld._id),
                "loan_id": str(pld.loan._id),
                "principal_amount": str(pld.principal_amount),
                "interest_amount": str(pld.interest_amount),
                "total_amount": str(pld.total_amount),
            }
            for pld in payroll.payroll_loan_deductions.all()
        ]
        leave_breakdown = [
            {
                "id": str(pld._id),
                "leave_request_id": str(pld.leave_request._id) if pld.leave_request else None,
                "working_days": str(pld.working_days),
                "amount": str(pld.amount),
            }
            for pld in payroll.payroll_leave_deductions.all()
        ]

        deduction_details = payroll.deduction_details.all()
        deductions_list = [
            {
                "id": str(detail._id),
                "type": detail.deduction_type,
                "amount": str(detail.amount),
                "description": detail.description,
                "leave_days": str(detail.leave_days) if detail.leave_days else None,
                "loan_id": str(detail.loan._id) if detail.loan else None,
            }
            for detail in deduction_details
        ]
        
        latest_payment = get_latest_confirmed_payment(payroll)
        payment_status = 'CANCELLED' if payroll.is_cancelled else payroll.payment_status

        return {
            "id": str(payroll._id),
            "employee_id": str(payroll.employee._id) if payroll.employee else None,
            "employee_name": payroll.employee.full_name if payroll.employee else None,
            "employee_code": payroll.employee.employee_id if payroll.employee else None,
            "department": payroll.employee.department.name if payroll.employee and payroll.employee.department else None,
            "designation": payroll.employee.designation.name if payroll.employee and payroll.employee.designation else None,
            "month": payroll.month,
            "year": payroll.year,
            "base_salary": str(payroll.base_salary),
            "bonus": str(payroll.bonus),
            "deductions": str(payroll.deductions),
            "total_compensation": str(payroll.total_compensation),
            "total_loan_deduction": str(payroll.total_loan_deduction),
            "total_leave_deduction": str(payroll.total_leave_deduction),
            "compensation_breakdown": compensation_breakdown,
            "loan_breakdown": loan_breakdown,
            "leave_breakdown": leave_breakdown,
            "deduction_details": deductions_list,
            "net_salary": str(payroll.net_salary),
            "paid_amount": str(payroll.paid_amount),
            "outstanding": str(payroll.outstanding),
            "transaction_type": payroll.transaction_type,
            "transaction_number": latest_payment.reference_number if latest_payment else None,
            "payment_method": latest_payment.payment_method if latest_payment else None,
            "payment_status": payment_status,
            "status": payment_status,
            "custom_note": payroll.custom_note,
            "processed_at": payroll.processed_at.isoformat() if payroll.processed_at else None,
            "created_at": payroll.created_at.isoformat() if payroll.created_at else None,
        }

    # ------------------------------------------------------------------
    # GET - List payroll records
    # ------------------------------------------------------------------
    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        employee_uuid = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')
        
        query = PayrollRecord.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee').prefetch_related(
            'deduction_details',
            'payroll_compensations',
            'payroll_loan_deductions',
            'payroll_leave_deductions',
        )
        
        if month:
            query = query.filter(month=int(month))
        if year:
            query = query.filter(year=int(year))
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        if status_filter:
            status_filter = status_filter.upper()
            if status_filter == 'CANCELLED':
                query = query.filter(is_cancelled=True)
            else:
                query = annotate_total_paid(query, PayrollRecord).filter(is_cancelled=False)
                if status_filter == 'PAID':
                    query = query.filter(_total_paid__gte=models.F('net_salary'))
                elif status_filter in ('PENDING', 'UNPAID'):
                    query = query.filter(_total_paid=0)
                elif status_filter == 'PARTIAL':
                    query = query.filter(_total_paid__gt=0, _total_paid__lt=models.F('net_salary'))
        if search:
            from django.contrib.contenttypes.models import ContentType
            from apps.finance.models import Payment

            ct = ContentType.objects.get_for_model(PayrollRecord)
            payment_payroll_ids = Payment.objects.filter(
                content_type=ct,
                reference_number__icontains=search,
                is_deleted=False,
            ).values_list('object_id', flat=True)
            query = query.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(employee__employee_id__icontains=search) |
                Q(pk__in=payment_payroll_ids)
            )
        
        records = query.order_by('-year', '-month', '-created_at')
        return Response([self._serialize_payroll(r) for r in records])

    # ------------------------------------------------------------------
    # POST (Process Payroll)
    # ------------------------------------------------------------------

    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.data.get('employee_id')
        month = int(request.data.get('month', date.today().month))
        year = int(request.data.get('year', date.today().year))
        
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
        
        # Validate employee joining date
        join_date = employee.joining_date
        if join_date and (year < join_date.year or (year == join_date.year and month < join_date.month)):
            return Response(
                {'error': f'Employee joined on {join_date}. Cannot process payroll before joining date.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for existing payroll
        if PayrollRecord.objects.filter(
            employee=employee,
            month=month,
            year=year,
            is_deleted=False
        ).exists():
            return Response(
                {'error': 'Payroll already processed for this employee this month'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # ---------- Base salary ----------
        base_salary = float(employee.salary)
        
        # ---------- Daily rate based on FIXED 30 days per month ----------
        days_in_month = self._get_days_in_month(year, month)  # Returns 30
        daily_rate = base_salary / days_in_month  # base_salary / 30
        
        # ---------- Month boundaries for leave/loan filtering ----------
        first_day, last_day = self._get_month_days(year, month)
        
        # ---------- Leave deduction (ONLY working days in leave period) ----------
        leave_deduction = self._get_leave_deduction(employee.id, company_id, year, month, daily_rate)
        leave_working_days = leave_deduction / daily_rate if daily_rate > 0 else 0
        
        # ---------- Compensation allowances (month-aware) ----------
        compensation = Compensation.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).prefetch_related('selected_months', 'month_range').first()
        total_compensation = 0
        if compensation:
            freq = compensation.frequency_type
            if freq in ('ONE_TIME', 'SELECTED_MONTH'):
                if compensation.selected_months.filter(month=month, year=year).exists():
                    total_compensation = float(compensation.total_allowances)
            elif freq == 'MONTH_RANGE':
                try:
                    mr = compensation.month_range
                    start = (mr.start_year, mr.start_month)
                    end = (mr.end_year, mr.end_month)
                    current = (year, month)
                    if start <= current <= end:
                        total_compensation = float(compensation.total_allowances)
                except CompensationMonthRange.DoesNotExist:
                    pass
            else:
                total_compensation = float(compensation.total_allowances)
        
        # ---------- Overtime ----------
        overtime_hours = float(request.data.get('overtime_hours', 0))
        overtime_amount = 0
        if compensation and overtime_hours > 0:
            overtime_rate = float(compensation.overtime_rate or 0)
            overtime_amount = overtime_hours * overtime_rate
        
        # ---------- Bonus ----------
        bonus = float(request.data.get('bonus', 0))
        
        # ---------- Custom deductions ----------
        custom_deductions = float(request.data.get('deductions', 0))
        
        # ---------- Loan deductions ----------
        loan_deductions = 0
        processed_loans = []
        
        selected_loan_uuids = request.data.get('selected_loans', [])
        if selected_loan_uuids:
            active_loans = EmployeeLoan.objects.filter(
                employee=employee,
                _id__in=selected_loan_uuids,
                status='ACTIVE',
                is_deleted=False
            ).prefetch_related('selected_months', 'month_range')
            
            for loan in active_loans:
                deduction_amount = 0
                if loan.frequency_type == 'SELECTED_MONTH':
                    selected = loan.selected_months.filter(month=month, year=year).first()
                    if selected:
                        deduction_amount = float(selected.deduction)
                elif loan.frequency_type == 'MONTH_RANGE':
                    selected = loan.selected_months.filter(month=month, year=year).first()
                    if selected:
                        deduction_amount = float(selected.deduction)
                    else:
                        try:
                            mr = loan.month_range
                            deduction_amount = float(mr.deduction)
                        except LoanMonthRange.DoesNotExist:
                            deduction_amount = 0
                elif loan.frequency_type == 'ONE_TIME':
                    selected = loan.selected_months.filter(month=month, year=year).first()
                    if selected:
                        deduction_amount = float(selected.deduction)
                
                if deduction_amount <= 0:
                    continue
                
                interest_amount = 0
                if float(loan.interest_rate) > 0:
                    interest_amount = (float(loan.remaining_amount) * float(loan.interest_rate) / 100) / max(1, loan.paid_months or 1)
                
                monthly_deduction_with_interest = deduction_amount + interest_amount
                loan_deductions += monthly_deduction_with_interest
                processed_loans.append({
                    'loan': loan,
                    'principal': deduction_amount,
                    'interest': interest_amount,
                    'total': monthly_deduction_with_interest
                })
                
                loan.paid_amount = float(loan.paid_amount) + deduction_amount
                loan.remaining_amount = max(0, float(loan.remaining_amount) - deduction_amount)
                loan.paid_months += 1
                if loan.remaining_amount <= 0:
                    loan.status = 'PAID'
                    loan.remaining_amount = 0
                loan.save()
        
        total_deductions = leave_deduction + loan_deductions + custom_deductions
        
        # ---------- Net salary ----------
        net_salary = base_salary + total_compensation + overtime_amount + bonus - total_deductions
        
        transaction_number = request.data.get('transaction_number') or \
            f"PAY-{year}{str(month).zfill(2)}-{employee.employee_id}"
        payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
        pay_immediately = request.data.get('pay_immediately', True)

        payroll = PayrollRecord.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            month=month,
            year=year,
            base_salary=base_salary,
            bonus=bonus,
            deductions=total_deductions,
            net_salary=net_salary,
            total_compensation=total_compensation,
            total_loan_deduction=loan_deductions,
            total_leave_deduction=leave_deduction,
            transaction_type=request.data.get('transaction_type', 'SALARY'),
            custom_note=request.data.get('custom_note'),
            processed_at=timezone.now(),
            created_by=request.user,
            updated_by=request.user,
        )
        
        # ---------- Create relational child records ----------
        # PayrollCompensation
        if compensation and total_compensation > 0:
            PayrollCompensation.objects.create(
                payroll=payroll,
                compensation=compensation,
                amount=total_compensation,
                company_id=company_id,
                branch_id=branch_id,
                created_by=request.user,
                updated_by=request.user,
            )
        
        # PayrollLoanDeduction
        for loan_data in processed_loans:
            if loan_data['total'] > 0:
                PayrollLoanDeduction.objects.create(
                    payroll=payroll,
                    loan=loan_data['loan'],
                    principal_amount=loan_data['principal'],
                    interest_amount=loan_data['interest'],
                    total_amount=loan_data['total'],
                    company_id=company_id,
                    branch_id=branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
        
        # PayrollLeaveDeduction - attribute per-leave working days
        if leave_deduction > 0:
            approved_leaves = LeaveRequest.objects.filter(
                employee=employee,
                status='APPROVED',
                start_date__lte=last_day,
                end_date__gte=first_day,
                is_deleted=False
            )
            for leave_req in approved_leaves:
                l_start = max(leave_req.start_date, first_day)
                l_end = min(leave_req.end_date, last_day)
                l_current = l_start
                l_working_days = 0
                while l_current <= l_end:
                    if self._is_working_day(company_id, l_current):
                        l_working_days += 1
                    l_current += timedelta(days=1)
                if leave_req.is_half_day and l_working_days == 1:
                    l_working_days = 0.5
                l_amount = l_working_days * daily_rate
                if l_amount > 0:
                    PayrollLeaveDeduction.objects.create(
                        payroll=payroll,
                        leave_request=leave_req,
                        working_days=l_working_days,
                        amount=l_amount,
                        company_id=company_id,
                        branch_id=branch_id,
                        created_by=request.user,
                        updated_by=request.user,
                    )
        
        if pay_immediately and net_salary > 0:
            bank_account = None
            bank_account_uuid = request.data.get('bank_account_id')
            if bank_account_uuid:
                from apps.finance.models import BankAccount
                try:
                    bank_account = BankAccount.objects.get(
                        _id=bank_account_uuid,
                        company_id=company_id,
                    )
                except BankAccount.DoesNotExist:
                    return Response(
                        {'error': 'Bank account not found'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

            try:
                create_payment_for(
                    payroll,
                    amount=Decimal(str(net_salary)),
                    payment_date=timezone.now().date(),
                    payment_method=payment_method,
                    reference_number=transaction_number,
                    bank_account=bank_account,
                    user=request.user,
                    auto_confirm=True,
                )
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            "message": "Payment processed successfully",
            "id": str(payroll._id),
            "transaction_number": transaction_number,
            "base_salary": str(payroll.base_salary),
            "days_in_month": days_in_month,
            "daily_rate": str(daily_rate),
            "compensation": str(total_compensation),
            "total_leave_deduction": str(payroll.total_leave_deduction),
            "total_loan_deduction": str(payroll.total_loan_deduction),
            "overtime": str(overtime_amount),
            "bonus": str(bonus),
            "deductions": str(total_deductions),
            "net_salary": str(payroll.net_salary),
            "payment_status": payroll.payment_status,
            "status": payroll.payment_status,
        }, status=status.HTTP_201_CREATED)
    
    # ------------------------------------------------------------------
    # PATCH - Update payroll record
    # ------------------------------------------------------------------

    @transaction.atomic
    def patch(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll_uuid = pk or request.data.get('id')
        if not payroll_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll = get_object_or_404(
            PayrollRecord,
            _id=payroll_uuid,
            company_id=company_id,
            is_deleted=False
        )
        if 'custom_note' in request.data:
            payroll.custom_note = request.data['custom_note']

        new_status = request.data.get('status')
        if new_status == 'CANCELLED':
            payroll.is_cancelled = True
        elif new_status == 'PAID' and payroll.payment_status != 'PAID':
            payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
            reference_number = request.data.get(
                'transaction_number',
                f"PAY-{payroll.year}{str(payroll.month).zfill(2)}-{payroll.employee.employee_id}",
            )
            bank_account = None
            bank_account_uuid = request.data.get('bank_account_id')
            if bank_account_uuid:
                from apps.finance.models import BankAccount
                try:
                    bank_account = BankAccount.objects.get(
                        _id=bank_account_uuid,
                        company_id=company_id,
                    )
                except BankAccount.DoesNotExist:
                    return Response(
                        {'error': 'Bank account not found'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
            try:
                create_payment_for(
                    payroll,
                    amount=payroll.outstanding,
                    payment_date=timezone.now().date(),
                    payment_method=payment_method,
                    reference_number=reference_number,
                    bank_account=bank_account,
                    user=request.user,
                    auto_confirm=True,
                )
            except ValueError as exc:
                return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        payroll.updated_by = request.user
        payroll.save()
        return Response({
            "message": "Payroll updated successfully",
            "payroll": self._serialize_payroll(payroll)
        })
    
    # ------------------------------------------------------------------
    # DELETE - Soft delete payroll record
    # ------------------------------------------------------------------

    @transaction.atomic
    def delete(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll_uuid = pk or request.data.get('id')
        if not payroll_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        payroll = get_object_or_404(
            PayrollRecord,
            _id=payroll_uuid,
            company_id=company_id,
            is_deleted=False
        )
        payroll.is_deleted = True
        payroll.deleted_at = timezone.now()
        payroll.deleted_by = request.user
        payroll.save()
        return Response({'message': 'Payroll record deleted successfully'})

    # ------------------------------------------------------------------
    # PREVIEW - Calculate payroll without saving
    # ------------------------------------------------------------------
    def preview(self, request):
        """Preview payroll calculation without saving - Uses fixed 30 days for daily rate"""
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.data.get('employee_id')
        month = int(request.data.get('month', date.today().month))
        year = int(request.data.get('year', date.today().year))
        overtime_hours = float(request.data.get('overtime_hours', 0))
        bonus = float(request.data.get('bonus', 0))
        custom_deductions = float(request.data.get('deductions', 0))
        selected_loan_uuids = request.data.get('selected_loans', [])
        
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
        
        # Validate employee joining date
        join_date = employee.joining_date
        if join_date and (year < join_date.year or (year == join_date.year and month < join_date.month)):
            return Response(
                {'error': f'Employee joined on {join_date}. Cannot process payroll before joining date.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        base_salary = float(employee.salary)
        
        # Calculate daily rate based on FIXED 30 days per month
        days_in_month = self._get_days_in_month(year, month)  # Returns 30
        daily_rate = base_salary / days_in_month  # base_salary / 30
        
        # Leave deduction using working days ONLY (not all calendar days)
        leave_deduction = self._get_leave_deduction(employee.id, company_id, year, month, daily_rate)
        leave_working_days = leave_deduction / daily_rate if daily_rate > 0 else 0
        
        # Compensation (month-aware)
        compensation = Compensation.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).prefetch_related('selected_months', 'month_range').first()
        total_compensation = 0
        if compensation:
            freq = compensation.frequency_type
            if freq in ('ONE_TIME', 'SELECTED_MONTH'):
                if compensation.selected_months.filter(month=month, year=year).exists():
                    total_compensation = float(compensation.total_allowances)
            elif freq == 'MONTH_RANGE':
                try:
                    mr = compensation.month_range
                    start = (mr.start_year, mr.start_month)
                    end = (mr.end_year, mr.end_month)
                    current = (year, month)
                    if start <= current <= end:
                        total_compensation = float(compensation.total_allowances)
                except CompensationMonthRange.DoesNotExist:
                    pass
            else:
                total_compensation = float(compensation.total_allowances)
        
        # Overtime
        overtime_amount = 0
        if compensation and overtime_hours > 0:
            overtime_rate = float(compensation.overtime_rate or 0)
            overtime_amount = overtime_hours * overtime_rate
        
        # Loan deductions
        loan_deductions = 0
        loan_details = []
        if selected_loan_uuids:
            active_loans = EmployeeLoan.objects.filter(
                employee=employee,
                _id__in=selected_loan_uuids,
                status='ACTIVE',
                is_deleted=False
            ).prefetch_related('selected_months', 'month_range')
            for loan in active_loans:
                deduction_amount = 0
                if loan.frequency_type == 'SELECTED_MONTH':
                    selected = loan.selected_months.filter(month=month, year=year).first()
                    if selected:
                        deduction_amount = float(selected.deduction)
                elif loan.frequency_type == 'MONTH_RANGE':
                    selected = loan.selected_months.filter(month=month, year=year).first()
                    if selected:
                        deduction_amount = float(selected.deduction)
                    else:
                        try:
                            mr = loan.month_range
                            deduction_amount = float(mr.deduction)
                        except LoanMonthRange.DoesNotExist:
                            deduction_amount = 0
                elif loan.frequency_type == 'ONE_TIME':
                    selected = loan.selected_months.filter(month=month, year=year).first()
                    if selected:
                        deduction_amount = float(selected.deduction)
                
                interest_amount = 0
                if float(loan.interest_rate) > 0 and deduction_amount > 0:
                    interest_amount = (float(loan.remaining_amount) * float(loan.interest_rate) / 100) / max(1, loan.paid_months or 1)
                total = deduction_amount + interest_amount
                loan_deductions += total
                loan_details.append({
                    'loan_id': str(loan._id),
                    'loan_type': loan.get_loan_type_display(),
                    'principal': deduction_amount,
                    'interest': interest_amount,
                    'total': total
                })
        
        total_deductions = leave_deduction + loan_deductions + custom_deductions
        net_salary = base_salary + total_compensation + overtime_amount + bonus - total_deductions
        
        return Response({
            'employee_id': str(employee._id),
            'employee_name': employee.full_name,
            'employee_code': employee.employee_id,
            'joining_date': employee.joining_date.isoformat() if employee.joining_date else None,
            'base_salary': base_salary,
            'daily_rate': daily_rate,
            'days_in_month': days_in_month,
            'compensation': total_compensation,
            'overtime_hours': overtime_hours,
            'overtime_amount': overtime_amount,
            'bonus': bonus,
            'leave_deduction': leave_deduction,
            'leave_days': leave_working_days,
            'loan_deductions': loan_deductions,
            'loan_details': loan_details,
            'custom_deductions': custom_deductions,
            'total_deductions': total_deductions,
            'net_salary': max(0, net_salary)
        })



class PayrollPreviewView(PayrollView):
    """Preview payroll without saving - Uses working days for leave deduction"""

    def get_permission_action(self):
        return 'view'

    def post(self, request):
        """Handle preview requests"""
        return self.preview(request)


# ============================================================================
# Other views (PayrollStatsView, EmployeeLoanView, etc.) remain unchanged
# ============================================================================

class PayrollStatsView(PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'payroll'
    """Payroll statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        month = int(request.query_params.get('month', date.today().month))
        year = int(request.query_params.get('year', date.today().year))
        current_payroll = PayrollRecord.objects.filter(
            company_id=company_id,
            month=month,
            year=year,
            is_deleted=False
        )
        total_payroll = current_payroll.aggregate(total=models.Sum('net_salary'))['total'] or 0
        paid_count = annotate_total_paid(current_payroll, PayrollRecord).filter(
            is_cancelled=False,
            _total_paid__gte=models.F('net_salary'),
        ).count()
        total_employees = Employee.objects.filter(
            company_id=company_id,
            is_deleted=False,
            employment_status='ACTIVE'
        ).count()
        avg_salary = total_payroll / paid_count if paid_count > 0 else 0
        return Response({
            "totalPayroll": str(total_payroll),
            "paidCount": paid_count,
            "pendingCount": total_employees - paid_count,
            "totalEmployees": total_employees,
            "avgSalary": str(avg_salary),
            "month": month,
            "year": year,
        })


class EmployeeLoanView(PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'compensation'
    """Employee loans management with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _serialize_loan(self, loan):
        selected_months = [
            {
                "id": str(sm._id),
                "month": sm.month,
                "year": sm.year,
                "deduction": str(sm.deduction),
            }
            for sm in loan.selected_months.all()
        ]
        month_range = None
        try:
            mr = loan.month_range
            month_range = {
                "id": str(mr._id),
                "start_month": mr.start_month,
                "start_year": mr.start_year,
                "end_month": mr.end_month,
                "end_year": mr.end_year,
                "deduction": str(mr.deduction),
            }
        except LoanMonthRange.DoesNotExist:
            pass
        return {
            "id": str(loan._id),
            "employee_id": str(loan.employee._id) if loan.employee else None,
            "employee_name": loan.employee.full_name if loan.employee else None,
            "employee_code": loan.employee.employee_id if loan.employee else None,
            "department": loan.employee.department.name if loan.employee and loan.employee.department else None,
            "monthly_salary": str(loan.employee.salary) if loan.employee else "0",
            "loan_type": loan.loan_type,
            "loan_type_display": loan.get_loan_type_display(),
            "principal_amount": str(loan.principal_amount),
            "remaining_amount": str(loan.remaining_amount),
            "paid_amount": str(loan.paid_amount),
            "paid_months": loan.paid_months,
            "paid_months_set": list(PayrollLoanDeduction.objects.filter(loan=loan).values_list('payroll__month', 'payroll__year').distinct()),
            "interest_rate": str(loan.interest_rate),
            "total_payable": str(loan.total_payable),
            "frequency_type": loan.frequency_type,
            "selected_months": selected_months,
            "month_range": month_range,
            "status": loan.status,
            "purpose": loan.purpose,
            "transaction_number": loan.transaction_number,
            "approved_at": loan.approved_at.isoformat() if loan.approved_at else None,
            "notes": loan.notes,
            "created_at": loan.created_at.isoformat() if loan.created_at else None,
        }
    
    def get(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if pk:
            loan = get_object_or_404(
                EmployeeLoan,
                _id=pk,
                company_id=company_id,
                is_deleted=False
            )
            return Response(self._serialize_loan(loan))
        employee_uuid = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')
        query = EmployeeLoan.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee').prefetch_related('selected_months', 'month_range')
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        if status_filter:
            query = query.filter(status=status_filter)
        if search:
            query = query.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(loan_type__icontains=search) |
                Q(purpose__icontains=search)
            )
        loans = query.order_by('-created_at')
        return Response([self._serialize_loan(l) for l in loans])
    

    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
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
        principal_amount = float(request.data.get('principal_amount', 0))
        interest_rate = float(request.data.get('interest_rate', 0))
        frequency_type = request.data.get('frequency_type', 'MONTH_RANGE')
        
        if interest_rate > 0:
            total_payable = principal_amount + (principal_amount * interest_rate / 100)
        else:
            total_payable = principal_amount
        
        # Validate frequency-specific data
        selected_months_data = request.data.get('selected_months', [])
        month_range_data = request.data.get('month_range', {})
        
        if frequency_type in ('SELECTED_MONTH', 'ONE_TIME', 'MONTH_RANGE'):
            if not selected_months_data:
                return Response(
                    {'error': 'At least one selected month is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            # Validate no month before employee joining date
            if employee.joining_date:
                join_month = employee.joining_date.month
                join_year = employee.joining_date.year
                for sm in selected_months_data:
                    m, y = sm.get('month'), sm.get('year')
                    if y < join_year or (y == join_year and m < join_month):
                        return Response(
                            {'error': f'Selected month {m}/{y} is before employee joining date {join_month}/{join_year}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
            # Validate sum of deductions equals total_payable
            if total_payable > 0:
                deductions_sum = sum(float(sm.get('deduction', 0)) for sm in selected_months_data)
                if abs(deductions_sum - total_payable) > 0.01:
                    return Response(
                        {'error': f'Sum of deductions ({deductions_sum:.2f}) must equal total payable amount ({total_payable:.2f})'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        if frequency_type == 'MONTH_RANGE':
            if not month_range_data:
                return Response(
                    {'error': 'Month range data is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            sm, sy = month_range_data.get('start_month'), month_range_data.get('start_year')
            em, ey = month_range_data.get('end_month'), month_range_data.get('end_year')
            if not all([sm, sy, em, ey]):
                return Response(
                    {'error': 'Start and end month/year are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if ey < sy or (ey == sy and em < sm):
                return Response(
                    {'error': 'End month/year must not be before start month/year'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if employee.joining_date:
                join_month = employee.joining_date.month
                join_year = employee.joining_date.year
                if sy < join_year or (sy == join_year and sm < join_month):
                    return Response(
                        {'error': f'Start month {sm}/{sy} is before employee joining date {join_month}/{join_year}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        transaction_number = f"LN-{datetime.now().strftime('%Y%m%d')}-{employee.employee_id}"
        loan = EmployeeLoan.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            loan_type=request.data.get('loan_type', 'PERSONAL_LOAN'),
            principal_amount=principal_amount,
            remaining_amount=total_payable,
            paid_amount=0,
            paid_months=0,
            interest_rate=interest_rate,
            total_payable=total_payable,
            frequency_type=frequency_type,
            status='PENDING',
            purpose=request.data.get('purpose'),
            notes=request.data.get('notes'),
            transaction_number=transaction_number,
            created_by=request.user,
            updated_by=request.user,
        )
        
        # Create child table records
        if frequency_type in ('SELECTED_MONTH', 'ONE_TIME'):
            for sm in selected_months_data:
                LoanSelectedMonth.objects.create(
                    loan=loan,
                    month=sm['month'],
                    year=sm['year'],
                    deduction=sm.get('deduction', total_payable / len(selected_months_data)),
                    company_id=company_id,
                    branch_id=branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
        elif frequency_type == 'MONTH_RANGE':
            # Save individual selected months for MONTH_RANGE (with per-month editable deductions)
            for sm in selected_months_data:
                LoanSelectedMonth.objects.create(
                    loan=loan,
                    month=sm['month'],
                    year=sm['year'],
                    deduction=sm.get('deduction', 0),
                    company_id=company_id,
                    branch_id=branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
            total_months_count = (month_range_data['end_year'] - month_range_data['start_year']) * 12 + \
                                 (month_range_data['end_month'] - month_range_data['start_month']) + 1
            deduction_per_month = total_payable / total_months_count if total_months_count > 0 else total_payable
            LoanMonthRange.objects.create(
                loan=loan,
                start_month=month_range_data['start_month'],
                start_year=month_range_data['start_year'],
                end_month=month_range_data['end_month'],
                end_year=month_range_data['end_year'],
                deduction=deduction_per_month,
                company_id=company_id,
                branch_id=branch_id,
                created_by=request.user,
                updated_by=request.user,
            )
        
        return Response({
            "message": "Loan created successfully",
            "loan": self._serialize_loan(loan)
        }, status=status.HTTP_201_CREATED)
    

    @transaction.atomic
    def patch(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan_uuid = pk or request.data.get('id')
        if not loan_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan = get_object_or_404(
            EmployeeLoan,
            _id=loan_uuid,
            company_id=company_id,
            is_deleted=False
        )
        updatable_fields = ['loan_type', 'interest_rate', 'purpose', 'notes', 'frequency_type']
        for field in updatable_fields:
            if field in request.data:
                setattr(loan, field, request.data[field])
        
        if 'principal_amount' in request.data or 'interest_rate' in request.data:
            principal = float(request.data.get('principal_amount', loan.principal_amount))
            interest = float(request.data.get('interest_rate', loan.interest_rate))
            if interest > 0:
                loan.total_payable = principal + (principal * interest / 100)
            else:
                loan.total_payable = principal
            loan.remaining_amount = float(loan.total_payable) - float(loan.paid_amount)
        
        # Update selected months if provided
        if 'selected_months' in request.data:
            # Validate sum of deductions equals total_payable
            total_payable_val = float(loan.total_payable)
            if total_payable_val > 0:
                deductions_sum = sum(float(sm.get('deduction', 0)) for sm in request.data['selected_months'])
                if abs(deductions_sum - total_payable_val) > 0.01:
                    return Response(
                        {'error': f'Sum of deductions ({deductions_sum:.2f}) must equal total payable amount ({total_payable_val:.2f})'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            loan.selected_months.all().delete()
            for sm in request.data['selected_months']:
                LoanSelectedMonth.objects.create(
                    loan=loan,
                    month=sm['month'],
                    year=sm['year'],
                    deduction=sm.get('deduction', 0),
                    company_id=company_id,
                    branch_id=loan.branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
        
        # Update month range if provided
        if 'month_range' in request.data:
            try:
                loan.month_range.delete()
            except (LoanMonthRange.DoesNotExist, AttributeError):
                pass
            mr_data = request.data['month_range']
            total_months_count = (mr_data['end_year'] - mr_data['start_year']) * 12 + \
                                 (mr_data['end_month'] - mr_data['start_month']) + 1
            tp = float(loan.total_payable)
            deduction_per_month = tp / total_months_count if total_months_count > 0 else tp
            LoanMonthRange.objects.create(
                loan=loan,
                start_month=mr_data['start_month'],
                start_year=mr_data['start_year'],
                end_month=mr_data['end_month'],
                end_year=mr_data['end_year'],
                deduction=deduction_per_month,
                company_id=company_id,
                branch_id=loan.branch_id,
                created_by=request.user,
                updated_by=request.user,
            )
        
        loan.updated_by = request.user
        loan.save()
        return Response({
            "message": "Loan updated successfully",
            "loan": self._serialize_loan(loan)
        })
    

    @transaction.atomic
    def delete(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan_uuid = pk or request.data.get('id')
        if not loan_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan = get_object_or_404(
            EmployeeLoan,
            _id=loan_uuid,
            company_id=company_id,
            is_deleted=False
        )
        if loan.status == 'ACTIVE':
            return Response(
                {'error': 'Cannot delete an active loan. Please cancel it first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan.is_deleted = True
        loan.deleted_at = timezone.now()
        loan.deleted_by = request.user
        loan.save()
        return Response({'message': 'Loan deleted successfully'})


class LoanStatusUpdateView(PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'compensation'
    permission_classes = [IsAuthenticated]

    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan_uuid = request.data.get('id')
        new_status = request.data.get('status')
        if not loan_uuid or not new_status:
            return Response(
                {'error': 'id and status are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if new_status not in ['PENDING', 'ACTIVE', 'PAID', 'CANCELLED']:
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        loan = get_object_or_404(
            EmployeeLoan,
            _id=loan_uuid,
            company_id=company_id,
            is_deleted=False
        )
        old_status = loan.status
        loan.status = new_status
        if new_status == 'ACTIVE':
            loan.approved_by = request.user
            loan.approved_at = timezone.now()
        elif new_status == 'CANCELLED':
            loan.remaining_amount = 0
        elif new_status == 'PAID':
            loan.remaining_amount = 0
            loan.paid_amount = float(loan.total_payable)
        loan.updated_by = request.user
        loan.save()
        return Response({
            "message": f"Loan status changed from {old_status} to {new_status}",
            "loan": {
                "id": str(loan._id),
                "status": loan.status,
            }
        })


class CompensationView(PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'compensation'
    permission_classes = [IsAuthenticated]
    
    def _serialize_compensation(self, comp):
        selected_months = [
            {
                "id": str(sm._id),
                "month": sm.month,
                "year": sm.year,
            }
            for sm in comp.selected_months.all()
        ]
        month_range = None
        try:
            mr = comp.month_range
            month_range = {
                "id": str(mr._id),
                "start_month": mr.start_month,
                "start_year": mr.start_year,
                "end_month": mr.end_month,
                "end_year": mr.end_year,
            }
        except CompensationMonthRange.DoesNotExist:
            pass
        return {
            "id": str(comp._id),
            "employee_id": str(comp.employee._id) if comp.employee else None,
            "employee_name": comp.employee.full_name if comp.employee else None,
            "employee_code": comp.employee.employee_id if comp.employee else None,
            "department": comp.employee.department.name if comp.employee and comp.employee.department else None,
            "designation": comp.employee.designation.name if comp.employee and comp.employee.designation else None,
            "basic_salary": str(comp.employee.salary) if comp.employee else "0",
            "house_rent_allowance": str(comp.house_rent_allowance),
            "medical_allowance": str(comp.medical_allowance),
            "transport_allowance": str(comp.transport_allowance),
            "phone_allowance": str(comp.phone_allowance),
            "utilities_allowance": str(comp.utilities_allowance),
            "education_allowance": str(comp.education_allowance),
            "other_allowances": str(comp.other_allowances),
            "employer_pf": str(comp.employer_pf),
            "employer_eobi": str(comp.employer_eobi),
            "overtime_rate": str(comp.overtime_rate),
            "bonus_percentage": str(comp.bonus_percentage),
            "total_allowances": str(comp.total_allowances),
            "total_ctc": str(comp.total_ctc),
            "total_monthly": str(comp.total_monthly),
            "frequency_type": comp.frequency_type,
            "selected_months": selected_months,
            "month_range": month_range,
            "status": comp.status,
            "paid_months_set": list(PayrollCompensation.objects.filter(compensation=comp).values_list('payroll__month', 'payroll__year').distinct()),
            "review_date": comp.review_date.isoformat() if comp.review_date else None,
            "notes": comp.notes,
            "created_at": comp.created_at.isoformat() if comp.created_at else None,
        }
    
    def get(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if pk:
            compensation = get_object_or_404(
                Compensation,
                _id=pk,
                company_id=company_id,
                is_deleted=False
            )
            return Response(self._serialize_compensation(compensation))
        employee_uuid = request.query_params.get('employee_id')
        search = request.query_params.get('search')
        status_filter = request.query_params.get('status')
        query = Compensation.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee').prefetch_related('selected_months')
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        if status_filter:
            query = query.filter(status=status_filter)
        if search:
            query = query.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search)
            )
        compensations = query.order_by('-created_at')
        return Response([self._serialize_compensation(c) for c in compensations])
    

    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        employee_uuid = request.data.get('employee_id')
        if not employee_uuid:
            return Response(
                {'error': 'employee_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        existing_compensation = Compensation.objects.filter(
            employee=employee,
            status='ACTIVE',
            is_deleted=False
        ).first()
        if existing_compensation:
            return Response(
                {'error': 'Employee already has an active compensation. Please deactivate it first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        frequency_type = request.data.get('frequency_type', 'MONTH_RANGE')
        selected_months_data = request.data.get('selected_months', [])
        month_range_data = request.data.get('month_range', {})
        
        # Validate frequency-specific data
        if frequency_type in ('SELECTED_MONTH', 'ONE_TIME'):
            if not selected_months_data:
                return Response(
                    {'error': 'At least one selected month is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if employee.joining_date:
                join_month = employee.joining_date.month
                join_year = employee.joining_date.year
                for sm in selected_months_data:
                    m, y = sm.get('month'), sm.get('year')
                    if y < join_year or (y == join_year and m < join_month):
                        return Response(
                            {'error': f'Selected month {m}/{y} is before employee joining date {join_month}/{join_year}'},
                            status=status.HTTP_400_BAD_REQUEST
                        )
        elif frequency_type == 'MONTH_RANGE':
            if not month_range_data:
                return Response(
                    {'error': 'Month range data is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            sm, sy = month_range_data.get('start_month'), month_range_data.get('start_year')
            em, ey = month_range_data.get('end_month'), month_range_data.get('end_year')
            if not all([sm, sy, em, ey]):
                return Response(
                    {'error': 'Start and end month/year are required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if ey < sy or (ey == sy and em < sm):
                return Response(
                    {'error': 'End month/year must not be before start month/year'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if employee.joining_date:
                join_month = employee.joining_date.month
                join_year = employee.joining_date.year
                if sy < join_year or (sy == join_year and sm < join_month):
                    return Response(
                        {'error': f'Start month {sm}/{sy} is before employee joining date {join_month}/{join_year}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
        
        compensation = Compensation.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            house_rent_allowance=request.data.get('house_rent_allowance', 0),
            medical_allowance=request.data.get('medical_allowance', 0),
            transport_allowance=request.data.get('transport_allowance', 0),
            phone_allowance=request.data.get('phone_allowance', 0),
            utilities_allowance=request.data.get('utilities_allowance', 0),
            education_allowance=request.data.get('education_allowance', 0),
            other_allowances=request.data.get('other_allowances', 0),
            employer_pf=request.data.get('employer_pf', 0),
            employer_eobi=request.data.get('employer_eobi', 0),
            overtime_rate=request.data.get('overtime_rate', 0),
            bonus_percentage=request.data.get('bonus_percentage', 0),
            frequency_type=frequency_type,
            status='ACTIVE',
            review_date=request.data.get('review_date'),
            notes=request.data.get('notes'),
            created_by=request.user,
            updated_by=request.user,
        )
        
        # Create child table records
        if frequency_type in ('SELECTED_MONTH', 'ONE_TIME'):
            for sm in selected_months_data:
                CompensationSelectedMonth.objects.create(
                    compensation=compensation,
                    month=sm['month'],
                    year=sm['year'],
                    company_id=company_id,
                    branch_id=branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
        elif frequency_type == 'MONTH_RANGE':
            CompensationMonthRange.objects.create(
                compensation=compensation,
                start_month=month_range_data['start_month'],
                start_year=month_range_data['start_year'],
                end_month=month_range_data['end_month'],
                end_year=month_range_data['end_year'],
                company_id=company_id,
                branch_id=branch_id,
                created_by=request.user,
                updated_by=request.user,
            )
        
        return Response({
            "message": "Compensation created successfully",
            "compensation": self._serialize_compensation(compensation)
        }, status=status.HTTP_201_CREATED)
    

    @transaction.atomic
    def patch(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        comp_uuid = pk or request.data.get('id')
        if not comp_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        compensation = get_object_or_404(
            Compensation,
            _id=comp_uuid,
            company_id=company_id,
            is_deleted=False
        )
        updatable_fields = [
            'house_rent_allowance', 'medical_allowance',
            'transport_allowance', 'phone_allowance',
            'utilities_allowance', 'education_allowance', 'other_allowances',
            'employer_pf', 'employer_eobi', 'overtime_rate', 'bonus_percentage',
            'frequency_type', 'status', 'review_date', 'notes'
        ]
        for field in updatable_fields:
            if field in request.data:
                setattr(compensation, field, request.data[field])
        
        # Update selected months if provided
        if 'selected_months' in request.data:
            compensation.selected_months.all().delete()
            for sm in request.data['selected_months']:
                CompensationSelectedMonth.objects.create(
                    compensation=compensation,
                    month=sm['month'],
                    year=sm['year'],
                    company_id=company_id,
                    branch_id=compensation.branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
        
        # Update month range if provided
        if 'month_range' in request.data:
            try:
                compensation.month_range.delete()
            except (CompensationMonthRange.DoesNotExist, AttributeError):
                pass
            mr_data = request.data['month_range']
            CompensationMonthRange.objects.create(
                compensation=compensation,
                start_month=mr_data['start_month'],
                start_year=mr_data['start_year'],
                end_month=mr_data['end_month'],
                end_year=mr_data['end_year'],
                company_id=company_id,
                branch_id=compensation.branch_id,
                created_by=request.user,
                updated_by=request.user,
            )
        
        compensation.updated_by = request.user
        compensation.save()
        return Response({
            "message": "Compensation updated successfully",
            "compensation": self._serialize_compensation(compensation)
        })
    

    @transaction.atomic
    def delete(self, request, pk=None):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        comp_uuid = pk or request.data.get('id')
        if not comp_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        compensation = get_object_or_404(
            Compensation,
            _id=comp_uuid,
            company_id=company_id,
            is_deleted=False
        )
        compensation.is_deleted = True
        compensation.status = 'INACTIVE'
        compensation.deleted_at = timezone.now()
        compensation.deleted_by = request.user
        compensation.save()
        return Response({'message': 'Compensation deleted successfully'})