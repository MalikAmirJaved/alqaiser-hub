from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.inventory.models import AuditLog
from apps.inventory.serializers.audit import AuditLogSerializer
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin


class AuditLogViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'audit_log'
    """
    Read-only viewset for audit logs.
    Accessible only to authenticated users, filtered by company.
    """
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
    lookup_field = '_id'
    filter_fields = {
        'search': ['entity_type', 'action', 'user_name', 'ip_address'],
        'entity_type': 'entity_type',
        'entity_id': 'entity_id',
        'action': 'action',
        'user_id': 'user_id',
        'start_date': 'created_at__date__gte',
        'end_date': 'created_at__date__lte',
    }
    
    def get_queryset(self):
        qs = super().get_queryset()  # applies company/branch filtering
        qs = qs.prefetch_related('field_changes')
        return qs.order_by('-created_at')