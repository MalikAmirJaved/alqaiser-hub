# ============================================================
# 5. Purchase Views
# ============================================================
# Create file: backend/apps/inventory/views/purchase.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import F
import uuid
from decimal import Decimal

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    PurchaseOrder, PurchaseOrderLine, GoodsReceipt, GoodsReceiptLine,
    StockItem, InventoryTransaction, ProductVariant
)

from apps.inventory.serializers.purchase import (
    PurchaseOrderSerializer,
    GoodsReceiptSerializer,
)
from apps.finance.models import SupplierBill
from apps.hr.services.assignment_service import create_or_update_asset_from_receipt_line, create_expense_from_receipt_line
import logging
logger = logging.getLogger(__name__)

class PurchaseOrderViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'purchase_order'
    queryset = PurchaseOrder.objects.all()
    serializer_class = PurchaseOrderSerializer
    lookup_field = '_id'
    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__variant__product')
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        supplier = self.request.query_params.get('supplier')
        if supplier:
            qs = qs.filter(supplier_id=supplier)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'status': 'success',
            'message': f'Purchase order {serializer.instance.order_number} created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, _id=None):   
        po = self.get_object()
        if po.status != 'DRAFT':
            return Response({'error': 'Only draft orders can be confirmed'}, status=400)
        po.status = 'CONFIRMED'
        po.save()
        return Response({'status': 'success', 'message': 'Order confirmed'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, _id=None):   
        po = self.get_object()
        if po.status in ['DRAFT', 'CONFIRMED']:
            po.status = 'CANCELLED'
            po.lines.update(status='CANCELLED')
            po.save()
            return Response({'status': 'success', 'message': 'Order cancelled'})
        return Response({'error': 'Cannot cancel this order'}, status=400)

class GoodsReceiptViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'purchase_order'
    queryset = GoodsReceipt.objects.all()
    serializer_class = GoodsReceiptSerializer
    lookup_field = '_id'
    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__purchase_order_line__variant__product')
        
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        
        supplier_uuid = self.request.query_params.get('supplier')
        if supplier_uuid:
            # Resolve UUID to integer ID
            from apps.inventory.models import Supplier
            try:
                supplier = Supplier.objects.get(_id=supplier_uuid, company_id=self.request.user.company_id)
                qs = qs.filter(supplier_id=supplier.id)
            except Supplier.DoesNotExist:
                return qs.none()
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        gr = serializer.save()

        # Update stock and PO lines
        self._process_receipt(gr, request.user)

        # Re-fetch with nested data
        read_serializer = GoodsReceiptSerializer(gr, context={'request': request})
        return Response({
            'status': 'success',
            'message': f'Goods receipt {gr.receipt_number} processed.',
            'data': read_serializer.data
        }, status=status.HTTP_201_CREATED)
    
    
    def _process_receipt(self, goods_receipt, user):
        """
        Process a goods receipt:
        - Update stock (for FOR_SALE) or HR assets (for OFFICE_INVENTORY)
        - Create a supplier bill for the total received amount
        - Create expenses for OFFICE_INVENTORY lines linked to that bill
        """
        po = goods_receipt.purchase_order
        inventory_type = po.inventory_type

        # Stores receipt lines for OFFICE_INVENTORY (to create expenses after the bill is created)
        office_lines = []
        total_bill_amount = Decimal('0.00')

        # ============ FIRST PASS: Process all lines and accumulate bill amount ============
        for line in goods_receipt.lines.filter(accepted=True):
            po_line = line.purchase_order_line
            qty = line.quantity_received
            unit_cost = line.unit_cost
            total_line = Decimal(qty) * Decimal(unit_cost)

            if inventory_type == 'FOR_SALE':
                # --- Stock update for FOR_SALE items ---
                variant = po_line.variant
                warehouse = po.warehouse
                stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                    variant=variant,
                    warehouse=warehouse,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
                )
                before = stock_item.quantity_on_hand
                after = before + qty
                stock_item.quantity_on_hand = after
                stock_item.version += 1
                stock_item.save(update_fields=['quantity_on_hand', 'version'])

                po_line.quantity_received += qty
                po_line.save(update_fields=['quantity_received'])

                if po_line.quantity_received >= po_line.quantity_ordered:
                    po_line.status = 'FULLY_RECEIVED'
                elif po_line.quantity_received > 0:
                    po_line.status = 'PARTIALLY_RECEIVED'
                po_line.save(update_fields=['status'])

                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=warehouse,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    quantity_change=qty,
                    quantity_before=before,
                    quantity_after=after,
                    unit_cost=unit_cost,
                    transaction_type='PURCHASE_RECEIPT',
                    source_document_type='PURCHASE_ORDER',
                    source_document_id=po._id,
                    source_line_id=po_line._id,
                    reason_text=f'Goods receipt {goods_receipt.receipt_number}',
                    created_by=user,
                    updated_by=user,
                )

                total_bill_amount += total_line

            else:  # OFFICE_INVENTORY
                # --- HR Asset update (create or update) ---
                if po_line.asset:
                    asset = po_line.asset
                    asset.total_quantity = (asset.total_quantity or 0) + qty
                    asset.available_quantity = (asset.available_quantity or 0) + qty
                    asset.purchase_date = goods_receipt.received_date.date()
                    asset.purchase_price = unit_cost
                    asset.vendor = po.supplier.name
                    asset.save(update_fields=[
                        'total_quantity', 'available_quantity',
                        'purchase_date', 'purchase_price', 'vendor'
                    ])
                else:
                    # Legacy fallback: create from variant
                    asset = create_or_update_asset_from_receipt_line(line, goods_receipt, user)

                # --- Update purchase order line quantities and status ---
                po_line.quantity_received += qty
                po_line.save(update_fields=['quantity_received'])

                if po_line.quantity_received >= po_line.quantity_ordered:
                    po_line.status = 'FULLY_RECEIVED'
                elif po_line.quantity_received > 0:
                    po_line.status = 'PARTIALLY_RECEIVED'
                po_line.save(update_fields=['status'])

                # --- Store the line for expense creation after the bill is created ---
                office_lines.append(line)
                total_bill_amount += total_line

        # ============ UPDATE PURCHASE ORDER STATUS ============
        po.refresh_from_db()
        all_lines = po.lines.all()
        if all(l.status == 'FULLY_RECEIVED' for l in all_lines):
            po.status = 'FULLY_RECEIVED'
        elif any(l.status in ['FULLY_RECEIVED', 'PARTIALLY_RECEIVED'] for l in all_lines):
            po.status = 'PARTIALLY_RECEIVED'
        po.save(update_fields=['status'])

        # ============ CREATE THE SUPPLIER BILL (for the total amount) ============
        supplier_bill = None
        if total_bill_amount > 0:
            supplier_bill = SupplierBill.objects.create(
                bill_number=f"BILL-{goods_receipt.receipt_number}",
                supplier=po.supplier,
                purchase_order=po,
                bill_date=goods_receipt.received_date.date(),
                due_date=po.expected_delivery_date or goods_receipt.received_date.date(),
                amount=total_bill_amount,
                status='DRAFT',
                company_id=po.company_id,
                branch_id=po.branch_id,
                created_by=user,
                updated_by=user
            )
            logger.info(f"Created supplier bill {supplier_bill.bill_number} (ID: {supplier_bill._id}) for amount {total_bill_amount}")

        # ============ SECOND PASS: Create expenses for OFFICE_INVENTORY lines (linked to the bill) ============
        for line in office_lines:
            if not supplier_bill:
                # This should never happen because total_bill_amount > 0 implies supplier_bill exists
                logger.error(f"No supplier bill available for goods receipt {goods_receipt.receipt_number} despite total amount > 0")
                continue

            expense = create_expense_from_receipt_line(
                line, goods_receipt, user,
                supplier_bill=supplier_bill   # Link the expense to the bill
            )
            logger.info(f"Created expense {expense.expense_number} linked to bill {supplier_bill.bill_number}")