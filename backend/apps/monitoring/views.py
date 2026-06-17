from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from django.conf import settings
from urllib.parse import quote
from .models import Site, Nvr, Camera
from .serializers import SiteSerializer, NvrSerializer, CameraSerializer
from .stream_manager import StreamManager


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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def start_stream(request):
    camera_id = request.data.get('camera_id')
    if not camera_id:
        return Response({'error': 'camera_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        camera = Camera.objects.get(_id=camera_id, is_deleted=False)
    except Camera.DoesNotExist:
        return Response({'error': 'Camera not found'}, status=status.HTTP_404_NOT_FOUND)

    nvr = camera.nvr

    existing = StreamManager.get_active_stream(str(camera._id))
    if existing:
        hls_url = request.build_absolute_uri(f'{settings.MEDIA_URL}streams/{existing}/index.m3u8')
        return Response({'stream_id': existing, 'hls_url': hls_url})

    username = quote(nvr.nvr_username, safe='')
    password = quote(nvr.password, safe='')
    channel = camera.channel
    rtsp_url = f'rtsp://{username}:{password}@{nvr.ip}:{nvr.port}/streaming/channels/{channel}'

    try:
        stream_id, hls_path = StreamManager.start(str(camera._id), rtsp_url)
        hls_url = request.build_absolute_uri(hls_path)
    except RuntimeError as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    return Response({'stream_id': stream_id, 'hls_url': hls_url})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def stop_stream(request):
    stream_id = request.data.get('stream_id')
    if not stream_id:
        return Response({'error': 'stream_id is required'}, status=status.HTTP_400_BAD_REQUEST)

    StreamManager.stop(stream_id)
    return Response({'status': 'stopped'})
