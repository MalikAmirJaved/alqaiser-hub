# ============================================================
# File: backend/apps/finance/views/supplier_bill.py
# ============================================================
from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import SupplierBill
from apps.finance.serializers import SupplierBillSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.services.invoice_payment import pay_supplier_bill


class SupplierBillViewSet(
    GenericFilterMixin,
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = SupplierBill.objects.select_related('supplier').all()
    serializer_class = SupplierBillSerializer
    permission_module = 'FINANCE'
    permission_resource = 'supplier_bill'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'
    filter_fields = {
        'search': ['bill_number', 'supplier__name', 'notes'],
        'status': 'status',
        'supplier': 'supplier___id',
    }

    def get_queryset(self):
        return super().get_queryset().order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Supplier bill created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response(
                {
                    "success": False,
                    "error": "Cannot update bill that is already posted or cancelled",
                    "detail": f"Bill status is '{instance.status}'. Only DRAFT bills can be updated."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Supplier bill updated successfully",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def _pay_bill(self, bill, request, amount=None):
        try:
            success, message = pay_supplier_bill(bill, request, amount=amount)
        except ValueError as exc:
            return Response(
                {'success': False, 'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception as exc:
            return Response(
                {'success': False, 'error': 'Failed to pay bill', 'detail': str(exc)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )
        if not success:
            return Response(
                {'success': False, 'error': message},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(
            {
                'success': True,
                'message': message,
                'data': self.get_serializer(bill).data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def post_bill(self, request, _id=None):
        """Pay bill in full (legacy alias — books JE + confirms payment)."""
        bill = self.get_object()
        return self._pay_bill(bill, request, amount=bill.outstanding)

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        """Record a payment against a bill (books JE on first payment)."""
        bill = self.get_object()
        return self._pay_bill(bill, request)
