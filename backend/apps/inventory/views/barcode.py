from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from rest_framework.filters import SearchFilter
from django_filters.rest_framework import DjangoFilterBackend
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import ProductVariant
from apps.inventory.serializers.barcode import BarcodeSerializer

# Barcode generation imports
import barcode
from barcode.writer import ImageWriter
from io import BytesIO

class BarcodeViewSet(CompanyBranchMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only endpoint for barcode list.
    Returns all variants with their barcodes, SKUs, and product names.
    Also provides a print endpoint to generate a barcode image.
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

    @action(detail=False, methods=['get'], url_path='print')
    def print_barcode(self, request):
        """
        GET /api/inventory/barcodes/print/?barcode=<barcode_value>
        Returns a PNG image of the barcode.
        """
        barcode_value = request.query_params.get('barcode')
        if not barcode_value:
            return Response({'error': 'barcode parameter is required'}, status=400)

        # Optional: verify that this barcode exists and belongs to the user's company
        variant = ProductVariant.objects.filter(
            barcode=barcode_value,
            company_id=request.user.company_id,
            is_deleted=False
        ).first()
        if not variant:
            return Response({'error': 'Barcode not found or not accessible'}, status=404)

        try:
            # Choose barcode format (Code128 is common for alphanumeric)
            # You can also use 'ean13' or 'upc' if barcode is numeric and of correct length.
            code128 = barcode.get('code128', barcode_value, writer=ImageWriter())
            buffer = BytesIO()
            code128.write(buffer)
            buffer.seek(0)
            return HttpResponse(buffer.getvalue(), content_type='image/png')
        except Exception as e:
            return Response({'error': f'Failed to generate barcode: {str(e)}'}, status=500)