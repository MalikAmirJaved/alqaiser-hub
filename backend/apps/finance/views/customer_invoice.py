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
from apps.finance.services.resolve_reduction import (
    resolve_invoice_line_reduction,
    resolve_variant_line_reduction,
)
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
        if instance.status not in ('DRAFT', 'PENDING', 'SENT'):
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
        variant_reduction_conflicts = getattr(serializer, '_variant_reduction_conflicts', [])
        if variant_reduction_conflicts:
            response_data['_variant_reduction_conflicts'] = variant_reduction_conflicts

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
        """Resolve a quantity reduction on an invoice line (manual or variant)."""
        invoice = self.get_object()
        line_id = request.data.get('line_id')
        action_type = request.data.get('action')

        if not line_id:
            return Response(
                {'error': 'line_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            line = invoice.lines.get(_id=line_id, is_deleted=False)
        except CustomerInvoiceLine.DoesNotExist:
            return Response(
                {'error': 'Invoice line not found.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if line.resolved:
            return Response(
                {'error': 'This reduction has already been resolved.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            if line.is_manual_entry:
                if action_type not in ('go_to_inventory', 'return_to_vendor'):
                    return Response(
                        {'error': 'action must be go_to_inventory or return_to_vendor for manual lines.'},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                result = resolve_invoice_line_reduction(
                    line,
                    action_type,
                    request.user,
                    product_qty=request.data.get('product_qty'),
                    damage_qty=request.data.get('damage_qty'),
                    damage_reason=request.data.get('damage_reason', ''),
                )
            else:
                result = resolve_variant_line_reduction(
                    line,
                    request.user,
                    product_qty=request.data.get('product_qty'),
                    damage_qty=request.data.get('damage_qty'),
                    damage_reason=request.data.get('damage_reason', ''),
                )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        return Response({
            'status': 'success',
            'message': f'Reduction resolved',
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

    @action(detail=True, methods=['get'], url_path='activity-log')
    def activity_log(self, request, _id=None):
        """
        Unified activity timeline for this invoice:
        creation, status changes, edits, payments, returns, cancellations.
        """
        invoice = self.get_object()
        events = []

        # ── 1. Invoice created ───────────────────────────────────
        events.append({
            'type': 'created',
            'icon': 'plus',
            'color': 'success',
            'timestamp': invoice.created_at.isoformat(),
            'user': invoice.created_by.get_full_name() or invoice.created_by.email if invoice.created_by else 'System',
            'title': 'Invoice created',
            'description': f'Invoice {invoice.invoice_number} created for {invoice.customer.name if invoice.customer else "Walk-in customer"}',
            'amount': str(invoice.amount),
            'details': [
                {'label': 'Invoice #', 'value': invoice.invoice_number},
                {'label': 'Customer', 'value': invoice.customer.name if invoice.customer else 'Walk-in'},
                {'label': 'Amount', 'value': str(invoice.amount)},
                {'label': 'Due Date', 'value': str(invoice.due_date)},
            ],
        })

        # ── 2. Status changes from audit logs ────────────────────
        audit_logs = AuditLog.objects.filter(
            model_name='CustomerInvoice',
            record_id=invoice._id,
            company_id=invoice.company_id,
        ).prefetch_related('field_changes').order_by('created_at')

        for log in audit_logs:
            if log.action == 'CREATE':
                continue  # already handled above

            field_changes = log.field_changes.all()
            if not field_changes:
                continue

            # Detect status changes
            status_change = next((c for c in field_changes if c.field_name == 'status'), None)
            amount_change = next((c for c in field_changes if c.field_name == 'amount'), None)

            if status_change:
                action_label = status_change.new_value or log.action.lower()
                icon = 'check-circle' if status_change.new_value in ('SENT', 'CANCELLED') else 'edit'
                color = 'success' if status_change.new_value == 'SENT' else 'warning' if status_change.new_value == 'CANCELLED' else 'info'

                events.append({
                    'type': 'status_change',
                    'icon': icon,
                    'color': color,
                    'timestamp': log.created_at.isoformat(),
                    'user': log.user.get_full_name() or log.user.email if log.user else 'System',
                    'title': f'Status changed to {status_change.new_value}',
                    'description': f'Invoice status changed from "{status_change.old_value}" to "{status_change.new_value}"',
                    'amount': None,
                    'details': [
                        {'label': 'From', 'value': status_change.old_value or '—'},
                        {'label': 'To', 'value': status_change.new_value or '—'},
                    ],
                })
            elif amount_change:
                events.append({
                    'type': 'edited',
                    'icon': 'edit',
                    'color': 'info',
                    'timestamp': log.created_at.isoformat(),
                    'user': log.user.get_full_name() or log.user.email if log.user else 'System',
                    'title': 'Invoice amount updated',
                    'description': f'Amount changed from {amount_change.old_value} to {amount_change.new_value}',
                    'amount': amount_change.new_value,
                    'details': [
                        {'label': 'Old Amount', 'value': amount_change.old_value or '—'},
                        {'label': 'New Amount', 'value': amount_change.new_value or '—'},
                    ],
                })
            else:
                changed_fields = ', '.join(c.field_name for c in field_changes)
                events.append({
                    'type': 'edited',
                    'icon': 'edit',
                    'color': 'info',
                    'timestamp': log.created_at.isoformat(),
                    'user': log.user.get_full_name() or log.user.email if log.user else 'System',
                    'title': 'Invoice updated',
                    'description': f'Fields updated: {changed_fields}',
                    'amount': None,
                    'details': [
                        {'label': 'Fields', 'value': changed_fields},
                    ],
                })

        # ── 3. Payments ──────────────────────────────────────────
        from apps.finance.services.payable import get_payments_queryset
        payments = get_payments_queryset(invoice).order_by('payment_date')
        for p in payments:
            is_refund = p.payment_type == 'PAYMENT'
            events.append({
                'type': 'payment_refund' if is_refund else 'payment',
                'icon': 'undo' if is_refund else 'dollar-sign',
                'color': 'destructive' if is_refund else 'success',
                'timestamp': p.payment_date.isoformat() + 'T12:00:00',
                'user': p.created_by.get_full_name() or p.created_by.email if p.created_by else 'System',
                'title': f'Refund of {p.amount}' if is_refund else f'Payment of {p.amount}',
                'description': (
                    f'Refunded {p.amount} via {p.payment_method}' if is_refund
                    else f'Received {p.amount} via {p.payment_method}'
                ) + (f' (Ref: {p.reference_number})' if p.reference_number else ''),
                'amount': str(p.amount),
                'status': p.status,
                'details': [
                    {'label': 'Amount', 'value': str(p.amount)},
                    {'label': 'Method', 'value': p.payment_method.replace('_', ' ')},
                    {'label': 'Date', 'value': str(p.payment_date)},
                    {'label': 'Reference', 'value': p.reference_number or '—'},
                    {'label': 'Status', 'value': p.status},
                ],
            })

        # ── 4. Returns / Refunds ─────────────────────────────────
        from apps.inventory.models.return_refund import ReturnRefund, ReturnRefundLine
        returns = ReturnRefund.objects.filter(
            document_id=invoice._id,
            return_type='INVOICE',
            company_id=invoice.company_id,
            is_deleted=False,
        ).select_related('warehouse', 'completed_by').order_by('-created_at')

        for ret in returns:
            ret_lines = ret.lines.select_related('variant').all()
            line_details = []
            total_returned = Decimal('0')
            for rl in ret_lines:
                sku = rl.variant.sku if rl.variant else (rl.manual_variant_sku or '—')
                name = rl.variant.product.product_name if rl.variant and rl.variant.product else (rl.manual_variant_name or '')
                line_details.append({'label': f'{sku} {name}', 'value': f'x{rl.quantity} = {rl.refund_amount}'})
                total_returned += Decimal(str(rl.refund_amount))

            events.append({
                'type': 'return',
                'icon': 'rotate-ccw',
                'color': 'warning',
                'timestamp': ret.return_date.isoformat() if ret.return_date else ret.created_at.isoformat(),
                'user': ret.completed_by.get_full_name() or ret.completed_by.email if ret.completed_by else 'System',
                'title': f'Return {ret.return_number} — {ret.status}',
                'description': f'{len(list(ret_lines))} item(s) returned, refund: {ret.total_refund_amount}',
                'amount': str(ret.total_refund_amount),
                'status': ret.status,
                'details': [
                    {'label': 'Return #', 'value': ret.return_number},
                    {'label': 'Refund Amount', 'value': str(ret.total_refund_amount)},
                    {'label': 'Reason', 'value': ret.reason or '—'},
                    {'label': 'Status', 'value': ret.status},
                    {'label': 'Warehouse', 'value': ret.warehouse.warehouse_name if ret.warehouse else '—'},
                    *line_details,
                ],
            })

        # ── 5. Cancellation ──────────────────────────────────────
        if invoice.status == 'CANCELLED' and invoice.cancelled_at:
            events.append({
                'type': 'cancelled',
                'icon': 'x-circle',
                'color': 'destructive',
                'timestamp': invoice.cancelled_at.isoformat(),
                'user': invoice.cancelled_by.get_full_name() or invoice.cancelled_by.email if invoice.cancelled_by else 'System',
                'title': 'Invoice cancelled',
                'description': f'Invoice {invoice.invoice_number} was cancelled',
                'amount': None,
                'details': [
                    {'label': 'Reason', 'value': invoice.notes or '—'},
                ],
            })

        # Sort by timestamp descending
        events.sort(key=lambda e: e['timestamp'], reverse=True)

        return Response(events)
