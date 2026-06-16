from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.quote import Quote
from apps.sales.serializers.quote import QuoteSerializer


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
        qs = qs.prefetch_related('lines__variant__product')
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
        """
        Accept a quote: changes status to ACCEPTED and creates a
        draft CustomerInvoice with matching line items.
        """
        quote = self.get_object()
        if quote.status != 'DRAFT' and quote.status != 'SENT':
            return Response(
                {'error': f"Cannot accept quote with status '{quote.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            quote.status = 'ACCEPTED'
            quote.save(update_fields=['status'])

            # Auto-create CustomerInvoice from this quote
            from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
            from django.utils import timezone
            import time, random

            invoice = CustomerInvoice.objects.create(
                invoice_number=f"INV-QT-{int(time.time())}-{random.randint(1000, 9999)}",
                customer=quote.customer,
                invoice_date=timezone.now().date(),
                due_date=timezone.now().date(),
                amount=quote.total_amount,
                status='DRAFT',
                source='SALES_QUOTE',
                company_id=quote.company_id,
                branch_id=quote.branch_id,
                created_by=request.user,
                updated_by=request.user,
            )

            # Copy quote lines to invoice lines
            for ql in quote.lines.all():
                CustomerInvoiceLine.objects.create(
                    customer_invoice=invoice,
                    variant=ql.variant,
                    quantity=ql.quantity,
                    unit_price=ql.unit_price,
                    tax_rate=ql.tax_rate,
                    discount_amount=ql.discount_amount,
                    company_id=quote.company_id,
                    branch_id=quote.branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )

        return Response({
            'status': 'success',
            'message': 'Quote accepted and invoice created',
            'invoice_id': str(invoice._id)
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
