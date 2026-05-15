from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db.models import Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import Supplier
from apps.inventory.serializers import SupplierSerializer


class BaseSupplierViewSet(CompanyBranchMixin, viewsets.ModelViewSet):
    queryset = Supplier.objects.all()   # ✅ REQUIRED
    serializer_class = SupplierSerializer

    def get_queryset(self):
        qs = super().get_queryset()

        qs = qs.filter(partner_type=self.partner_type)

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(email__icontains=search)
            )

        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)

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

        self.perform_destroy(instance)

        return Response({
            'status': 'success',
            'message': f'{self.partner_type.title()} "{name}" deleted.'
        })

    def perform_update(self, serializer):
        serializer.save()


class SupplierViewSet(BaseSupplierViewSet):
    partner_type = 'supplier'


class VendorViewSet(BaseSupplierViewSet):
    partner_type = 'vendor'