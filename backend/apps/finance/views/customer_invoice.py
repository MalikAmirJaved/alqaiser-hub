from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import CustomerInvoice, JournalEntry, JournalLine, Account
from apps.finance.serializers import CustomerInvoiceSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin


class CustomerInvoiceViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = CustomerInvoice.objects.all()
    serializer_class = CustomerInvoiceSerializer
    permission_module = 'FINANCE'
    permission_resource = 'customerinvoice'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'   
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Customer invoice created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def post_invoice(self, request, _id=None):
        invoice = self.get_object()
        
        if invoice.status != 'DRAFT':
            return Response(
                {
                    "success": False,
                    "error": "Invoice already processed",
                    "detail": f"Cannot post invoice with status '{invoice.status}'. Only DRAFT invoices can be posted."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                # Get accounts
                try:
                    accounts_receivable = Account.objects.get(
                        code='AR',
                        company_id=invoice.company_id,
                        branch_id=invoice.branch_id,
                        is_deleted=False
                    )
                    sales_revenue = Account.objects.get(
                        code='SALES',
                        company_id=invoice.company_id,
                        branch_id=invoice.branch_id,
                        is_deleted=False
                    )
                except ObjectDoesNotExist as e:
                    return Response(
                        {
                            "success": False,
                            "error": "Required accounts not found",
                            "detail": f"Missing account: {str(e)}. Please ensure AR and SALES accounts exist."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Create journal entry
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
                
                # Create journal lines
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
                
                # Update invoice
                invoice.status = 'POSTED'
                invoice.journal_entry = entry
                invoice.save()
                
                return Response(
                    {
                        "success": True,
                        "message": f"Customer invoice '{invoice.invoice_number}' posted successfully",
                        "data": self.get_serializer(invoice).data
                    },
                    status=status.HTTP_200_OK
                )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": "Failed to post invoice",
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )