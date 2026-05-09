# apps/hr/views/shift_template_views.py
from datetime import datetime, time as dt_time
from django.db import transaction, models
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
import logging
from apps.hr.models import ShiftTemplate

logger = logging.getLogger(__name__)


class ShiftTemplateView(APIView):
    """CRUD for shift templates"""
    permission_classes = [IsAuthenticated]
    
    def _format_time(self, time_obj):
        """Safely format time object to HH:MM string"""
        if isinstance(time_obj, str):
            return time_obj
        if hasattr(time_obj, 'strftime'):
            return time_obj.strftime("%H:%M")
        return str(time_obj)
    
    def _parse_time(self, time_str):
        """Parse time string to time object"""
        try:
            hours, minutes = map(int, time_str.split(':'))
            return dt_time(hours, minutes)
        except (ValueError, TypeError, AttributeError):
            raise ValueError(f"Invalid time format: {time_str}. Expected HH:MM")
    
    def get(self, request):
        """Get all shift templates for user's company"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Build query based on user role
        query = ShiftTemplate.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        # Non-admin users only see their branch templates or global templates
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(
                models.Q(branch_id=branch_id) | models.Q(branch__isnull=True)
            )
        
        templates = query.order_by('name')
        
        return Response([
            {
                "id": t.id,
                "_id": str(t._id),
                "name": t.name,
                "startTime": self._format_time(t.start_time),
                "endTime": self._format_time(t.end_time),
                "breakMinutes": t.break_minutes,
                "description": t.description,
                "is_active": t.is_active,
                "workingHours": t.working_hours,
                "createdAt": t.created_at.isoformat() if t.created_at else None,
                "updatedAt": t.updated_at.isoformat() if t.updated_at else None,
            }
            for t in templates
        ])
    
    @transaction.atomic
    def post(self, request):
        """Create new shift template"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Validate required fields
        required_fields = ['name', 'startTime', 'endTime']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        # Check for duplicate name
        if ShiftTemplate.objects.filter(
            company_id=company_id,
            name=request.data['name'],
            is_deleted=False
        ).exists():
            return Response(
                {'error': 'Shift template with this name already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            start_time = self._parse_time(request.data['startTime'])
            end_time = self._parse_time(request.data['endTime'])
        except ValueError as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = ShiftTemplate.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            name=request.data['name'],
            start_time=start_time,
            end_time=end_time,
            break_minutes=request.data.get('breakMinutes', 60),
            description=request.data.get('description', ''),
            is_active=request.data.get('is_active', True),
            created_by=request.user,
            updated_by=request.user,
        )
        
        return Response({
            "message": "Shift template created successfully",
            "id": template.id,
            "_id": str(template._id),
            "name": template.name,
            "startTime": self._format_time(template.start_time),
            "endTime": self._format_time(template.end_time),
            "breakMinutes": template.break_minutes,
            "description": template.description,
            "is_active": template.is_active,
            "workingHours": template.working_hours,
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update shift template"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template_id = request.data.get('id')
        if not template_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = get_object_or_404(
            ShiftTemplate,
            id=template_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Update fields
        if 'name' in request.data:
            template.name = request.data['name']
        if 'startTime' in request.data:
            try:
                template.start_time = self._parse_time(request.data['startTime'])
            except ValueError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if 'endTime' in request.data:
            try:
                template.end_time = self._parse_time(request.data['endTime'])
            except ValueError as e:
                return Response(
                    {'error': str(e)},
                    status=status.HTTP_400_BAD_REQUEST
                )
        if 'breakMinutes' in request.data:
            template.break_minutes = request.data['breakMinutes']
        if 'description' in request.data:
            template.description = request.data['description']
        if 'is_active' in request.data:
            template.is_active = request.data['is_active']
        
        template.branch_id = request.user.branch_id
        template.updated_by = request.user
        template.save()
        
        return Response({
            "message": "Shift template updated successfully",
            "id": template.id,
            "name": template.name,
            "startTime": self._format_time(template.start_time),
            "endTime": self._format_time(template.end_time),
            "breakMinutes": template.break_minutes,
            "description": template.description,
            "is_active": template.is_active,
            "workingHours": template.working_hours,
        })
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete shift template"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template_id = request.data.get('id')
        if not template_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = get_object_or_404(
            ShiftTemplate,
            id=template_id,
            company_id=company_id,
            is_deleted=False
        )
        
        template.is_deleted = True
        template.deleted_at = datetime.now()
        template.deleted_by = request.user
        template.save()
        
        return Response({'message': 'Shift template deleted successfully'})