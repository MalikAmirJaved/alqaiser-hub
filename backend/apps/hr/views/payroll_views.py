# apps/hr/views/payroll_views.py
from datetime import datetime, date
from django.db import transaction, models
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db.models import Q
import logging
from apps.hr.models import (
    Employee, PayrollRecord, EmployeeLoan, Compensation,
    EmployeeAssetAssignment, AssetCategory, Asset
)

logger = logging.getLogger(__name__)


class PayrollView(APIView):
    """Payroll management - process and view payroll"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get payroll records with optional filters"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Filters
        month = request.query_params.get('month')
        year = request.query_params.get('year')
        employee_id = request.query_params.get('employee_id')
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
        if employee_id:
            query = query.filter(employee_id=employee_id)
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
        
        return Response([
            {
                "id": r.id,
                "employee_id": r.employee_id,
                "employee_name": r.employee.full_name,
                "employee_code": r.employee.employee_id,
                "department": r.employee.department,
                "designation": r.employee.designation,
                "month": r.month,
                "year": r.year,
                "base_salary": str(r.base_salary),
                "bonus": str(r.bonus),
                "deductions": str(r.deductions),
                "deduction_breakdown": r.deduction_breakdown,
                "net_salary": str(r.net_salary),
                "transaction_type": r.transaction_type,
                "transaction_number": r.transaction_number,
                "payment_method": r.payment_method,
                "status": r.status,
                "custom_note": r.custom_note,
                "processed_at": r.processed_at.isoformat() if r.processed_at else None,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in records
        ])
    
    @transaction.atomic
    def post(self, request):
        """Process payroll for an employee with compensation and overtime"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.data.get('employee_id')
        month = request.data.get('month', date.today().month)
        year = request.data.get('year', date.today().year)
        
        if not employee_id:
            return Response(
                {'error': 'employee_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(
            Employee,
            id=employee_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Check if already processed for this month
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
        
        # Get employee base salary from employee table
        base_salary = float(employee.salary)
        
        # Get active compensation
        compensation = Compensation.objects.filter(
            employee=employee,
            is_active=True,
            is_deleted=False
        ).first()
        
        # Calculate compensation allowances
        total_compensation = 0
        if compensation:
            total_compensation = float(compensation.total_allowances)
        
        # Calculate overtime
        overtime_hours = float(request.data.get('overtime_hours', 0))
        overtime_amount = 0
        if compensation and overtime_hours > 0:
            overtime_rate = float(compensation.overtime_rate or 0)
            overtime_amount = overtime_hours * overtime_rate
        
        bonus = float(request.data.get('bonus', 0))
        custom_deductions = float(request.data.get('deductions', 0))
        
        # Process loan deductions - calculate (monthly_deduction + interest)
        loan_deductions = 0
        deduction_breakdown = {
            'custom_deductions': custom_deductions,
            'custom_reason': request.data.get('deduction_reason', ''),
            'loan_deductions': [],
            'compensation_allowances': float(total_compensation),
            'overtime_hours': overtime_hours,
            'overtime_amount': float(overtime_amount),
        }
        
        selected_loan_ids = request.data.get('selected_loans', [])
        if selected_loan_ids:
            active_loans = EmployeeLoan.objects.filter(
                employee=employee,
                id__in=selected_loan_ids,
                status='ACTIVE',
                is_deleted=False
            )
            
            for loan in active_loans:
                # Calculate monthly deduction with interest
                monthly_deduction_with_interest = float(loan.monthly_deduction)
                if float(loan.interest_rate) > 0:
                    interest_amount = (float(loan.remaining_amount) * float(loan.interest_rate) / 100) / loan.remaining_months
                    monthly_deduction_with_interest += interest_amount
                
                loan_deductions += monthly_deduction_with_interest
                deduction_breakdown['loan_deductions'].append({
                    'loan_id': loan.id,
                    'loan_type': loan.loan_type,
                    'principal_deduction': str(loan.monthly_deduction),
                    'interest_amount': str(monthly_deduction_with_interest - float(loan.monthly_deduction)),
                    'total_deduction': str(monthly_deduction_with_interest)
                })
                
                # Update loan repayment
                loan.remaining_amount = max(0, float(loan.remaining_amount) - float(loan.monthly_deduction))
                loan.paid_months += 1
                if loan.remaining_amount <= 0:
                    loan.status = 'PAID'
                    loan.remaining_amount = 0
                loan.save()
        
        total_deductions = custom_deductions + loan_deductions
        
        # Calculate net salary: base salary + total compensation + overtime + bonus - deductions
        net_salary = base_salary + total_compensation + overtime_amount + bonus - total_deductions
        
        # Generate transaction number
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
            processed_at=datetime.now(),
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Payment processed successfully",
            "id": payroll.id,
            "transaction_number": payroll.transaction_number,
            "base_salary": str(payroll.base_salary),
            "compensation": str(total_compensation),
            "overtime": str(overtime_amount),
            "bonus": str(bonus),
            "deductions": str(total_deductions),
            "net_salary": str(payroll.net_salary),
            "status": payroll.status,
        }, status=status.HTTP_201_CREATED)


