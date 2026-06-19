from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.lead import Lead
from apps.sales.serializers.lead import LeadSerializer


class LeadViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'SALES'
    permission_resource = 'lead'
    queryset = Lead.objects.all()
    serializer_class = LeadSerializer
    lookup_field = '_id'
    filter_fields = {
        'status': 'status',
        'source': 'source',
        'search': ['company_name', 'contact_name', 'email', 'phone'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response({
            'status': 'success',
            'message': 'Lead created successfully',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status in ('ACCEPTED', 'WON'):
            return Response(
                {'error': 'Cannot edit an accepted or won lead'},
                status=status.HTTP_400_BAD_REQUEST
            )
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': 'Lead updated successfully',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status in ('ACCEPTED', 'WON'):
            return Response(
                {'error': 'Cannot delete an accepted or won lead'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response({
            'status': 'success',
            'message': 'Lead deleted successfully'
        })

    def perform_create(self, serializer):
        serializer.save()

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['post'])
    def accept(self, request, _id=None):
        """Accept lead - update status to ACCEPTED"""
        lead = self.get_object()
        if lead.status == 'WON':
            return Response(
                {'error': 'Cannot accept a won lead'},
                status=status.HTTP_400_BAD_REQUEST
            )
        lead.status = 'ACCEPTED'
        lead.save(update_fields=['status'])
        return Response({'status': 'success', 'message': 'Lead accepted'})

    @action(detail=True, methods=['post'])
    def create_customer(self, request, _id=None):
        """Create a customer from lead data without changing lead status"""
        lead = self.get_object()
        if lead.customer:
            return Response({
                'status': 'success',
                'message': 'Customer already exists',
                'customer_id': str(lead.customer._id)
            })
        
        customer = lead.create_customer_from_lead(created_by=request.user)
        return Response({
            'status': 'success',
            'message': 'Customer created',
            'customer_id': str(customer._id)
        })

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