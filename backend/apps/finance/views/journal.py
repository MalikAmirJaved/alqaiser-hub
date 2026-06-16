from rest_framework import viewsets, status
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import JournalEntry
from apps.finance.serializers import JournalEntrySerializer
from apps.finance.mixins import CompanyBranchUserMixin

class JournalEntryViewSet(GenericFilterMixin, CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    permission_module = 'FINANCE'
    permission_resource = 'journal_entrie'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'
    filter_backends = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    filterset_fields = {
        'date': ['exact', 'gte', 'lte'],
        'entry_number': ['exact', 'icontains'],
        'reference_type': ['exact'],
        'reference_id': ['exact'],
        'is_posted': ['exact'],
    }
    ordering_fields = ['date', 'entry_number', 'created_at']
    search_fields = ['entry_number', 'description']
    filter_fields = {
        'search': ['entry_number', 'description'],
        'is_posted': 'is_posted',
    }

    def get_queryset(self):
        # Ensure only current tenant's data
        return super().get_queryset().select_related().prefetch_related('lines__account')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'success': True,
            'message': 'Journal entry created successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'success': True,
            'message': 'Journal entry updated successfully',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save()
        return Response({
            'success': True,
            'message': 'Journal entry deleted successfully'
        }, status=status.HTTP_200_OK)