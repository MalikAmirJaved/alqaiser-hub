from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import (
    CustomerInvoice, CustomerInvoiceLine,
    JournalEntry, JournalLine, Account, Payment
)
from apps.sales.serializers.invoice import SalesInvoiceSerializer
from apps.finance.views.payment import confirm_payment_logic


class SalesInvoiceViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    """
    Full CRUD for Customer Invoices exposed under the Sales module.
    Finance module only has read-only access.
    """
    permission_module = 'SALES'
    permission_resource = 'invoice'
    queryset = CustomerInvoice.objects.all()
    serializer_class = SalesInvoiceSerializer
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__variant__product')
        status_param = self.request.query_params.get('status')
        if status_param:
            qs = qs.filter(status=status_param)
        customer_uuid = self.request.query_params.get('customer')
        if customer_uuid:
            from apps.inventory.models import Customer
            try:
                customer = Customer.objects.get(
                    _id=customer_uuid,
                    company_id=self.request.user.company_id
                )
                qs = qs.filter(customer=customer)
            except Customer.DoesNotExist:
                return qs.none()
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        import time, random
        serializer.save(
            invoice_number=f"INV-{int(time.time())}-{random.randint(1000, 9999)}",
            source='SALES_AGENT',
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        instance = serializer.instance
        if instance.status != 'DRAFT':
            from rest_framework.exceptions import ValidationError
            raise ValidationError("Only DRAFT invoices can be updated.")
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response(
                {'error': 'Only DRAFT invoices can be deleted'},
                status=status.HTTP_400_BAD_REQUEST
            )
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save(update_fields=['is_deleted', 'deleted_by'])
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def post_invoice(self, request, _id=None):
        """Post a draft invoice: creates journal entries."""
        invoice = self.get_object()
        if invoice.status != 'DRAFT':
            return Response(
                {'error': f"Cannot post invoice with status '{invoice.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
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
                    {'error': f'Missing account: {str(e)}. Ensure AR and SALES accounts exist.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            entry = JournalEntry.objects.create(
                entry_number=f"JE-INV-{invoice.invoice_number}",
                date=invoice.invoice_date,
                description=f"Customer invoice {invoice.invoice_number} for {invoice.customer.name if invoice.customer else 'Customer'}",
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
            invoice.save(update_fields=['status', 'journal_entry'])

        return Response({
            'status': 'success',
            'message': f"Invoice '{invoice.invoice_number}' posted",
            'data': self.get_serializer(invoice).data
        })

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        """Record a payment against a posted invoice."""
        invoice = self.get_object()
        if invoice.status not in ['POSTED', 'PARTIAL']:
            return Response(
                {'error': f"Cannot record payment for invoice with status '{invoice.status}'"},
                status=status.HTTP_400_BAD_REQUEST
            )

        amount = Decimal(str(request.data.get('amount', invoice.outstanding)))
        bank_account_uuid = request.data.get('bank_account_id')
        payment_method = request.data.get('payment_method', 'CASH')

        if amount <= 0:
            return Response(
                {'error': 'Payment amount must be positive'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if amount > invoice.outstanding:
            return Response(
                {'error': f'Amount {amount} exceeds outstanding {invoice.outstanding}'},
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            bank_account = None
            if bank_account_uuid:
                from apps.finance.models import BankAccount
                try:
                    bank_account = BankAccount.objects.get(
                        _id=bank_account_uuid,
                        company_id=invoice.company_id
                    )
                except BankAccount.DoesNotExist:
                    return Response(
                        {'error': 'Bank account not found'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

            from django.utils import timezone
            payment = Payment.objects.create(
                company_id=invoice.company_id,
                branch_id=invoice.branch_id,
                payment_type='RECEIPT',
                payment_method=payment_method,
                amount=amount,
                payment_date=timezone.now().date(),
                customer_invoice=invoice,
                bank_account=bank_account,
                status='DRAFT',
                created_by=request.user,
                updated_by=request.user,
            )

            success, msg = confirm_payment_logic(payment, request.user)
            if not success:
                return Response(
                    {'error': msg},
                    status=status.HTTP_400_BAD_REQUEST
                )

        return Response({
            'status': 'success',
            'message': 'Payment recorded and confirmed',
            'data': self.get_serializer(invoice).data
        })
