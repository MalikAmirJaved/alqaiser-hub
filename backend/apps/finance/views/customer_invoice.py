from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
from apps.finance.serializers import CustomerInvoiceSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.services.invoice_payment import pay_customer_invoice


class CustomerInvoiceViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    """
    Full CRUD + posting action for Customer Invoices in the Finance module.
    """
    queryset = CustomerInvoice.objects.all()
    serializer_class = CustomerInvoiceSerializer
    permission_module = 'FINANCE'
    permission_resource = 'customer_invoice'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__variant__product')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        customer_uuid = self.request.query_params.get('customer')
        if customer_uuid:
            from apps.inventory.models import Customer
            try:
                customer = Customer.objects.get(_id=customer_uuid, company_id=self.request.user.company_id)
                qs = qs.filter(customer=customer)
            except Customer.DoesNotExist:
                return qs.none()
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        import time, random
        serializer.save(
            invoice_number=f"INV-{int(time.time())}-{random.randint(1000, 9999)}",
            source='FINANCE',
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.status != 'DRAFT':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Only DRAFT invoices can be updated.")
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT invoices can be deleted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    def _pay_invoice(self, invoice, request, amount=None):
        try:
            success, message = pay_customer_invoice(invoice, request, amount=amount)
        except ValueError as exc:
            return Response({'error': str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        if not success:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'status': 'success',
            'message': message,
            'data': self.get_serializer(invoice).data,
        })

    @action(detail=True, methods=['post'])
    def post_invoice(self, request, _id=None):
        """Pay invoice in full (legacy alias — books JE + confirms payment)."""
        invoice = self.get_object()
        return self._pay_invoice(invoice, request, amount=invoice.outstanding)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        """Record a payment against an invoice (books JE on first payment)."""
        invoice = self.get_object()
        return self._pay_invoice(invoice, request)