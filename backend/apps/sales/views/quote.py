from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.sales.models.quote import Quote
from apps.sales.serializers.quote import QuoteSerializer


class QuoteViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = Quote.objects.all()
    serializer_class = QuoteSerializer
    lookup_field = '_id'

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__variant__product')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        return qs.order_by('-created_at')

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
