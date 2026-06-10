from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db.models import Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import Warehouse
from apps.inventory.serializers import WarehouseSerializer


class WarehouseViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'warehouse'
    queryset = Warehouse.objects.all()
    serializer_class = WarehouseSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'

    def get_queryset(self):
        qs = super().get_queryset()

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(warehouse_name__icontains=search) |
                Q(code__icontains=search) |
                Q(city__icontains=search) |
                Q(state__icontains=search) |
                Q(country__icontains=search)
            )

        is_active = self.request.query_params.get('is_active')
        if is_active is not None:
            qs = qs.filter(is_active=is_active.lower() == 'true')

        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country__icontains=country)

        state = self.request.query_params.get('state')
        if state:
            qs = qs.filter(state__icontains=state)

        city = self.request.query_params.get('city')
        if city:
            qs = qs.filter(city__icontains=city)

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