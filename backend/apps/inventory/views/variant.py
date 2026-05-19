# apps/inventory/views/variant.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from django.core.cache import cache
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import ProductVariant
from apps.inventory.serializers.variant import VariantDetailSerializer, VariantPOSSerializer


class VariantViewSet(CompanyBranchMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for product variants.
    Supports filtering by product, search, active status, etc.
    Use ?pos=true for lightweight POS-optimized response.
    """
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'

    def get_serializer_class(self):
        """Return lightweight serializer for POS requests"""
        if self.request.query_params.get('pos') == 'true':
            return VariantPOSSerializer
        return VariantDetailSerializer

    def get_queryset(self):
        user = self.request.user
        company_id = user.company_id

        # Build cache key
        cache_key = f"variants_queryset_{company_id}_{self.request.query_params.urlencode()}"
        cached_qs_ids = cache.get(cache_key)
        
        if cached_qs_ids is not None:
            # Return cached queryset
            return ProductVariant.objects.filter(
                _id__in=cached_qs_ids,
                company_id=company_id,
                is_deleted=False
            ).select_related('product', 'product__category', 'product__brand')

        qs = ProductVariant.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('product', 'product__category', 'product__brand')

        # Filter by product ID
        product_id = self.request.query_params.get('product_id')
        if product_id:
            qs = qs.filter(product___id=product_id)

        # Filter by product name / SKU search
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(sku__icontains=search) |
                Q(product__product_name__icontains=search) |
                Q(barcode__icontains=search)
            )

        # Only show variants of active products
        active_only = self.request.query_params.get('active_only', 'true').lower() == 'true'
        if active_only:
            qs = qs.filter(product__is_active=True, product__status='active')

        qs = qs.order_by('product__product_name', 'sku')
        
        # Cache the IDs for 30 seconds
        cache.set(cache_key, list(qs.values_list('_id', flat=True)), 30)
        
        return qs