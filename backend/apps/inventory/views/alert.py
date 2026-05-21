from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from django.utils import timezone  # <-- ADD THIS IMPORT
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import Alert
from apps.inventory.serializers.alert import AlertSerializer

class AlertViewSet(CompanyBranchMixin, viewsets.ReadOnlyModelViewSet):
    serializer_class = AlertSerializer
    lookup_field = '_id'
    # Define queryset to satisfy DRF (even though we override get_queryset, but base classes may need it)
    queryset = Alert.objects.none()   # <-- ADD THIS

    def get_queryset(self):
        # Do NOT call super().get_queryset() because CompanyBranchMixin expects self.queryset
        user = self.request.user
        qs = Alert.objects.filter(
            Q(company_id=user.company_id) &
            (Q(branch_id=user.branch_id) | Q(branch_id__isnull=True)) &
            (Q(target_user_id__isnull=True) | Q(target_user_id=user.id))
        )
        return qs.order_by('-created_at')

    @action(detail=False, methods=['post'])
    def mark_read(self, request):
        alert_ids = request.data.get('alert_ids', [])
        if not alert_ids:
            return Response({'error': 'alert_ids required'}, status=400)
        updated = Alert.objects.filter(
            _id__in=alert_ids,
            company_id=request.user.company_id
        ).update(is_read=True, read_at=timezone.now())
        return Response({'marked_read': updated})

    @action(detail=False, methods=['get'])
    def unread_count(self, request):
        count = self.get_queryset().filter(is_read=False).count()
        return Response({'unread_count': count})