class PayrollStatsView(APIView):
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
        
        # Current month payroll
        current_payroll = PayrollRecord.objects.filter(
            company_id=company_id,
            month=month,
            year=year,
            is_deleted=False
        )
        
        total_payroll = current_payroll.aggregate(
            total=models.Sum('net_salary')
        )['total'] or 0
        
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


class EmployeeLoanView(APIView):
    """Employee loans management"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get employee loans"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.query_params.get('employee_id')
        status_filter = request.query_params.get('status')
        search = request.query_params.get('search')
        
        query = EmployeeLoan.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee')
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
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
        
        return Response([
            {
                "id": l.id,
                "employee_id": l.employee_id,
                "employee_name": l.employee.full_name,
                "employee_code": l.employee.employee_id,
                "department": l.employee.department,
                "monthly_salary": str(l.employee.salary),  # Include employee salary
                "loan_type": l.loan_type,
                "loan_type_display": l.get_loan_type_display(),
                "principal_amount": str(l.principal_amount),
                "monthly_deduction": str(l.monthly_deduction),
                "remaining_amount": str(l.remaining_amount),
                "total_months": l.total_months,
                "paid_months": l.paid_months,
                "remaining_months": l.remaining_months,
                "interest_rate": str(l.interest_rate),
                "total_payable": str(l.total_payable),
                "start_date": l.start_date.isoformat() if l.start_date else None,
                "end_date": l.end_date.isoformat() if l.end_date else None,
                "status": l.status,
                "purpose": l.purpose,
                "transaction_number": l.transaction_number,
                "approved_at": l.approved_at.isoformat() if l.approved_at else None,
                "notes": l.notes,
                "created_at": l.created_at.isoformat() if l.created_at else None,
            }
            for l in loans
        ])
    
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
        
        employee_id = request.data.get('employee_id')
        if not employee_id:
            return Response(
                {'error': 'employee_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(
            Employee,
            id=employee_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Get employee monthly salary
        monthly_salary = float(employee.salary)
        
        # Calculate loan details
        principal_amount = float(request.data.get('principal_amount', 0))
        interest_rate = float(request.data.get('interest_rate', 0))
        total_months = int(request.data.get('total_months', 0))
        monthly_deduction = float(request.data.get('monthly_deduction', 0))
        
        # Validate monthly deduction doesn't exceed monthly salary
        if monthly_deduction > 0 and monthly_deduction > monthly_salary:
            return Response(
                {'error': f'Monthly deduction ({monthly_deduction}) cannot exceed monthly salary ({monthly_salary})'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Calculate total payable with interest
        if interest_rate > 0:
            total_payable = principal_amount + (principal_amount * interest_rate / 100)
        else:
            total_payable = principal_amount
        
        # Auto-calculate total_months or monthly_deduction
        if total_months > 0 and monthly_deduction > 0:
            # Both provided, validate they match
            calculated_total = monthly_deduction * total_months
            if abs(calculated_total - total_payable) > 0.01:
                return Response(
                    {'error': f'Monthly deduction ({monthly_deduction}) × Total months ({total_months}) = {calculated_total} does not match total payable ({total_payable})'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        elif total_months > 0 and monthly_deduction == 0:
            # Auto-calculate monthly deduction
            monthly_deduction = total_payable / total_months
        elif monthly_deduction > 0 and total_months == 0:
            # Auto-calculate total months
            total_months = int(total_payable / monthly_deduction)
            if total_payable % monthly_deduction > 0.01:
                # Handle remainder in last month
                pass
        else:
            return Response(
                {'error': 'Please provide either total_months or monthly_deduction'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate transaction number
        transaction_number = f"LN-{datetime.now().strftime('%Y%m%d')}-{employee.employee_id}"
        
        # Always set status as PENDING initially
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
            status='PENDING',  # Always start as PENDING
            purpose=request.data.get('purpose'),
            notes=request.data.get('notes'),
            transaction_number=transaction_number,
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Loan created successfully",
            "id": loan.id,
            "loan_type": loan.loan_type,
            "principal_amount": str(loan.principal_amount),
            "monthly_deduction": str(loan.monthly_deduction),
            "total_months": loan.total_months,
            "total_payable": str(loan.total_payable),
            "status": loan.status,
            "transaction_number": loan.transaction_number,
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update loan"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan_id = request.data.get('id')
        if not loan_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan = get_object_or_404(
            EmployeeLoan,
            id=loan_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Don't allow changing status through this endpoint
        updatable_fields = [
            'loan_type', 'principal_amount', 'total_months',
            'interest_rate', 'start_date', 'end_date',
            'purpose', 'notes'
        ]
        
        for field in updatable_fields:
            if field in request.data:
                setattr(loan, field, request.data[field])
        
        # Recalculate if needed
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
            "id": loan.id,
            "monthly_deduction": str(loan.monthly_deduction),
            "total_payable": str(loan.total_payable),
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete loan"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan_id = request.data.get('id')
        if not loan_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan = get_object_or_404(
            EmployeeLoan,
            id=loan_id,
            company_id=company_id,
            is_deleted=False
        )
        
        if loan.status == 'ACTIVE':
            return Response(
                {'error': 'Cannot delete an active loan. Please cancel it first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan.is_deleted = True
        loan.deleted_at = datetime.now()
        loan.deleted_by = request.user
        loan.save()
        
        return Response({'message': 'Loan deleted successfully'})


class LoanStatusUpdateView(APIView):
    """Toggle loan status"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        loan_id = request.data.get('id')
        new_status = request.data.get('status')
        
        if not loan_id or not new_status:
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
            id=loan_id,
            company_id=company_id,
            is_deleted=False
        )
        
        old_status = loan.status
        loan.status = new_status
        
        if new_status == 'ACTIVE':
            loan.approved_by = request.user
            loan.approved_at = datetime.now()
        elif new_status == 'CANCELLED':
            loan.remaining_amount = 0
        elif new_status == 'PAID':
            loan.remaining_amount = 0
            loan.paid_months = loan.total_months
        
        loan.updated_by = request.user
        loan.save()
        
        return Response({
            "message": f"Loan status changed from {old_status} to {new_status}",
            "id": loan.id,
            "status": loan.status,
        })


