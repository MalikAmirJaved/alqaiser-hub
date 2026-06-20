from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.quote import Quote
from apps.sales.serializers.quote import QuoteSerializer
from apps.finance.models import CustomerInvoice



class QuoteViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'SALES'
    permission_resource = 'quote'
    queryset = Quote.objects.all()
    serializer_class = QuoteSerializer
    lookup_field = '_id'
    filter_fields = {
        'status': 'status',
        'search': ['quote_number', 'customer__name'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related('customer', 'converted_invoice').prefetch_related('lines__variant__product')
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'status': 'success',
            'message': 'Quote created successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': 'Quote updated successfully',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response({
            'status': 'success',
            'message': 'Quote deleted successfully'
        })

    @action(detail=True, methods=['post'])
    def accept(self, request, _id=None):
        """Accept a quote: changes status to ACCEPTED."""
        quote = self.get_object()
        if quote.status not in ('DRAFT', 'SENT'):
            return Response(
                {'error': f"Cannot accept quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        quote.status = 'ACCEPTED'
        quote.save(update_fields=['status'])
        return Response({
            'status': 'success',
            'message': 'Quote accepted'
        })

    @action(detail=True, methods=['post'])
    def reject(self, request, _id=None):
        quote = self.get_object()
        if quote.status in ['ACCEPTED', 'REJECTED']:
            return Response(
                {'error': f"Cannot reject quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        quote.status = 'REJECTED'
        quote.save(update_fields=['status'])
        return Response({'status': 'success', 'message': 'Quote rejected'})

    @action(detail=True, methods=['post'])
    def mark_converted(self, request, _id=None):
        """Link this quote to an invoice after successful conversion."""
        quote = self.get_object()
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response({'error': 'invoice_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invoice = CustomerInvoice.objects.get(_id=invoice_id, company_id=quote.company_id)
        except CustomerInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)
        quote.converted_invoice = invoice
        quote.save(update_fields=['converted_invoice'])
        return Response({'status': 'success', 'message': 'Quote marked as converted'})
