# apps/hr/views/leave_views.py
from datetime import date
from django.db.models import Q, Count
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
from django.db import models
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import Employee, LeaveRequest

logger = logging.getLogger(__name__)


class LeaveRequestView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    """CRUD operations for leave requests with UUID support - Simplified"""
    permission_classes = [IsAuthenticated]
    permission_module = 'HR'
    permission_resource = 'leave'
    
    def _serialize_leave(self, leave: LeaveRequest) -> dict:
        """Serialize leave request with UUIDs"""
        approved_by_name = None
        if leave.approved_by:
            approved_by_name = leave.approved_by.get_full_name() or leave.approved_by.email
        
        return {
            "id": str(leave._id),
            "employee_id": str(leave.employee._id) if leave.employee else None,
            "employee_name": leave.employee.full_name,
            "leave_type": leave.leave_type,
            "leave_type_display": leave.get_leave_type_display(),
            "start_date": leave.start_date.isoformat(),
            "end_date": leave.end_date.isoformat(),
            "total_days": float(leave.total_days),
            "is_half_day": leave.is_half_day,
            "reason": leave.reason,
            "emergency_contact": leave.emergency_contact,
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
        
        query = LeaveRequest.objects.filter(
            company_id=company_id, 
            is_deleted=False
        ).select_related('employee', 'approved_by')
        
        # Filter by employee (UUID)
        employee_uuid = request.query_params.get('employee_id')
        if employee_uuid:
            employee = get_object_or_404(
                Employee, 
                _id=employee_uuid, 
                company_id=company_id, 
                is_deleted=False
            )
            query = query.filter(employee=employee)
        
        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            query = query.filter(status=status_filter)
        
        # Filter by leave type
        leave_type_filter = request.query_params.get('leave_type')
        if leave_type_filter:
            query = query.filter(leave_type=leave_type_filter)
        
        # Filter by date range
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if start_date:
            query = query.filter(start_date__gte=start_date)
        if end_date:
            query = query.filter(end_date__lte=end_date)
        
        # Role-based filtering
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            try:
                employee = Employee.objects.get(email=request.user.email, company_id=company_id)
                query = query.filter(employee=employee)
            except Employee.DoesNotExist:
                query = query.filter(created_by=request.user)
        
        query = query.order_by('-applied_at')
        
        return Response([self._serialize_leave(l) for l in query])
    

    def post(self, request):
        """Create a new leave request - no balance validation"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        required_fields = ['employee_id', 'leave_type', 'start_date', 'reason']
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
        
        # Validate date range
        if end_date < start_date:
            return Response(
                {'error': 'End date cannot be before start date'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check for overlapping leave requests (optional - recommended)
        employee = get_object_or_404(
            Employee, 
            _id=request.data['employee_id'], 
            company_id=company_id, 
            is_deleted=False
        )

        # Validate employee joining date: employee must have joined before the leave start date
        if getattr(employee, 'joining_date', None):
            if employee.joining_date >= start_date:
                return Response(
                    {'error': 'Employee must have joined before the leave start date'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        overlapping = LeaveRequest.objects.filter(
            employee=employee,
            status__in=['PENDING', 'APPROVED'],
            is_deleted=False,
            start_date__lte=end_date,
            end_date__gte=start_date
        ).exclude(status='CANCELLED')
        
        if overlapping.exists():
            return Response(
                {'error': 'Employee already has a leave request overlapping with these dates'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create leave request
        leave_request = LeaveRequest.objects.create(
            company_id=company_id,
            branch_id=employee.branch_id or request.user.branch_id,
            employee=employee,
            leave_type=request.data['leave_type'],
            start_date=start_date,
            end_date=end_date,
            is_half_day=request.data.get('is_half_day', False),
            reason=request.data['reason'],
            emergency_contact=request.data.get('emergency_contact', ''),
            status='PENDING',
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Leave request submitted successfully",
            "leave": self._serialize_leave(leave_request)
        }, status=status.HTTP_201_CREATED)
    

    def patch(self, request):
        """Update leave request (only if PENDING)"""
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
        
        if leave_request.status != 'PENDING':
            return Response(
                {'error': f'Cannot update leave request with status: {leave_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Update allowed fields
        updatable_fields = ['reason', 'emergency_contact', 'leave_type', 'is_half_day']
        for field in updatable_fields:
            if field in request.data:
                setattr(leave_request, field, request.data[field])
        
        # Update dates
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
        
        leave_request.updated_by = request.user
        leave_request.save()  # Auto-calculates total_days
        
        return Response({
            "message": "Leave request updated successfully",
            "leave": self._serialize_leave(leave_request)
        })
    

    def delete(self, request):
        """Soft delete leave request (only if PENDING)"""
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
        
        if leave_request.status != 'PENDING':
            return Response(
                {'error': f'Cannot delete leave request with status: {leave_request.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        leave_request.is_deleted = True
        leave_request.deleted_at = timezone.now()
        leave_request.deleted_by = request.user
        leave_request.save()
        
        return Response({'message': 'Leave request deleted successfully'})


class LeaveApprovalView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    """Handle leave request approvals/rejections with UUID support"""
    permission_classes = [IsAuthenticated]
    permission_module = 'HR'
    permission_resource = 'leave'

    def get_permission_action(self):
        action = (self.request.data.get('action') or '').upper()
        if action == 'APPROVED':
            return 'approve'
        if action == 'REJECTED':
            return 'reject'
        return 'approve'


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
        
        return Response({
            "message": f"Leave request {action.lower()} successfully",
            "leave": {
                "id": str(leave_request._id),
                "status": leave_request.status,
                "approved_by_name": request.user.get_full_name() or request.user.email,
                "approval_date": leave_request.approval_date.isoformat(),
                "rejection_reason": rejection_reason
            }
        })


class LeaveStatsView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'leave'
    """Get simple leave statistics for dashboard"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get current employee if not admin
        current_employee = None
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            try:
                current_employee = Employee.objects.get(email=request.user.email, company_id=company_id)
            except Employee.DoesNotExist:
                pass
        
        # My leaves stats
        my_leaves_query = LeaveRequest.objects.filter(
            company_id=company_id,
            is_deleted=False,
        )
        
        if current_employee:
            my_leaves_query = my_leaves_query.filter(employee=current_employee)
        
        my_stats = {
            "total": my_leaves_query.count(),
            "approved": my_leaves_query.filter(status='APPROVED').count(),
            "pending": my_leaves_query.filter(status='PENDING').count(),
            "rejected": my_leaves_query.filter(status='REJECTED').count(),
        }
        
        # Pending approvals count (for admins)
        pending_approvals = 0
        if request.user.role in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            pending_approvals = LeaveRequest.objects.filter(
                company_id=company_id,
                is_deleted=False,
                status='PENDING'
            ).count()
        
        # Fix: Get leave type usage without __display lookup
        leave_type_usage = list(
            LeaveRequest.objects.filter(
                company_id=company_id,
                is_deleted=False,
                status='APPROVED'
            ).values('leave_type').annotate(
                total_days=models.Sum('total_days'),
                request_count=Count('id')
            ).order_by('-total_days')
        )

        # Add display names manually
        leave_type_choices = dict(LeaveRequest.LEAVE_TYPE_CHOICES)
        for item in leave_type_usage:
            item['leave_type_display'] = leave_type_choices.get(item['leave_type'], item['leave_type'])

        
        return Response({
            "my_leaves": my_stats,
            "pending_approvals": pending_approvals,
            "leave_type_usage": leave_type_usage,
        })
