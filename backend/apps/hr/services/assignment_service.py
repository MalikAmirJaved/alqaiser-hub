# apps/hr/services/assignment_service.py
from datetime import date
from django.db import transaction, models
from django.core.exceptions import ValidationError
from apps.hr.models import (
    Employee, Asset, AssetCategory, EmployeeAssetAssignment
)
import logging

logger = logging.getLogger(__name__)

class AssetAssignmentService:
    """Service for managing employee asset assignments with kit expansion"""
    
    @staticmethod
    @transaction.atomic
    def assign_assets_to_employee(
        employee_id: int,
        company_id: int,
        branch_id: int,
        asset_ids: list = None,
        kit_ids: list = None,
        assigned_date: date = None,
        condition: str = 'GOOD',
        notes: str = '',
        created_by=None
    ) -> dict:
        """
        Assign assets and kits to employee.
        Kits are expanded to individual assets automatically.
        Deduplication prevents double-assignment.
        """
        if not asset_ids and not kit_ids:
            raise ValidationError("Must provide asset_ids or kit_ids")
        
        employee = Employee.objects.select_for_update().get(
            id=employee_id, company_id=company_id, is_deleted=False
        )
        
        assigned_date = assigned_date or date.today()
        
        # Collect all asset IDs (from direct + kits)
        all_asset_ids = set(asset_ids or [])
        kit_asset_map = {}  # Track which assets came from which kit
        
        if kit_ids:
            kits = AssetCategory.objects.filter(
                id__in=kit_ids, company_id=company_id, is_deleted=False
            ).prefetch_related('assets')
            
            for kit in kits:
                kit_assets = kit.assets.filter(
                    is_deleted=False, 
                    is_active=True
                ).values_list('id', flat=True)
                
                for asset_id in kit_assets:
                    all_asset_ids.add(asset_id)
                    kit_asset_map[asset_id] = kit.id
        
        # Check existing active assignments to prevent duplicates
        existing_assignments = EmployeeAssetAssignment.objects.filter(
            employee=employee,
            asset_id__in=all_asset_ids,
            status='ACTIVE'
        ).values_list('asset_id', flat=True)
        
        # Filter out already-assigned assets
        new_asset_ids = all_asset_ids - set(existing_assignments)
        
        if not new_asset_ids:
            return {
                'assigned_count': 0,
                'already_assigned': len(existing_assignments),
                'message': 'All assets already assigned'
            }
        
        # Validate assets exist
        assets = Asset.objects.select_for_update().filter(
            id__in=new_asset_ids,
            company_id=company_id,
            is_deleted=False
        )
        
        # Create assignments
        assignments = []
        for asset in assets:
            source_type = 'KIT' if asset.id in kit_asset_map else 'DIRECT'
            source_kit_id = kit_asset_map.get(asset.id)
            
            assignments.append(EmployeeAssetAssignment(
                company_id=company_id,
                branch_id=branch_id,
                employee=employee,
                asset=asset,
                source_type=source_type,
                source_kit_id=source_kit_id,
                assigned_date=assigned_date,
                status='ACTIVE',
                condition_on_assignment=condition,
                notes=notes,
                created_by=created_by,
                updated_by=created_by,
            ))
            
        
        # Bulk create assignments
        EmployeeAssetAssignment.objects.bulk_create(assignments)
        
        return {
            'assigned_count': len(assignments),
            'already_assigned': len(existing_assignments),
            'message': f'Successfully assigned {len(assignments)} assets'
        }
    

    @staticmethod
    @transaction.atomic
    def return_assets(
        assignment_ids: list,
        company_id: int,
        returned_date: date = None,
        condition_on_return: str = 'GOOD',
        return_notes: str = '',
        updated_by=None
    ) -> dict:
        """Return assigned assets"""
        assignments = EmployeeAssetAssignment.objects.select_for_update().filter(
            id__in=assignment_ids,
            company_id=company_id,
            status='ACTIVE'
        ).select_related('asset')
        
        returned_date = returned_date or date.today()
        returned_count = 0
        
        for assignment in assignments:
            assignment.status = 'RETURNED'
            assignment.returned_date = returned_date
            assignment.condition_on_return = condition_on_return
            assignment.return_notes = return_notes
            assignment.updated_by = updated_by
            
            
            returned_count += 1
        
        EmployeeAssetAssignment.objects.bulk_update(
            assignments, 
            ['status', 'returned_date', 'condition_on_return', 'return_notes', 'updated_by']
        )
        
        return {
            'returned_count': returned_count,
            'message': f'Successfully returned {returned_count} assets'
        }
    
    @staticmethod
    def get_employee_assignments(employee_id: int, company_id: int) -> dict:
        """Get all assignments with kit context for an employee"""
        employee = Employee.objects.get(id=employee_id, company_id=company_id, is_deleted=False)
        
        # Active assignments with related data
        active_assignments = EmployeeAssetAssignment.objects.filter(
            employee=employee,
            status='ACTIVE'
        ).select_related('asset', 'source_kit').order_by('-assigned_date')
        
        # Assignment history
        history = EmployeeAssetAssignment.objects.filter(
            employee=employee
        ).exclude(status='ACTIVE').select_related('asset', 'source_kit').order_by('-returned_date', '-assigned_date')
        
        # Get distinct kits
        kit_ids = active_assignments.filter(
            source_type='KIT', source_kit__isnull=False
        ).values_list('source_kit_id', flat=True).distinct()
        
        kits = AssetCategory.objects.filter(
            id__in=kit_ids
        ).prefetch_related('assets') if kit_ids else []
        
        return {
            'employee_id': employee.id,
            'employee_name': employee.full_name,
            'active_assignments': [
                {
                    'id': str(a._id),
                    'asset': {
                        'id': str(a.asset._id),
                        'name': a.asset.name,
                        'brand': a.asset.brand,
                        'model': a.asset.model,
                        'serial_number': a.asset.serial_number,
                    },
                    'source_type': a.source_type,
                    'source_kit': {
                        'id': str(a.source_kit._id),
                        'name': a.source_kit.name,
                    } if a.source_kit else None,
                    'assigned_date': a.assigned_date.isoformat(),
                    'condition': a.condition_on_assignment,
                    'status': a.status,
                }
                for a in active_assignments
            ],
            'kits': [
                {
                    'id': str(kit._id),
                    'name': kit.name,
                    'assets': [
                        {'id': str(asset._id), 'name': asset.name}
                        for asset in kit.assets.filter(is_deleted=False)
                    ]
                }
                for kit in kits
            ],
            'history': [
                {
                    'id': str(h._id),
                    'asset_name': h.asset.name,
                    'assigned_date': h.assigned_date.isoformat(),
                    'returned_date': h.returned_date.isoformat() if h.returned_date else None,
                    'status': h.status,
                    'condition_on_return': h.condition_on_return,
                }
                for h in history[:50]  # Limit history
            ]
        }