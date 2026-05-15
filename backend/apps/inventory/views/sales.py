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
    Customer, SalesOrder, SalesOrderLine,
    SalesShipment, SalesReturn
)
from apps.inventory.serializers.sales import (
    CustomerSerializer, SalesOrderSerializer,
    SalesShipmentSerializer, SalesReturnSerializer,
)


class CustomerViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(email__icontains=search)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            created_by=request.user,
            updated_by=request.user,
        )
        return Response({
            'status': 'success',
            'message': f'Customer "{serializer.instance.name}" created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'Customer "{serializer.instance.name}" updated.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        self.perform_destroy(instance)
        return Response({
            'status': 'success',
            'message': f'Customer "{name}" deleted.'
        })


class SalesOrderViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = SalesOrder.objects.all()
    serializer_class = SalesOrderSerializer

    def get_queryset(self):
        qs = super().get_queryset().prefetch_related('lines__variant__product')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        customer = self.request.query_params.get('customer')
        if customer:
            qs = qs.filter(customer_id=customer)
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
    def confirm(self, request, pk=None):
        """Confirm order: reserve stock for every line."""
        so = self.get_object()
        if so.status != 'DRAFT':
            return Response({'error': 'Only draft orders can be confirmed'}, status=400)
        user = request.user
        warehouse = so.warehouse
        reservation_type = 'SALES_ORDER'
        reserved_until = timezone.now() + timedelta(days=7)  # example: 7-day reservation

        with transaction.atomic():
            for line in so.lines.filter(status='PENDING'):
                variant = line.variant
                qty = line.quantity_ordered
                # Lock stock item
                stock_item = StockItem.objects.select_for_update().get(
                    variant=variant, warehouse=warehouse,
                    company_id=user.company_id
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


class SalesShipmentViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = SalesShipment.objects.all()
    serializer_class = SalesShipmentSerializer

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
                unit_cost=variant.buying_price,  # or sol.unit_price if desired
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
            # Optionally, reverse the shipment effect on the sales order line (not decreasing shipped qty usually)