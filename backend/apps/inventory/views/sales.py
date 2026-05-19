# ============================================================
# File: backend/apps/inventory/views/sales.py
# ============================================================
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from datetime import timedelta
import uuid

from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import (
    StockItem, InventoryTransaction, StockReservation, ProductVariant
)
from apps.inventory.models.sales import (
    SalesOrder, SalesOrderLine, SalesReturn, SalesReturnLine
)
from apps.inventory.serializers.sales import (
    SalesOrderSerializer, SalesReturnSerializer
)


class SalesOrderViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = SalesOrder.objects.all()
    serializer_class = SalesOrderSerializer
    lookup_field = '_id'

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
        
        status_val = serializer.validated_data.get('status', 'PENDING')
        
        if status_val == 'COMPLETE':
            # Complete order: deduct stock directly, no reservation
            order = self._create_complete_order(serializer, request.user)
        elif status_val == 'DRAFT':
            # Draft order: create reservations
            order = serializer.save()
            self._create_reservations(order, request.user)
        else:
            # PENDING or any other: just create order, no stock impact
            order = serializer.save()
        
        return Response({
            'status': 'success',
            'message': f'Sales order {order.order_number} created.',
            'data': SalesOrderSerializer(order, context={'request': request}).data
        }, status=status.HTTP_201_CREATED)

    def _create_complete_order(self, serializer, user):
        """Create an order with status=COMPLETE and deduct stock immediately."""
        validated_data = serializer.validated_data
        line_items_data = validated_data.pop('line_items', [])
        company_id = user.company_id
        branch_id = user.branch_id

        if 'order_number' not in validated_data:
            validated_data['order_number'] = self._generate_order_number()

        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        validated_data['status'] = 'COMPLETE'

        order = SalesOrder.objects.create(**validated_data)
        total_amount = 0

        for item in line_items_data:
            variant_uuid = item.get('variant')
            variant = ProductVariant.objects.get(_id=variant_uuid, company_id=company_id)
            qty = item['quantity_ordered']
            unit_price = item['unit_price']
            line_total = qty * unit_price
            total_amount += line_total

            order_line = SalesOrderLine.objects.create(
                sales_order=order,
                variant=variant,
                quantity_ordered=qty,
                unit_price=unit_price,
                tax_rate=item.get('tax_rate', 0),
                status='COMPLETE',
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )

            # Deduct stock
            self._deduct_stock(order, order_line, variant, qty, user)

        order.total_amount = total_amount
        order.save(update_fields=['total_amount'])
        return order

    def _deduct_stock(self, order, order_line, variant, qty, user):
        warehouse = order.warehouse
        company_id = user.company_id

        with transaction.atomic():
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant, warehouse=warehouse, company_id=company_id
            )
            available = stock_item.quantity_on_hand - stock_item.quantity_reserved
            if available < qty:
                raise Exception(f'Insufficient stock for {variant.sku}')

            before = stock_item.quantity_on_hand
            after = before - qty
            stock_item.quantity_on_hand = after
            stock_item.version = F('version') + 1
            stock_item.save(update_fields=['quantity_on_hand', 'version'])

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
                transaction_type='SALE',
                source_document_type='SALES_ORDER',
                source_document_id=order._id,
                source_line_id=order_line._id,
                reason_text=f'Sale completed - {order.order_number}',
                created_by=user,
                updated_by=user,
            )

    def _create_reservations(self, order, user):
        for line in order.lines.all():
            variant = line.variant
            warehouse = order.warehouse
            qty = line.quantity_ordered

            stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                variant=variant,
                warehouse=warehouse,
                company_id=order.company_id,
                branch_id=order.branch_id,
                defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
            )
            stock_item.quantity_reserved += qty
            stock_item.save(update_fields=['quantity_reserved'])

            StockReservation.objects.create(
                variant=variant,
                warehouse=warehouse,
                quantity=qty,
                reservation_type='SALES_ORDER',
                reference_id=order._id,
                reference_line_id=line._id,
                reserved_until=timezone.now() + timedelta(days=7),
                status='ACTIVE',
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=user,
                updated_by=user,
            )

    @action(detail=True, methods=['post'])
    def complete(self, request, _id=None):
        """Convert a DRAFT order to COMPLETE: consume reservations and deduct stock."""
        order = self.get_object()
        if order.status != 'DRAFT':
            return Response({'error': 'Only draft orders can be completed'}, status=400)

        user = request.user
        warehouse = order.warehouse
        company_id = user.company_id

        with transaction.atomic():
            reservations = StockReservation.objects.filter(
                reference_id=order._id,
                status='ACTIVE'
            ).select_related('variant').select_for_update()

            if not reservations.exists():
                return Response({'error': 'No active reservations found'}, status=400)

            for reservation in reservations:
                variant = reservation.variant
                qty = reservation.quantity

                stock_item = StockItem.objects.select_for_update().get(
                    variant=variant, warehouse=warehouse, company_id=company_id
                )
                available = stock_item.quantity_on_hand - stock_item.quantity_reserved
                if available < qty:
                    return Response(
                        {'error': f'Insufficient stock for {variant.sku}'},
                        status=400
                    )

                before = stock_item.quantity_on_hand
                after = before - qty
                stock_item.quantity_on_hand = after
                stock_item.quantity_reserved = F('quantity_reserved') - qty
                stock_item.version = F('version') + 1
                stock_item.save(update_fields=['quantity_on_hand', 'quantity_reserved', 'version'])

                order_line = order.lines.filter(variant=variant).first()
                if order_line:
                    order_line.status = 'COMPLETE'
                    order_line.save(update_fields=['status'])

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
                    transaction_type='SALE',
                    source_document_type='SALES_ORDER',
                    source_document_id=order._id,
                    source_line_id=order_line._id if order_line else None,
                    reason_text=f'Order completed – {order.order_number}',
                    created_by=user,
                    updated_by=user,
                )

                reservation.status = 'FULFILLED'
                reservation.save(update_fields=['status'])

            order.status = 'COMPLETE'
            order.save(update_fields=['status'])

        return Response({'status': 'success', 'message': 'Order completed, stock deducted'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, _id=None):
        order = self.get_object()
        if order.status not in ['PENDING', 'DRAFT']:
            return Response({'error': 'Only PENDING or DRAFT orders can be cancelled'}, status=400)

        with transaction.atomic():
            if order.status == 'DRAFT':
                reservations = StockReservation.objects.filter(
                    reference_id=order._id,
                    status='ACTIVE'
                ).select_for_update()
                for reservation in reservations:
                    stock_item = StockItem.objects.select_for_update().get(
                        variant=reservation.variant,
                        warehouse=reservation.warehouse,
                        company_id=request.user.company_id
                    )
                    stock_item.quantity_reserved = F('quantity_reserved') - reservation.quantity
                    stock_item.version = F('version') + 1
                    stock_item.save(update_fields=['quantity_reserved', 'version'])
                    reservation.status = 'CANCELLED'
                    reservation.save(update_fields=['status'])

            order.lines.update(status='CANCELLED')
            order.status = 'CANCELLED'
            order.save(update_fields=['status'])

        return Response({'status': 'success', 'message': 'Order cancelled'})

    def _generate_order_number(self):
        import time, random
        return f"SO-{int(time.time())}-{random.randint(1000, 9999)}"


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