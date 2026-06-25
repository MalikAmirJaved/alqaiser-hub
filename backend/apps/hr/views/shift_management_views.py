# apps/hr/views/shift_management_views.py
from datetime import date, datetime, timedelta
from django.db.models import Q, Count, Prefetch
from django.core.cache import cache
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from collections import defaultdict
import logging

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.models import (
    Employee, ShiftTemplate, ShiftOverride, 
    ShiftDateRangeAssignment, ShiftChangeHistory,
    EmployeeDefaultShift, EmployeeShiftSchedule
)
from apps.hr.serializers.shift_serializers import (
    ShiftOverrideSerializer, ShiftDateRangeSerializer,
    ShiftChangeHistorySerializer, BulkShiftAssignmentSerializer,
    EmployeeDefaultShiftSerializer
)
from apps.hr.services.shift_service import ShiftResolutionService

logger = logging.getLogger(__name__)


class EmployeeShiftResolveView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """Resolve shifts for employees on specific dates with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuids = request.query_params.getlist('employee_ids')
        date_param = request.query_params.get('date')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if employee_uuids:
            employees = Employee.objects.filter(
                _id__in=employee_uuids,
                company_id=company_id,
                is_deleted=False
            )
            if employees.count() != len(employee_uuids):
                return Response(
                    {'error': 'Some employees not found in your company'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            employee_id_list = [e.id for e in employees]
        else:
            employees = Employee.objects.filter(
                company_id=company_id,
                is_deleted=False
            )
            employee_id_list = list(employees.values_list('id', flat=True))
        
        if date_param:
            date_obj = datetime.strptime(date_param, '%Y-%m-%d').date()
            results = []
            
            for emp in employees:
                resolved = ShiftResolutionService.get_resolved_shift(emp.id, date_obj)
                results.append({
                    'employee_id': str(emp._id),
                    'employee_name': emp.full_name,
                    'employee_department': str(emp.department),
                    'template_id': str(resolved.get('template_id')) if resolved.get('template_id') else None,
                    'template_name': resolved.get('template_name'),
                    'start_time': resolved.get('start_time'),
                    'end_time': resolved.get('end_time'),
                    'break_minutes': resolved.get('break_minutes', 0),
                    'is_override': resolved.get('is_override', False),
                    'source_type': resolved.get('source_type', 'NONE')
                })
            
            return Response(results)
        
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
            
            formatted_results = {}
            for emp_id, shifts in results.items():
                employee = next((e for e in employees if e.id == emp_id), None)
                if employee:
                    formatted_results[str(employee._id)] = {
                        'employee_name': employee.full_name,
                        'employee_department': str(employee.department),
                        'shifts': {}
                    }
                    for date_str, shift_data in shifts.items():
                        template = shift_data.get('template')
                        formatted_results[str(employee._id)]['shifts'][date_str] = {
                            'template_id': str(template._id) if template else None,
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


class ShiftOverrideView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """CRUD for shift overrides with UUID support"""
    permission_classes = [IsAuthenticated]
    def get_permission_action(self):
        # POST (create) and DELETE use 'schedule' instead of default 'create'/'delete'
        if self.request.method in ['POST', 'DELETE']:
            return 'schedule'
        return super().get_permission_action()   # GET → 'view'

    def get(self, request):
        
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.query_params.get('employee_id')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        query = ShiftOverride.objects.filter(
            company_id=company_id
        ).select_related('employee', 'shift_template')
        
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        
        if start_date:
            query = query.filter(date__gte=start_date)
        
        if end_date:
            query = query.filter(date__lte=end_date)
        
        overrides = query.order_by('-date')
        
        return Response([
            {
                "id": str(o._id),
                "employee_id": str(o.employee._id),
                "employee_name": o.employee.full_name,
                "template_id": str(o.shift_template._id),
                "template_name": o.shift_template.name,
                "date": o.date.isoformat(),
                "reason": o.reason,
                "notes": o.notes,
            }
            for o in overrides
        ])
    

    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.data.get('employee_id')
        template_uuid = request.data.get('template_id')
        date_str = request.data.get('date')
        
        if not all([employee_uuid, template_uuid, date_str]):
            return Response(
                {'error': 'employee_id, template_id, and date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        template = get_object_or_404(ShiftTemplate, _id=template_uuid, company_id=company_id, is_deleted=False)
        date_obj = datetime.strptime(date_str, '%Y-%m-%d').date()
        
        try:
            override = ShiftResolutionService.create_override(
                employee_id=employee.id,
                template_id=template.id,
                date_obj=date_obj,
                reason=request.data.get('reason', ''),
                user=request.user
            )
            
            return Response({
                "id": str(override._id),
                "employee_id": str(override.employee._id),
                "template_id": str(override.shift_template._id),
                "date": override.date.isoformat(),
                "reason": override.reason,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating override: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    

    def delete(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        override_uuid = request.data.get('id')
        if not override_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            override = get_object_or_404(
                ShiftOverride,
                _id=override_uuid,
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


class ShiftDateRangeView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """CRUD for date range assignments with UUID support"""
    permission_classes = [IsAuthenticated]
    def get_permission_action(self):
        if self.request.method in ['POST', 'PATCH', 'DELETE']:
            return 'schedule'
        return super().get_permission_action()

    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.query_params.get('employee_id')
        active_only = request.query_params.get('active_only', 'true').lower() == 'true'
        
        query = ShiftDateRangeAssignment.objects.filter(
            company_id=company_id
        ).select_related('employee', 'shift_template')
        
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        
        if active_only:
            query = query.filter(is_active=True, end_date__gte=date.today())
        
        assignments = query.order_by('-start_date')
        
        return Response([
            {
                "id": str(a._id),
                "employee_id": str(a.employee._id),
                "employee_name": a.employee.full_name,
                "template_id": str(a.shift_template._id),
                "template_name": a.shift_template.name,
                "start_date": a.start_date.isoformat(),
                "end_date": a.end_date.isoformat(),
                "reason": a.reason,
                "notes": a.notes,
                "is_active": a.is_active,
            }
            for a in assignments
        ])
    

    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.data.get('employee_id')
        template_uuid = request.data.get('template_id')
        start_date_str = request.data.get('start_date')
        end_date_str = request.data.get('end_date')
        
        if not all([employee_uuid, template_uuid, start_date_str]):
            return Response(
                {'error': 'employee_id, template_id, and start_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        template = get_object_or_404(ShiftTemplate, _id=template_uuid, company_id=company_id, is_deleted=False)
        start_date = datetime.strptime(start_date_str, '%Y-%m-%d').date()
        end_date = datetime.strptime(end_date_str, '%Y-%m-%d').date() if end_date_str else start_date
        
        try:
            assignment = ShiftResolutionService.create_date_range_assignment(
                employee_id=employee.id,
                template_id=template.id,
                start_date=start_date,
                end_date=end_date,
                reason=request.data.get('reason', ''),
                user=request.user
            )
            
            return Response({
                "id": str(assignment._id),
                "employee_id": str(assignment.employee._id),
                "template_id": str(assignment.shift_template._id),
                "start_date": assignment.start_date.isoformat(),
                "end_date": assignment.end_date.isoformat(),
                "reason": assignment.reason,
                "is_active": assignment.is_active,
            }, status=status.HTTP_201_CREATED)
            
        except Exception as e:
            logger.error(f"Error creating date range assignment: {str(e)}")
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
    

    def patch(self, request):
        company_id = request.user.company_id
        
        assignment_uuid = request.data.get('id')
        if not assignment_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assignment = get_object_or_404(
                ShiftDateRangeAssignment,
                _id=assignment_uuid,
                company_id=company_id
            )
            
            if 'is_active' in request.data:
                assignment.is_active = request.data['is_active']
            
            if 'reason' in request.data:
                assignment.reason = request.data['reason']
            
            assignment.save()
            
            return Response({
                "id": str(assignment._id),
                "is_active": assignment.is_active,
                "reason": assignment.reason,
            })
            
        except ShiftDateRangeAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )
    

    def delete(self, request):
        company_id = request.user.company_id
        
        assignment_uuid = request.data.get('id')
        if not assignment_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            assignment = get_object_or_404(
                ShiftDateRangeAssignment,
                _id=assignment_uuid,
                company_id=company_id
            )
            
            assignment.is_deleted = True
            assignment.deleted_by = request.user
            assignment.save(update_fields=["is_deleted", "deleted_by"])
            
            return Response({'message': 'Assignment deleted successfully'})
            
        except ShiftDateRangeAssignment.DoesNotExist:
            return Response(
                {'error': 'Assignment not found'},
                status=status.HTTP_404_NOT_FOUND
            )


class BulkShiftAssignmentView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    permission_classes = [IsAuthenticated]

    def get_permission_action(self):
        # All write operations should use 'schedule'
        if self.request.method == 'POST':
            return 'schedule'
        return super().get_permission_action()

    """Bulk shift assignment for multiple employees with UUID support"""
    permission_classes = [IsAuthenticated]
    

    def post(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        data = request.data
        employee_uuids = data.get('employee_ids', [])
        template_uuid = data.get('template_id')
        start_date = datetime.strptime(data.get('start_date'), '%Y-%m-%d').date() if data.get('start_date') else None
        end_date = datetime.strptime(data.get('end_date'), '%Y-%m-%d').date() if data.get('end_date') else start_date
        assignment_type = data.get('assignment_type')
        reason = data.get('reason', '')
        
        if not employee_uuids or not template_uuid or not start_date:
            return Response(
                {'error': 'employee_ids, template_id, and start_date are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employees = Employee.objects.filter(
            _id__in=employee_uuids,
            company_id=company_id,
            is_deleted=False
        )
        
        if employees.count() != len(employee_uuids):
            return Response(
                {'error': 'Some employees not found in your company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = get_object_or_404(ShiftTemplate, _id=template_uuid, company_id=company_id, is_deleted=False)
        
        results = {'success': [], 'failed': [], 'total': len(employee_uuids)}
        
        for employee in employees:
            try:
                if assignment_type == 'OVERRIDE':
                    current_date = start_date
                    while current_date <= end_date:
                        ShiftResolutionService.create_override(
                            employee_id=employee.id,
                            template_id=template.id,
                            date_obj=current_date,
                            reason=reason,
                            user=request.user
                        )
                        current_date += timedelta(days=1)
                    
                    results['success'].append({
                        'employee_id': str(employee._id),
                        'employee_name': employee.full_name,
                        'type': 'override',
                        'dates': f"{start_date} to {end_date}"
                    })
                    
                else:
                    ShiftResolutionService.create_date_range_assignment(
                        employee_id=employee.id,
                        template_id=template.id,
                        start_date=start_date,
                        end_date=end_date,
                        reason=reason,
                        user=request.user
                    )
                    
                    results['success'].append({
                        'employee_id': str(employee._id),
                        'employee_name': employee.full_name,
                        'type': 'date_range',
                        'dates': f"{start_date} to {end_date}"
                    })
                    
            except Exception as e:
                logger.error(f"Error assigning shift to employee {employee.id}: {str(e)}")
                results['failed'].append({
                    'employee_id': str(employee._id),
                    'employee_name': employee.full_name,
                    'error': str(e)
                })
        
        return Response(results, status=status.HTTP_200_OK)


class ShiftHistoryView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """Get shift change history with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee_uuid = request.query_params.get('employee_id')
        limit = int(request.query_params.get('limit', 50))
        offset = int(request.query_params.get('offset', 0))
        change_type = request.query_params.get('change_type')
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        query = ShiftChangeHistory.objects.filter(company_id=company_id)
        
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(employee=employee)
        
        if change_type:
            query = query.filter(change_type=change_type)
        
        if start_date:
            query = query.filter(changed_at__date__gte=start_date)
        
        if end_date:
            query = query.filter(changed_at__date__lte=end_date)
        
        total = query.count()
        history = query.order_by('-changed_at')[offset:offset + limit]
        
        return Response({
            'data': [
                {
                    "id": str(h._id),
                    "employee_id": str(h.employee._id),
                    "employee_name": h.employee.full_name,
                    "change_type": h.change_type,
                    "from_template_id": str(h.from_template._id) if h.from_template else None,
                    "from_template_name": h.from_template_name,
                    "to_template_id": str(h.to_template._id) if h.to_template else None,
                    "to_template_name": h.to_template_name,
                    "effective_from": h.effective_from.isoformat(),
                    "effective_to": h.effective_to.isoformat() if h.effective_to else None,
                    "reason": h.reason,
                    "changed_by": h.changed_by.email if h.changed_by else None,
                    "changed_at": h.changed_at.isoformat(),
                }
                for h in history
            ],
            'pagination': {
                'total': total,
                'limit': limit,
                'offset': offset,
                'has_more': offset + limit < total
            }
        })


