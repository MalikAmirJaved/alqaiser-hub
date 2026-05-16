# apps/hr/views/shift_template_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction
from django.shortcuts import get_object_or_404
from apps.common.baseauthentication import CompanyBranchMixin
from apps.hr.models import ShiftTemplate
from django.utils import timezone

class ShiftTemplateView(CompanyBranchMixin, APIView):
    """CRUD for shift templates with UUID support"""
    lookup_field = '_id'
    
    def _format_time(self, time_obj):
        if isinstance(time_obj, str):
            return time_obj
        if hasattr(time_obj, 'strftime'):
            return time_obj.strftime("%H:%M")
        return str(time_obj)
    
    def _parse_time(self, time_str):
        try:
            from datetime import time
            hours, minutes = map(int, time_str.split(':'))
            return time(hours, minutes)
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
        
        # Use the mixin's filtering (already applied via get_queryset pattern)
        from django.db.models import Q
        query = ShiftTemplate.objects.filter(company_id=company_id, is_deleted=False)
        
        if request.user.role not in ['COMPANY_ADMIN', 'SUPER_ADMIN']:
            query = query.filter(Q(branch_id=branch_id) | Q(branch_id__isnull=True))
        
        templates = query.order_by('name')
        
        return Response([
            {
                "id": str(t._id),  # Return UUID as string
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
        
        required_fields = ['name', 'startTime', 'endTime']
        for field in required_fields:
            if field not in request.data:
                return Response(
                    {'error': f'{field} is required'},
                    status=status.HTTP_400_BAD_REQUEST
                )
        
        if ShiftTemplate.objects.filter(company_id=company_id, name=request.data['name'], is_deleted=False).exists():
            return Response(
                {'error': 'Shift template with this name already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            start_time = self._parse_time(request.data['startTime'])
            end_time = self._parse_time(request.data['endTime'])
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
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
            "id": str(template._id),
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
        """Update shift template using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template_uuid = request.data.get('id')
        if not template_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = get_object_or_404(
            ShiftTemplate,
            _id=template_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        if 'name' in request.data:
            template.name = request.data['name']
        if 'startTime' in request.data:
            try:
                template.start_time = self._parse_time(request.data['startTime'])
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if 'endTime' in request.data:
            try:
                template.end_time = self._parse_time(request.data['endTime'])
            except ValueError as e:
                return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if 'breakMinutes' in request.data:
            template.break_minutes = request.data['breakMinutes']
        if 'description' in request.data:
            template.description = request.data['description']
        if 'is_active' in request.data:
            template.is_active = request.data['is_active']
        
        template.updated_by = request.user
        template.save()
        
        return Response({
            "message": "Shift template updated successfully",
            "id": str(template._id),
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
        """Soft delete shift template using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template_uuid = request.data.get('id')
        if not template_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        template = get_object_or_404(
            ShiftTemplate,
            _id=template_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        template.is_deleted = True
        template.deleted_at = timezone.now()
        template.deleted_by = request.user
        template.save()
        
        return Response({'message': 'Shift template deleted successfully'})