class CompensationView(APIView):
    """Employee compensation management"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get compensations"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.query_params.get('employee_id')
        search = request.query_params.get('search')
        status_filter = request.query_params.get('status')
        
        query = Compensation.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('employee')
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        if status_filter:
            query = query.filter(status=status_filter)
        if search:
            query = query.filter(
                Q(employee__first_name__icontains=search) |
                Q(employee__last_name__icontains=search) |
                Q(grade__icontains=search)
            )
        
        compensations = query.order_by('-effective_date')
        
        return Response([
            {
                "id": c.id,
                "employee_id": c.employee_id,
                "employee_name": c.employee.full_name,
                "employee_code": c.employee.employee_id,
                "department": c.employee.department,
                "designation": c.employee.designation,
                "basic_salary": str(c.employee.salary),  # Get from employee table
                "grade": c.grade,
                "house_rent_allowance": str(c.house_rent_allowance),
                "medical_allowance": str(c.medical_allowance),
                "transport_allowance": str(c.transport_allowance),
                "fuel_allowance": str(c.fuel_allowance),
                "phone_allowance": str(c.phone_allowance),
                "utilities_allowance": str(c.utilities_allowance),
                "education_allowance": str(c.education_allowance),
                "other_allowances": str(c.other_allowances),
                "employer_pf": str(c.employer_pf),
                "employer_eobi": str(c.employer_eobi),
                "overtime_rate": str(c.overtime_rate),
                "bonus_percentage": str(c.bonus_percentage),
                "total_allowances": str(c.total_allowances),
                "total_ctc": str(c.total_ctc),
                "total_monthly": str(c.total_monthly),
                "is_active": c.is_active,
                "status": c.status,
                "effective_date": c.effective_date.isoformat() if c.effective_date else None,
                "review_date": c.review_date.isoformat() if c.review_date else None,
                "notes": c.notes,
                "created_at": c.created_at.isoformat() if c.created_at else None,
            }
            for c in compensations
        ])
    
    @transaction.atomic
    def post(self, request):
        """Create compensation - don't allow duplicate employees"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.data.get('employee_id')
        if not employee_id:
            return Response(
                {'error': 'employee_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if employee already has active compensation
        existing_compensation = Compensation.objects.filter(
            employee_id=employee_id,
            is_active=True,
            is_deleted=False
        ).first()
        
        if existing_compensation:
            return Response(
                {'error': 'Employee already has an active compensation. Please deactivate it first.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(
            Employee,
            id=employee_id,
            company_id=company_id,
            is_deleted=False
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
            "id": compensation.id,
            "total_monthly": str(compensation.total_monthly),
            "total_ctc": str(compensation.total_ctc),
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update compensation"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        compensation_id = request.data.get('id')
        if not compensation_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        compensation = get_object_or_404(
            Compensation,
            id=compensation_id,
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
            "id": compensation.id,
            "total_monthly": str(compensation.total_monthly),
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete compensation"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        compensation_id = request.data.get('id')
        if not compensation_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        compensation = get_object_or_404(
            Compensation,
            id=compensation_id,
            company_id=company_id,
            is_deleted=False
        )
        
        compensation.is_deleted = True
        compensation.status = 'INACTIVE'
        compensation.is_active = False
        compensation.deleted_at = datetime.now()
        compensation.deleted_by = request.user
        compensation.save()
        
        return Response({'message': 'Compensation deleted successfully'})