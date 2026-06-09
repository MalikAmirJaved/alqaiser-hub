# apps/hr/services/assignment_service.py
from datetime import date
from django.db import transaction, models
from django.core.exceptions import ValidationError
from apps.hr.models import (
    Employee, Asset, AssetCategory, EmployeeAssetAssignment
)
from apps.inventory.models import (GoodsReceipt, GoodsReceiptLine)
import logging
import time
import random
from django.db import transaction
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


def create_or_update_asset_from_receipt_line(
    line: GoodsReceiptLine, 
    goods_receipt: GoodsReceipt, 
    user
) -> Asset:
    """
    Create or update an HR Asset based on a goods receipt line.
    Handles both cases: when the purchase order line already has an asset,
    or when it has a product variant (legacy).
    """
    from apps.hr.models import Asset
    
    po_line = line.purchase_order_line
    po = goods_receipt.purchase_order
    supplier = po.supplier
    
    # If the PO line already has an asset reference, update it directly
    if po_line.asset:
        asset = po_line.asset
        # Update quantity and purchase info
        asset.total_quantity = (asset.total_quantity or 0) + line.quantity_received
        asset.available_quantity = (asset.available_quantity or 0) + line.quantity_received
        asset.purchase_date = goods_receipt.received_date.date()
        asset.purchase_price = line.unit_cost
        asset.vendor = supplier.name
        asset.save(update_fields=[
            'total_quantity', 'available_quantity', 
            'purchase_date', 'purchase_price', 'vendor'
        ])
        return asset
    
    # Otherwise, create asset from variant (existing logic)
    variant = po_line.variant
    if not variant:
        raise ValueError("Purchase order line has neither asset nor variant")
    
    product = variant.product
    
    # Determine category based on product category or variant type
    category = product.category or "Office Equipment"
    
    # Use variant SKU as serial number if not provided
    serial_number = variant.sku
    
    asset, created = Asset.objects.get_or_create(
        company_id=po.company_id,
        branch_id=po.branch_id,
        name=product.product_name,
        brand=product.brand or "",
        model=variant.sku,
        defaults={
            'serial_number': serial_number,
            'description': product.description or "",
            'category': category,
            'purchase_date': goods_receipt.received_date.date(),
            'purchase_price': line.unit_cost,
            'vendor': supplier.name,
            'total_quantity': line.quantity_received,
            'available_quantity': line.quantity_received,
            'is_active': True,
            'is_assigned': False,
            'created_by': user,
            'updated_by': user,
        }
    )
    
    if not created:
        # Update existing asset
        asset.total_quantity = (asset.total_quantity or 0) + line.quantity_received
        asset.available_quantity = (asset.available_quantity or 0) + line.quantity_received
        asset.purchase_date = goods_receipt.received_date.date()
        asset.purchase_price = line.unit_cost
        asset.vendor = supplier.name
        asset.save(update_fields=[
            'total_quantity', 'available_quantity', 
            'purchase_date', 'purchase_price', 'vendor'
        ])
    
    return asset


def create_expense_from_receipt_line(
    line: "GoodsReceiptLine",
    goods_receipt: "GoodsReceipt",
    user,
    supplier_bill=None       # <-- critical parameter
) -> None:
    """
    Create an expense record for an office inventory receipt.
    If supplier_bill is provided, the expense will be linked to it.
    """
    from apps.finance.models import Expense

    po_line = line.purchase_order_line
    po = goods_receipt.purchase_order
    supplier = po.supplier

    if po_line.asset:
        asset = po_line.asset
        description = f"Purchase of asset: {asset.name} (SN: {asset.serial_number or 'N/A'}) from {supplier.name}"
        category = "OFFICE_SUPPLIES"
    elif po_line.variant:
        variant = po_line.variant
        product = variant.product
        description = f"Purchase of {product.product_name} (SKU: {variant.sku}) from {supplier.name}"
        category = "OFFICE_SUPPLIES"
    else:
        raise ValueError("Purchase order line has no asset or variant")

    total_amount = line.quantity_received * line.unit_cost
    expense_number = f"EXP-{int(time.time())}-{random.randint(1000, 9999)}"
    notes = f"Goods Receipt: {goods_receipt.receipt_number}\nVendor: {supplier.name}"

    expense = Expense.objects.create(
        expense_number=expense_number,
        company_id=po.company_id,
        branch_id=po.branch_id,
        expense_date=goods_receipt.received_date.date(),
        amount=total_amount,
        category=category,
        description=description,
        notes=notes,
        supplier_bill=supplier_bill,    # ✅ FK is set here
        created_by=user,
        updated_by=user,
    )
    return expense