class ShiftStatisticsView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """Get shift statistics with UUID support"""
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
        employee_ids = list(employees.values_list('id', flat=True))

        # Use bulk resolver instead of per-employee N+1 queries
        resolved_batch = ShiftResolutionService.get_resolved_shifts_for_day(employee_ids, date_obj)

        shift_distribution = {}
        employees_without_shift = 0
        for r in resolved_batch:
            tpl = r.get('template')
            if tpl:
                tid = str(tpl._id)
                shift_distribution[tid] = shift_distribution.get(tid, 0) + 1
            else:
                employees_without_shift += 1

        # Bulk template stats using aggregation
        templates = ShiftTemplate.objects.filter(company_id=company_id, is_deleted=False)
        override_counts = dict(
            ShiftOverride.objects.filter(
                shift_template__in=templates, date__gte=date_obj
            ).values_list('shift_template_id').annotate(count=Count('id'))
        )
        date_range_counts = dict(
            ShiftDateRangeAssignment.objects.filter(
                shift_template__in=templates, is_active=True, end_date__gte=date_obj
            ).values_list('shift_template_id').annotate(count=Count('id'))
        )
        default_counts = dict(
            EmployeeDefaultShift.objects.filter(
                template__in=templates, effective_from__lte=date_obj
            ).filter(
                Q(effective_to__isnull=True) | Q(effective_to__gte=date_obj)
            ).values_list('template_id').annotate(count=Count('id'))
        )

        template_stats = []
        for template in templates:
            oc = override_counts.get(template.id, 0)
            drc = date_range_counts.get(template.id, 0)
            dc = default_counts.get(template.id, 0)
            template_stats.append({
                'template_id': str(template._id),
                'template_name': template.name,
                'is_active': template.is_active,
                'overrides_count': oc,
                'date_range_count': drc,
                'default_count': dc,
                'total_usage': oc + drc + dc,
            })
        
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


