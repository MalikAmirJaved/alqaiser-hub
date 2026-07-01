from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.utils import timezone
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.lead import Lead
from apps.sales.models.status_history import SalesStatusHistory
from apps.sales.serializers.lead import LeadSerializer
from apps.sales.serializers.status_history import SalesStatusHistorySerializer
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

    # ── Helpers ──

    def _log_status_change(self, lead, from_status, to_status, notes=''):
        SalesStatusHistory.objects.create(
            entity_type='LEAD',
            entity_id=lead._id,
            from_status=from_status,
            to_status=to_status,
            notes=notes,
            changed_by=self.request.user,
            company_id=lead.company_id,
            branch_id=lead.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    # ── Workflow Actions ──

    @action(detail=True, methods=['post'])
    def contact(self, request, _id=None):
        """Move lead from NEW → CONTACTED."""
        lead = self.get_object()
        if lead.status != 'NEW':
            return Response({'error': f"Cannot contact lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        from_status = lead.status
        lead.status = 'CONTACTED'
        lead.save(update_fields=['status'])
        self._log_status_change(lead, from_status, 'CONTACTED')
        return Response({'status': 'success', 'message': 'Lead marked as Contacted'})

    @action(detail=True, methods=['post'])
    def schedule_follow_up(self, request, _id=None):
        """Move lead from CONTACTED/QUALIFIED → FOLLOW_UP with a date and notes."""
        lead = self.get_object()
        if lead.status not in ('CONTACTED', 'QUALIFIED'):
            return Response({'error': f"Cannot schedule follow-up for lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        from_status = lead.status
        follow_up_date = request.data.get('follow_up_date')
        follow_up_notes = request.data.get('follow_up_notes', '')
        lead.status = 'FOLLOW_UP'
        lead.follow_up_date = follow_up_date or None
        lead.follow_up_notes = follow_up_notes
        lead.save(update_fields=['status', 'follow_up_date', 'follow_up_notes'])
        self._log_status_change(lead, from_status, 'FOLLOW_UP', follow_up_notes)
        return Response({'status': 'success', 'message': 'Follow-up scheduled'})

    @action(detail=True, methods=['post'])
    def qualify(self, request, _id=None):
        """Move lead from CONTACTED or FOLLOW_UP → QUALIFIED."""
        lead = self.get_object()
        if lead.status not in ('CONTACTED', 'FOLLOW_UP'):
            return Response({'error': f"Cannot qualify lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        from_status = lead.status
        lead.status = 'QUALIFIED'
        lead.save(update_fields=['status'])
        self._log_status_change(lead, from_status, 'QUALIFIED')
        return Response({'status': 'success', 'message': 'Lead qualified'})

    @action(detail=True, methods=['post'])
    def convert_to_customer(self, request, _id=None):
        """Move lead from QUALIFIED → CONVERTED and create a Customer record."""
        lead = self.get_object()
        if lead.status != 'QUALIFIED':
            return Response({'error': f"Cannot convert lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            from_status = lead.status
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
            self._log_status_change(lead, from_status, 'CONVERTED', f"Converted to customer {customer.name}")

        return Response({
            'status': 'success',
            'message': 'Lead converted to customer',
            'customer_id': str(customer._id),
        })

    @action(detail=True, methods=['post'])
    def revert_status(self, request, _id=None):
        """Revert lead one step back in the pipeline."""
        lead = self.get_object()
        prev_map = {
            'CONTACTED': 'NEW',
            'FOLLOW_UP': 'CONTACTED',
            'QUALIFIED': 'CONTACTED',
            'LOST': 'NEW',
        }
        prev = prev_map.get(lead.status)
        if not prev:
            return Response({'error': f"Cannot revert lead with status '{lead.status}'"}, status=status.HTTP_400_BAD_REQUEST)
        from_status = lead.status
        lead.status = prev
        if prev == 'NEW':
            lead.lost_reason = ''
            lead.follow_up_date = None
            lead.follow_up_notes = ''
        lead.save(update_fields=['status', 'lost_reason', 'follow_up_date', 'follow_up_notes'])
        self._log_status_change(lead, from_status, prev)
        return Response({'status': 'success', 'message': f'Lead reverted to {prev}'})

    @action(detail=True, methods=['post'])
    def mark_lost(self, request, _id=None):
        """Move lead to LOST with a reason."""
        lead = self.get_object()
        if lead.status in ('CONVERTED', 'LOST'):
            return Response({'error': f"Cannot mark lead with status '{lead.status}' as lost"}, status=status.HTTP_400_BAD_REQUEST)
        from_status = lead.status
        reason = request.data.get('lost_reason', '')
        lead.status = 'LOST'
        lead.lost_reason = reason
        lead.save(update_fields=['status', 'lost_reason'])
        self._log_status_change(lead, from_status, 'LOST', reason)
        return Response({'status': 'success', 'message': 'Lead marked as Lost'})

    @action(detail=True, methods=['get'])
    def status_history(self, request, _id=None):
        """Return status change history for this lead."""
        lead = self.get_object()
        history = SalesStatusHistory.objects.filter(
            entity_type='LEAD',
            entity_id=lead._id,
            company_id=lead.company_id,
        ).order_by('-created_at')
        serializer = SalesStatusHistorySerializer(history, many=True)
        return Response(serializer.data)
