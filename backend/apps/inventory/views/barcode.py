from rest_framework import viewsets
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import ProductVariant
from apps.inventory.serializers.barcode import BarcodeSerializer

class BarcodeViewSet(CompanyBranchMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for barcode list.
    Returns all variants with their barcodes, SKUs, and product names.
    """
    serializer_class = BarcodeSerializer
    lookup_field = '_id'
    queryset = ProductVariant.objects.all()

    filter_backends = [SearchFilter, DjangoFilterBackend]
    search_fields = ['sku', 'barcode', 'product__product_name']
    filterset_fields = ['product___id']

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(is_deleted=False).select_related('product')
        return qs.order_by('product__product_name', 'sku')