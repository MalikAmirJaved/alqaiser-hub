from decimal import Decimal

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
from apps.finance.services.invoice_payment import pay_customer_invoice
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.serializers.invoice import SalesInvoiceSerializer
from rest_framework.exceptions import ValidationError


class SalesInvoiceViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    """
    Full CRUD for Customer Invoices exposed under the Sales module.
    Finance module only has read-only access.
    """
    queryset = CustomerInvoice.objects.all()
    serializer_class = SalesInvoiceSerializer
    permission_module = 'SALES'
    permission_resource = 'sales_customers_invoice'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'
    filter_fields = {
        'status': 'status',
        'customer': 'customer___id',
        'search': ['invoice_number', 'customer__name'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(source__in=['SALES_AGENT', 'SALES_QUOTE', 'SALES_POS'])
        qs = qs.prefetch_related('lines__variant__product')
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        import random
        import time
        serializer.save(
            invoice_number=f'INV-SL-{int(time.time())}-{random.randint(1000, 9999)}',
            source='SALES_AGENT',
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.status != 'DRAFT':
            raise ValidationError('Only DRAFT invoices can be updated.')
        if instance.payment_status == 'PAID':
            raise ValidationError('Cannot edit a paid invoice.')
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT invoices can be deleted'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.payment_status == 'PAID':
            return Response(
                {'error': 'Cannot delete a paid invoice'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response(status=status.HTTP_204_NO_CONTENT)


    @action(detail=True, methods=['post'])
    def post_invoice(self, request, _id=None):
        """Pay invoice in full."""
        invoice = self.get_object()
        success, message = pay_customer_invoice(invoice, request, amount=invoice.outstanding)
        if not success:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'status': 'success',
            'message': message,
            'data': self.get_serializer(invoice).data,
        })

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        """Record a payment against an invoice."""
        invoice = self.get_object()
        try:
            success, message = pay_customer_invoice(invoice, request)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not success:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'status': 'success',
            'message': message,
            'data': self.get_serializer(invoice).data,
        })
