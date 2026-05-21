from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from django.db.models import Q
from apps.inventory.models import AuditLog
from apps.inventory.serializers.audit import AuditLogSerializer
from apps.common.baseauthentication import CompanyBranchMixin


class AuditLogViewSet(CompanyBranchMixin, viewsets.ReadOnlyModelViewSet):
    """
    Read-only viewset for audit logs.
    Accessible only to authenticated users, filtered by company.
    """
    serializer_class = AuditLogSerializer
    queryset = AuditLog.objects.all()
    lookup_field = '_id'
    
    def get_queryset(self):
        qs = super().get_queryset()  # applies company/branch filtering
        qs = qs.prefetch_related('field_changes')
        
        # Optional filters via query params
        entity_type = self.request.query_params.get('entity_type')
        if entity_type:
            qs = qs.filter(entity_type=entity_type)
        
        entity_id = self.request.query_params.get('entity_id')
        if entity_id:
            qs = qs.filter(entity_id=entity_id)
        
        action = self.request.query_params.get('action')
        if action:
            qs = qs.filter(action=action)
        
        user_id = self.request.query_params.get('user_id')
        if user_id:
            qs = qs.filter(user_id=user_id)
        
        start_date = self.request.query_params.get('start_date')
        if start_date:
            qs = qs.filter(created_at__date__gte=start_date)
        
        end_date = self.request.query_params.get('end_date')
        if end_date:
            qs = qs.filter(created_at__date__lte=end_date)
        
        return qs.order_by('-created_at')