from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import F, Sum
from django.core.paginator import Paginator
import uuid

from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import StockItem, InventoryTransaction
from apps.inventory.serializers.stock_management import (
    StockAdjustmentSerializer,
    StockHistoryFilterSerializer,
    StockItemSerializer,
    InventoryTransactionSerializer
)


class StockManagementViewSet(CompanyBranchMixin, viewsets.GenericViewSet):
    queryset = StockItem.objects.all()   # ✅ REQUIRED FOR DRF + MIXIN

    # -------------------- STOCK ADJUST --------------------
    @action(detail=False, methods=['post'])
    def adjust(self, request):
        serializer = StockAdjustmentSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        variant = data['variant']
        warehouse = data['warehouse']
        quantity_change = data['quantity_change']
        reason = data['reason']
        transaction_type = data['transaction_type']
        user = request.user

        with transaction.atomic():
            stock_item, created = StockItem.objects.select_for_update().get_or_create(
                variant=variant,
                warehouse=warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                defaults={'quantity_on_hand': 0, 'quantity_reserved': 0},
                created_by=user,
                updated_by=user,
            )

            before = stock_item.quantity_on_hand
            new_quantity = before + quantity_change

            if new_quantity < 0:
                return Response(
                    {'error': f'Insufficient stock. Available: {before}'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            stock_item.quantity_on_hand = new_quantity
            stock_item.version += 1
            stock_item.save()

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                quantity_change=quantity_change,
                quantity_before=before,
                quantity_after=new_quantity,
                unit_cost=variant.buying_price,
                transaction_type=transaction_type,
                reason_text=reason,
                created_by=user,
                updated_by=user,
            )

        return Response({
            'status': 'success',
            'message': f'Stock adjusted. New quantity: {new_quantity}',
            'new_quantity': new_quantity,
            'version': stock_item.version
        }, status=status.HTTP_200_OK)

    # -------------------- CURRENT STOCK --------------------
    @action(detail=False, methods=['get'])
    def current_stock(self, request):
        queryset = self.get_queryset()

        variant_id = request.query_params.get('variant___id')
        if variant_id:
            queryset = queryset.filter(variant_id=variant_id)

        warehouse_id = request.query_params.get('warehouse___id')
        if warehouse_id:
            queryset = queryset.filter(warehouse_id=warehouse_id)

        low_stock = request.query_params.get('low_stock')
        if low_stock and low_stock.lower() == 'true':
            queryset = queryset.filter(
                quantity_on_hand__lte=F('variant__min_stock_level')
            )

        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)

        serializer = StockItemSerializer(page_obj, many=True)

        return Response({
            'count': paginator.count,
            'page': page,
            'page_size': page_size,
            'results': serializer.data
        })

    # -------------------- HISTORY --------------------
    @action(detail=False, methods=['get'])
    def history(self, request):
        filter_serializer = StockHistoryFilterSerializer(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        filters = filter_serializer.validated_data

        user = request.user

        qs = InventoryTransaction.objects.filter(
            company_id=user.company_id
        ).select_related('variant', 'warehouse')

        if filters.get('variant_id'):
            qs = qs.filter(variant___id=filters['variant_id'])

        if filters.get('warehouse_id'):
            qs = qs.filter(warehouse___id=filters['warehouse_id'])

        if filters.get('start_date'):
            qs = qs.filter(created_at__date__gte=filters['start_date'])

        if filters.get('end_date'):
            qs = qs.filter(created_at__date__lte=filters['end_date'])

        if filters.get('transaction_type'):
            qs = qs.filter(transaction_type=filters['transaction_type'])

        qs = qs.order_by('-created_at')

        page = filters.get('page', 1)
        page_size = filters.get('page_size', 20)

        paginator = Paginator(qs, page_size)
        page_obj = paginator.get_page(page)

        serializer = InventoryTransactionSerializer(page_obj, many=True)

        return Response({
            'count': paginator.count,
            'page': page,
            'page_size': page_size,
            'results': serializer.data
        })

    # -------------------- VARIANT SUMMARY --------------------
    @action(detail=False, methods=['get'])
    def variant_summary(self, request):
        variant_id = request.query_params.get('variant_id')

        if not variant_id:
            return Response({'error': 'variant_id required'}, status=400)

        user = request.user

        stock_items = StockItem.objects.filter(
            variant___id=variant_id,
            company_id=user.company_id
        ).select_related('warehouse')

        total_on_hand = stock_items.aggregate(
            total=Sum('quantity_on_hand')
        )['total'] or 0

        total_reserved = stock_items.aggregate(
            total=Sum('quantity_reserved')
        )['total'] or 0

        summary = {
            'variant_id': variant_id,
            'total_on_hand': total_on_hand,
            'total_reserved': total_reserved,
            'total_available': 0,
            'warehouses': []
        }

        total_available = 0

        for item in stock_items:
            available = item.quantity_on_hand - item.quantity_reserved
            total_available += available

            summary['warehouses'].append({
                'warehouse_id': item.warehouse.id,
                'warehouse_name': item.warehouse.warehouse_name,
                'quantity_on_hand': item.quantity_on_hand,
                'quantity_reserved': item.quantity_reserved,
                'quantity_available': available
            })

        summary['total_available'] = total_available

        return Response(summary)