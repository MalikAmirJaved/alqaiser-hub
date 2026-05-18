# ============================================================
# File: backend/apps/inventory/views/sales.py
# ============================================================
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import F
import uuid
from datetime import timedelta
from django.utils import timezone

from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import (
    StockItem, InventoryTransaction, StockReservation, ProductVariant, Warehouse
)
from apps.inventory.models.sales import (
    SalesOrder, SalesOrderLine,
    SalesShipment, SalesReturn
)
from apps.inventory.serializers.sales import (
    SalesOrderSerializer,
    SalesShipmentSerializer, SalesReturnSerializer,
)

class SalesOrderViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = SalesOrder.objects.all()
    serializer_class = SalesOrderSerializer
    lookup_field = '_id'  # Use UUID for lookups
    
    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__variant__product')
        
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
            
        customer_uuid = self.request.query_params.get('customer')
        if customer_uuid:
            from apps.inventory.models import Customer
            try:
                customer = Customer.objects.get(_id=customer_uuid, company_id=self.request.user.company_id)
                qs = qs.filter(customer_id=customer.id)
            except Customer.DoesNotExist:
                return qs.none()
        return qs

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'status': 'success',
            'message': f'Sales order {serializer.instance.order_number} created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, _id=None):  # Changed pk to _id
        """Confirm order: reserve stock for every line."""
        so = self.get_object()
        if so.status != 'DRAFT':
            return Response({'error': 'Only draft orders can be confirmed'}, status=400)
        
        user = request.user
        warehouse = so.warehouse
        reservation_type = 'SALES_ORDER'
        reserved_until = timezone.now() + timedelta(days=7)

        with transaction.atomic():
            for line in so.lines.filter(status='PENDING'):
                variant = line.variant
                qty = line.quantity_ordered
                
                # Lock stock item
                try:
                    stock_item = StockItem.objects.select_for_update().get(
                        variant=variant, warehouse=warehouse,
                        company_id=user.company_id
                    )
                except StockItem.DoesNotExist:
                    return Response(
                        {'error': f'No stock record found for {variant.sku}'},
                        status=400
                    )
                
                available = stock_item.quantity_on_hand - stock_item.quantity_reserved
                if available < qty:
                    return Response(
                        {'error': f'Insufficient stock for {variant.sku}. Available: {available}'},
                        status=400
                    )
                
                # Reserve
                StockReservation.objects.create(
                    variant=variant,
                    warehouse=warehouse,
                    quantity=qty,
                    reservation_type=reservation_type,
                    reference_id=so._id,
                    reference_line_id=line._id,
                    reserved_until=reserved_until,
                    status='ACTIVE',
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    created_by=user,
                    updated_by=user,
                )
                
                # Update stock reserved count
                stock_item.quantity_reserved = F('quantity_reserved') + qty
                stock_item.version = F('version') + 1
                stock_item.save(update_fields=['quantity_reserved', 'version'])

            so.status = 'CONFIRMED'
            so.save(update_fields=['status'])

        return Response({'status': 'success', 'message': 'Order confirmed and stock reserved'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, _id=None):
        """Cancel a draft or confirmed order."""
        so = self.get_object()
        if so.status not in ['DRAFT', 'CONFIRMED']:
            return Response({'error': 'Only draft or confirmed orders can be cancelled'}, status=400)
        
        with transaction.atomic():
            # Release reservations if any
            if so.status == 'CONFIRMED':
                reservations = StockReservation.objects.filter(
                    reference_id=so._id,
                    status='ACTIVE'
                )
                for reservation in reservations:
                    # Update stock reserved count
                    stock_item = StockItem.objects.select_for_update().get(
                        variant=reservation.variant,
                        warehouse=reservation.warehouse,
                        company_id=request.user.company_id
                    )
                    stock_item.quantity_reserved = F('quantity_reserved') - reservation.quantity
                    stock_item.version = F('version') + 1
                    stock_item.save(update_fields=['quantity_reserved', 'version'])
                    
                    # Cancel reservation
                    reservation.status = 'CANCELLED'
                    reservation.save(update_fields=['status'])
            
            # Update line statuses
            so.lines.update(status='CANCELLED')
            so.status = 'CANCELLED'
            so.save(update_fields=['status'])
        
        return Response({'status': 'success', 'message': 'Order cancelled'})


class SalesShipmentViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = SalesShipment.objects.all()
    serializer_class = SalesShipmentSerializer
    lookup_field = '_id'
    
    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related('sales_order').prefetch_related('lines__sales_order_line__variant__product')
        
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        
        sales_order_uuid = self.request.query_params.get('sales_order')
        if sales_order_uuid:
            try:
                sales_order = SalesOrder.objects.get(_id=sales_order_uuid, company_id=self.request.user.company_id)
                qs = qs.filter(sales_order_id=sales_order.id)
            except SalesOrder.DoesNotExist:
                return qs.none()
        
        return qs
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        shipment = serializer.save()

        # Process stock movements
        self._process_shipment(shipment, request.user)
        read_serializer = SalesShipmentSerializer(shipment, context={'request': request})
        return Response({
            'status': 'success',
            'message': f'Shipment {shipment.shipment_number} processed.',
            'data': read_serializer.data
        }, status=status.HTTP_201_CREATED)

    def _process_shipment(self, shipment, user):
        """Deduct stock, update reservations, create transactions."""
        sales_order = shipment.sales_order
        warehouse = sales_order.warehouse
        company_id = user.company_id

        for ship_line in shipment.lines.all():
            sol = ship_line.sales_order_line
            variant = sol.variant
            qty = ship_line.quantity_shipped

            # Lock stock item
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant, warehouse=warehouse, company_id=company_id
            )
            
            # Update reservation: find the active reservation for this line
            reservation = StockReservation.objects.filter(
                reference_id=sales_order._id,
                reference_line_id=sol._id,
                status='ACTIVE'
            ).select_for_update().first()
            
            if reservation:
                new_reserved_qty = reservation.quantity - qty
                reservation.quantity = max(new_reserved_qty, 0)
                if new_reserved_qty <= 0:
                    reservation.status = 'FULFILLED'
                reservation.save(update_fields=['quantity', 'status'])
            
            # Deduct actual stock
            before = stock_item.quantity_on_hand
            after = before - qty
            stock_item.quantity_on_hand = after
            stock_item.quantity_reserved = F('quantity_reserved') - qty
            stock_item.version = F('version') + 1
            stock_item.save(update_fields=['quantity_on_hand', 'quantity_reserved', 'version'])

            # Inventory transaction
            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=warehouse,
                company_id=company_id,
                branch_id=user.branch_id,
                quantity_change=-qty,
                quantity_before=before,
                quantity_after=after,
                unit_cost=variant.buying_price,
                transaction_type='SALE_SHIPMENT',
                source_document_type='SALES_ORDER',
                source_document_id=sales_order._id,
                source_line_id=sol._id,
                reason_text=f'Shipment {shipment.shipment_number}',
                created_by=user,
                updated_by=user,
            )

            # Update order line shipped qty and status
            sol.quantity_shipped = F('quantity_shipped') + qty
            sol.save(update_fields=['quantity_shipped'])
            sol.refresh_from_db()
            
            if sol.quantity_shipped >= sol.quantity_ordered:
                sol.status = 'SHIPPED'
            elif sol.quantity_shipped > 0:
                sol.status = 'PARTIALLY_SHIPPED'
            sol.save(update_fields=['status'])

        # Update sales order status
        all_lines = sales_order.lines.all()
        if all(l.status == 'SHIPPED' for l in all_lines):
            sales_order.status = 'SHIPPED'
        elif any(l.status in ['SHIPPED', 'PARTIALLY_SHIPPED'] for l in all_lines):
            sales_order.status = 'PARTIALLY_SHIPPED'
        sales_order.save(update_fields=['status'])


class SalesReturnViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = SalesReturn.objects.all()
    serializer_class = SalesReturnSerializer
    lookup_field = '_id'
    
    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related('sales_order', 'warehouse').prefetch_related('lines__sales_order_line__variant__product')
        
        status = self.request.query_params.get('status')
        if status:
            qs = qs.filter(status=status)
        
        sales_order_uuid = self.request.query_params.get('sales_order')
        if sales_order_uuid:
            try:
                sales_order = SalesOrder.objects.get(_id=sales_order_uuid, company_id=self.request.user.company_id)
                qs = qs.filter(sales_order_id=sales_order.id)
            except SalesOrder.DoesNotExist:
                return qs.none()
        
        return qs
    
    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ret = serializer.save()

        self._process_return(ret, request.user)
        read_serializer = SalesReturnSerializer(ret, context={'request': request})
        return Response({
            'status': 'success',
            'message': f'Return {ret.return_number} processed.',
            'data': read_serializer.data
        }, status=status.HTTP_201_CREATED)

    def _process_return(self, ret, user):
        """Restock if applicable, create RETURN_IN transaction."""
        warehouse = ret.warehouse
        company_id = user.company_id

        for ret_line in ret.lines.all():
            sol = ret_line.sales_order_line
            variant = sol.variant
            qty = ret_line.quantity_returned

            if ret_line.restock:
                stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                    variant=variant, warehouse=warehouse,
                    company_id=company_id,
                    branch_id=user.branch_id,
                    defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
                )
                before = stock_item.quantity_on_hand
                after = before + qty
                stock_item.quantity_on_hand = after
                stock_item.version = F('version') + 1
                stock_item.save(update_fields=['quantity_on_hand', 'version'])

                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=warehouse,
                    company_id=company_id,
                    branch_id=user.branch_id,
                    quantity_change=qty,
                    quantity_before=before,
                    quantity_after=after,
                    unit_cost=ret_line.unit_cost,
                    transaction_type='RETURN_IN',
                    source_document_type='SALES_RETURN',
                    source_document_id=ret._id,
                    source_line_id=sol._id,
                    reason_text=f'Return {ret.return_number}',
                    created_by=user,
                    updated_by=user,
                )