class ShiftMonthSummaryView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """Lightweight aggregated month summary for the calendar view — returns template counts per day (no per-employee data). Cache-friendly."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response({'error': 'User is not associated with any company'}, status=400)

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        if not start_date or not end_date:
            return Response({'error': 'start_date and end_date are required'}, status=400)

        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()

        cache_key = f"shift_month_summary_{company_id}_{start_date}_{end_date}"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        employees = Employee.objects.filter(company_id=company_id, is_deleted=False)
        employee_ids = list(employees.values_list('id', flat=True))

        # Pre-load template metadata
        templates = ShiftTemplate.objects.filter(company_id=company_id, is_deleted=False)
        template_meta = {}
        for t in templates:
            template_meta[t.id] = {
                'template_id': str(t._id),
                'template_name': t.name,
                'start_time': t.start_time.strftime('%H:%M'),
                'end_time': t.end_time.strftime('%H:%M'),
                'break_minutes': t.break_minutes,
            }

        # Use the (now optimized) batch resolver for the month
        resolved = ShiftResolutionService.get_resolved_shifts_batch(employee_ids, start, end)

        # Aggregate: date → template_id → count
        summary = defaultdict(lambda: defaultdict(int))
        date_keys = [(start + timedelta(days=i)).isoformat() for i in range((end - start).days + 1)]
        for dt_str in date_keys:
            for emp_id, emp_shifts in resolved.items():
                shift = emp_shifts.get(dt_str, {})
                template = shift.get('template')
                if template:
                    summary[dt_str][template.id] += 1

        # Shape into final response
        result = {}
        for dt_str in date_keys:
            tpl_list = []
            for t_id, count in summary[dt_str].items():
                meta = template_meta.get(t_id, {})
                tpl_list.append({**meta, 'employee_count': count})
            result[dt_str] = tpl_list

        cache.set(cache_key, result, 60)
        return Response(result)


class ShiftDayDetailView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_override'
    """Full shift details for a single day — used by the 'See more' popup. Fetched lazily."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response({'error': 'User is not associated with any company'}, status=400)

        date_param = request.query_params.get('date')
        if not date_param:
            return Response({'error': 'date is required'}, status=400)

        date_obj = datetime.strptime(date_param, '%Y-%m-%d').date()

        employees = Employee.objects.filter(
            company_id=company_id, is_deleted=False,
            employment_status='ACTIVE'
        )
        employee_ids = list(employees.values_list('id', flat=True))

        # Use the optimized single-day resolver
        resolved = ShiftResolutionService.get_resolved_shifts_for_day(employee_ids, date_obj)

        # Group by template
        template_groups = defaultdict(list)
        for r in resolved:
            tpl = r.get('template')
            if tpl:
                template_groups[tpl.id].append({
                    'employee_id': str(r['employee']._id),
                    'employee_name': r['employee'].full_name,
                    'department_name': str(r['employee'].department) if r['employee'].department else None,
                    'source_type': r['source_type'],
                })

        # Build response with template details + employee lists
        result = []
        templates = ShiftTemplate.objects.filter(company_id=company_id, is_deleted=False)
        template_map = {t.id: t for t in templates}

        for t_id, emp_list in template_groups.items():
            tpl = template_map.get(t_id)
            if tpl:
                result.append({
                    'template_id': str(tpl._id),
                    'template_name': tpl.name,
                    'start_time': tpl.start_time.strftime('%H:%M'),
                    'end_time': tpl.end_time.strftime('%H:%M'),
                    'break_minutes': tpl.break_minutes,
                    'employee_count': len(emp_list),
                    'employees': emp_list,
                })

        result.sort(key=lambda x: x['employee_count'], reverse=True)

        return Response({
            'date': date_param,
            'shifts': result,
            'total_employees': len(employee_ids),
        })


class ShiftScheduleGenerateView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'shift_template'
    """Generate and cache shift schedules for performance with UUID support"""
    permission_classes = [IsAuthenticated]
    

    def post(self, request):
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
        
        EmployeeShiftSchedule.objects.filter(
            company_id=company_id,
            date__gte=start,
            date__lte=end
        ).delete()
        
        schedules_created = 0
        
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