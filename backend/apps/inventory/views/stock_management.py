from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import F, Sum
from django.db import models
from django.core.paginator import Paginator
import uuid

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import StockItem, InventoryTransaction, ProductVariant, Warehouse
from apps.inventory.serializers.stock_management import (
    StockAdjustmentSerializer,
    StockHistoryFilterSerializer,
    StockItemSerializer,
    InventoryTransactionSerializer
)
from .batch_stock import BatchStockMixin
from django.core.cache import cache
from django.db.models import Q, Exists, OuterRef, IntegerField, Value
from django.db.models.functions import Coalesce
from apps.inventory.models import Product
from apps.inventory.serializers.product import ProductSerializer
from apps.inventory.serializers.variant import VariantPOSSerializer

class StockManagementViewSet(CompanyBranchMixin, PermissionRequiredMixin, BatchStockMixin, viewsets.GenericViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'stock'
    queryset = StockItem.objects.all()

    # Cross-module read access: these read-only actions serve multiple
    # features (POS, product details, reports) — grant access if the
    # user has view permission on ANY of the listed resources.
    action_permission_any_of = {
        'batch_stock': [
            ('INVENTORY', 'stock'),
            ('INVENTORY', 'sales_order'),
            ('INVENTORY', 'product'),
        ],
        'current_stock': [
            ('INVENTORY', 'stock'),
            ('INVENTORY', 'sales_order'),
            ('INVENTORY', 'product'),
        ],
        'variant_summary': [
            ('INVENTORY', 'stock'),
            ('INVENTORY', 'sales_order'),
            ('INVENTORY', 'product'),
        ],
        'pos_catalog': [
            ('INVENTORY', 'stock'),
            ('INVENTORY', 'sales_order'),
            ('INVENTORY', 'product'),
        ],
    }

    # -------------------- RETRIEVE --------------------
    def retrieve(self, request, pk=None):
        try:
            stock_item = StockItem.objects.select_related(
                'variant__product', 'warehouse'
            ).get(
                _id=pk,
                company_id=request.user.company_id,
            )
        except StockItem.DoesNotExist:
            return Response(
                {'error': 'Stock item not found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        serializer = StockItemSerializer(stock_item)
        return Response(serializer.data)

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
                defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
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
        user = request.user
        company_id = user.company_id
        
        # Extract parameters
        variant_ids = request.query_params.getlist('variant_id') or request.query_params.get('variant_ids', '').split(',')
        warehouse_uuid = request.query_params.get('warehouse_id')
        low_stock = request.query_params.get('low_stock')
        search_query = request.query_params.get('search', '').strip()
        
        # Build cache key (only for simple queries without low_stock)
        cache_key = None
        if not low_stock and variant_ids and warehouse_uuid:
            cache_key = f"current_stock_{company_id}_{warehouse_uuid}_{'_'.join(sorted(variant_ids))}"
            cached = cache.get(cache_key)
            if cached:
                return Response(cached)
        
        queryset = StockItem.objects.filter(company_id=company_id)
        
        # Warehouse filter
        if warehouse_uuid:
            try:
                warehouse = Warehouse.objects.get(_id=warehouse_uuid, company_id=company_id)
                queryset = queryset.filter(warehouse=warehouse)
            except Warehouse.DoesNotExist:
                queryset = queryset.none()
        
        # Multiple variant filter
        if variant_ids and variant_ids[0]:
            variants = ProductVariant.objects.filter(_id__in=variant_ids, company_id=company_id)
            queryset = queryset.filter(variant__in=variants)
        
        # Low stock filter
        if low_stock and low_stock.lower() == 'true':
            queryset = queryset.filter(quantity_on_hand__lte=F('variant__min_stock_level'))
        
        # Prefetch related
        queryset = queryset.select_related('variant__product', 'warehouse')
        
        # Search by variant SKU, barcode, title, or product name
        if search_query:
            queryset = queryset.filter(
                models.Q(variant__sku__icontains=search_query) |
                models.Q(variant__barcode__icontains=search_query) |
                models.Q(variant__variant_title__icontains=search_query) |
                models.Q(variant__product__product_name__icontains=search_query)
            )

        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 100))  # Increased default
        paginator = Paginator(queryset, page_size)
        page_obj = paginator.get_page(page)
        
        serializer = StockItemSerializer(page_obj, many=True)
        response_data = {
            'count': paginator.count,
            'page': page,
            'page_size': page_size,
            'results': serializer.data
        }
        
        # Cache response (short TTL)
        if cache_key:
            cache.set(cache_key, response_data, 3)  # 3 seconds
        
        return Response(response_data)
    
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

        variant_uuid = filters.get('variant_id')
        if variant_uuid:
            try:
                variant = ProductVariant.objects.get(_id=variant_uuid, company_id=user.company_id)
                qs = qs.filter(variant=variant)
            except ProductVariant.DoesNotExist:
                qs = qs.none()

        warehouse_uuid = filters.get('warehouse_id')
        if warehouse_uuid:
            try:
                warehouse = Warehouse.objects.get(_id=warehouse_uuid, company_id=user.company_id)
                qs = qs.filter(warehouse=warehouse)
            except Warehouse.DoesNotExist:
                qs = qs.none()

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
        variant_uuid = request.query_params.get('variant_id')

        if not variant_uuid:
            return Response({'error': 'variant_id required'}, status=400)

        user = request.user

        try:
            variant = ProductVariant.objects.get(_id=variant_uuid, company_id=user.company_id)
        except ProductVariant.DoesNotExist:
            return Response({'error': 'Variant not found'}, status=404)

        stock_items = StockItem.objects.filter(
            variant=variant,
            company_id=user.company_id
        ).select_related('warehouse')

        total_on_hand = stock_items.aggregate(
            total=Sum('quantity_on_hand')
        )['total'] or 0

        total_reserved = stock_items.aggregate(
            total=Sum('quantity_reserved')
        )['total'] or 0

        summary = {
            'variant_id': variant_uuid,
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
                'warehouse_id': str(item.warehouse._id),
                'warehouse_name': item.warehouse.warehouse_name,
                'quantity_on_hand': item.quantity_on_hand,
                'quantity_reserved': item.quantity_reserved,
                'quantity_available': available
            })

        summary['total_available'] = total_available

        return Response(summary)

    # -------------------- POS CATALOG (unified) --------------------
    @action(detail=False, methods=['get'], url_path='pos-catalog')
    def pos_catalog(self, request):
        """
        Unified POS catalog endpoint.
        Returns products with variants + per-warehouse stock data
        in a single request, filtered by the selected warehouse.
        """
        user = request.user
        company_id = user.company_id

        search_query = request.query_params.get('search', '').strip()
        category_id = request.query_params.get('category_id')
        brand_id = request.query_params.get('brand_id')
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))

        warehouse_uuid = request.query_params.get('warehouse_id')
        warehouse = None
        if warehouse_uuid:
            try:
                warehouse = Warehouse.objects.get(_id=warehouse_uuid, company_id=company_id)
            except Warehouse.DoesNotExist:
                return Response({'error': 'Warehouse not found'}, status=404)

        # Build base query
        products_qs = Product.objects.filter(company_id=company_id)

        # When a warehouse is selected, only show products that have stock in that warehouse
        if warehouse:
            has_stock_in_warehouse = Exists(
                StockItem.objects.filter(
                    variant__product=OuterRef('pk'),
                    warehouse=warehouse,
                    company_id=company_id,
                )
            )
            products_qs = products_qs.filter(has_stock_in_warehouse)
        else:
            # When "All" is selected, show products that have stock in ANY warehouse
            has_stock_in_any_warehouse = Exists(
                StockItem.objects.filter(
                    variant__product=OuterRef('pk'),
                    company_id=company_id,
                )
            )
            products_qs = products_qs.filter(has_stock_in_any_warehouse)

        # Category filter
        if category_id:
            products_qs = products_qs.filter(category___id=category_id)

        # Brand filter
        if brand_id:
            products_qs = products_qs.filter(brand___id=brand_id)

        # Search filter
        if search_query:
            products_qs = products_qs.filter(
                Q(product_name__icontains=search_query) |
                Q(variants__sku__icontains=search_query) |
                Q(variants__barcode__icontains=search_query)
            ).distinct()

        products_qs = products_qs.order_by('product_name')

        # Pagination
        paginator = Paginator(products_qs, page_size)
        page_obj = paginator.get_page(page)

        # Calculate total variant count across ALL filtered products (not just current page)
        if warehouse:
            has_variant_stock_all = Exists(
                StockItem.objects.filter(
                    variant=OuterRef('pk'),
                    warehouse=warehouse,
                    company_id=company_id,
                )
            )
            total_variant_count = ProductVariant.objects.filter(
                has_variant_stock_all,
                product__in=products_qs,
                company_id=company_id,
            ).count()
        else:
            total_variant_count = ProductVariant.objects.filter(
                product__in=products_qs,
                company_id=company_id,
            ).count()

        # Build response with variants and stock data
        result = []
        for product in page_obj:
            # Filter variants by warehouse stock when warehouse is selected
            if warehouse:
                has_variant_stock = Exists(
                    StockItem.objects.filter(
                        variant=OuterRef('pk'),
                        warehouse=warehouse,
                        company_id=company_id,
                    )
                )
                variants = ProductVariant.objects.filter(
                    has_variant_stock,
                    product=product,
                    company_id=company_id,
                ).select_related('product').prefetch_related('variant_attributes', 'variant_images')
            else:
                variants = ProductVariant.objects.filter(
                    product=product,
                    company_id=company_id,
                ).select_related('product').prefetch_related('variant_attributes', 'variant_images')

            variants_data = []
            for v in variants:
                # Get stock data — either for specific warehouse or all warehouses summed
                if warehouse:
                    stock = StockItem.objects.filter(
                        variant=v,
                        warehouse=warehouse,
                        company_id=company_id,
                    ).first()
                    available = (stock.quantity_on_hand - stock.quantity_reserved) if stock else 0
                    on_hand = stock.quantity_on_hand if stock else 0
                    reserved = stock.quantity_reserved if stock else 0
                else:
                    # Aggregate across all warehouses
                    stock_agg = StockItem.objects.filter(
                        variant=v,
                        company_id=company_id,
                    ).aggregate(
                        total_on_hand=models.Sum('quantity_on_hand'),
                        total_reserved=models.Sum('quantity_reserved'),
                    )
                    on_hand = stock_agg['total_on_hand'] or 0
                    reserved = stock_agg['total_reserved'] or 0
                    available = on_hand - reserved

                # Get primary image
                primary_image = v.variant_images.filter(is_primary=True).first() or v.variant_images.first()
                image_url = primary_image.image_url if primary_image else ''

                variants_data.append({
                    'id': str(v._id),
                    'sku': v.sku,
                    'variant_title': v.variant_title,
                    'barcode': v.barcode,
                    'selling_price': float(v.selling_price),
                    'min_stock_level': v.min_stock_level,
                    'max_stock_level': v.max_stock_level,
                    'unit': product.unit,
                    'is_active': product.is_active,
                    'image_url': image_url,
                    'stock': {
                        'available': available,
                        'on_hand': on_hand,
                        'reserved': reserved,
                    },
                    'attributes': [
                        {'key': a.attribute_key, 'value': a.attribute_value}
                        for a in v.variant_attributes.filter(is_deleted=False)
                    ],
                })

            # Count variants for this product (already filtered by warehouse above)
            product_variant_count = len(variants_data)

            result.append({
                'id': str(product._id),
                'product_name': product.product_name,
                'description': product.description,
                'unit': product.unit,
                'category_id': str(product.category._id) if product.category else None,
                'brand_id': str(product.brand._id) if product.brand else None,
                'variant_count': product_variant_count,
                'variants': variants_data,
            })

        return Response({
            'count': paginator.count,
            'page': page,
            'page_size': page_size,
            'results': result,
            'variant_count': total_variant_count,
        })