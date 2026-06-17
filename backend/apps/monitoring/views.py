from rest_framework import viewsets
from rest_framework.response import Response
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from .models import Site, Nvr, Camera
from .serializers import SiteSerializer, NvrSerializer, CameraSerializer


class SiteViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'AI_MONITORING'
    permission_resource = 'site'
    queryset = Site.objects.all()
    serializer_class = SiteSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    filter_fields = {
        'search': ['name', 'location'],
    }

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
            'message': f'Site "{serializer.instance.name}" created successfully.',
            'data': serializer.data,
        }, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'Site "{serializer.instance.name}" updated successfully.',
            'data': serializer.data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.name
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response({
            'status': 'success',
            'message': f'Site "{name}" deleted successfully.',
        })

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class NvrViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'AI_MONITORING'
    permission_resource = 'nvr'
    queryset = Nvr.objects.all()
    serializer_class = NvrSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    filter_fields = {
        'search': ['nvr_name', 'ip'],
        'site': 'site___id',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.select_related('site')

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
            'message': f'NVR "{serializer.instance.nvr_name}" created successfully.',
            'data': serializer.data,
        }, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'NVR "{serializer.instance.nvr_name}" updated successfully.',
            'data': serializer.data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.nvr_name
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response({
            'status': 'success',
            'message': f'NVR "{name}" deleted successfully.',
        })

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)


class CameraViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'AI_MONITORING'
    permission_resource = 'camera'
    queryset = Camera.objects.all()
    serializer_class = CameraSerializer
    lookup_field = '_id'
    lookup_value_regex = '[0-9a-f-]+'
    filter_fields = {
        'search': ['camera', 'zone', 'purpose'],
        'nvr': 'nvr___id',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.select_related('nvr__site')

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
            'message': f'Camera "{serializer.instance.camera}" created successfully.',
            'data': serializer.data,
        }, status=201)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'Camera "{serializer.instance.camera}" updated successfully.',
            'data': serializer.data,
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        name = instance.camera
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response({
            'status': 'success',
            'message': f'Camera "{name}" deleted successfully.',
        })

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)
