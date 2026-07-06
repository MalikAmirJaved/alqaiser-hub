from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.contrib.contenttypes.models import ContentType
from django.db.models import Sum, Count
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import Supplier, SupplierHistory, PurchaseOrder, AuditLog
from apps.inventory.serializers import SupplierSerializer, SupplierHistorySerializer, PurchaseOrderSerializer, AuditLogSerializer
from apps.finance.models import SupplierBill, Payment
from apps.finance.serializers import SupplierBillSerializer, PaymentSerializer
from apps.sales.models import QuoteLine
from apps.finance.models import CustomerInvoiceLine


class BaseSupplierViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    action_permission_any_of = {
        "": [("FINANCE", "supplier_bill"), ("FINANCE", "expense")],
    }
    queryset = Supplier.objects.all()
    serializer_class = SupplierSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    filter_fields = {
        'search': ['name', 'code', 'email', 'phone', 'contact_person'],
        'status': 'status',
        'country': 'country__icontains',
        'city': 'city__icontains',
    }

    def get_queryset(self):
        qs = super().get_queryset()

        qs = qs.filter(is_deleted=False, partner_type=self.partner_type)

        sort_by = self.request.query_params.get('sort_by')
        sort_order = self.request.query_params.get('sort_order', 'asc')

        if sort_by:
            order = '' if sort_order == 'asc' else '-'
            qs = qs.order_by(f'{order}{sort_by}')

        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save(
            company_id=user.company_id,
            branch_id=user.branch_id,
            partner_type=self.partner_type,
            created_by=user,
            updated_by=user,
        )

        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{serializer.instance.name}" created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        serializer = self.get_serializer(
            instance,
            data=request.data,
            partial=partial
        )

        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{serializer.instance.name}" updated.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name

        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=["is_deleted", "deleted_by"])

        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{name}" deleted.'
        })

    def perform_update(self, serializer):
        serializer.save()

    @action(detail=True, methods=['get'], url_path='detail')
    def full_detail(self, request, _id=None):
        supplier = self.get_object()

        purchase_orders = PurchaseOrder.objects.filter(
            supplier=supplier, is_deleted=False
        ).select_related('supplier', 'warehouse').prefetch_related('lines').order_by('-created_at')

        bills = SupplierBill.objects.filter(
            supplier=supplier, is_deleted=False
        ).select_related('supplier', 'purchase_order').order_by('-bill_date')

        bill_ids = list(bills.values_list('id', flat=True))
        if bill_ids:
            ct = ContentType.objects.get_for_model(SupplierBill)
            payments = Payment.objects.filter(
                content_type=ct, object_id__in=bill_ids, is_deleted=False
            ).order_by('-payment_date')
        else:
            payments = Payment.objects.none()

        quote_lines = QuoteLine.objects.filter(vendor=supplier).select_related('quote').order_by('-created_at')

        invoice_lines = CustomerInvoiceLine.objects.filter(vendor=supplier).select_related('customer_invoice').order_by('-created_at')

        audit_logs = AuditLog.objects.filter(
            entity_type='supplier', entity_id=supplier._id
        ).prefetch_related('field_changes').order_by('-created_at')

        history = SupplierHistory.objects.filter(supplier=supplier).order_by('-created_at')

        po_count = purchase_orders.count()
        po_amount = purchase_orders.aggregate(t=Sum('total_amount'))['t'] or 0
        bill_count = bills.count()
        bill_amount = bills.aggregate(t=Sum('amount'))['t'] or 0
        paid = payments.filter(status='CONFIRMED').aggregate(t=Sum('amount'))['t'] or 0

        return Response({
            'supplier': SupplierSerializer(supplier).data,
            'summary': {
                'total_purchase_orders': po_count,
                'total_po_amount': str(po_amount),
                'total_bills': bill_count,
                'total_bill_amount': str(bill_amount),
                'total_paid': str(paid),
                'total_outstanding': str(max(float(bill_amount) - float(paid), 0)),
                'balance': str(supplier.balance),
                'credit': str(supplier.credit),
            },
            'purchase_orders': PurchaseOrderSerializer(purchase_orders, many=True, context={'request': request}).data,
            'bills': SupplierBillSerializer(bills, many=True).data,
            'payments': PaymentSerializer(payments, many=True).data,
            'quote_lines': [
                {
                    'id': str(ql._id),
                    'quote_number': ql.quote.quote_number if ql.quote else '-',
                    'quote_status': ql.quote.status if ql.quote else '-',
                    'item': ql.manual_variant_name or (ql.variant.sku if ql.variant else '-'),
                    'quantity': ql.quantity,
                    'unit_price': str(ql.unit_price),
                    'line_total': str(ql.line_total),
                    'created_at': ql.created_at.isoformat() if ql.created_at else None,
                }
                for ql in quote_lines
            ],
            'invoice_lines': [
                {
                    'id': str(il._id),
                    'invoice_number': il.customer_invoice.invoice_number if il.customer_invoice else '-',
                    'invoice_status': il.customer_invoice.status if il.customer_invoice else '-',
                    'item': il.manual_variant_name or (il.variant.sku if il.variant else '-'),
                    'quantity': il.quantity,
                    'unit_price': str(il.unit_price),
                    'line_total': str(il.line_total),
                    'created_at': il.created_at.isoformat() if il.created_at else None,
                }
                for il in invoice_lines
            ],
            'history': SupplierHistorySerializer(history, many=True).data,
            'audit_logs': AuditLogSerializer(audit_logs, many=True).data,
        })


class SupplierViewSet(BaseSupplierViewSet):
    partner_type = 'supplier'
    permission_resource = 'supplier'


class SupplierHistoryViewSet(
    GenericFilterMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    viewsets.ReadOnlyModelViewSet
):
    permission_module = 'INVENTORY'
    permission_resource = 'supplier'
    queryset = SupplierHistory.objects.select_related('supplier').all()
    serializer_class = SupplierHistorySerializer
    lookup_field = '_id'
    filter_fields = {
        'supplier': 'supplier___id',
        'transaction_type': 'transaction_type',
    }

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')