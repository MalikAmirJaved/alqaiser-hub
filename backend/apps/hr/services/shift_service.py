# apps/hr/services/shift_service.py
from datetime import date, datetime, timedelta
from typing import List, Dict, Optional, Tuple
from django.db import transaction
from django.db.models import Q, Prefetch
from django.core.cache import cache
from collections import defaultdict
import logging

from apps.hr.models import (
    Employee, ShiftTemplate, EmployeeDefaultShift,
    ShiftOverride, ShiftDateRangeAssignment, 
    ShiftChangeHistory, EmployeeShiftSchedule
)

logger = logging.getLogger(__name__)


class ShiftResolutionService:
    """Service for resolving employee shifts with caching and optimization"""
    
    CACHE_TTL = 3600  # 1 hour cache
    
    @classmethod
    def get_resolved_shift(cls, employee_id: int, date_obj: date) -> Dict:
        """Get resolved shift for a single employee on a specific date"""
        cache_key = f"shift_resolved_{employee_id}_{date_obj.isoformat()}"
        
        # Try cache first
        cached = cache.get(cache_key)
        if cached:
            return cached
        
        result = cls._resolve_employee_shift(employee_id, date_obj)
        
        # Cache the result
        cache.set(cache_key, result, cls.CACHE_TTL)
        
        return result
    
    @classmethod
    def get_resolved_shifts_batch(cls, employee_ids: List[int], 
                                   start_date: date, 
                                   end_date: date) -> Dict:
        """Get resolved shifts for multiple employees over a date range"""
        result = {}
        
        # Generate all date strings in range
        date_range = []
        current = start_date
        while current <= end_date:
            date_range.append(current)
            current += timedelta(days=1)
        
        # Bulk fetch all data
        employees = Employee.objects.filter(id__in=employee_ids).select_related('default_shift')
        
        # Fetch all overrides in date range
        overrides = ShiftOverride.objects.filter(
            employee_id__in=employee_ids,
            date__gte=start_date,
            date__lte=end_date
        ).select_related('shift_template')
        
        # Fetch all date range assignments
        date_range_assignments = ShiftDateRangeAssignment.objects.filter(
            employee_id__in=employee_ids,
            start_date__lte=end_date,
            end_date__gte=start_date,
            is_active=True
        ).select_related('shift_template')
        
        # Fetch default shifts
        default_shifts = EmployeeDefaultShift.objects.filter(
            employee_id__in=employee_ids,
            effective_from__lte=end_date
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=start_date)
        ).select_related('template')
        
        # Organize by employee
        overrides_by_employee = defaultdict(dict)
        for override in overrides:
            overrides_by_employee[override.employee_id][override.date] = override

        # Build date-indexed lookup for date ranges (O(1) per date check instead of O(A))
        date_range_lookup = defaultdict(dict)
        for dra in date_range_assignments:
            d = max(dra.start_date, start_date)
            e = min(dra.end_date, end_date)
            while d <= e:
                if d not in date_range_lookup[dra.employee_id]:
                    date_range_lookup[dra.employee_id][d] = dra
                d += timedelta(days=1)

        default_by_employee = {}
        for default in default_shifts:
            if default.employee_id not in default_by_employee:
                default_by_employee[default.employee_id] = default

        # Resolve for each employee and date
        for employee in employees:
            employee_dict = {}
            for date_check in date_range:
                # Priority 1: Override
                if date_check in overrides_by_employee[employee.id]:
                    override = overrides_by_employee[employee.id][date_check]
                    employee_dict[date_check.isoformat()] = {
                        'template': override.shift_template,
                        'is_override': True,
                        'source_type': 'OVERRIDE'
                    }
                    continue

                # Priority 2: Date range assignment (O(1) lookup)
                dra_match = date_range_lookup.get(employee.id, {}).get(date_check)

                if dra_match:
                    employee_dict[date_check.isoformat()] = {
                        'template': dra_match.shift_template,
                        'is_override': True,
                        'source_type': 'DATE_RANGE'
                    }
                    continue

                # Priority 3: Default shift
                default = default_by_employee.get(employee.id)
                if default and default.effective_from <= date_check:
                    employee_dict[date_check.isoformat()] = {
                        'template': default.template,
                        'is_override': False,
                        'source_type': 'DEFAULT'
                    }
                    continue

                # Priority 4: Employee default_shift field
                if employee.default_shift:
                    employee_dict[date_check.isoformat()] = {
                        'template': employee.default_shift,
                        'is_override': False,
                        'source_type': 'DEFAULT'
                    }
                    continue

                # No shift assigned
                employee_dict[date_check.isoformat()] = {
                    'template': None,
                    'is_override': False,
                    'source_type': 'NONE'
                }

            result[employee.id] = employee_dict

        return result

    @classmethod
    def get_resolved_shifts_for_day(cls, employee_ids, date_obj):
        """Optimized bulk resolution for a single day — used by day-detail popup"""
        employees = Employee.objects.filter(id__in=employee_ids).select_related('default_shift')

        overrides = ShiftOverride.objects.filter(
            employee_id__in=employee_ids, date=date_obj
        ).select_related('shift_template')

        date_range_assignments = ShiftDateRangeAssignment.objects.filter(
            employee_id__in=employee_ids,
            start_date__lte=date_obj, end_date__gte=date_obj, is_active=True
        ).select_related('shift_template')

        default_shifts = EmployeeDefaultShift.objects.filter(
            employee_id__in=employee_ids,
            effective_from__lte=date_obj
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=date_obj)
        ).select_related('template')

        override_map = {o.employee_id: o for o in overrides}
        range_map = {}
        for dra in date_range_assignments:
            if dra.employee_id not in range_map:
                range_map[dra.employee_id] = dra
        default_map = {}
        for ds in default_shifts:
            if ds.employee_id not in default_map:
                default_map[ds.employee_id] = ds

        results = []
        for emp in employees:
            if emp.id in override_map:
                o = override_map[emp.id]
                results.append({'employee': emp, 'template': o.shift_template, 'source_type': 'OVERRIDE'})
            elif emp.id in range_map:
                dra = range_map[emp.id]
                results.append({'employee': emp, 'template': dra.shift_template, 'source_type': 'DATE_RANGE'})
            elif emp.id in default_map:
                ds = default_map[emp.id]
                results.append({'employee': emp, 'template': ds.template, 'source_type': 'DEFAULT'})
            elif emp.default_shift:
                results.append({'employee': emp, 'template': emp.default_shift, 'source_type': 'DEFAULT'})
            else:
                results.append({'employee': emp, 'template': None, 'source_type': 'NONE'})

        return results
    
    @classmethod
    def _resolve_employee_shift(cls, employee_id: int, date_obj: date) -> Dict:
        """Internal method to resolve single employee shift"""
        
        # Priority 1: Check for override
        override = ShiftOverride.objects.filter(
            employee_id=employee_id,
            date=date_obj
        ).select_related('shift_template').first()
        
        if override:
            return {
                'template_id': override.shift_template.id,
                'template_name': override.shift_template.name,
                'start_time': override.shift_template.start_time,
                'end_time': override.shift_template.end_time,
                'break_minutes': override.shift_template.break_minutes,
                'is_override': True,
                'source_type': 'OVERRIDE'
            }
        
        # Priority 2: Check date range assignments
        date_range = ShiftDateRangeAssignment.objects.filter(
            employee_id=employee_id,
            start_date__lte=date_obj,
            end_date__gte=date_obj,
            is_active=True
        ).select_related('shift_template').first()
        
        if date_range:
            return {
                'template_id': date_range.shift_template.id,
                'template_name': date_range.shift_template.name,
                'start_time': date_range.shift_template.start_time,
                'end_time': date_range.shift_template.end_time,
                'break_minutes': date_range.shift_template.break_minutes,
                'is_override': True,
                'source_type': 'DATE_RANGE'
            }
        
        # Priority 3: Check default shift history
        default_shift = EmployeeDefaultShift.objects.filter(
            employee_id=employee_id,
            effective_from__lte=date_obj
        ).filter(
            Q(effective_to__isnull=True) | Q(effective_to__gte=date_obj)
        ).select_related('template').first()
        
        if default_shift:
            return {
                'template_id': default_shift.template.id,
                'template_name': default_shift.template.name,
                'start_time': default_shift.template.start_time,
                'end_time': default_shift.template.end_time,
                'break_minutes': default_shift.template.break_minutes,
                'is_override': False,
                'source_type': 'DEFAULT'
            }
        
        # Priority 4: Check employee default_shift field
        employee = Employee.objects.filter(id=employee_id).select_related('default_shift').first()
        if employee and employee.default_shift:
            return {
                'template_id': employee.default_shift.id,
                'template_name': employee.default_shift.name,
                'start_time': employee.default_shift.start_time,
                'end_time': employee.default_shift.end_time,
                'break_minutes': employee.default_shift.break_minutes,
                'is_override': False,
                'source_type': 'DEFAULT'
            }
        
        # No shift
        return {
            'template_id': None,
            'template_name': None,
            'start_time': None,
            'end_time': None,
            'break_minutes': 0,
            'is_override': False,
            'source_type': 'NONE'
        }

    @classmethod
    @transaction.atomic
    def create_override(cls, employee_id: int, template_id: int, 
                        date_obj: date, reason: str = '', 
                        user=None) -> ShiftOverride:
        """Create a shift override with history tracking"""
        
        # Get current shift before change
        current_shift = cls._resolve_employee_shift(employee_id, date_obj)
        
        # Get employee and template to ensure they exist
        employee = Employee.objects.get(id=employee_id)
        new_template = ShiftTemplate.objects.get(id=template_id)
        
        # Update existing override if any, otherwise create new one
        existing = ShiftOverride.objects.filter(employee_id=employee_id, date=date_obj).first()
        if existing:
            existing.shift_template_id = template_id
            existing.reason = reason
            existing.updated_by = user
            existing.save()
            override = existing
        else:
            override = ShiftOverride.objects.create(
                company_id=employee.company_id,
                branch_id=employee.branch_id,
                employee_id=employee_id,
                shift_template_id=template_id,
                date=date_obj,
                reason=reason,
                created_by=user,
                updated_by=user
            )
        
        # Create history record
        ShiftChangeHistory.objects.create(
            company_id=employee.company_id,
            employee=employee,
            change_type='TEMPORARY_OVERRIDE',
            from_template_id=current_shift.get('template_id'),
            from_template_name=current_shift.get('template_name'),
            to_template_id=template_id,
            to_template_name=new_template.name,
            effective_from=date_obj,
            effective_to=None,
            reason=reason,
            changed_by=user,
            changed_by_name=user.get_full_name() if user else 'System',
            metadata={'date': date_obj.isoformat()}
        )
        
        # Invalidate cache
        cache_key = f"shift_resolved_{employee_id}_{date_obj.isoformat()}"
        cache.delete(cache_key)
        
        return override
    
    @classmethod
    @transaction.atomic
    def create_date_range_assignment(cls, employee_id: int, template_id: int,
                                      start_date: date, end_date: date,
                                      reason: str = '', user=None) -> ShiftDateRangeAssignment:
        """Create a date range shift assignment with history tracking"""
        
        # Get employee and template
        employee = Employee.objects.get(id=employee_id)
        new_template = ShiftTemplate.objects.get(id=template_id)
        
        # Check for existing overlapping assignments
        overlapping = ShiftDateRangeAssignment.objects.filter(
            employee_id=employee_id,
            start_date__lte=end_date,
            end_date__gte=start_date,
            is_active=True
        )
        
        # Deactivate overlapping assignments
        overlapping.update(is_active=False)
        
        # Create history for each date in range
        current_date = start_date
        while current_date <= end_date:
            current_shift = cls._resolve_employee_shift(employee_id, current_date)
            
            ShiftChangeHistory.objects.create(
                company_id=employee.company_id,
                employee=employee,
                change_type='DATE_RANGE_ASSIGNMENT',
                from_template_id=current_shift.get('template_id'),
                from_template_name=current_shift.get('template_name'),
                to_template_id=template_id,
                to_template_name=new_template.name,
                effective_from=current_date,
                effective_to=current_date,
                reason=reason,
                changed_by=user,
                changed_by_name=user.get_full_name() if user else 'System',
                metadata={'range_start': start_date.isoformat(), 'range_end': end_date.isoformat()}
            )
            
            # Invalidate cache for each date
            cache_key = f"shift_resolved_{employee_id}_{current_date.isoformat()}"
            cache.delete(cache_key)
            
            current_date += timedelta(days=1)
        
        # Create the date range assignment
        assignment = ShiftDateRangeAssignment.objects.create(
            company_id=employee.company_id,
            employee_id=employee_id,
            shift_template_id=template_id,
            start_date=start_date,
            end_date=end_date,
            reason=reason,
            created_by=user,
            updated_by=user
        )
        
        return assignment
    
    @classmethod
    @transaction.atomic
    def delete_override(cls, employee_id: int, date_obj: date, user=None):
        """Delete a shift override"""
        override = ShiftOverride.objects.filter(employee_id=employee_id, date=date_obj).first()
        
        if override:
            employee = Employee.objects.get(id=employee_id)
            
            # Soft delete the override
            override.is_deleted = True
            override.deleted_by = user
            override.save(update_fields=["is_deleted", "deleted_by"])
            
            # Invalidate cache
            cache_key = f"shift_resolved_{employee_id}_{date_obj.isoformat()}"
            cache.delete(cache_key)
            
            # Get new resolved shift
            new_shift = cls._resolve_employee_shift(employee_id, date_obj)
            
            # Record history
            ShiftChangeHistory.objects.create(
                company_id=employee.company_id,
                employee=employee,
                change_type='TEMPORARY_OVERRIDE',
                from_template_id=override.shift_template_id,
                from_template_name=override.shift_template.name,
                to_template_id=new_shift.get('template_id'),
                to_template_name=new_shift.get('template_name'),
                effective_from=date_obj,
                effective_to=None,
                reason='Override removed',
                changed_by=user,
                changed_by_name=user.get_full_name() if user else 'System',
                metadata={'date': date_obj.isoformat(), 'action': 'deleted'}
            )
            
            return True
        return False