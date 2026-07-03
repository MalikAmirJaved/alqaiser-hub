from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction

from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models.return_refund import ReturnRefund
from apps.inventory.serializers.return_refund import (
    ReturnRefundListSerializer,
    ReturnRefundDetailSerializer,
    CreateReturnRefundSerializer,
    LookupDocumentSerializer,
)
from apps.inventory.services.return_refund_service import (
    lookup_paid_document,
    create_return_refund,
)


class ReturnRefundViewSet(
    GenericFilterMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    viewsets.ModelViewSet,
):
    permission_module = 'INVENTORY'
    permission_resource = 'return_refund'
    queryset = ReturnRefund.objects.all()
    lookup_field = '_id'
    filter_fields = {
        'status': 'status',
        'return_type': 'return_type',
        'search': ['return_number', 'document_number', 'customer__name'],
    }

    def get_serializer_class(self):
        if self.action == 'list':
            return ReturnRefundListSerializer
        return ReturnRefundDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related('customer', 'warehouse').prefetch_related('lines')
        return qs

    def create(self, request, *args, **kwargs):
        """
        Create a return refund. Expects:
        {
            return_type: "INVOICE" | "POS",
            document_id: "uuid",
            warehouse_id: "uuid",
            return_date: "2026-07-03T...",
            reason: "...",
            lines: [
                {
                    source_line_id: "uuid",
                    quantity: 5,
                    unit_price: 100.00,
                    refund_amount: 500.00,
                    restock: true,
                    return_to_supplier: false,
                    reason: "..."
                }
            ]
        }
        """
        serializer = CreateReturnRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            ret = create_return_refund(serializer.validated_data, request.user)
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        read_serializer = ReturnRefundDetailSerializer(ret, context={'request': request})
        return Response({
            'status': 'success',
            'message': f'Return {ret.return_number} processed successfully',
            'data': read_serializer.data,
        }, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['post'])
    def lookup_document(self, request):
        """
        Look up a paid document by its number.
        Returns the document's line items available for return.

        Request: { return_type: "INVOICE"|"POS", document_number: "INV-..." }
        Response: { document info, lines: [...] }
        """
        serializer = LookupDocumentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        rt = serializer.validated_data['return_type']
        doc_number = serializer.validated_data['document_number']

        try:
            doc, customer, lines = lookup_paid_document(
                rt, doc_number, request.user.company_id
            )
        except ValueError as e:
            return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # Build response
        doc_info = {
            'document_id': str(doc._id),
            'document_number': doc_number,
            'return_type': rt,
            'customer': {
                'id': str(customer._id) if customer else None,
                'name': customer.name if customer else 'Walk-in Customer',
            } if customer else None,
        }

        lines_data = []
        for line in lines:
            lines_data.append({
                'source_line_id': str(line['source_line_id']),
                'variant_id': str(line['variant']._id) if line['variant'] else None,
                'variant_sku': line['variant'].sku if line['variant'] else (line['manual_variant_sku'] or '—'),
                'product_name': line['variant'].product.product_name if line['variant'] else line['manual_variant_name'],
                'unit_price': float(line['unit_price']),
                'max_returnable': line['quantity'],
                'is_manual_entry': line['is_manual_entry'],
                'manual_variant_name': line['manual_variant_name'],
                'manual_variant_sku': line['manual_variant_sku'],
                'vendor_id': str(line['vendor']._id) if line['vendor'] else None,
                'vendor_name': line['vendor'].name if line['vendor'] else None,
                'tax_rate': float(line['tax_rate']),
                'discount_amount': float(line['discount_amount']),
            })

        return Response({
            'status': 'success',
            'data': {
                'document': doc_info,
                'lines': lines_data,
            }
        })

    @action(detail=True, methods=['get'])
    def audit_log(self, request, _id=None):
        """Return audit trail for this return."""
        ret = self.get_object()
        from apps.audit.models import AuditLog
        from apps.audit.serializers import AuditLogSerializer

        logs = AuditLog.objects.filter(
            model_name='ReturnRefund',
            record_id=ret._id,
            company_id=ret.company_id,
        ).order_by('-created_at').prefetch_related('field_changes')
        serializer = AuditLogSerializer(logs, many=True)
        return Response(serializer.data)
