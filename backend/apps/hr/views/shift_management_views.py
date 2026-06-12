# apps/hr/views/shift_management_views.py
from datetime import date, datetime, timedelta
from typing import List, Dict
from django.db import transaction
from django.db.models import Q, Count, F, Prefetch
from django.core.cache import cache
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import JSONParser
import logging

from apps.hr.models import (
    Employee, ShiftTemplate, ShiftOverride, 
    ShiftDateRangeAssignment, ShiftChangeHistory,
    EmployeeDefaultShift, EmployeeShiftSchedule
)
from apps.hr.serializers.shift_serializers import (
    ShiftOverrideSerializer, ShiftDateRangeSerializer,
    ShiftChangeHistorySerializer, BulkShiftAssignmentSerializer,
    ResolvedShiftResponseSerializer, EmployeeDefaultShiftSerializer
)
from apps.hr.services.shift_service import ShiftResolutionService

logger = logging.getLogger(__name__)


class EmployeeShiftResolveView(APIView):
    """Resolve shifts for employees on specific dates"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get resolved shifts for employees"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get query parameters
        employee_ids = request.query_params.getlist('employee_ids')
        date_param = request.query_params.get('date')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        # Validate employees belong to company
        if employee_ids:
            employees = Employee.objects.filter(
                id__in=employee_ids,
                company_id=company_id,
                is_deleted=False
            )
            if employees.count() != len(employee_ids):
                return Response(
                    {'error': 'Some employees not found in your company'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            employee_id_list = [e.id for e in employees]
        else:
            # Get all employees in company
            employees = Employee.objects.filter(
                company_id=company_id,
                is_deleted=False
            )
            employee_id_list = list(employees.values_list('id', flat=True))
        
        # Single date resolution
        if date_param:
            date_obj = datetime.strptime(date_param, '%Y-%m-%d').date()
            results = []
            
            for emp in employees:
                resolved = ShiftResolutionService.get_resolved_shift(emp.id, date_obj)
                results.append({
                    'employee_id': emp.id,
                    'employee_name': emp.full_name,
                    'employee_department': emp.department,
                    'template_id': resolved.get('template_id'),
                    'template_name': resolved.get('template_name'),
                    'start_time': resolved.get('start_time'),
                    'end_time': resolved.get('end_time'),
                    'break_minutes': resolved.get('break_minutes', 0),
                    'is_override': resolved.get('is_override', False),
                    'source_type': resolved.get('source_type', 'NONE')
                })
            
            return Response(results)
        
        # Date range resolution
        if start_date and end_date:
            start = datetime.strptime(start_date, '%Y-%m-%d').date()
            end = datetime.strptime(end_date, '%Y-%m-%d').date()
            
            if end < start:
                return Response(
                    {'error': 'End date cannot be before start date'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            results = ShiftResolutionService.get_resolved_shifts_batch(
                employee_id_list, start, end
            )
            
            # Format response
            formatted_results = {}
            for emp_id, shifts in results.items():
                employee = next(e for e in employees if e.id == emp_id)
                formatted_results[emp_id] = {
                    'employee_name': employee.full_name,
                    'employee_department': employee.department,
                    'shifts': {}
                }
                for date_str, shift_data in shifts.items():
                    template = shift_data.get('template')
                    formatted_results[emp_id]['shifts'][date_str] = {
                        'template_id': template.id if template else None,
                        'template_name': template.name if template else None,
                        'start_time': template.start_time.strftime('%H:%M') if template else None,
                        'end_time': template.end_time.strftime('%H:%M') if template else None,
                        'break_minutes': template.break_minutes if template else 0,
                        'is_override': shift_data.get('is_override', False),
                        'source_type': shift_data.get('source_type', 'NONE')
                    }
            
            return Response(formatted_results)
        
        return Response(
            {'error': 'Please provide either date or start_date/end_date'},
            status=status.HTTP_400_BAD_REQUEST
        )


class ShiftOverrideView(APIView):
    """CRUD for shift overrides"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get shift overrides"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.query_params.get('employee_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        query = ShiftOverride.objects.filter(
            company_id=company_id
        ).select_related('employee', 'shift_template')
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        
        if start_date:
            query = query.filter(date__gte=start_date)
        
        if end_date:
            query = query.filter(date__lte=end_date)
        
        serializer = ShiftOverrideSerializer(query.order_by('-date'), many=True)
        return Response(serializer.data)
    
    def post(self, request):
        """Create shift override"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.data.get('employee_id')
        template_id = request.data.get('template_id')
        date_str = request.data.get('date')
        
        if not all([employee_id, template_id, date_str]):
            return Response(
                {'error': 'employee_id, template_id, and date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify employee belongs to company
        try:
            employee = Employee.objects.get(id=employee_id, company_id=company_id)
        except Employee.DoesNotExist:
            return Response(
                {'error': 'Employee not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify template exists and belongs to company
        try:
            template = ShiftTemplate.objects.get(id=template_id, company_id=company_id)
        except ShiftTemplate.DoesNotExist:
            return Response(
                {'error': 'Shift template not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        try:
            override = ShiftResolutionService.create_override(
                employee_id=employee_id,
                template_id=template_id,
                date_obj=date_obj,
                reason=request.data.get('reason', ''),
                user=request.user
            )
            
            serializer = ShiftOverrideSerializer(override)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating override: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def delete(self, request):
        """Delete shift override"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        override_id = request.data.get('id')
        
        if not override_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            override = ShiftOverride.objects.get(
                id=override_id,
                employee__company_id=company_id
            )
            
            success = ShiftResolutionService.delete_override(
                employee_id=override.employee_id,
                date_obj=override.date,
                user=request.user
            )
            
            if success:
                return Response({'message': 'Override deleted successfully'})
            else:
                return Response(
                    {'error': 'Failed to delete override'},
                    status=status.HTTP_400_BAD_REQUEST
                )
                
        except ShiftOverride.DoesNotExist:
            return Response(
                {'error': 'Override not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class ShiftDateRangeView(APIView):
    """CRUD for date range assignments"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get date range assignments"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.query_params.get('employee_id')
        active_only = request.query_params.get('active_only', 'true').lower() == 'true'
        
        query = ShiftDateRangeAssignment.objects.filter(
            company_id=company_id
        ).select_related('employee', 'shift_template')
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        
        if active_only:
            query = query.filter(is_active=True, end_date__gte=date.today())
        
        serializer = ShiftDateRangeSerializer(query.order_by('-start_date'), many=True)
        return Response(serializer.data)
    
    def post(self, request):
        """Create date range assignment"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.data.get('employee_id')
        template_id = request.data.get('template_id')
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        
        if not all([employee_id, template_id, start_date_str]):
            return Response(
                {'error': 'employee_id, template_id, and start_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify employee belongs to company
        try:
            employee = Employee.objects.get(id=employee_id, company_id=company_id)
        except Employee.DoesNotExist:
            return Response(
                {'error': 'Employee not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Verify template exists
        try:
            template = ShiftTemplate.objects.get(id=template_id, company_id=company_id)
        except ShiftTemplate.DoesNotExist:
            return Response(
                {'error': 'Shift template not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else start_date
        
        try:
            assignment = ShiftResolutionService.create_date_range_assignment(
                employee_id=employee_id,
                template_id=template_id,
                start_date=start_date,
                end_date=end_date,
                reason=request.data.get('reason', ''),
                user=request.user
            )
            
            serializer = ShiftDateRangeSerializer(assignment)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating date range assignment: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    
    def patch(self, request):
        """Update date range assignment"""
        company_id = request.user.company_id
        
        assignment_id = request.data.get('id')
        if not assignment_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assignment = ShiftDateRangeAssignment.objects.get(
                id=assignment_id,
                company_id=company_id
            )
            
            if 'is_active' in request.data:
                assignment.is_active = request.data['is_active']
            
            if 'reason' in request.data:
                assignment.reason = request.data['reason']
            
            assignment.save()
            
            serializer = ShiftDateRangeSerializer(assignment)
            return Response(serializer.data)
            
        except ShiftDateRangeAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    
    def delete(self, request):
        """Delete date range assignment"""
        company_id = request.user.company_id
        
        assignment_id = request.data.get('id')
        if not assignment_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assignment = ShiftDateRangeAssignment.objects.get(
                id=assignment_id,
                company_id=company_id
            )
            
            assignment.delete()
            
            return Response({'message': 'Assignment deleted successfully'})
            
        except ShiftDateRangeAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class BulkShiftAssignmentView(APIView):
    """Bulk shift assignment for multiple employees"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = BulkShiftAssignmentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        data = serializer.validated_data
        employee_ids = data['employee_ids']
        template_id = data['template_id']
        start_date = data['start_date']
        end_date = data.get('end_date', start_date)
        assignment_type = data['assignment_type']
        reason = data.get('reason', '')
        
        # Verify all employees belong to company
        employees = Employee.objects.filter(
            id__in=employee_ids,
            company_id=company_id
        )
        
        if employees.count() != len(employee_ids):
            return Response(
                {'error': 'Some employees not found in your company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Verify template exists
        try:
            template = ShiftTemplate.objects.get(id=template_id, company_id=company_id)
        except ShiftTemplate.DoesNotExist:
            return Response(
                {'error': 'Shift template not found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        results = {
            'success': [],
            'failed': [],
            'total': len(employee_ids)
        }
        
        for employee in employees:
            try:
                if assignment_type == 'OVERRIDE':
                    # Create override for each date in range
                    current_date = start_date
                    while current_date <= end_date:
                        ShiftResolutionService.create_override(
                            employee_id=employee.id,
                            template_id=template_id,
                            date_obj=current_date,
                            reason=reason,
                            user=request.user
                        )
                        current_date += timedelta(days=1)
                    
                    results['success'].append({
                        'employee_id': employee.id,
                        'employee_name': employee.full_name,
                        'type': 'override',
                        'dates': f"{start_date} to {end_date}"
                    })
                    
                else:  # DATE_RANGE
                    ShiftResolutionService.create_date_range_assignment(
                        employee_id=employee.id,
                        template_id=template_id,
                        start_date=start_date,
                        end_date=end_date,
                        reason=reason,
                        user=request.user
                    )
                    
                    results['success'].append({
                        'employee_id': employee.id,
                        'employee_name': employee.full_name,
                        'type': 'date_range',
                        'dates': f"{start_date} to {end_date}"
                    })
                    
            except Exception as e:
                logger.error(f"Error assigning shift to employee {employee.id}: {str(e)}")
                results['failed'].append({
                    'employee_id': employee.id,
                    'employee_name': employee.full_name,
                    'error': str(e)
                })
        
        return Response(results, status=status.HTTP_200_OK)


class ShiftHistoryView(APIView):
    """Get shift change history"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_id = request.query_params.get('employee_id')
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        change_type = request.query_params.get('change_type')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        query = ShiftChangeHistory.objects.filter(company_id=company_id)
        
        if employee_id:
            query = query.filter(employee_id=employee_id)
        
        if change_type:
            query = query.filter(change_type=change_type)
        
        if start_date:
            query = query.filter(changed_at__date__gte=start_date)
        
        if end_date:
            query = query.filter(changed_at__date__lte=end_date)
        
        total = query.count()
        history = query.order_by('-changed_at')[offset:offset + limit]
        
        serializer = ShiftChangeHistorySerializer(history, many=True)
        
        return Response({
            'data': serializer.data,
            'pagination': {
                'total': total,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total
            }
        })


class ShiftStatisticsView(APIView):
    """Get shift statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        date_param = request.query_params.get('date', date.today().isoformat())
        date_obj = datetime.strptime(date_param, '%Y-%m-%d').date()
        
        employees = Employee.objects.filter(company_id=company_id, is_deleted=False)
        
        # Get shift distribution for the date
        shift_distribution = {}
        employees_without_shift = 0
        
        for employee in employees:
            resolved = ShiftResolutionService.get_resolved_shift(employee.id, date_obj)
            template_id = resolved.get('template_id')
            
            if template_id:
                shift_distribution[template_id] = shift_distribution.get(template_id, 0) + 1
            else:
                employees_without_shift += 1
        
        # Get shift template usage statistics
        template_stats = []
        templates = ShiftTemplate.objects.filter(company_id=company_id, is_deleted=False)
        
        for template in templates:
            # Count active overrides using this template
            overrides_count = ShiftOverride.objects.filter(
                shift_template_id=template.id,
                date__gte=date_obj
            ).count()
            
            # Count active date range assignments
            date_range_count = ShiftDateRangeAssignment.objects.filter(
                shift_template_id=template.id,
                is_active=True,
                end_date__gte=date_obj
            ).count()
            
            # Count employees with this as default
            default_count = EmployeeDefaultShift.objects.filter(
                template_id=template.id,
                effective_from__lte=date_obj
            ).filter(
                Q(effective_to__isnull=True) | Q(effective_to__gte=date_obj)
            ).count()
            
            template_stats.append({
                'template_id': template.id,
                'template_name': template.name,
                'is_active': template.is_active,
                'overrides_count': overrides_count,
                'date_range_count': date_range_count,
                'default_count': default_count,
                'total_usage': overrides_count + date_range_count + default_count
            })
        
        # Get recent activity
        recent_activity = ShiftChangeHistory.objects.filter(
            company_id=company_id,
            changed_at__date__gte=date_obj - timedelta(days=30)
        ).values('change_type').annotate(count=Count('id'))
        
        return Response({
            'date': date_param,
            'total_employees': employees.count(),
            'employees_with_shift': employees.count() - employees_without_shift,
            'employees_without_shift': employees_without_shift,
            'shift_distribution': shift_distribution,
            'template_statistics': template_stats,
            'recent_activity': recent_activity,
            'overrides_today': ShiftOverride.objects.filter(
                company_id=company_id,
                date=date_obj
            ).count(),
        })


class ShiftScheduleGenerateView(APIView):
    """Generate and cache shift schedules for performance"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        """Pre-compute shift schedules for a date range"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        start_date = request.data.get('start_date')
        end_date = request.data.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {'error': 'start_date and end_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        if (end - start).days > 90:
            return Response(
                {'error': 'Date range cannot exceed 90 days'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employees = Employee.objects.filter(company_id=company_id, is_deleted=False)
        
        # Delete existing schedules for this date range
        EmployeeShiftSchedule.objects.filter(
            company_id=company_id,
            date__gte=start,
            date__lte=end
        ).delete()
        
        schedules_created = 0
        
        # Generate schedules
        for employee in employees:
            current = start
            while current <= end:
                resolved = ShiftResolutionService.get_resolved_shift(employee.id, current)
                
                if resolved.get('template_id'):
                    template = ShiftTemplate.objects.get(id=resolved['template_id'])
                    
                    EmployeeShiftSchedule.objects.create(
                        company_id=company_id,
                        employee=employee,
                        shift_template=template,
                        date=current,
                        source_type=resolved.get('source_type', 'DEFAULT'),
                        shift_name=template.name,
                        start_time=template.start_time,
                        end_time=template.end_time,
                        break_minutes=template.break_minutes,
                        working_hours=template.working_hours
                    )
                    schedules_created += 1
                
                current += timedelta(days=1)
        
        return Response({
            'message': f'Generated {schedules_created} shift schedules',
            'employees_processed': employees.count(),
            'date_range': f'{start_date} to {end_date}'
        })