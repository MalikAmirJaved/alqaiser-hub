from decimal import Decimal

from django.db.models import Count, Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.finance.models import CustomerInvoice
from apps.finance.services.payable import get_outstanding
from apps.inventory.models import Customer
from apps.permissions.mixins import PermissionRequiredMixin
from apps.sales.models.lead import Lead
from apps.sales.models.quote import Quote


class SalesDashboardViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    permission_module = 'SALES'
    permission_resource = 'dashboard'

    @action(detail=False, methods=['get'])
    def summary(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        today = timezone.now().date()
        month_start = today.replace(day=1)

        leads = Lead.objects.filter(company_id=company_id, branch_id=branch_id, is_deleted=False)
        quotes = Quote.objects.filter(company_id=company_id, branch_id=branch_id, is_deleted=False)
        customers = Customer.objects.filter(company_id=company_id, is_deleted=False)
        invoices = CustomerInvoice.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).exclude(status='CANCELLED')

        leads_by_status = leads.values('status').annotate(count=Count('id'))
        quotes_by_status = quotes.values('status').annotate(count=Count('id'))

        quote_value = quotes.aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        invoice_total = invoices.aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        outstanding = sum(get_outstanding(inv) for inv in invoices)
        paid_mtd = sum(inv.paid_amount for inv in invoices if inv.payment_status == 'PAID')

        won_leads = leads.filter(status='WON').count()
        total_leads = leads.count()
        conversion_rate = round((won_leads / total_leads) * 100, 1) if total_leads else 0

        return Response({
            'kpis': {
                'total_leads': total_leads,
                'new_leads_mtd': leads.filter(created_at__date__gte=month_start).count(),
                'total_quotes': quotes.count(),
                'quote_value': str(quote_value),
                'total_customers': customers.count(),
                'invoice_total': str(invoice_total),
                'outstanding': str(outstanding),
                'paid_mtd': str(paid_mtd),
                'conversion_rate': conversion_rate,
            },
            'leads_by_status': list(leads_by_status),
            'quotes_by_status': list(quotes_by_status),
        })

    @action(detail=False, methods=['get'])
    def pipeline(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id

        stages = [
            ('NEW', 'New Leads'),
            ('CONTACTED', 'Contacted'),
            ('QUALIFIED', 'Qualified'),
            ('WON', 'Won'),
            ('LOST', 'Lost'),
        ]
        data = []
        for status, label in stages:
            count = Lead.objects.filter(
                company_id=company_id,
                branch_id=branch_id,
                status=status,
                is_deleted=False,
            ).count()
            data.append({'stage': label, 'count': count, 'status': status})
        return Response({'data': data})

    @action(detail=False, methods=['get'])
    def recent_activity(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id

        recent_leads = Lead.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).order_by('-created_at')[:5]

        recent_quotes = Quote.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).order_by('-created_at')[:5]

        return Response({
            'leads': [
                {
                    'id': str(lead._id),
                    'name': f'{lead.first_name} {lead.last_name}'.strip(),
                    'status': lead.status,
                    'source': lead.source,
                    'created_at': lead.created_at.isoformat(),
                }
                for lead in recent_leads
            ],
            'quotes': [
                {
                    'id': str(quote._id),
                    'quote_number': quote.quote_number,
                    'status': quote.status,
                    'total_amount': str(quote.total_amount),
                    'created_at': quote.created_at.isoformat(),
                }
                for quote in recent_quotes
            ],
        })
