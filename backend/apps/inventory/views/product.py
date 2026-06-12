from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q, F
import uuid
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    Product, ProductVariant, StockItem, InventoryTransaction, Warehouse,
    VariantAttribute, VariantImage, Category, Brand,StockReservation
)
from apps.inventory.serializers import ProductSerializer


class ProductViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'product'
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'

    def get_queryset(self):
        qs = super().get_queryset()
        user = self.request.user

        qs = qs.prefetch_related(
            'variants',
            'variants__stock_items__warehouse',
            'variants__variant_attributes',
            'variants__variant_images'
        )

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(product_name__icontains=search)

        category_uuid = self.request.query_params.get('category')
        if category_uuid:
            try:
                category = Category.objects.get(_id=category_uuid, company_id=user.company_id)
                qs = qs.filter(category=category)
            except Category.DoesNotExist:
                qs = qs.none()

        brand_uuid = self.request.query_params.get('brand')
        if brand_uuid:
            try:
                brand = Brand.objects.get(_id=brand_uuid, company_id=user.company_id)
                qs = qs.filter(brand=brand)
            except Brand.DoesNotExist:
                qs = qs.none()

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        # Convert category UUID to instance
        category_uuid = data.get('category')
        category = None
        if category_uuid:
            try:
                category = Category.objects.get(_id=category_uuid, company_id=user.company_id)
            except Category.DoesNotExist:
                return Response({'error': 'Invalid category UUID'}, status=400)

        # Convert brand UUID to instance
        brand_uuid = data.get('brand')
        brand = None
        if brand_uuid:
            try:
                brand = Brand.objects.get(_id=brand_uuid, company_id=user.company_id)
            except Brand.DoesNotExist:
                return Response({'error': 'Invalid brand UUID'}, status=400)

        # 1. Create Product
        product_data = {
            'product_name': data['productName'],
            'description': data.get('description', ''),
            'unit': data.get('unit', 'PIECE'),
            'storage_requirement': data.get('storageRequirement', 'AMBIENT'),
            'tax_rate': data.get('taxRate', 0),
            'status': data.get('status', 'active'),
            'is_active': data.get('is_active', True),
            'company_id': user.company_id,
            'branch_id': user.branch_id,
            'created_by': user,
            'updated_by': user,
            'category': category,
            'brand': brand,
        }
        
        product = Product.objects.create(**product_data)

        # 2. Get default warehouse – raise error if none exists
        default_warehouse = self._get_default_warehouse(user)
        if not default_warehouse:
            return Response(
                {'error': 'No active warehouse found. Please create a warehouse before adding products.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 3. Create Variants, StockItems, Attributes, Images
        for var_data in data.get('variants', []):
            variant = ProductVariant.objects.create(
                product=product,
                company_id=user.company_id,
                branch_id=user.branch_id,
                sku=var_data.get('sku') or self._generate_sku(product),
                barcode=var_data.get('barcode', ''),
                qr_code=var_data.get('qrCode', ''),
                buying_price=var_data.get('buyingPrice', 0),
                selling_price=var_data.get('sellingPrice', 0),
                min_stock_level=var_data.get('minStockLevel', 0),
                max_stock_level=var_data.get('maxStockLevel', 0),
                created_by=user,
                updated_by=user,
            )

            # Attributes
            for attr in var_data.get('attributes', []):
                VariantAttribute.objects.create(
                    variant=variant,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    attribute_key=attr.get('key', ''),
                    attribute_value=attr.get('value', ''),
                    created_by=user,
                    updated_by=user,
                )

            # Images
            for idx, url in enumerate(var_data.get('images', [])):
                VariantImage.objects.create(
                    variant=variant,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    image_url=url,
                    sort_order=idx,
                    is_primary=(idx == 0),
                    created_by=user,
                    updated_by=user,
                )

            # Stock item (default warehouse)
            initial_stock = var_data.get('stock', 0)
            StockItem.objects.create(
                variant=variant,
                warehouse=default_warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                quantity_on_hand=initial_stock,
                created_by=user,
                updated_by=user,
            )
            if initial_stock > 0:
                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=default_warehouse,
                    company_id=user.company_id,
                    quantity_change=initial_stock,
                    quantity_before=0,
                    quantity_after=initial_stock,
                    unit_cost=var_data.get('buyingPrice', 0),
                    transaction_type='INITIAL',
                    created_by=user,
                    updated_by=user,
                )

        serializer = self.get_serializer(product)
        return Response({
            'status': 'success',
            'message': 'Product created',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        product = self.get_object()
        user = request.user
        data = request.data

        # Update product fields – including status and is_active
        product.product_name = data.get('productName', product.product_name)
        product.description = data.get('description', product.description)
        product.unit = data.get('unit', product.unit)
        product.storage_requirement = data.get('storageRequirement', product.storage_requirement)
        product.tax_rate = data.get('taxRate', product.tax_rate)
        product.status = data.get('status', product.status)
        product.is_active = data.get('is_active', product.is_active)
        
        # Update category if provided
        if data.get('category'):
            try:
                category = Category.objects.get(_id=data['category'], company_id=user.company_id)
                product.category = category
            except Category.DoesNotExist:
                return Response({'error': 'Invalid category UUID'}, status=400)
        
        # Update brand if provided
        if data.get('brand'):
            try:
                brand = Brand.objects.get(_id=data['brand'], company_id=user.company_id)
                product.brand = brand
            except Brand.DoesNotExist:
                return Response({'error': 'Invalid brand UUID'}, status=400)
        
        product.updated_by = user
        product.save()

        # Get default warehouse for stock operations (only if needed)
        default_warehouse = self._get_default_warehouse(user)
        if not default_warehouse:
            return Response(
                {'error': 'No active warehouse found. Cannot update stock.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # Handle variants: map received variants by UUID
        received_variants = {v.get('id'): v for v in data.get('variants', []) if v.get('id')}
        existing_variants = {str(v._id): v for v in product.variants.all()}

        # Soft delete variants not in request
        for vid, variant in existing_variants.items():
            if vid not in received_variants:
                variant.is_deleted = True
                variant.save()

        # Process each variant from request
        for var_data in data.get('variants', []):
            # Get the current stock (on hand) for this variant if it exists
            current_stock_item = None
            current_stock_qty = 0
            if var_data.get('id') and var_data['id'] in existing_variants:
                variant = existing_variants[var_data['id']]
                try:
                    current_stock_item = StockItem.objects.get(
                        variant=variant,
                        warehouse=default_warehouse,
                        company_id=user.company_id
                    )
                    current_stock_qty = current_stock_item.quantity_on_hand
                except StockItem.DoesNotExist:
                    pass
            else:
                variant = None

            # If variant exists, update its fields
            if variant:
                variant.sku = var_data.get('sku', variant.sku)
                variant.barcode = var_data.get('barcode', variant.barcode)
                variant.qr_code = var_data.get('qrCode', variant.qr_code)
                variant.buying_price = var_data.get('buyingPrice', variant.buying_price)
                variant.selling_price = var_data.get('sellingPrice', variant.selling_price)
                variant.min_stock_level = var_data.get('minStockLevel', variant.min_stock_level)
                variant.max_stock_level = var_data.get('maxStockLevel', variant.max_stock_level)
                variant.is_deleted = False
                variant.save()

                # Replace attributes
                if 'attributes' in var_data:
                    variant.variant_attributes.all().delete()
                    for attr in var_data['attributes']:
                        VariantAttribute.objects.create(
                            variant=variant,
                            company_id=user.company_id,
                            branch_id=user.branch_id,
                            attribute_key=attr.get('key', ''),
                            attribute_value=attr.get('value', ''),
                            created_by=user,
                            updated_by=user,
                        )
                # Replace images
                if 'images' in var_data:
                    variant.variant_images.all().delete()
                    for idx, url in enumerate(var_data['images']):
                        VariantImage.objects.create(
                            variant=variant,
                            company_id=user.company_id,
                            branch_id=user.branch_id,
                            image_url=url,
                            sort_order=idx,
                            is_primary=(idx == 0),
                            created_by=user,
                            updated_by=user,
                        )

                # Handle stock adjustment if provided via stockChangeAmount
                if 'stockChangeAmount' in var_data and var_data['stockChangeAmount']:
                    change = var_data['stockChangeAmount']
                    self._adjust_stock(
                        variant,
                        change,
                        var_data.get('stockChangeType', 'ADJUSTMENT'),
                        var_data.get('stockChangeReason', ''),
                        user,
                        default_warehouse
                    )
                # Also support absolute stock field (only if it differs from current stock)
                elif 'stock' in var_data and var_data['stock'] is not None:
                    new_abs = var_data['stock']
                    # Convert to int if string
                    try:
                        new_abs = int(new_abs)
                    except (ValueError, TypeError):
                        new_abs = current_stock_qty
                    if new_abs != current_stock_qty:
                        change = new_abs - current_stock_qty
                        self._adjust_stock(
                            variant,
                            change,
                            'ADJUSTMENT',
                            f'Stock set from {current_stock_qty} to {new_abs} via product update',
                            user,
                            default_warehouse
                        )

            else:
                # Create new variant
                new_variant = ProductVariant.objects.create(
                    product=product,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    sku=var_data.get('sku') or self._generate_sku(product),
                    barcode=var_data.get('barcode', ''),
                    qr_code=var_data.get('qrCode', ''),
                    buying_price=var_data.get('buyingPrice', 0),
                    selling_price=var_data.get('sellingPrice', 0),
                    min_stock_level=var_data.get('minStockLevel', 0),
                    max_stock_level=var_data.get('maxStockLevel', 0),
                    created_by=user,
                    updated_by=user,
                )

                # Attributes
                for attr in var_data.get('attributes', []):
                    VariantAttribute.objects.create(
                        variant=new_variant,
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        attribute_key=attr.get('key', ''),
                        attribute_value=attr.get('value', ''),
                        created_by=user,
                        updated_by=user,
                    )

                # Images
                for idx, url in enumerate(var_data.get('images', [])):
                    VariantImage.objects.create(
                        variant=new_variant,
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        image_url=url,
                        sort_order=idx,
                        is_primary=(idx == 0),
                        created_by=user,
                        updated_by=user,
                    )

                # Initial stock (if any)
                initial_stock = var_data.get('stock', 0)
                StockItem.objects.create(
                    variant=new_variant,
                    warehouse=default_warehouse,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    quantity_on_hand=initial_stock,
                    created_by=user,
                    updated_by=user,
                )
                if initial_stock > 0:
                    InventoryTransaction.objects.create(
                        transaction_id=uuid.uuid4(),
                        variant=new_variant,
                        warehouse=default_warehouse,
                        company_id=user.company_id,
                        quantity_change=initial_stock,
                        quantity_before=0,
                        quantity_after=initial_stock,
                        unit_cost=var_data.get('buyingPrice', 0),
                        transaction_type='INITIAL',
                        created_by=user,
                        updated_by=user,
                    )

        serializer = self.get_serializer(product)
        return Response({
            'status': 'success',
            'message': 'Product updated',
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        variant_uuid = request.data.get('variant_id')
        warehouse_uuid = request.data.get('warehouse_id')
        quantity_change = int(request.data.get('quantity_change', 0))
        reason = request.data.get('reason', '')
        transaction_type = request.data.get('transaction_type', 'ADJUSTMENT')

        try:
            variant = product.variants.get(_id=variant_uuid)
            warehouse = Warehouse.objects.get(_id=warehouse_uuid, company_id=request.user.company_id)
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant,
                warehouse=warehouse,
                company_id=request.user.company_id
            )
        except (ProductVariant.DoesNotExist, Warehouse.DoesNotExist, StockItem.DoesNotExist):
            return Response({'error': 'Variant, warehouse, or stock item not found'}, status=404)

        with transaction.atomic():
            before = stock_item.quantity_on_hand
            new_quantity = before + quantity_change
            if new_quantity < 0:
                return Response({'error': 'Stock cannot be negative'}, status=400)

            stock_item.quantity_on_hand = new_quantity
            stock_item.version += 1
            stock_item.save()

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=warehouse,
                company_id=request.user.company_id,
                quantity_change=quantity_change,
                quantity_before=before,
                quantity_after=new_quantity,
                unit_cost=variant.buying_price,
                transaction_type=transaction_type,
                reason_text=reason,
                created_by=request.user,
                updated_by=request.user,
            )

        return Response({'status': 'success', 'new_quantity': new_quantity})

    # -------------------- Helper Methods --------------------
    def _generate_sku(self, product):
        import time
        import random
        base = f"{product.id}{int(time.time())}{random.randint(10, 99)}"
        return base[:50]

    def _get_default_warehouse(self, user):
        return Warehouse.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id,
            is_active=True
        ).first()

    def _adjust_stock(self, variant, change, change_type, reason, user, warehouse=None):
        if warehouse is None:
            warehouse = self._get_default_warehouse(user)
            if not warehouse:
                return

        try:
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant,
                warehouse=warehouse,
                company_id=user.company_id
            )
        except StockItem.DoesNotExist:
            stock_item = StockItem.objects.create(
                variant=variant,
                warehouse=warehouse,
                company_id=user.company_id,
                branch_id=user.branch_id,
                quantity_on_hand=0,
                created_by=user,
                updated_by=user,
            )

        with transaction.atomic():
            before = stock_item.quantity_on_hand
            new_quantity = before + change
            if new_quantity < 0:
                raise ValueError("Stock cannot be negative")
                return

            stock_item.quantity_on_hand = new_quantity
            stock_item.version += 1
            stock_item.save()

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=warehouse,
                company_id=user.company_id,
                quantity_change=change,
                quantity_before=before,
                quantity_after=new_quantity,
                unit_cost=variant.buying_price,
                transaction_type=change_type,
                reason_text=reason,
                created_by=user,
                updated_by=user,
            )

    def destroy(self, request, *args, **kwargs):
        product = self.get_object()
        user = request.user

        # Soft delete the product itself
        product.is_deleted = True
        product.save(update_fields=['is_deleted'])

        # Get all variant IDs for this product
        variant_ids = list(product.variants.values_list('_id', flat=True))

        if variant_ids:
            # Soft delete all related records in one go
            StockItem.objects.filter(variant___id__in=variant_ids).update(is_deleted=True)
            VariantAttribute.objects.filter(variant___id__in=variant_ids).update(is_deleted=True)
            VariantImage.objects.filter(variant___id__in=variant_ids).update(is_deleted=True)
            StockReservation.objects.filter(variant___id__in=variant_ids).update(is_deleted=True)

            # Finally soft delete the variants themselves
            product.variants.update(is_deleted=True)

        return Response({
            'status': 'success',
            'message': f'Product "{product.product_name}" and all related records have been soft deleted.'
        }, status=status.HTTP_200_OK)
