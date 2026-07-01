from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.quote import Quote
from apps.sales.models.status_history import SalesStatusHistory
from apps.sales.serializers.quote import QuoteSerializer
from apps.sales.serializers.status_history import SalesStatusHistorySerializer
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
        if instance.status != 'DRAFT':
            return Response(
                {'error': f"Cannot edit quote with status '{instance.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
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

    # ── Helpers ──

    def _log_status_change(self, quote, from_status, to_status, notes=''):
        SalesStatusHistory.objects.create(
            entity_type='QUOTE',
            entity_id=quote._id,
            from_status=from_status,
            to_status=to_status,
            notes=notes,
            changed_by=self.request.user,
            company_id=quote.company_id,
            branch_id=quote.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    # ── Workflow Actions ──

    @action(detail=True, methods=['post'])
    def send(self, request, _id=None):
        """Move quote from DRAFT → SENT."""
        quote = self.get_object()
        if quote.status != 'DRAFT':
            return Response(
                {'error': f"Cannot send quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        from_status = quote.status
        quote.status = 'SENT'
        quote.save(update_fields=['status'])
        self._log_status_change(quote, from_status, 'SENT')
        return Response({'status': 'success', 'message': 'Quote sent to customer'})

    @action(detail=True, methods=['post'])
    def mark_viewed(self, request, _id=None):
        """Move quote from SENT → VIEWED."""
        quote = self.get_object()
        if quote.status != 'SENT':
            return Response(
                {'error': f"Cannot mark quote as viewed with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        from_status = quote.status
        quote.status = 'VIEWED'
        quote.save(update_fields=['status'])
        self._log_status_change(quote, from_status, 'VIEWED')
        return Response({'status': 'success', 'message': 'Quote marked as viewed'})

    @action(detail=True, methods=['post'])
    def approve(self, request, _id=None):
        """Move quote from VIEWED → APPROVED."""
        quote = self.get_object()
        if quote.status != 'VIEWED':
            return Response(
                {'error': f"Cannot approve quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        from_status = quote.status
        quote.status = 'APPROVED'
        quote.save(update_fields=['status'])
        self._log_status_change(quote, from_status, 'APPROVED')
        return Response({'status': 'success', 'message': 'Quote approved'})

    @action(detail=True, methods=['post'])
    def reject(self, request, _id=None):
        """Move quote from VIEWED → REJECTED."""
        quote = self.get_object()
        if quote.status != 'VIEWED':
            return Response(
                {'error': f"Cannot reject quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        from_status = quote.status
        quote.status = 'REJECTED'
        quote.save(update_fields=['status'])
        self._log_status_change(quote, from_status, 'REJECTED')
        return Response({'status': 'success', 'message': 'Quote rejected'})

    @action(detail=True, methods=['post'])
    def revert_status(self, request, _id=None):
        """Revert quote one step back in the pipeline."""
        quote = self.get_object()
        prev_map = {
            'SENT': 'DRAFT',
            'VIEWED': 'SENT',
            'APPROVED': 'VIEWED',
            'REJECTED': 'VIEWED',
        }
        prev = prev_map.get(quote.status)
        if not prev:
            return Response({'error': f"Cannot revert quote with status '{quote.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        from_status = quote.status
        quote.status = prev
        quote.save(update_fields=['status'])
        self._log_status_change(quote, from_status, prev)
        return Response({'status': 'success', 'message': f'Quote reverted to {prev}'})

    @action(detail=True, methods=['post'])
    def mark_converted(self, request, _id=None):
        """Link this quote to an invoice and set status to CONVERTED."""
        quote = self.get_object()
        if quote.status != 'APPROVED':
            return Response(
                {'error': f"Cannot convert quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )
        invoice_id = request.data.get('invoice_id')
        if not invoice_id:
            return Response({'error': 'invoice_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            invoice = CustomerInvoice.objects.get(_id=invoice_id, company_id=quote.company_id)
        except CustomerInvoice.DoesNotExist:
            return Response({'error': 'Invoice not found'}, status=status.HTTP_404_NOT_FOUND)
        from_status = quote.status
        quote.converted_invoice = invoice
        quote.status = 'CONVERTED'
        quote.save(update_fields=['converted_invoice', 'status'])
        self._log_status_change(quote, from_status, 'CONVERTED', f"Converted to invoice {invoice.invoice_number}")
        return Response({'status': 'success', 'message': 'Quote converted to invoice'})

    @action(detail=True, methods=['get'])
    def status_history(self, request, _id=None):
        """Return status change history for this quote."""
        quote = self.get_object()
        history = SalesStatusHistory.objects.filter(
            entity_type='QUOTE',
            entity_id=quote._id,
            company_id=quote.company_id,
        ).order_by('-created_at')
        serializer = SalesStatusHistorySerializer(history, many=True)
        return Response(serializer.data)
