from rest_framework import viewsets
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import JournalEntry
from apps.finance.serializers import JournalEntrySerializer
from apps.finance.mixins import CompanyBranchUserMixin

class JournalEntryViewSet(CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = JournalEntry.objects.all()
    serializer_class = JournalEntrySerializer
    permission_module = 'FINANCE'
    permission_resource = 'journal'
    lookup_field = '_id'
    def perform_create(self, serializer):
        serializer.save(company_id=self.request.user.company_id,
                        branch_id=self.request.user.branch_id,
                        created_by=self.request.user)