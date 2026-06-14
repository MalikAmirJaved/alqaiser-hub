from rest_framework import viewsets
from rest_framework.response import Response
from django.db.models import Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import Brand
from apps.inventory.serializers import BrandSerializer


class BrandViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'brand'
    queryset = Brand.objects.all()
    serializer_class = BrandSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'

    def get_queryset(self):
        qs = super().get_queryset()

        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(
                Q(name__icontains=search) |
                Q(code__icontains=search) |
                Q(country_of_origin__icontains=search)
            )

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
            'message': f'Brand "{serializer.instance.name}" has been created successfully.',
            'data': serializer.data
        }, status=201)

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
            'message': f'Brand "{serializer.instance.name}" has been updated successfully.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        brand_name = instance.name

        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=["is_deleted", "deleted_by"])

        return Response({
            'status': 'success',
            'message': f'Brand "{brand_name}" has been deleted successfully.'
        })

    def perform_update(self, serializer):
        serializer.save()