from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from rest_framework.exceptions import ValidationError
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
from apps.finance.serializers import CustomerInvoiceSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.services.invoice_payment import pay_customer_invoice
from apps.finance.services.resolve_reduction import resolve_invoice_line_reduction
from apps.inventory.services.stock_service import (
    direct_deduct_stock,
    direct_release_stock,
)
from apps.audit.models import AuditLog
from apps.audit.serializers import AuditLogSerializer


class CustomerInvoiceViewSet(
    GenericFilterMixin,
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
    action_permission_any_of = {
        "": [("SALES", "sales_customers_invoice")],
    }
    lookup_field = '_id'
    lookup_url_kwarg = '_id'
    filter_fields = {
        'status': 'status',
        'customer': 'customer___id',
        'source': 'source',
        'search': ['invoice_number', 'customer__name'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related('customer').prefetch_related('lines__variant__product')
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                import time, random
                self.perform_create(serializer)
                invoice = serializer.instance
                direct_deduct_stock(
                    invoice.lines.all(),
                    company_id=invoice.company_id,
                    branch_id=invoice.branch_id,
                    reference_id=invoice._id,
                    user=request.user,
                )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'status': 'success',
            'message': f'Invoice {serializer.instance.invoice_number} created',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        import time, random
        from django.db import IntegrityError
        for _ in range(10):
            try:
                serializer.save(
                    invoice_number=f"INV-{int(time.time())}-{random.randint(1000, 9999)}",
                    source='FINANCE',
                    company_id=self.request.user.company_id,
                    branch_id=self.request.user.branch_id,
                    created_by=self.request.user,
                    updated_by=self.request.user,
                )
                return
            except IntegrityError:
                continue
        raise ValueError("Failed to generate unique invoice number")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        if instance.status not in ('DRAFT', 'PENDING'):
            return Response({'error': 'Only DRAFT or PENDING invoices can be updated.'}, status=status.HTTP_400_BAD_REQUEST)
        if instance.payment_status == 'PAID':
            return Response({'error': 'Cannot edit a paid invoice.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            with transaction.atomic():
                direct_release_stock(instance._id, instance.company_id, request.user)
                # Pass raw line IDs through context for matching during update
                raw_lines = request.data.get('lines', [])
                line_ids_map = {idx: str(l.get('id', '')) for idx, l in enumerate(raw_lines) if l.get('id')}
                serializer = self.get_serializer(
                    instance, data=request.data, partial=partial,
                    context={**self.get_serializer_context(), 'raw_line_ids': line_ids_map}
                )
                serializer.is_valid(raise_exception=True)
                serializer.save(updated_by=request.user)
                direct_deduct_stock(
                    instance.lines.all(),
                    company_id=instance.company_id,
                    branch_id=instance.branch_id,
                    reference_id=instance._id,
                    user=request.user,
                )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        response_data = serializer.data
        reduction_conflicts = getattr(serializer, '_reduction_conflicts', [])
        if reduction_conflicts:
            response_data['_reduction_conflicts'] = reduction_conflicts

        return Response({
            'status': 'success',
            'message': f'Invoice updated successfully',
            'data': response_data
        })

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status not in ('DRAFT', 'PENDING'):
            return Response(
                {'error': 'Only DRAFT or PENDING invoices can be deleted'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if instance.payment_status == 'PAID':
            return Response(
                {'error': 'Cannot delete a paid invoice'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        direct_release_stock(instance._id, instance.company_id, request.user)
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

    @action(detail=True, methods=['post'])
    def send_invoice(self, request, _id=None):
        """Mark invoice as SENT (PENDING → SENT)."""
        invoice = self.get_object()
        if invoice.status != 'PENDING':
            return Response({'error': f"Cannot send invoice with status '{invoice.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        invoice.status = 'SENT'
        invoice.save(update_fields=['status', 'updated_at'])
        return Response({
            'status': 'success',
            'message': 'Invoice marked as Sent',
            'data': self.get_serializer(invoice).data,
        })

    @action(detail=True, methods=['post'])
    def cancel_invoice(self, request, _id=None):
        """Cancel invoice and reverse all side-effects (stock, supplier bills, journal entries).

        Request body:
            reason (str): Required cancellation reason
            supplier_action (str): 'go_to_inventory' or 'return_to_supplier' (default)
                Default action for manual item supplier bills.
            line_actions (list): Per-line overrides for manual items:
                [{ "source_line_id": "uuid", "action": "go_to_inventory"|"return_to_supplier" }]
            stock_dispositions (list): Per-line stock handling:
                [{ "source_line_id": "uuid", "disposition": "add_stock"|"damaged" }]
        """
        invoice = self.get_object()
        reason = request.data.get('reason', '')
        if not reason or not reason.strip():
            return Response({'error': 'Cancellation reason is required'}, status=status.HTTP_400_BAD_REQUEST)

        supplier_action = request.data.get('supplier_action', 'return_to_supplier')
        if supplier_action not in ('go_to_inventory', 'return_to_supplier'):
            supplier_action = 'return_to_supplier'

        line_actions = request.data.get('line_actions', [])
        stock_dispositions = request.data.get('stock_dispositions', [])

        try:
            from apps.finance.services.cancel_invoice import cancel_customer_invoice
            success, message = cancel_customer_invoice(
                invoice, request.user,
                reason=reason,
                supplier_action=supplier_action,
                line_actions=line_actions,
                stock_dispositions=stock_dispositions,
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if not success:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        return Response({
            'status': 'success',
            'message': message,
            'data': self.get_serializer(invoice).data,
        })

    @action(detail=True, methods=['post'])
    def refund_payments(self, request, _id=None):
        """Cancel all confirmed payments for this invoice and reverse their effects."""
        invoice = self.get_object()
        try:
            from apps.finance.services.cancel_invoice import refund_invoice_payments
            success, message = refund_invoice_payments(invoice, request.user)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        if not success:
            return Response({'error': message}, status=status.HTTP_400_BAD_REQUEST)
        invoice.refresh_from_db()
        return Response({
            'status': 'success',
            'message': message,
            'data': self.get_serializer(invoice).data,
        })

    @action(detail=True, methods=['post'])
    def resolve_reduction(self, request, _id=None):
        """Resolve a reduction conflict on a manual invoice line."""
        invoice = self.get_object()
        line_id = request.data.get('line_id')
        action_type = request.data.get('action')

        if not line_id or action_type not in ('go_to_inventory', 'return_to_vendor'):
            return Response(
                {'error': 'line_id and a valid action (go_to_inventory or return_to_vendor) are required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            line = invoice.lines.get(_id=line_id, is_deleted=False, is_manual_entry=True)
        except CustomerInvoiceLine.DoesNotExist:
            return Response(
                {'error': 'Manual entry line not found on this invoice.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if line.resolved:
            return Response(
                {'error': 'This reduction has already been resolved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = resolve_invoice_line_reduction(line, action_type, request.user)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': 'success',
            'message': f'Reduction resolved: {action_type}',
            'data': result,
        })

    @action(detail=True, methods=['get'])
    def audit_log(self, request, _id=None):
        """Return audit trail (field-level changes) for this invoice."""
        invoice = self.get_object()
        logs = AuditLog.objects.filter(
            model_name='CustomerInvoice',
            record_id=invoice._id,
            company_id=invoice.company_id,
        ).order_by('-created_at').prefetch_related('field_changes')
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)
