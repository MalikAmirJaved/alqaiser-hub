from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.lead import Lead
from apps.sales.serializers.lead import LeadSerializer
from apps.inventory.models import Customer


class LeadViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'SALES'
    permission_resource = 'lead'
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    lookup_field = '_id'
    filter_fields = {
        'status': 'status',
        'source': 'source',
        'search': ['company_name', 'first_name', 'last_name', 'email', 'phone'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    # ── Workflow Actions ──

    @action(detail=True, methods=['post'])
    def contact(self, request, _id=None):
        """Move lead from NEW → CONTACTED."""
        lead = self.get_object()
        if lead.status != 'NEW':
            return Response({'error': f"Cannot contact lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        lead.status = 'CONTACTED'
        lead.save(update_fields=['status'])
        return Response({'status': 'success', 'message': 'Lead marked as Contacted'})

    @action(detail=True, methods=['post'])
    def schedule_follow_up(self, request, _id=None):
        """Move lead from CONTACTED → FOLLOW_UP with a date and notes."""
        lead = self.get_object()
        if lead.status not in ('CONTACTED', 'QUALIFIED'):
            return Response({'error': f"Cannot schedule follow-up for lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        follow_up_date = request.data.get('follow_up_date')
        follow_up_notes = request.data.get('follow_up_notes', '')
        lead.status = 'FOLLOW_UP'
        lead.follow_up_date = follow_up_date or None
        lead.follow_up_notes = follow_up_notes
        lead.save(update_fields=['status', 'follow_up_date', 'follow_up_notes'])
        return Response({'status': 'success', 'message': 'Follow-up scheduled'})

    @action(detail=True, methods=['post'])
    def qualify(self, request, _id=None):
        """Move lead from CONTACTED or FOLLOW_UP → QUALIFIED."""
        lead = self.get_object()
        if lead.status not in ('CONTACTED', 'FOLLOW_UP'):
            return Response({'error': f"Cannot qualify lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        lead.status = 'QUALIFIED'
        lead.save(update_fields=['status'])
        return Response({'status': 'success', 'message': 'Lead qualified'})

    @action(detail=True, methods=['post'])
    def convert_to_customer(self, request, _id=None):
        """Move lead from QUALIFIED → CONVERTED and create a Customer record."""
        lead = self.get_object()
        if lead.status != 'QUALIFIED':
            return Response({'error': f"Cannot convert lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            import time, random
            customer = Customer.objects.create(
                customer_code=f"CUST-{int(time.time())}-{random.randint(1000, 9999)}",
                name=lead.company_name or f"{lead.first_name} {lead.last_name}".strip(),
                contact_person=f"{lead.first_name} {lead.last_name}".strip(),
                email=lead.email,
                phone=lead.phone,
                address_line=lead.address_line,
                city=lead.city,
                state=lead.state,
                country=lead.country,
                company_id=lead.company_id,
                branch_id=lead.branch_id,
                created_by=request.user,
                updated_by=request.user,
            )
            lead.converted_customer = customer
            lead.status = 'CONVERTED'
            lead.save(update_fields=['converted_customer', 'status'])

        return Response({
            'status': 'success',
            'message': 'Lead converted to customer',
            'customer_id': str(customer._id),
        })

    @action(detail=True, methods=['post'])
    def mark_lost(self, request, _id=None):
        """Move lead to LOST with a reason."""
        lead = self.get_object()
        if lead.status in ('CONVERTED', 'LOST'):
            return Response({'error': f"Cannot mark lead with status '{lead.status}' as lost"}, status=status.HTTP_400_BAD_REQUEST)
        reason = request.data.get('lost_reason', '')
        lead.status = 'LOST'
        lead.lost_reason = reason
        lead.save(update_fields=['status', 'lost_reason'])
        return Response({'status': 'success', 'message': 'Lead marked as Lost'})
