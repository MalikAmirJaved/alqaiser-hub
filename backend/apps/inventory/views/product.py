# apps/inventory/views/product.py

from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q, Sum, F

from apps.inventory.models import (
    Product,
    ProductVariant,
    Inventory,
    Tag,
    ProductTag
)

from apps.inventory.serializers import (
    ProductSerializer,
    ProductVariantSerializer,
    InventorySerializer,
    TagSerializer
)


class ProductViewSet(viewsets.ModelViewSet):
    serializer_class = ProductSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        queryset = Product.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id
        ).prefetch_related(
            'variants',
            'attributes',
            'inventory_records'
        )

        # Search
        search = self.request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search) |
                Q(sku__icontains=search)
            )

        # Category filter
        category = self.request.query_params.get('category')
        if category:
            queryset = queryset.filter(category_id=category)

        # Brand filter
        brand = self.request.query_params.get('brand')
        if brand:
            queryset = queryset.filter(brand_id=brand)

        # Status filter
        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # Product type filter
        product_type = self.request.query_params.get('product_type')
        if product_type:
            queryset = queryset.filter(product_type=product_type)

        # Price filters
        min_price = self.request.query_params.get('min_price')
        max_price = self.request.query_params.get('max_price')

        if min_price:
            queryset = queryset.filter(selling_price__gte=min_price)

        if max_price:
            queryset = queryset.filter(selling_price__lte=max_price)

        # Stock filters
        stock_status = self.request.query_params.get('stock_status')

        if stock_status:
            if stock_status == 'low':
                queryset = queryset.filter(
                    inventory_records__stock_quantity__lt=10
                ).distinct()

            elif stock_status == 'out':
                queryset = queryset.filter(
                    inventory_records__stock_quantity=0
                ).distinct()

            elif stock_status == 'in':
                queryset = queryset.filter(
                    inventory_records__stock_quantity__gt=0
                ).distinct()

        # Sorting
        sort_by = self.request.query_params.get('sort_by')
        sort_order = self.request.query_params.get('sort_order', 'asc')

        if sort_by:
            order = '' if sort_order == 'asc' else '-'
            queryset = queryset.order_by(f'{order}{sort_by}')

        return queryset

    # FIXED HERE
    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        )

    # OPTIONAL BUT GOOD PRACTICE
    def perform_update(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        self.perform_create(serializer)

        return Response({
            'status': 'success',
            'message': f'Product "{serializer.instance.name}" created successfully.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)

        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial
        )

        serializer.is_valid(raise_exception=True)

        self.perform_update(serializer)

        return Response({
            'status': 'success',
            'message': f'Product "{serializer.instance.name}" updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        name = instance.name

        self.perform_destroy(instance)

        return Response({
            'status': 'success',
            'message': f'Product "{name}" deleted successfully.'
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        user = request.user

        queryset = self.get_queryset()

        total_products = queryset.count()

        active_products = queryset.filter(
            status='active'
        ).count()

        draft_products = queryset.filter(
            status='draft'
        ).count()

        archived_products = queryset.filter(
            status='archived'
        ).count()

        # Stock totals
        stock_aggregate = Inventory.objects.filter(
            product__company_id=user.company_id,
            product__branch_id=user.branch_id
        ).aggregate(
            total_stock=Sum('stock_quantity'),
            total_reserved=Sum('reserved_quantity')
        )

        total_stock = stock_aggregate['total_stock'] or 0
        total_reserved = stock_aggregate['total_reserved'] or 0

        # Inventory value
        total_value = Inventory.objects.filter(
            product__company_id=user.company_id,
            product__branch_id=user.branch_id
        ).annotate(
            value=F('stock_quantity') * F('product__selling_price')
        ).aggregate(
            total=Sum('value')
        )['total'] or 0

        return Response({
            'total_products': total_products,
            'active_products': active_products,
            'draft_products': draft_products,
            'archived_products': archived_products,
            'total_stock': total_stock,
            'total_reserved': total_reserved,
            'total_inventory_value': float(total_value),
        })


class TagViewSet(viewsets.ModelViewSet):
    serializer_class = TagSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        return Tag.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id
        )

    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        )


class InventoryViewSet(viewsets.ModelViewSet):
    serializer_class = InventorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user

        return Inventory.objects.filter(
            product__company_id=user.company_id,
            product__branch_id=user.branch_id
        ).select_related(
            'warehouse',
            'product',
            'variant'
        )

    @action(detail=False, methods=['post'])
    def bulk_update(self, request):
        updates = request.data.get('updates', [])

        for item in updates:
            inventory_id = item.pop('id')

            Inventory.objects.filter(
                id=inventory_id
            ).update(**item)

        return Response({
            'status': 'success',
            'message': 'Inventory updated successfully.'
        })