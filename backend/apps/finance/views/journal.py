from rest_framework import viewsets
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import OrderingFilter, SearchFilter
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import JournalEntry
from apps.finance.serializers import JournalEntrySerializer
from apps.finance.mixins import CompanyBranchUserMixin

class JournalEntryViewSet(CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
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

    def get_queryset(self):
        # Ensure only current tenant's data
        return super().get_queryset().select_related().prefetch_related('lines__account')