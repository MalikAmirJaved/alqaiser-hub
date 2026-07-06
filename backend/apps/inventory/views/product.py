from rest_framework import viewsets, status, permissions
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS
from django.db import transaction
from django.db.models import Q, F
import uuid
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    Product, ProductVariant, StockItem, InventoryTransaction, Warehouse,
    VariantAttribute, VariantImage, Category, Brand,StockReservation
)
from apps.inventory.models.purchase import PurchaseOrderLine
from apps.inventory.models.sales import SalesOrderLine
from apps.inventory.serializers import ProductSerializer


class ProductViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'product'
    action_permission_any_of = {
        "": [("SALES", "sales_customer"), ("SALES", "lead"), ("SALES", "quote"), ("FINANCE", "customer_invoice")],
    }
    queryset = Product.objects.all()
    serializer_class = ProductSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    filter_fields = {
        'search': ['product_name', 'variants__sku'],
        'category': 'category___id',
        'brand': 'brand___id',
        'status': 'status',
    }

    def get_permissions(self):
        if self.request.method in SAFE_METHODS:
            return [permissions.IsAuthenticated()]
        return super().get_permissions()

    @staticmethod
    def _image_url(img):
        return img if isinstance(img, str) else img.get('url', '')
    @action(detail=True, methods=['get'], url_path='related-data')
    def related_data(self, request, _id=None):
        product = self.get_object()
        user = request.user
        variant_pks = list(product.variants.values_list('id', flat=True))

        tab = request.query_params.get('tab', '')
        page_num = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 20))
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        from django.core.paginator import Paginator, EmptyPage

        def paginate(qs, serializer_fn):
            count = qs.count()
            paginator = Paginator(qs, page_size)
            try:
                page_obj = paginator.page(page_num)
            except EmptyPage:
                page_obj = paginator.page(paginator.num_pages) if paginator.num_pages else paginator.page(1)
            results = [serializer_fn(obj) for obj in page_obj]
            return {
                'count': count,
                'total_pages': paginator.num_pages,
                'current_page': page_obj.number,
                'next': page_obj.has_next(),
                'previous': page_obj.has_previous(),
                'results': results,
            }

        # ── Stock Movements ────────────────────────────────────
        def _stock_movements():
            qs = InventoryTransaction.objects.filter(
                variant_id__in=variant_pks,
                company_id=user.company_id,
            ).select_related('variant', 'warehouse', 'created_by').order_by('-created_at')
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            def serialize(t):
                return {
                    'id': str(t._id),
                    'transaction_id': str(t.transaction_id),
                    'variant_id': str(t.variant._id),
                    'variant_sku': t.variant.sku,
                    'warehouse_name': t.warehouse.warehouse_name,
                    'quantity_change': t.quantity_change,
                    'quantity_before': t.quantity_before,
                    'quantity_after': t.quantity_after,
                    'unit_cost': str(t.unit_cost),
                    'transaction_type': t.transaction_type,
                    'transaction_type_display': dict(InventoryTransaction.TRANSACTION_TYPES).get(t.transaction_type, t.transaction_type),
                    'reason_text': t.reason_text,
                    'source_document_type': t.source_document_type,
                    'source_document_id': str(t.source_document_id) if t.source_document_id else None,
                    'created_at': t.created_at.isoformat(),
                    'created_by_name': t.created_by.get_full_name() or t.created_by.email if t.created_by else None,
                }
            return paginate(qs, serialize)

        # ── Purchase Order Lines ────────────────────────────────
        def _purchase_orders():
            qs = PurchaseOrderLine.objects.filter(
                variant_id__in=variant_pks,
                company_id=user.company_id,
            ).select_related(
                'purchase_order', 'purchase_order__supplier', 'variant', 'created_by'
            ).order_by('-created_at')
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            def serialize(l):
                po = l.purchase_order
                return {
                    'id': str(l._id),
                    'order_number': po.order_number,
                    'order_id': str(po._id),
                    'supplier_name': po.supplier.name if po.supplier else None,
                    'status': po.status,
                    'line_status': l.status,
                    'variant_sku': l.variant.sku,
                    'quantity_ordered': l.quantity_ordered,
                    'quantity_received': l.quantity_received,
                    'unit_cost': str(l.unit_cost),
                    'order_date': po.order_date.isoformat() if po.order_date else None,
                    'created_at': l.created_at.isoformat(),
                    'created_by_name': l.created_by.get_full_name() or l.created_by.email if l.created_by else None,
                }
            return paginate(qs, serialize)

        # ── Sales Order Lines ──────────────────────────────────
        def _sales_orders():
            qs = SalesOrderLine.objects.filter(
                variant_id__in=variant_pks,
                company_id=user.company_id,
            ).select_related(
                'sales_order', 'sales_order__customer', 'variant', 'created_by'
            ).order_by('-created_at')
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            def serialize(l):
                so = l.sales_order
                return {
                    'id': str(l._id),
                    'order_number': so.order_number,
                    'order_id': str(so._id),
                    'customer_name': so.customer.name if so.customer else None,
                    'status': so.status,
                    'line_status': l.status,
                    'source': so.source,
                    'variant_sku': l.variant.sku,
                    'quantity_ordered': l.quantity_ordered,
                    'quantity_returned': l.quantity_returned,
                    'unit_price': str(l.unit_price),
                    'order_date': so.order_date.isoformat() if so.order_date else None,
                    'created_at': l.created_at.isoformat(),
                    'created_by_name': l.created_by.get_full_name() or l.created_by.email if l.created_by else None,
                }
            return paginate(qs, serialize)

        # ── Quote Lines ────────────────────────────────────────
        def _quotes():
            from apps.sales.models import QuoteLine
            qs = QuoteLine.objects.filter(
                variant_id__in=variant_pks,
                company_id=user.company_id,
            ).select_related(
                'quote', 'quote__customer', 'quote__lead', 'variant', 'created_by'
            ).order_by('-created_at')
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            def serialize(l):
                q = l.quote
                return {
                    'id': str(l._id),
                    'quote_number': q.quote_number,
                    'quote_id': str(q._id),
                    'customer_name': q.customer.name if q.customer else None,
                    'lead_name': str(q.lead) if q.lead else None,
                    'status': q.status,
                    'variant_sku': l.variant.sku,
                    'quantity': l.quantity,
                    'unit_price': str(l.unit_price),
                    'discount_amount': str(l.discount_amount),
                    'date': q.date.isoformat() if q.date else None,
                    'created_at': l.created_at.isoformat(),
                    'created_by_name': l.created_by.get_full_name() or l.created_by.email if l.created_by else None,
                }
            return paginate(qs, serialize)

        # ── Customer Invoice Lines ─────────────────────────────
        def _invoices():
            from apps.finance.models import CustomerInvoiceLine
            qs = CustomerInvoiceLine.objects.filter(
                variant_id__in=variant_pks,
                company_id=user.company_id,
            ).select_related(
                'customer_invoice', 'customer_invoice__customer', 'variant', 'created_by'
            ).order_by('-created_at')
            if date_from:
                qs = qs.filter(created_at__date__gte=date_from)
            if date_to:
                qs = qs.filter(created_at__date__lte=date_to)

            def serialize(l):
                inv = l.customer_invoice
                return {
                    'id': str(l._id),
                    'invoice_number': inv.invoice_number,
                    'invoice_id': str(inv._id),
                    'customer_name': inv.customer.name if inv.customer else None,
                    'status': inv.status,
                    'source': inv.source,
                    'variant_sku': l.variant.sku,
                    'quantity': l.quantity,
                    'unit_price': str(l.unit_price),
                    'discount_amount': str(l.discount_amount),
                    'cost_price': str(l.cost_price) if l.cost_price else None,
                    'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                    'created_at': l.created_at.isoformat(),
                    'created_by_name': l.created_by.get_full_name() or l.created_by.email if l.created_by else None,
                }
            return paginate(qs, serialize)

        tab_map = {
            'stock-movements': _stock_movements,
            'purchase-orders': _purchase_orders,
            'sales-orders': _sales_orders,
            'quotes': _quotes,
            'invoices': _invoices,
        }

        if tab in tab_map:
            return Response(tab_map[tab]())

        return Response({
            'stock_movements': _stock_movements(),
            'purchase_orders': _purchase_orders(),
            'sales_orders': _sales_orders(),
            'quotes': _quotes(),
            'invoices': _invoices(),
        })

    def get_queryset(self):
        qs = super().get_queryset()

        qs = qs.prefetch_related(
            'variants',
            'variants__stock_items__warehouse',
            'variants__variant_attributes',
            'variants__variant_images'
        )

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

        # Get default warehouse for stock operations
        default_warehouse = self._get_default_warehouse(user)
        if not default_warehouse:
            return Response(
                {'error': 'No active warehouse found. Please create a warehouse before adding products.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
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

            # 2. Create Variants, StockItems, Attributes, Images
            for var_data in data.get('variants', []):
                variant = ProductVariant.objects.create(
                    product=product,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    sku=var_data.get('sku') or self._generate_sku(product),
                    variant_title=var_data.get('variantTitle', ''),
                    barcode=var_data.get('barcode', ''),
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
                for idx, img in enumerate(var_data.get('images', [])):
                    VariantImage.objects.create(
                        variant=variant,
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        image_url=self._image_url(img),
                        sort_order=idx,
                        is_primary=(idx == 0),
                        created_by=user,
                        updated_by=user,
                    )

                # Stock item (default warehouse)
                StockItem.objects.create(
                    variant=variant,
                    warehouse=default_warehouse,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    quantity_on_hand=0,
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
        
        # Update category if key is present in request (allows null to clear)
        if 'category' in data:
            if data['category']:
                try:
                    category = Category.objects.get(_id=data['category'], company_id=user.company_id)
                    product.category = category
                except Category.DoesNotExist:
                    return Response({'error': 'Invalid category UUID'}, status=400)
            else:
                product.category = None
        
        # Update brand if key is present in request (allows null to clear)
        if 'brand' in data:
            if data['brand']:
                try:
                    brand = Brand.objects.get(_id=data['brand'], company_id=user.company_id)
                    product.brand = brand
                except Brand.DoesNotExist:
                    return Response({'error': 'Invalid brand UUID'}, status=400)
            else:
                product.brand = None
        
        product.updated_by = user
        product.save()

        # Get default warehouse for stock operations
        default_warehouse = self._get_default_warehouse(user)

        with transaction.atomic():
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
                if var_data.get('id') and var_data['id'] in existing_variants:
                    variant = existing_variants[var_data['id']]
                else:
                    variant = None

                # If variant exists, update its fields
                if variant:
                    variant.sku = var_data.get('sku', variant.sku)
                    variant.variant_title = var_data.get('variantTitle', variant.variant_title)
                    variant.barcode = var_data.get('barcode', variant.barcode)
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
                        for idx, img in enumerate(var_data['images']):
                            VariantImage.objects.create(
                                variant=variant,
                                company_id=user.company_id,
                                branch_id=user.branch_id,
                                image_url=self._image_url(img),
                                sort_order=idx,
                                is_primary=(idx == 0),
                                created_by=user,
                                updated_by=user,
                            )

                else:
                    # Create new variant
                    new_variant = ProductVariant.objects.create(
                        product=product,
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        sku=var_data.get('sku') or self._generate_sku(product),
                        variant_title=var_data.get('variantTitle', ''),
                        barcode=var_data.get('barcode', ''),
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
                    for idx, img in enumerate(var_data.get('images', [])):
                        VariantImage.objects.create(
                            variant=new_variant,
                            company_id=user.company_id,
                            branch_id=user.branch_id,
                            image_url=self._image_url(img),
                            sort_order=idx,
                            is_primary=(idx == 0),
                            created_by=user,
                            updated_by=user,
                        )

                    # Stock item (default warehouse)
                    if default_warehouse:
                        StockItem.objects.create(
                            variant=new_variant,
                            warehouse=default_warehouse,
                            company_id=user.company_id,
                            branch_id=user.branch_id,
                            quantity_on_hand=0,
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
