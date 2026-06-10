# apps/hr/views/employee_asset_views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import date
import logging

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.services.assignment_service import AssetAssignmentService
from apps.hr.models import Asset, AssetCategory, EmployeeAssetAssignment, Employee

logger = logging.getLogger(__name__)


class EmployeeAssetAssignmentView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'asset_assignment'
    """Main assignment CRUD endpoint with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get assignments for an employee"""
        employee_uuid = request.query_params.get('employee_id')
        if not employee_uuid:
            return Response({'error': 'employee_id required'}, status=400)
        
        company_id = request.user.company_id
        
        employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
        
        data = AssetAssignmentService.get_employee_assignments(employee.id, company_id)
        
        
        
        return Response(data)
    
    def post(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id

        employee_uuid = request.data.get('employee_id')
        assets_data = request.data.get('assets', [])          
        kit_uuids = request.data.get('kit_ids', [])

        if not employee_uuid:
            return Response({'error': 'employee_id required'}, status=400)
        if not assets_data and not kit_uuids:
            return Response({'error': 'Must provide assets or kit_ids'}, status=400)

        try:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)

            # Convert assets_data to format expected by service
            assets_payload = []
            for item in assets_data:
                asset_uuid = item.get('asset_id')
                qty = item.get('quantity', 1)
                if not asset_uuid or qty <= 0:
                    continue
                asset = get_object_or_404(Asset, _id=asset_uuid, company_id=company_id, is_deleted=False)
                assets_payload.append({'asset_id': asset.id, 'quantity': qty})

            # Convert kit UUIDs to internal IDs
            kit_ids = []
            if kit_uuids:
                kits = AssetCategory.objects.filter(_id__in=kit_uuids, company_id=company_id, is_deleted=False)
                kit_ids = list(kits.values_list('id', flat=True))

            result = AssetAssignmentService.assign_assets_to_employee(
                employee_id=employee.id,
                company_id=company_id,
                branch_id=branch_id,
                assets=assets_payload,
                kit_ids=kit_ids,
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
        company_id = request.user.company_id
        action = request.data.get('action', 'return')
        
        if action == 'return':
            assignment_uuids = request.data.get('assignment_ids', [])
            if not assignment_uuids:
                return Response({'error': 'assignment_ids required'}, status=400)
            
            try:
                # Convert UUIDs to integer IDs
                assignments = EmployeeAssetAssignment.objects.filter(
                    _id__in=assignment_uuids,
                    company_id=company_id
                )
                assignment_ids = list(assignments.values_list('id', flat=True))
                
                result = AssetAssignmentService.return_assets(
                    assignment_ids=assignment_ids,
                    company_id=company_id,
                    returned_date=request.data.get('returned_date'),
                    condition_on_return=request.data.get('condition_on_return', 'GOOD'),
                    return_notes=request.data.get('return_notes', ''),
                    updated_by=request.user
                )
                return Response(result)
            except Exception as e:
                return Response({'error': str(e)}, status=400)
        
        elif action == 'update':
            assignment_uuid = request.data.get('assignment_id')
            if not assignment_uuid:
                return Response({'error': 'assignment_id required'}, status=400)
            
            assignment = get_object_or_404(
                EmployeeAssetAssignment,
                _id=assignment_uuid,
                company_id=company_id
            )
            
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
        """Remove assignment entirely (admin only) using UUID"""
        company_id = request.user.company_id
        
        assignment_uuid = request.data.get('id')
        if not assignment_uuid:
            return Response({'error': 'id (UUID) required'}, status=400)
        
        assignment = get_object_or_404(
            EmployeeAssetAssignment,
            _id=assignment_uuid,
            company_id=company_id
        )
        
        if assignment.status == 'ACTIVE':
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


class AvailableAssetsView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'emp_asset'
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        employee_uuid = request.query_params.get('employee_id')
        
        assigned_to_employee_ids = set()
        if employee_uuid:
            employee = get_object_or_404(Employee, _id=employee_uuid, company_id=company_id, is_deleted=False)
            assigned_to_employee_ids = set(EmployeeAssetAssignment.objects.filter(
                employee=employee,
                status='ACTIVE'
            ).values_list('asset_id', flat=True))
        
        assets = Asset.objects.filter(
            company_id=company_id,
            is_deleted=False,
            is_active=True
        ).order_by('name')
        
        kits = AssetCategory.objects.filter(
            company_id=company_id,
            is_deleted=False,
            is_active=True
        ).prefetch_related('assets')
        
        return Response({
            'assets': [
                {
                    'id': str(a._id),
                    'name': a.name,
                    'brand': a.brand,
                    'model': a.model,
                    'serial_number': a.serial_number,
                    'is_assigned': a.is_assigned,
                    'available_quantity': a.available_quantity,
                    'total_quantity': a.total_quantity,
                    'already_assigned_to_employee': a.id in assigned_to_employee_ids,
                }
                for a in assets
            ],
            'kits': [
                {
                    'id': str(k._id),
                    'name': k.name,
                    'description': k.description,
                    'asset_count': k.assets.filter(is_deleted=False).count(),
                    'assets': [
                        {
                            'id': str(asset._id),
                            'name': asset.name,
                            'brand': asset.brand,
                            'model': asset.model,
                            'serial_number': asset.serial_number,
                            'is_assigned': asset.is_assigned,
                            'available_quantity': asset.available_quantity,
                            'total_quantity': asset.total_quantity,
                            'already_assigned_to_employee': asset.id in assigned_to_employee_ids,
                        }
                        for asset in k.assets.filter(is_deleted=False)
                    ]
                }
                for k in kits
            ]
        })

class BulkAssignmentView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    permission_module = 'HR'
    permission_resource = 'asset_assignment'

    def get_permission_action(self):
        if self.request.method.upper() == 'POST':
            return 'assign'
        return super().get_permission_action()
    """Bulk operations endpoint with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Bulk return assignments"""
        assignment_uuids = request.data.get('assignment_ids', [])
        company_id = request.user.company_id
        
        if not assignment_uuids:
            return Response({'error': 'assignment_ids required'}, status=400)
        
        try:
            assignments = EmployeeAssetAssignment.objects.filter(
                _id__in=assignment_uuids,
                company_id=company_id
            )
            assignment_ids = list(assignments.values_list('id', flat=True))
            
            result = AssetAssignmentService.return_assets(
                assignment_ids=assignment_ids,
                company_id=company_id,
                updated_by=request.user
            )
            return Response(result)
        except Exception as e:
            return Response({'error': str(e)}, status=400)