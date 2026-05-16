# apps/hr/views/payroll_views.py
from datetime import datetime, date
from django.db import transaction, models
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
import logging

from apps.common.baseauthentication import CompanyBranchMixin
from apps.hr.models import (
    Employee, PayrollRecord, EmployeeLoan, Compensation
)

logger = logging.getLogger(__name__)


class PayrollView(CompanyBranchMixin, APIView):
    """Payroll management with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _serialize_payroll(self, payroll):
        return {
            "id": str(payroll._id),
            "employee_id": str(payroll.employee._id) if payroll.employee else None,
            "employee_name": payroll.employee.full_name if payroll.employee else None,
            "employee_code": payroll.employee.employee_id if payroll.employee else None,
            "department": payroll.employee.department if payroll.employee else None,
            "designation": payroll.employee.designation if payroll.employee else None,
            "month": payroll.month,
            "year": payroll.year,
            "base_salary": str(payroll.base_salary),
            "bonus": str(payroll.bonus),
            "deductions": str(payroll.deductions),
            "deduction_breakdown": payroll.deduction_breakdown,
            "net_salary": str(payroll.net_salary),
            "transaction_type": payroll.transaction_type,
            "transaction_number": payroll.transaction_number,
            "payment_method": payroll.payment_method,
            "status": payroll.status,
            "custom_note": payroll.custom_note,
            "processed_at": payroll.processed_at.isoformat() if payroll.processed_at else None,
            "created_at": payroll.created_at.isoformat() if payroll.created_at else None,
        }
    
    def get(self, request):
        """Get payroll records with optional filters"""
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
        ).select_related('employee')
        
        if month:
            query = query.filter(month=int(month))
        if year:
            query = query.filter(year=int(year))
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        if status_filter:
            query = query.filter(status=status_filter)
        if search:
            query = query.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(employee__employee_id__icontains=search) |
                Q(transaction_number__icontains=search)
            )
        
        records = query.order_by('-year', '-month', '-created_at')
        
        return Response([self._serialize_payroll(r) for r in records])
    
    @transaction.atomic
    def post(self, request):
        """Process payroll for an employee"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.data.get('employee_id')
        month = request.data.get('month', date.today().month)
        year = request.data.get('year', date.today().year)
        
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
        
        base_salary = float(employee.salary)
        
        compensation = Compensation.objects.filter(
            employee=employee,
            is_active=True,
            is_deleted=False
        ).first()
        
        total_compensation = 0
        if compensation:
            total_compensation = float(compensation.total_allowances)
        
        overtime_hours = float(request.data.get('overtime_hours', 0))
        overtime_amount = 0
        if compensation and overtime_hours > 0:
            overtime_rate = float(compensation.overtime_rate or 0)
            overtime_amount = overtime_hours * overtime_rate
        
        bonus = float(request.data.get('bonus', 0))
        custom_deductions = float(request.data.get('deductions', 0))
        
        loan_deductions = 0
        deduction_breakdown = {
            'custom_deductions': custom_deductions,
            'custom_reason': request.data.get('deduction_reason', ''),
            'loan_deductions': [],
            'compensation_allowances': float(total_compensation),
            'overtime_hours': overtime_hours,
            'overtime_amount': float(overtime_amount),
        }
        
        selected_loan_uuids = request.data.get('selected_loans', [])
        if selected_loan_uuids:
            active_loans = EmployeeLoan.objects.filter(
                employee=employee,
                _id__in=selected_loan_uuids,
                status='ACTIVE',
                is_deleted=False
            )
            
            for loan in active_loans:
                monthly_deduction_with_interest = float(loan.monthly_deduction)
                if float(loan.interest_rate) > 0:
                    interest_amount = (float(loan.remaining_amount) * float(loan.interest_rate) / 100) / loan.remaining_months
                    monthly_deduction_with_interest += interest_amount
                
                loan_deductions += monthly_deduction_with_interest
                deduction_breakdown['loan_deductions'].append({
                    'loan_id': str(loan._id),
                    'loan_type': loan.loan_type,
                    'principal_deduction': str(loan.monthly_deduction),
                    'interest_amount': str(monthly_deduction_with_interest - float(loan.monthly_deduction)),
                    'total_deduction': str(monthly_deduction_with_interest)
                })
                
                loan.remaining_amount = max(0, float(loan.remaining_amount) - float(loan.monthly_deduction))
                loan.paid_months += 1
                if loan.remaining_amount <= 0:
                    loan.status = 'PAID'
                    loan.remaining_amount = 0
                loan.save()
        
        total_deductions = custom_deductions + loan_deductions
        net_salary = base_salary + total_compensation + overtime_amount + bonus - total_deductions
        
        transaction_number = request.data.get('transaction_number') or \
            f"PAY-{year}{str(month).zfill(2)}-{employee.employee_id}"
        
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
            transaction_type=request.data.get('transaction_type', 'SALARY'),
            transaction_number=transaction_number,
            payment_method=request.data.get('payment_method', 'BANK_TRANSFER'),
            status='PAID',
            custom_note=request.data.get('custom_note'),
            deduction_breakdown=deduction_breakdown,
            processed_at=timezone.now(),
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Payment processed successfully",
            "id": str(payroll._id),
            "transaction_number": payroll.transaction_number,
            "base_salary": str(payroll.base_salary),
            "compensation": str(total_compensation),
            "overtime": str(overtime_amount),
            "bonus": str(bonus),
            "deductions": str(total_deductions),
            "net_salary": str(payroll.net_salary),
            "status": payroll.status,
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update payroll record using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payroll_uuid = request.data.get('id')
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
        
        updatable_fields = ['status', 'custom_note', 'transaction_number', 'payment_method']
        for field in updatable_fields:
            if field in request.data:
                setattr(payroll, field, request.data[field])
        
        payroll.updated_by = request.user
        payroll.save()
        
        return Response({
            "message": "Payroll updated successfully",
            "payroll": self._serialize_payroll(payroll)
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete payroll record using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        payroll_uuid = request.data.get('id')
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


class PayrollStatsView(CompanyBranchMixin, APIView):
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
        paid_count = current_payroll.filter(status='PAID').count()
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


class EmployeeLoanView(CompanyBranchMixin, APIView):
    """Employee loans management with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _serialize_loan(self, loan):
        return {
            "id": str(loan._id),
            "employee_id": str(loan.employee._id) if loan.employee else None,
            "employee_name": loan.employee.full_name if loan.employee else None,
            "employee_code": loan.employee.employee_id if loan.employee else None,
            "department": loan.employee.department if loan.employee else None,
            "monthly_salary": str(loan.employee.salary) if loan.employee else "0",
            "loan_type": loan.loan_type,
            "loan_type_display": loan.get_loan_type_display(),
            "principal_amount": str(loan.principal_amount),
            "monthly_deduction": str(loan.monthly_deduction),
            "remaining_amount": str(loan.remaining_amount),
            "total_months": loan.total_months,
            "paid_months": loan.paid_months,
            "remaining_months": loan.remaining_months,
            "interest_rate": str(loan.interest_rate),
            "total_payable": str(loan.total_payable),
            "start_date": loan.start_date.isoformat() if loan.start_date else None,
            "end_date": loan.end_date.isoformat() if loan.end_date else None,
            "status": loan.status,
            "purpose": loan.purpose,
            "transaction_number": loan.transaction_number,
            "approved_at": loan.approved_at.isoformat() if loan.approved_at else None,
            "notes": loan.notes,
            "created_at": loan.created_at.isoformat() if loan.created_at else None,
        }
    
    def get(self, request):
        """Get employee loans"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')
        
        query = EmployeeLoan.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee')
        
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
        """Create employee loan"""
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
        
        monthly_salary = float(employee.salary)
        principal_amount = float(request.data.get('principal_amount', 0))
        interest_rate = float(request.data.get('interest_rate', 0))
        total_months = int(request.data.get('total_months', 0))
        monthly_deduction = float(request.data.get('monthly_deduction', 0))
        
        if monthly_deduction > 0 and monthly_deduction > monthly_salary:
            return Response(
                {'error': f'Monthly deduction ({monthly_deduction}) cannot exceed monthly salary ({monthly_salary})'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if interest_rate > 0:
            total_payable = principal_amount + (principal_amount * interest_rate / 100)
        else:
            total_payable = principal_amount
        
        if total_months > 0 and monthly_deduction > 0:
            calculated_total = monthly_deduction * total_months
            if abs(calculated_total - total_payable) > 0.01:
                return Response(
                    {'error': f'Monthly deduction × Total months does not match total payable'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif total_months > 0 and monthly_deduction == 0:
            monthly_deduction = total_payable / total_months
        elif monthly_deduction > 0 and total_months == 0:
            total_months = int(total_payable / monthly_deduction)
        else:
            return Response(
                {'error': 'Please provide either total_months or monthly_deduction'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        transaction_number = f"LN-{datetime.now().strftime('%Y%m%d')}-{employee.employee_id}"
        
        loan = EmployeeLoan.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            loan_type=request.data.get('loan_type', 'PERSONAL_LOAN'),
            principal_amount=principal_amount,
            monthly_deduction=monthly_deduction,
            remaining_amount=total_payable,
            total_months=total_months,
            paid_months=0,
            interest_rate=interest_rate,
            total_payable=total_payable,
            start_date=request.data.get('start_date', date.today()),
            end_date=request.data.get('end_date'),
            status='PENDING',
            purpose=request.data.get('purpose'),
            notes=request.data.get('notes'),
            transaction_number=transaction_number,
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Loan created successfully",
            "loan": self._serialize_loan(loan)
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update loan using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan_uuid = request.data.get('id')
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
        
        updatable_fields = ['loan_type', 'principal_amount', 'total_months', 'interest_rate', 'start_date', 'end_date', 'purpose', 'notes']
        
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
            
            if loan.total_months > 0:
                loan.monthly_deduction = float(loan.total_payable) / loan.total_months
                loan.remaining_amount = float(loan.total_payable) - (float(loan.monthly_deduction) * loan.paid_months)
        
        loan.updated_by = request.user
        loan.save()
        
        return Response({
            "message": "Loan updated successfully",
            "loan": self._serialize_loan(loan)
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete loan using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan_uuid = request.data.get('id')
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


class LoanStatusUpdateView(CompanyBranchMixin, APIView):
    """Toggle loan status with UUID support"""
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
            loan.paid_months = loan.total_months
        
        loan.updated_by = request.user
        loan.save()
        
        return Response({
            "message": f"Loan status changed from {old_status} to {new_status}",
            "loan": {
                "id": str(loan._id),
                "status": loan.status,
            }
        })


class CompensationView(CompanyBranchMixin, APIView):
    """Employee compensation management with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _serialize_compensation(self, comp):
        return {
            "id": str(comp._id),
            "employee_id": str(comp.employee._id) if comp.employee else None,
            "employee_name": comp.employee.full_name if comp.employee else None,
            "employee_code": comp.employee.employee_id if comp.employee else None,
            "department": comp.employee.department if comp.employee else None,
            "designation": comp.employee.designation if comp.employee else None,
            "basic_salary": str(comp.employee.salary) if comp.employee else "0",
            "grade": comp.grade,
            "house_rent_allowance": str(comp.house_rent_allowance),
            "medical_allowance": str(comp.medical_allowance),
            "transport_allowance": str(comp.transport_allowance),
            "fuel_allowance": str(comp.fuel_allowance),
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
            "is_active": comp.is_active,
            "status": comp.status,
            "effective_date": comp.effective_date.isoformat() if comp.effective_date else None,
            "review_date": comp.review_date.isoformat() if comp.review_date else None,
            "notes": comp.notes,
            "created_at": comp.created_at.isoformat() if comp.created_at else None,
        }
    
    def get(self, request):
        """Get compensations"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.query_params.get('employee_id')
        search = request.query_params.get('search')
        status_filter = request.query_params.get('status')
        
        query = Compensation.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee')
        
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        if status_filter:
            query = query.filter(status=status_filter)
        if search:
            query = query.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(grade__icontains=search)
            )
        
        compensations = query.order_by('-effective_date')
        
        return Response([self._serialize_compensation(c) for c in compensations])
    
    @transaction.atomic
    def post(self, request):
        """Create compensation"""
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
            is_active=True,
            is_deleted=False
        ).first()
        
        if existing_compensation:
            return Response(
                {'error': 'Employee already has an active compensation. Please deactivate it first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        compensation = Compensation.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            employee=employee,
            grade=request.data.get('grade'),
            house_rent_allowance=request.data.get('house_rent_allowance', 0),
            medical_allowance=request.data.get('medical_allowance', 0),
            transport_allowance=request.data.get('transport_allowance', 0),
            fuel_allowance=request.data.get('fuel_allowance', 0),
            phone_allowance=request.data.get('phone_allowance', 0),
            utilities_allowance=request.data.get('utilities_allowance', 0),
            education_allowance=request.data.get('education_allowance', 0),
            other_allowances=request.data.get('other_allowances', 0),
            employer_pf=request.data.get('employer_pf', 0),
            employer_eobi=request.data.get('employer_eobi', 0),
            overtime_rate=request.data.get('overtime_rate', 0),
            bonus_percentage=request.data.get('bonus_percentage', 0),
            status='ACTIVE',
            is_active=True,
            effective_date=request.data.get('effective_date', date.today()),
            review_date=request.data.get('review_date'),
            notes=request.data.get('notes'),
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Compensation created successfully",
            "compensation": self._serialize_compensation(compensation)
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update compensation using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comp_uuid = request.data.get('id')
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
            'grade', 'house_rent_allowance', 'medical_allowance',
            'transport_allowance', 'fuel_allowance', 'phone_allowance',
            'utilities_allowance', 'education_allowance', 'other_allowances',
            'employer_pf', 'employer_eobi', 'overtime_rate', 'bonus_percentage',
            'status', 'is_active', 'effective_date', 'review_date', 'notes'
        ]
        
        for field in updatable_fields:
            if field in request.data:
                setattr(compensation, field, request.data[field])
        
        compensation.updated_by = request.user
        compensation.save()
        
        return Response({
            "message": "Compensation updated successfully",
            "compensation": self._serialize_compensation(compensation)
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete compensation using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        comp_uuid = request.data.get('id')
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
        compensation.is_active = False
        compensation.deleted_at = timezone.now()
        compensation.deleted_by = request.user
        compensation.save()
        
        return Response({'message': 'Compensation deleted successfully'})