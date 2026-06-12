# apps/hr/views/employee_asset_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from apps.hr.services.assignment_service import AssetAssignmentService
from apps.hr.models import Asset, AssetCategory, EmployeeAssetAssignment
from django.db import models
from datetime import date
import logging

logger = logging.getLogger(__name__)


class EmployeeAssetAssignmentView(APIView):
    """Main assignment CRUD endpoint"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get assignments for an employee"""
        employee_id = request.query_params.get('employee_id')
        if not employee_id:
            return Response({'error': 'employee_id required'}, status=400)
        
        company_id = request.user.company_id
        data = AssetAssignmentService.get_employee_assignments(employee_id, company_id)
        return Response(data)
    
    def post(self, request):
        """Assign assets/kits to employee"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        employee_id = request.data.get('employee_id')
        asset_ids = request.data.get('asset_ids', [])
        kit_ids = request.data.get('kit_ids', [])
        
        if not employee_id:
            return Response({'error': 'employee_id required'}, status=400)
        if not asset_ids and not kit_ids:
            return Response({'error': 'Must provide asset_ids or kit_ids'}, status=400)
        
        try:
            result = AssetAssignmentService.assign_assets_to_employee(
                employee_id=int(employee_id),
                company_id=company_id,
                branch_id=branch_id,
                asset_ids=[int(a) for a in asset_ids] if asset_ids else None,
                kit_ids=[int(k) for k in kit_ids] if kit_ids else None,
                assigned_date=request.data.get('assigned_date'),
                condition=request.data.get('condition', 'GOOD'),
                notes=request.data.get('notes', ''),
                created_by=request.user
            )
            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            logger.error(f"Assignment failed: {str(e)}")
            return Response({'error': str(e)}, status=400)
    
    def patch(self, request):
        """Update assignment (return, change condition, etc.)"""
        action = request.data.get('action', 'return')
        
        if action == 'return':
            assignment_ids = request.data.get('assignment_ids', [])
            if not assignment_ids:
                return Response({'error': 'assignment_ids required'}, status=400)
            
            try:
                result = AssetAssignmentService.return_assets(
                    assignment_ids=assignment_ids,
                    company_id=request.user.company_id,
                    returned_date=request.data.get('returned_date'),
                    condition_on_return=request.data.get('condition_on_return', 'GOOD'),
                    return_notes=request.data.get('return_notes', ''),
                    updated_by=request.user
                )
                return Response(result)
            except Exception as e:
                return Response({'error': str(e)}, status=400)
        
        elif action == 'update':
            assignment_id = request.data.get('assignment_id')
            if not assignment_id:
                return Response({'error': 'assignment_id required'}, status=400)
            
            assignment = EmployeeAssetAssignment.objects.get(
                id=assignment_id,
                company_id=request.user.company_id
            )
            
            # Update allowed fields
            if 'status' in request.data:
                assignment.status = request.data['status']
            if 'condition_on_assignment' in request.data:
                assignment.condition_on_assignment = request.data['condition_on_assignment']
            if 'notes' in request.data:
                assignment.notes = request.data['notes']
            if 'expected_return_date' in request.data:
                assignment.expected_return_date = request.data['expected_return_date']
            
            assignment.updated_by = request.user
            assignment.save()
            
            return Response({'message': 'Assignment updated'})
        
        return Response({'error': 'Invalid action'}, status=400)
    
    def delete(self, request):
        """Remove assignment entirely (admin only)"""
        assignment_id = request.data.get('id')
        if not assignment_id:
            return Response({'error': 'id required'}, status=400)
        
        assignment = EmployeeAssetAssignment.objects.get(
            id=assignment_id,
            company_id=request.user.company_id
        )
        
        # Only allow deleting non-active assignments, or admin override
        if assignment.status == 'ACTIVE':
            # First return the asset
            assignment.status = 'RETURNED'
            assignment.returned_date = date.today()
            assignment.updated_by = request.user
            assignment.asset.is_assigned = False
            assignment.asset.save()
            assignment.save()
        
        assignment.is_deleted = True
        assignment.deleted_by = request.user
        assignment.save()
        
        return Response({'message': 'Assignment removed'})


class AvailableAssetsView(APIView):
    """Get available assets and kits for assignment"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        employee_id = request.query_params.get('employee_id')
        
        # Available assets (not assigned to this employee)
        assigned_to_employee = EmployeeAssetAssignment.objects.filter(
            employee_id=employee_id,
            status='ACTIVE'
        ).values_list('asset_id', flat=True) if employee_id else []
        
        assets = Asset.objects.filter(
            company_id=company_id,
            is_deleted=False,
            is_active=True
        ).exclude(
            id__in=assigned_to_employee
        ).order_by('name')
        
        # Kits with asset details
        kits = AssetCategory.objects.filter(
            company_id=company_id,
            is_deleted=False,
            is_active=True
        ).prefetch_related('assets')
        
        return Response({
            'assets': [
                {
                    'id': a.id,
                    'name': a.name,
                    'brand': a.brand,
                    'model': a.model,
                    'serial_number': a.serial_number,
                    'is_assigned': a.is_assigned,
                }
                for a in assets
            ],
            'kits': [
                {
                    'id': k.id,
                    'name': k.name,
                    'description': k.description,
                    'asset_count': k.assets.filter(is_deleted=False).count(),
                    'assets': [
                        {
                            'id': asset.id,
                            'name': asset.name,
                            'brand': asset.brand,
                            'model': asset.model,
                            'serial_number': asset.serial_number,
                            'is_assigned': asset.is_assigned,
                            'already_assigned_to_employee': asset.id in assigned_to_employee,
                        }
                        for asset in k.assets.filter(is_deleted=False)
                    ]
                }
                for k in kits
            ]
        })


class BulkAssignmentView(APIView):
    """Bulk operations endpoint"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Bulk return assignments"""
        assignment_ids = request.data.get('assignment_ids', [])
        company_id = request.user.company_id
        
        if not assignment_ids:
            return Response({'error': 'assignment_ids required'}, status=400)
        
        try:
            result = AssetAssignmentService.return_assets(
                assignment_ids=assignment_ids,
                company_id=company_id,
                updated_by=request.user
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=400)