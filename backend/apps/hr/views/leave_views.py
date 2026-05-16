# apps/hr/views/leave_views.py
from datetime import datetime, date
from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Sum, Count, F
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging

from apps.common.baseauthentication import CompanyBranchMixin
from apps.hr.models import Employee, LeaveRequest, LeaveBalance, LeaveBalanceHistory, YearEndCarryForward
from apps.hr.services.leave_calculation import LeaveCalculationService, LeaveBalanceService
from apps.compsetting.models import LeaveType

logger = logging.getLogger(__name__)


class LeaveRequestView(CompanyBranchMixin, APIView):
    """CRUD operations for leave requests with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _serialize_leave(self, leave: LeaveRequest) -> dict:
        approved_by_name = None
        if leave.approved_by:
            approved_by_name = leave.approved_by.get_full_name() or leave.approved_by.email
        
        return {
            "id": str(leave._id),
            "employee_id": str(leave.employee._id) if leave.employee else None,
            "employee_name": leave.employee_name,
            "leave_type_id": str(leave.leave_type._id) if leave.leave_type else None,
            "leave_type_name": leave.leave_type_name,
            "leave_year": leave.leave_year,
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "total_days": float(leave.total_days),
            "is_half_day": leave.is_half_day,
            "reason": leave.reason,
            "contact_number": leave.contact_number,
            "document_url": leave.document_url,
            "status": leave.status,
            "applied_at": leave.applied_at.isoformat() if leave.applied_at else None,
            "approved_by_id": str(leave.approved_by._id) if leave.approved_by else None,
            "approved_by_name": approved_by_name,
            "approval_date": leave.approval_date.isoformat() if leave.approval_date else None,
            "rejection_reason": leave.rejection_reason,
            "created_at": leave.created_at.isoformat() if leave.created_at else None,
            "updated_at": leave.updated_at.isoformat() if leave.updated_at else None,
        }
    
    def get(self, request):
        """Get leave requests with filtering"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = LeaveRequest.objects.filter(company_id=company_id, is_deleted=False).select_related('employee', 'leave_type', 'approved_by')
        
        employee_uuid = request.query_params.get('employee_id')
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        
        status_filter = request.query_params.get('status')
        if status_filter:
            query = query.filter(status=status_filter)
        
        year = request.query_params.get('year')
        if year:
            query = query.filter(leave_year=year)
        
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            query = query.filter(start_date__gte=start_date)
        if end_date:
            query = query.filter(end_date__lte=end_date)
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            try:
                employee = Employee.objects.get(email=request.user.email, company_id=company_id)
                query = query.filter(employee=employee)
            except Employee.DoesNotExist:
                query = query.filter(created_by=request.user)
        
        query = query.order_by('-applied_at')
        
        return Response([self._serialize_leave(l) for l in query])
    
    @transaction.atomic
    def post(self, request):
        """Create a new leave request"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        required_fields = ['employee_id', 'leave_type_id', 'start_date', 'reason']
        for field in required_fields:
            if not request.data.get(field):
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        try:
            start_date = date.fromisoformat(request.data['start_date'])
            end_date = date.fromisoformat(request.data.get('end_date', request.data['start_date']))
        except ValueError:
            return Response(
                {'error': 'Invalid date format. Use YYYY-MM-DD'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        is_half_day = request.data.get('is_half_day', 'false')
        
        employee = get_object_or_404(Employee, _id=request.data['employee_id'], company_id=company_id, is_deleted=False)
        leave_type = get_object_or_404(LeaveType, _id=request.data['leave_type_id'], is_deleted=False)
        
        validation = LeaveCalculationService.validate_leave_request(
            employee_id=employee.id,
            leave_type_id=leave_type.id,
            start_date=start_date,
            end_date=end_date,
            is_half_day=is_half_day == 'true',
            company_id=company_id
        )
        
        if not validation['valid']:
            return Response(
                {'error': validation['error']},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request = LeaveRequest.objects.create(
            company_id=company_id,
            branch_id=employee.branch_id or request.user.branch_id,
            employee=employee,
            employee_name=employee.full_name,
            leave_type=leave_type,
            leave_type_name=leave_type.name,
            leave_year=start_date.year,
            start_date=start_date,
            end_date=end_date,
            total_days=validation['days'],
            is_half_day=is_half_day,
            reason=request.data['reason'],
            contact_number=request.data.get('contact_number', ''),
            document_url=request.data.get('document_url', ''),
            status='PENDING',
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Leave request submitted successfully",
            "leave": self._serialize_leave(leave_request)
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update leave request"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_uuid = request.data.get('id')
        if not leave_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request = get_object_or_404(
            LeaveRequest,
            _id=leave_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        if leave_request.status not in ['DRAFT', 'PENDING']:
            return Response(
                {'error': f'Cannot update leave request with status: {leave_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        updatable_fields = ['reason', 'contact_number', 'document_url']
        for field in updatable_fields:
            if field in request.data:
                setattr(leave_request, field, request.data[field])
        
        if 'start_date' in request.data:
            try:
                leave_request.start_date = date.fromisoformat(request.data['start_date'])
            except ValueError:
                return Response({'error': 'Invalid start_date format'}, status=status.HTTP_400_BAD_REQUEST)
        
        if 'end_date' in request.data:
            try:
                leave_request.end_date = date.fromisoformat(request.data['end_date'])
            except ValueError:
                return Response({'error': 'Invalid end_date format'}, status=status.HTTP_400_BAD_REQUEST)
        
        if 'is_half_day' in request.data:
            leave_request.is_half_day = request.data['is_half_day']
        
        if 'start_date' in request.data or 'end_date' in request.data:
            leave_request.total_days = LeaveCalculationService.calculate_working_days(
                leave_request.start_date, leave_request.end_date, company_id
            )
            if leave_request.is_half_day == 'true' and leave_request.total_days == 1:
                leave_request.total_days = Decimal('0.5')
        
        leave_request.updated_by = request.user
        leave_request.save()
        
        return Response({
            "message": "Leave request updated successfully",
            "leave": self._serialize_leave(leave_request)
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete leave request"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_uuid = request.data.get('id')
        if not leave_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request = get_object_or_404(
            LeaveRequest,
            _id=leave_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        if leave_request.status not in ['DRAFT', 'PENDING']:
            return Response(
                {'error': f'Cannot delete leave request with status: {leave_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request.is_deleted = True
        leave_request.deleted_at = timezone.now()
        leave_request.deleted_by = request.user
        leave_request.save()
        
        return Response({'message': 'Leave request deleted successfully'})


class LeaveApprovalView(CompanyBranchMixin, APIView):
    """Handle leave request approvals/rejections with UUID support"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_uuid = request.data.get('id')
        action = request.data.get('action')
        
        if not leave_uuid or not action:
            return Response(
                {'error': 'id and action are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if action not in ['APPROVED', 'REJECTED']:
            return Response(
                {'error': 'action must be APPROVED or REJECTED'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request = get_object_or_404(
            LeaveRequest,
            _id=leave_uuid,
            company_id=company_id,
            is_deleted=False,
            status='PENDING'
        )
        
        rejection_reason = request.data.get('rejection_reason') if action == 'REJECTED' else None
        
        leave_request.status = action
        leave_request.approved_by = request.user
        leave_request.approval_date = timezone.now()
        leave_request.rejection_reason = rejection_reason
        leave_request.updated_by = request.user
        leave_request.save()
        
        if action == 'APPROVED':
            LeaveBalanceService.update_balance_on_approval(leave_request, request.user)
        else:
            balance, _ = LeaveBalance.objects.get_or_create(
                company_id=company_id,
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                year=leave_request.start_date.year,
                defaults={
                    'branch_id': leave_request.branch_id,
                    'employee_name': leave_request.employee_name,
                    'leave_type_name': leave_request.leave_type_name,
                    'allocated': 0,
                    'used': 0,
                    'available': 0,
                    'carry_forward_from': 0,
                    'created_by': request.user,
                    'updated_by': request.user,
                }
            )
            
            LeaveBalanceHistory.objects.create(
                company_id=company_id,
                balance=balance,
                employee=leave_request.employee,
                leave_type=leave_request.leave_type,
                action='LEAVE_CANCELLED',
                previous_used=balance.used,
                new_used=balance.used,
                delta=0,
                previous_available=balance.available,
                new_available=balance.available,
                leave_request=leave_request,
                performed_by=request.user,
                notes=f"Leave rejected: {rejection_reason or 'No reason provided'}"
            )
        
        return Response({
            "message": f"Leave request {action.lower()} successfully",
            "leave": {
                "id": str(leave_request._id),
                "status": leave_request.status,
                "approved_by": request.user.email,
                "approval_date": leave_request.approval_date.isoformat(),
                "rejection_reason": rejection_reason
            }
        })


class LeaveBalanceView(CompanyBranchMixin, APIView):
    """View and manage leave balances with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = LeaveBalance.objects.filter(company_id=company_id, is_deleted=False).select_related('employee', 'leave_type')
        
        employee_uuid = request.query_params.get('employee_id')
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        
        leave_type_uuid = request.query_params.get('leave_type_id')
        if leave_type_uuid:
            leave_type = get_object_or_404(LeaveType, _id=leave_type_uuid, is_deleted=False)
            query = query.filter(leave_type=leave_type)
        
        year = request.query_params.get('year', date.today().year)
        query = query.filter(year=year)
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            try:
                employee = Employee.objects.get(email=request.user.email, company_id=company_id)
                query = query.filter(employee=employee)
            except Employee.DoesNotExist:
                pass
        
        balances = query.order_by('employee__first_name', 'leave_type__order')
        
        return Response([
            {
                "id": str(b._id),
                "employee_id": str(b.employee._id) if b.employee else None,
                "employee_name": b.employee_name,
                "leave_type_id": str(b.leave_type._id) if b.leave_type else None,
                "leave_type_name": b.leave_type_name,
                "year": b.year,
                "allocated": float(b.allocated),
                "used": float(b.used),
                "available": float(b.available),
                "carry_forward_from": float(b.carry_forward_from),
            }
            for b in balances
        ])
    
    @transaction.atomic
    def post(self, request):
        """Create or update leave balance (admin only) using UUIDs"""
        company_id = request.user.company_id
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            return Response(
                {'error': 'Only company admins can modify leave balances'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        employee_uuid = request.data.get('employee_id')
        leave_type_uuid = request.data.get('leave_type_id')
        year = request.data.get('year', date.today().year)
        
        if not employee_uuid or not leave_type_uuid:
            return Response(
                {'error': 'employee_id and leave_type_id are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        leave_type = get_object_or_404(LeaveType, _id=leave_type_uuid, is_deleted=False)
        
        balance, created = LeaveBalance.objects.update_or_create(
            company_id=company_id,
            employee=employee,
            leave_type=leave_type,
            year=year,
            defaults={
                'branch_id': employee.branch_id,
                'employee_name': employee.full_name,
                'leave_type_name': leave_type.name,
                'allocated': request.data.get('allocated', leave_type.default_days_per_year),
                'used': request.data.get('used', 0),
                'carry_forward_from': request.data.get('carry_forward_from', 0),
                'updated_by': request.user,
            }
        )
        
        balance.available = balance.allocated - balance.used + balance.carry_forward_from
        balance.save()
        
        LeaveBalanceHistory.objects.create(
            company_id=company_id,
            balance=balance,
            employee=employee,
            leave_type=leave_type,
            action='MANUAL_ADJUSTMENT',
            previous_used=0 if created else balance.used,
            new_used=balance.used,
            delta=balance.used,
            previous_available=0 if created else balance.available,
            new_available=balance.available,
            performed_by=request.user,
            notes=request.data.get('notes', 'Manual balance adjustment')
        )
        
        return Response({
            "message": "Leave balance saved successfully",
            "balance": {
                "id": str(balance._id),
                "allocated": float(balance.allocated),
                "used": float(balance.used),
                "available": float(balance.available),
                "carry_forward_from": float(balance.carry_forward_from),
            }
        })


class LeaveStatsView(CompanyBranchMixin, APIView):
    """Get leave statistics for dashboard"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        year = request.query_params.get('year', date.today().year)
        
        current_employee = None
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            try:
                current_employee = Employee.objects.get(email=request.user.email, company_id=company_id)
            except Employee.DoesNotExist:
                pass
        
        my_leaves_query = LeaveRequest.objects.filter(
            company_id=company_id,
            is_deleted=False,
            leave_year=year
        )
        
        if current_employee:
            my_leaves_query = my_leaves_query.filter(employee=current_employee)
        elif request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            my_leaves_query = my_leaves_query.filter(created_by=request.user)
        
        my_stats = {
            "total": my_leaves_query.count(),
            "approved": my_leaves_query.filter(status='APPROVED').count(),
            "pending": my_leaves_query.filter(status='PENDING').count(),
            "rejected": my_leaves_query.filter(status='REJECTED').count(),
        }
        
        pending_approvals = 0
        if request.user.role in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            pending_approvals = LeaveRequest.objects.filter(
                company_id=company_id,
                is_deleted=False,
                status='PENDING'
            ).count()
        
        leave_type_usage = list(
            LeaveRequest.objects.filter(
                company_id=company_id,
                is_deleted=False,
                status='APPROVED',
                leave_year=year
            ).values('leave_type_name').annotate(
                total_days=Sum('total_days'),
                request_count=Count('id')
            ).order_by('-total_days')
        )
        
        monthly_trends = list(
            LeaveRequest.objects.filter(
                company_id=company_id,
                is_deleted=False,
                status='APPROVED',
                leave_year=year
            ).extra(
                {'month': "EXTRACT(MONTH FROM start_date)"}
            ).values('month').annotate(
                total_days=Sum('total_days'),
                request_count=Count('id')
            ).order_by('month')
        )
        
        return Response({
            "my_leaves": my_stats,
            "pending_approvals": pending_approvals,
            "leave_type_usage": leave_type_usage,
            "monthly_trends": monthly_trends,
        })


class LeaveHistoryView(CompanyBranchMixin, APIView):
    """Get leave balance history/audit trail with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.query_params.get('employee_id')
        if not employee_uuid:
            return Response(
                {'error': 'employee_id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            current_employee = Employee.objects.filter(email=request.user.email, company_id=company_id).first()
            if not current_employee or current_employee.id != employee.id:
                return Response(
                    {'error': 'You can only view your own history'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        history = LeaveBalanceHistory.objects.filter(
            company_id=company_id,
            employee=employee,
            is_deleted=False
        ).select_related('leave_type', 'performed_by', 'leave_request').order_by('-created_at')
        
        return Response([
            {
                "id": str(h._id),
                "action": h.action,
                "leave_type_name": h.leave_type.name if h.leave_type else None,
                "previous_used": float(h.previous_used),
                "new_used": float(h.new_used),
                "delta": float(h.delta),
                "previous_available": float(h.previous_available),
                "new_available": float(h.new_available),
                "notes": h.notes,
                "performed_by": h.performed_by.email if h.performed_by else None,
                "performed_at": h.created_at.isoformat(),
                "leave_request_id": str(h.leave_request._id) if h.leave_request else None,
            }
            for h in history
        ])


class YearEndCarryForwardView(CompanyBranchMixin, APIView):
    """Process year-end leave carry forward with UUID support"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            return Response(
                {'error': 'Only company admins can process year-end carry forward'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        from_year = request.data.get('from_year', date.today().year - 1)
        
        result = LeaveBalanceService.process_year_end_carry_forward(company_id, from_year, request.user)
        
        if result['success']:
            return Response({
                "message": "Year-end carry forward processed successfully",
                "processed_employees": result['processed'],
                "updated_balances": result['updated'],
                "total_days_carried": result['total_carried']
            })
        else:
            return Response(
                {'error': result.get('error', 'Processing failed')},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
    
    def get(self, request):
        """Get carry forward process history"""
        company_id = request.user.company_id
        
        processes = YearEndCarryForward.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).order_by('-created_at')[:10]
        
        return Response([
            {
                "id": str(p._id),
                "from_year": p.from_year,
                "to_year": p.to_year,
                "processed_at": p.processed_at.isoformat(),
                "completed_at": p.completed_at.isoformat() if p.completed_at else None,
                "status": p.status,
                "total_employees_processed": p.total_employees_processed,
                "total_balances_updated": p.total_balances_updated,
                "total_days_carried": float(p.total_days_carried),
                "error_log": p.error_log,
            }
            for p in processes
        ])