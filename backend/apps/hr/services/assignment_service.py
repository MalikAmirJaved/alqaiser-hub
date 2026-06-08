# apps/hr/services/assignment_service.py
from datetime import date
from django.db import transaction, models
from django.core.exceptions import ValidationError
from apps.hr.models import (
    Employee, Asset, AssetCategory, EmployeeAssetAssignment
)
import logging
from apps.finance.models import Expense
logger = logging.getLogger(__name__)

class AssetAssignmentService:
    """Service for managing employee asset assignments with kit expansion"""
    
    @staticmethod
    @transaction.atomic
    def assign_assets_to_employee(
        employee_id: int,
        company_id: int,
        branch_id: int,
        assets: list = None,   # each element: {'asset_id': int, 'quantity': int}
        kit_ids: list = None,
        assigned_date: date = None,
        condition: str = 'GOOD',
        notes: str = '',
        created_by=None
    ) -> dict:
        """
        assets: list of dicts with keys 'asset_id' (int) and 'quantity' (int)
        kit_ids: list of kit UUIDs (each kit expands to its assets with quantity 1 per asset)
        """
        if not assets and not kit_ids:
            raise ValidationError("Must provide assets or kit_ids")

        employee = Employee.objects.select_for_update().get(
            id=employee_id, company_id=company_id, is_deleted=False
        )
        assigned_date = assigned_date or date.today()

        # Build a map of asset_id -> requested quantity
        asset_quantity_map = {}

        # Process direct assets
        if assets:
            for item in assets:
                asset_id = item['asset_id']
                qty = item.get('quantity', 1)
                if qty <= 0:
                    continue
                asset_quantity_map[asset_id] = asset_quantity_map.get(asset_id, 0) + qty

        # Process kits
        if kit_ids:
            kits = AssetCategory.objects.filter(
                id__in=kit_ids, company_id=company_id, is_deleted=False
            ).prefetch_related('assets')
            for kit in kits:
                for asset in kit.assets.filter(is_deleted=False, is_active=True):
                    asset_quantity_map[asset.id] = asset_quantity_map.get(asset.id, 0) + 1

        if not asset_quantity_map:
            return {'assigned_count': 0, 'already_assigned': 0, 'message': 'No valid assets to assign'}

        # Fetch assets with lock
        asset_ids = list(asset_quantity_map.keys())
        assets_qs = Asset.objects.select_for_update().filter(
            id__in=asset_ids, company_id=company_id, is_deleted=False
        )

        assignments = []
        total_assigned = 0
        already_assigned_count = 0

        for asset in assets_qs:
            requested = asset_quantity_map[asset.id]
            if asset.available_quantity < requested:
                raise ValidationError(
                    f"Asset '{asset.name}' has only {asset.available_quantity} available, but {requested} requested"
                )
            # Check existing active assignments for this employee+asset (sum quantities)
            existing_assigned_qty = EmployeeAssetAssignment.objects.filter(
                employee=employee,
                asset=asset,
                status='ACTIVE'
            ).aggregate(total=models.Sum('quantity'))['total'] or 0

            if existing_assigned_qty >= requested:
                already_assigned_count += requested
                continue

            # Quantity still available to assign
            to_assign = min(requested, asset.available_quantity - existing_assigned_qty)
            if to_assign <= 0:
                continue

            # Create a single assignment for this asset with the assigned quantity
            assignment = EmployeeAssetAssignment(
                company_id=company_id,
                branch_id=branch_id,
                employee=employee,
                asset=asset,
                quantity=to_assign,
                source_type='DIRECT' if not kit_ids else 'KIT',  # simplified, could track per asset
                source_kit=None,  # would need per-assoc kit tracking if needed
                assigned_date=assigned_date,
                status='ACTIVE',
                condition_on_assignment=condition,
                notes=notes,
                created_by=created_by,
                updated_by=created_by,
            )
            assignments.append(assignment)

            # Decrement asset's available quantity
            asset.available_quantity -= to_assign
            asset.is_assigned = asset.available_quantity == 0  # if no more available
            asset.save(update_fields=['available_quantity', 'is_assigned'])

            total_assigned += to_assign

        if assignments:
            EmployeeAssetAssignment.objects.bulk_create(assignments)

        return {
            'assigned_count': total_assigned,
            'already_assigned': already_assigned_count,
            'message': f'Successfully assigned {total_assigned} units'
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
        """Return assigned assets (full return of the entire assignment quantity)"""
        assignments = EmployeeAssetAssignment.objects.select_for_update().filter(
            id__in=assignment_ids,
            company_id=company_id,
            status='ACTIVE'
        ).select_related('asset')

        returned_date = returned_date or date.today()
        returned_count = 0

        for assignment in assignments:
            # Restore available quantity on the asset
            asset = assignment.asset
            asset.available_quantity += assignment.quantity
            asset.is_assigned = asset.available_quantity > 0
            asset.save(update_fields=['available_quantity', 'is_assigned'])

            assignment.status = 'RETURNED'
            assignment.returned_date = returned_date
            assignment.condition_on_return = condition_on_return
            assignment.return_notes = return_notes
            assignment.updated_by = updated_by
            returned_count += assignment.quantity

        EmployeeAssetAssignment.objects.bulk_update(
            assignments,
            ['status', 'returned_date', 'condition_on_return', 'return_notes', 'updated_by']
        )

        return {
            'returned_count': returned_count,
            'message': f'Successfully returned {returned_count} units'
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
                    'quantity': a.quantity,
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


def create_or_update_asset_from_receipt_line(line, receipt, user):
    """
    line: GoodsReceiptLine instance
    receipt: GoodsReceipt instance
    user: User
    Returns Asset instance
    """
    variant = line.purchase_order_line.variant
    product = variant.product
    supplier = receipt.purchase_order.supplier
    qty = line.quantity_received
    unit_cost = line.unit_cost

    # Find existing asset with same name/brand/model/vendor
    asset, created = Asset.objects.select_for_update().get_or_create(
        company_id=receipt.company_id,
        branch_id=receipt.branch_id,
        name=product.product_name,
        brand=product.brand.name if product.brand else '',
        model=variant.sku,
        vendor=supplier.name,
        defaults={
            'description': product.description,
            'purchase_date': receipt.received_date.date(),
            'purchase_price': unit_cost,
            'total_quantity': qty,
            'available_quantity': qty,
            'is_assigned': False,
            'is_active': True,
            'created_by': user,
            'updated_by': user,
        }
    )
    if not created:
        # Update quantity and purchase price if needed (average cost optional)
        asset.total_quantity += qty
        asset.available_quantity += qty
        # Optionally recalculate average purchase price
        total_cost = (asset.total_quantity - qty) * asset.purchase_price + qty * unit_cost
        asset.purchase_price = total_cost / asset.total_quantity
        asset.updated_by = user
        asset.save(update_fields=['total_quantity', 'available_quantity', 'purchase_price', 'updated_by'])

    return asset


def create_expense_from_receipt_line(line, receipt, user):
    """
    Creates an Expense record for office inventory items.
    """
    variant = line.purchase_order_line.variant
    product = variant.product
    qty = line.quantity_received
    unit_cost = line.unit_cost
    total_amount = qty * unit_cost

    expense = Expense.objects.create(
        company_id=receipt.company_id,
        branch_id=receipt.branch_id,
        expense_number=f"EXP-{receipt.receipt_number}-{variant.sku[:6]}",
        category='OFFICE_SUPPLIES',  # or a new category 'OFFICE_INVENTORY'
        expense_date=receipt.received_date.date(),
        amount=total_amount,
        description=f"Purchase of {product.product_name} (Qty: {qty}) from {receipt.purchase_order.supplier.name}",
        notes=f"Goods Receipt: {receipt.receipt_number}, PO: {receipt.purchase_order.order_number}",
        created_by=user,
        updated_by=user,
    )
    return expense
