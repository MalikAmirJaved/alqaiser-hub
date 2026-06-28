from rest_framework import viewsets, status
from rest_framework.response import Response
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import Supplier, SupplierHistory
from apps.inventory.serializers import SupplierSerializer, SupplierHistorySerializer


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

        qs = qs.filter(partner_type=self.partner_type)

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
            # partner_type=self.partner_type,
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


class SupplierViewSet(BaseSupplierViewSet):
    partner_type = 'supplier'
    permission_resource = 'supplier'


class VendorViewSet(BaseSupplierViewSet):
    partner_type = 'vendor'
    permission_resource = 'vendor'


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