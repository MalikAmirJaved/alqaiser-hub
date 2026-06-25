from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import Warehouse
from apps.inventory.serializers import WarehouseSerializer


class WarehouseViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'warehouse'
    action_permission_any_of = {
        "list": [("INVENTORY", "sales_order")],
        "retrieve": [("INVENTORY", "sales_order")],
    }
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    filter_fields = {
        'search': ['warehouse_name', 'code', 'city', 'state', 'country'],
        'is_active': 'is_active',
        'country': 'country__icontains',
        'state': 'state__icontains',
        'city': 'city__icontains',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        serializer.save(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            created_by=request.user,
            updated_by=request.user,
        )

        return Response({
            'status': 'success',
            'message': f'Warehouse "{serializer.instance.warehouse_name}" has been created successfully.',
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
            'message': f'Warehouse "{serializer.instance.warehouse_name}" has been updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        warehouse_name = instance.warehouse_name

        instance.is_deleted = True
        instance.save()

        return Response({
            "status": "success",
            "deleted": True,
            "message": f'Warehouse "{warehouse_name}" has been soft deleted.'
        })

    @action(detail=False, methods=['get'])
    def stats(self, request):
        queryset = self.get_queryset()

        total_warehouses = queryset.count()
        active_warehouses = queryset.filter(is_active=True).count()

        return Response({
            'total_warehouses': total_warehouses,
            'active_warehouses': active_warehouses,
            'inactive_warehouses': total_warehouses - active_warehouses,
        })