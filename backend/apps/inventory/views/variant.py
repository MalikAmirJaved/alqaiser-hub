# apps/inventory/views/variant.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import ProductVariant
from apps.inventory.serializers.variant import VariantDetailSerializer


class VariantViewSet(CompanyBranchMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for product variants.
    Supports filtering by product, search, active status, etc.
    """
    serializer_class = VariantDetailSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'

    def get_queryset(self):
        qs = ProductVariant.objects.filter(
            company_id=self.request.user.company_id,
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
                Q(product__product_name__icontains=search)
            )

        # Only show variants of active products?
        active_only = self.request.query_params.get('active_only', 'true').lower() == 'true'
        if active_only:
            qs = qs.filter(product__is_active=True, product__status='active')

        return qs.order_by('product__product_name', 'sku')