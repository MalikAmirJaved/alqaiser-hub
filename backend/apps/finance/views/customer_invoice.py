from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import CustomerInvoice, JournalEntry, JournalLine, Account
from apps.finance.serializers import CustomerInvoiceSerializer
from apps.finance.mixins import CompanyBranchUserMixin

class CustomerInvoiceViewSet(CompanyBranchUserMixin,CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = CustomerInvoice.objects.all()
    serializer_class = CustomerInvoiceSerializer
    permission_module = 'FINANCE'
    permission_resource = 'customerinvoice'

    @action(detail=True, methods=['post'])
    def post_invoice(self, request, pk=None):
        invoice = self.get_object()
        if invoice.status != 'DRAFT':
            return Response({'error': 'Invoice already posted'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            accounts_receivable = Account.objects.get(code='AR', company_id=invoice.company_id, branch_id=invoice.branch_id)
            sales_revenue = Account.objects.get(code='SALES', company_id=invoice.company_id, branch_id=invoice.branch_id)

            entry = JournalEntry.objects.create(
                entry_number=f"JE-INV-{invoice.invoice_number}",
                date=invoice.invoice_date,
                description=f"Customer invoice {invoice.invoice_number} for {invoice.customer.name}",
                reference_type='CustomerInvoice',
                reference_id=invoice._id,
                company_id=invoice.company_id,
                branch_id=invoice.branch_id,
                created_by=request.user,
                is_posted=True
            )
            JournalLine.objects.create(
                journal_entry=entry,
                account=accounts_receivable,
                debit=invoice.amount,
                credit=Decimal('0.00'),
                company_id=invoice.company_id,
                branch_id=invoice.branch_id
            )
            JournalLine.objects.create(
                journal_entry=entry,
                account=sales_revenue,
                debit=Decimal('0.00'),
                credit=invoice.amount,
                company_id=invoice.company_id,
                branch_id=invoice.branch_id
            )
            invoice.status = 'POSTED'
            invoice.journal_entry = entry
            invoice.save()
        return Response(self.get_serializer(invoice).data)