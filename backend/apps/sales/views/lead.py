from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.lead import Lead
from apps.sales.serializers.lead import LeadSerializer


class LeadViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'SALES'
    permission_resource = 'lead'
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    lookup_field = '_id'

    def get_queryset(self):
        qs = super().get_queryset()
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        source_param = self.request.query_params.get('source')
        if source_param:
            qs = qs.filter(source=source_param)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save() # Fields are handled in Serializer.create

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def convert(self, request, _id=None):
        """Convert a lead to WON status and optionally create a Quote."""
        lead = self.get_object()
        if lead.status == 'WON':
            return Response(
                {'error': 'Lead already converted'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            lead.status = 'WON'
            lead.save(update_fields=['status'])

            # Optionally auto-create a quote from this lead
            create_quote = request.data.get('create_quote', False)
            if create_quote:
                from apps.sales.models.quote import Quote
                import time, random
                from django.utils import timezone
                quote = Quote.objects.create(
                    quote_number=f"QT-{int(time.time())}-{random.randint(1000, 9999)}",
                    lead=lead,
                    customer=lead.customer,
                    status='DRAFT',
                    total_amount=0,
                    date=timezone.now().date(),
                    expiration_date=None,
                    company_id=lead.company_id,
                    branch_id=lead.branch_id,
                    created_by=request.user,
                    updated_by=request.user,
                )
                return Response({
                    'status': 'success',
                    'message': 'Lead converted and quote created',
                    'quote_id': str(quote._id)
                })

        return Response({'status': 'success', 'message': 'Lead converted to WON'})
