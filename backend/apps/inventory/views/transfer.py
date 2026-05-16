from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone
import uuid

from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import StockTransfer, StockItem, InventoryTransaction, ProductVariant, Warehouse
from apps.inventory.serializers.transfer import StockTransferSerializer, StockTransferCreateSerializer


class StockTransferViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = StockTransfer.objects.all()
    serializer_class = StockTransferSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'

    def get_serializer_class(self):
        if self.action == 'create':
            return StockTransferCreateSerializer
        return StockTransferSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        variant_uuid = self.request.query_params.get('variant_id')
        if variant_uuid:
            try:
                variant = ProductVariant.objects.get(_id=variant_uuid, company_id=user.company_id)
                qs = qs.filter(variant=variant)
            except ProductVariant.DoesNotExist:
                qs = qs.none()

        src_uuid = self.request.query_params.get('source_warehouse')
        if src_uuid:
            try:
                src = Warehouse.objects.get(_id=src_uuid, company_id=user.company_id)
                qs = qs.filter(source_warehouse=src)
            except Warehouse.DoesNotExist:
                qs = qs.none()

        dst_uuid = self.request.query_params.get('destination_warehouse')
        if dst_uuid:
            try:
                dst = Warehouse.objects.get(_id=dst_uuid, company_id=user.company_id)
                qs = qs.filter(destination_warehouse=dst)
            except Warehouse.DoesNotExist:
                qs = qs.none()

        return qs.order_by('-created_at')

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        user = request.user
        variant = data['variant_id']
        source_wh = data['source_warehouse_id']
        dest_wh = data['destination_warehouse_id']
        quantity = data['quantity']
        planned_date = data.get('planned_date')
        notes = data.get('notes', '')

        transfer_number = self._generate_transfer_number()

        transfer = StockTransfer.objects.create(
            transfer_number=transfer_number,
            variant=variant,
            source_warehouse=source_wh,
            destination_warehouse=dest_wh,
            quantity=quantity,
            status='PENDING',
            planned_date=planned_date,
            notes=notes,
            company_id=user.company_id,
            branch_id=user.branch_id,
            created_by=user,
            updated_by=user,
        )

        serializer_out = StockTransferSerializer(transfer, context={'request': request})
        return Response({
            'status': 'success',
            'message': f'Stock transfer {transfer_number} created.',
            'data': serializer_out.data
        }, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['post'])
    def confirm(self, request, pk=None):
        transfer = self.get_object()
        user = request.user

        if transfer.status != 'PENDING':
            return Response(
                {'error': f'Cannot confirm transfer with status {transfer.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            try:
                source_stock = StockItem.objects.select_for_update().get(
                    variant=transfer.variant,
                    warehouse=transfer.source_warehouse,
                    company_id=user.company_id
                )
                available = source_stock.quantity_on_hand - source_stock.quantity_reserved
                if available < transfer.quantity:
                    return Response(
                        {'error': f'Insufficient stock at source. Available: {available}'},
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except StockItem.DoesNotExist:
                return Response({'error': 'Source stock not found'}, status=400)

            dest_stock, _ = StockItem.objects.select_for_update().get_or_create(
                variant=transfer.variant,
                warehouse=transfer.destination_warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
            )

            before_src = source_stock.quantity_on_hand
            source_stock.quantity_on_hand -= transfer.quantity
            source_stock.version += 1
            source_stock.save()

            before_dst = dest_stock.quantity_on_hand
            dest_stock.quantity_on_hand += transfer.quantity
            dest_stock.version += 1
            dest_stock.save()

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=transfer.variant,
                warehouse=transfer.source_warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                quantity_change=-transfer.quantity,
                quantity_before=before_src,
                quantity_after=source_stock.quantity_on_hand,
                unit_cost=transfer.variant.buying_price,
                transaction_type='TRANSFER_OUT',
                source_document_type='TRANSFER',
                source_document_id=transfer.id,
                reason_text=f"Transfer to {transfer.destination_warehouse.warehouse_name}",
                created_by=user,
                updated_by=user,
            )

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=transfer.variant,
                warehouse=transfer.destination_warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                quantity_change=transfer.quantity,
                quantity_before=before_dst,
                quantity_after=dest_stock.quantity_on_hand,
                unit_cost=transfer.variant.buying_price,
                transaction_type='TRANSFER_IN',
                source_document_type='TRANSFER',
                source_document_id=transfer.id,
                reason_text=f"Transfer from {transfer.source_warehouse.warehouse_name}",
                created_by=user,
                updated_by=user,
            )

            transfer.status = 'COMPLETED'
            transfer.completed_at = timezone.now()
            transfer.save()

        return Response({
            'status': 'success',
            'message': f'Transfer {transfer.transfer_number} completed.',
            'data': StockTransferSerializer(transfer).data
        })

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        transfer = self.get_object()
        if transfer.status != 'PENDING':
            return Response(
                {'error': f'Cannot cancel transfer with status {transfer.status}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        transfer.status = 'CANCELLED'
        transfer.save()
        return Response({
            'status': 'success',
            'message': f'Transfer {transfer.transfer_number} cancelled.'
        })

    def _generate_transfer_number(self):
        import time
        import random
        return f"TRF-{int(time.time())}-{random.randint(100, 999)}"