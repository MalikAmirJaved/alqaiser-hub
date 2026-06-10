from rest_framework import generics
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from .models import AuditLog
from .serializers import AuditLogSerializer

class AuditLogListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = AuditLogSerializer
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['model_name', 'record_id', 'module', 'action', 'user__id']

    def get_queryset(self):
        user = self.request.user
        # Filter by company/branch if needed (company_id is on model)
        qs = AuditLog.objects.filter(company_id=user.company_id)
        return qs.order_by('-created_at')