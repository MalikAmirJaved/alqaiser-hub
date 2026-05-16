from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import Q
import uuid
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import (
    Product, ProductVariant, StockItem, InventoryTransaction, Warehouse,
    VariantAttribute, VariantImage
)
from apps.inventory.serializers import ProductSerializer


class ProductViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = Product.objects.all() 
    serializer_class = ProductSerializer

    def get_queryset(self):
        qs = super().get_queryset()  # company/branch filtering from mixin

        qs = qs.prefetch_related(
            'variants',
            'variants__stock_items__warehouse',
            'variants__variant_attributes',
            'variants__variant_images'
        )

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(product_name__icontains=search)

        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category_id=category)

        brand = self.request.query_params.get('brand')
        if brand:
            qs = qs.filter(brand_id=brand)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            qs = qs.filter(status=status_filter)

        return qs


    @transaction.atomic
    def create(self, request, *args, **kwargs):
        user = request.user
        data = request.data

        # 1. Create Product
        product_data = {
            'product_name': data['productName'],
            'description': data.get('description', ''),
            'unit': data.get('unit', 'PIECE'),
            'storage_requirement': data.get('storageRequirement', 'AMBIENT'),
            'tax_rate': data.get('taxRate', 0),
            'status': 'active',
            'is_active': True,
            'company_id': user.company_id,
            'branch_id': user.branch_id,
            'created_by': user,
            'updated_by': user,
        }
        if data.get('category'):
            product_data['category_id'] = data['category']
        if data.get('brand'):
            product_data['brand_id'] = data['brand']

        product = Product.objects.create(**product_data)

        # 2. Get default warehouse
        default_warehouse = self._get_default_warehouse(user)

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
            if default_warehouse:
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

    @transaction.atomic
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        product = self.get_object()
        user = request.user
        data = request.data

        # Update product fields
        product.product_name = data.get('productName', product.product_name)
        product.description = data.get('description', product.description)
        product.unit = data.get('unit', product.unit)
        product.storage_requirement = data.get('storageRequirement', product.storage_requirement)
        product.tax_rate = data.get('taxRate', product.tax_rate)
        if data.get('category'):
            product.category_id = data['category']
        if data.get('brand'):
            product.brand_id = data['brand']
        product.updated_by = user
        product.save()

        # Handle variants: map received variants by ID
        received_variants = {v.get('id'): v for v in data['variants'] if v.get('id')}
        existing_variants = {str(v.id): v for v in product.variants.all()}

        # Soft delete variants not in request
        for vid, variant in existing_variants.items():
            if vid not in received_variants:
                variant.is_deleted = True
                variant.save()

        default_warehouse = self._get_default_warehouse(user)

        # Process each variant from request
        for var_data in data['variants']:
            if var_data.get('id') and var_data['id'] in existing_variants:
                # Update existing variant
                variant = existing_variants[var_data['id']]
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

                # Handle stock adjustment if provided
                if 'stockChangeAmount' in var_data and var_data['stockChangeAmount']:
                    self._adjust_stock(
                        variant,
                        var_data['stockChangeAmount'],
                        var_data.get('stockChangeType', 'ADJUSTMENT'),
                        var_data.get('stockChangeReason', ''),
                        user,
                        default_warehouse
                    )

            else:
                # Create new variant
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

                # Initial stock (if any)
                if default_warehouse:
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
            'message': 'Product updated',
            'data': serializer.data
        })

    @action(detail=True, methods=['post'])
    def adjust_stock(self, request, pk=None):
        """Adjust stock of a specific variant in a specific warehouse."""
        product = self.get_object()
        variant_id = request.data.get('variant_id')
        warehouse_id = request.data.get('warehouse_id')
        quantity_change = int(request.data.get('quantity_change', 0))
        reason = request.data.get('reason', '')
        transaction_type = request.data.get('transaction_type', 'ADJUSTMENT')

        try:
            variant = product.variants.get(id=variant_id)
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant,
                warehouse_id=warehouse_id,
                company_id=request.user.company_id
            )
        except (ProductVariant.DoesNotExist, StockItem.DoesNotExist):
            return Response({'error': 'Variant or stock item not found'}, status=404)

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
                warehouse_id=warehouse_id,
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
        """Generate a unique SKU for a new variant."""
        # Example: product ID prefix + timestamp + random
        import time
        import random
        base = f"{product.id}{int(time.time())}{random.randint(10, 99)}"
        return base[:50]  # limit length

    def _get_default_warehouse(self, user):
        return Warehouse.objects.filter(
            company_id=user.company_id,
            branch_id=user.branch_id,
            is_active=True
        ).first()

    def _adjust_stock(self, variant, change, change_type, reason, user, warehouse=None):
        """Internal method to adjust stock without HTTP request."""
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
            # Create stock item if it doesn't exist (should not happen normally)
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
                return  # silently ignore, or raise exception

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
        """
        Soft delete: mark product and all its variants as is_deleted=True.
        This preserves inventory transactions and other related data.
        """
        product = self.get_object()
        product.is_deleted = True
        product.save(update_fields=['is_deleted'])

        # Also soft delete all variants (optional but recommended)
        product.variants.update(is_deleted=True)

        return Response({
            'status': 'success',
            'message': f'Product "{product.product_name}" has been deleted (soft delete).'
        }, status=status.HTTP_200_OK)
