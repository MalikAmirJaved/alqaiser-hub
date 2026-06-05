from rest_framework import viewsets, status, serializers
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Payment, JournalEntry, JournalLine, Account, BankTransaction
from apps.finance.serializers import PaymentSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from django_filters.rest_framework import DjangoFilterBackend


def confirm_payment_logic(payment, user):
    if payment.status == 'CONFIRMED':
        return True, "Payment already confirmed."
        
    with transaction.atomic():
        # 1. Update status
        payment.status = 'CONFIRMED'
        
        # 2. Update linked bill or invoice paid amount
        if payment.supplier_bill:
            bill = payment.supplier_bill
            bill.paid_amount += payment.amount
            if bill.paid_amount >= bill.amount:
                bill.status = 'PAID'
            else:
                bill.status = 'PARTIAL'
            bill.save(update_fields=['paid_amount', 'status'])
            
        if payment.customer_invoice:
            inv = payment.customer_invoice
            inv.paid_amount += payment.amount
            if inv.paid_amount >= inv.amount:
                inv.status = 'PAID'
            else:
                inv.status = 'PARTIAL'
            inv.save(update_fields=['paid_amount', 'status'])

        # 3. Create Journal Entry (if not already created)
        if not payment.journal_entry:
            # Get cash/bank account
            try:
                cash_bank = Account.objects.get(
                    code='CASH',
                    company_id=payment.company_id,
                    branch_id=payment.branch_id,
                    is_deleted=False
                )
            except ObjectDoesNotExist:
                return False, "CASH account not found in chart of accounts"
                
            if payment.payment_type == 'RECEIPT':
                try:
                    ar = Account.objects.get(
                        code='AR',
                        company_id=payment.company_id,
                        branch_id=payment.branch_id,
                        is_deleted=False
                    )
                except ObjectDoesNotExist:
                    return False, "AR account not found in chart of accounts"
                    
                entry = JournalEntry.objects.create(
                    entry_number=f"JE-PMT-{payment.id}",
                    date=payment.payment_date,
                    description=f"Receipt from {payment.customer_invoice.customer.name if payment.customer_invoice and payment.customer_invoice.customer else 'Customer'}",
                    reference_type='Payment',
                    reference_id=payment._id,
                    company_id=payment.company_id,
                    branch_id=payment.branch_id,
                    created_by=user,
                    is_posted=True
                )
                JournalLine.objects.create(
                    journal_entry=entry,
                    account=cash_bank,
                    debit=payment.amount,
                    credit=Decimal('0.00'),
                    company_id=payment.company_id,
                    branch_id=payment.branch_id
                )
                JournalLine.objects.create(
                    journal_entry=entry,
                    account=ar,
                    debit=Decimal('0.00'),
                    credit=payment.amount,
                    company_id=payment.company_id,
                    branch_id=payment.branch_id
                )
            else:  # PAYMENT
                try:
                    ap = Account.objects.get(
                        code='AP',
                        company_id=payment.company_id,
                        branch_id=payment.branch_id,
                        is_deleted=False
                    )
                except ObjectDoesNotExist:
                    return False, "AP account not found in chart of accounts"
                    
                entry = JournalEntry.objects.create(
                    entry_number=f"JE-PMT-{payment.id}",
                    date=payment.payment_date,
                    description=f"Payment to {payment.supplier_bill.supplier.name if payment.supplier_bill and payment.supplier_bill.supplier else 'Supplier'}",
                    reference_type='Payment',
                    reference_id=payment._id,
                    company_id=payment.company_id,
                    branch_id=payment.branch_id,
                    created_by=user,
                    is_posted=True
                )
                JournalLine.objects.create(
                    journal_entry=entry,
                    account=ap,
                    debit=payment.amount,
                    credit=Decimal('0.00'),
                    company_id=payment.company_id,
                    branch_id=payment.branch_id
                )
                JournalLine.objects.create(
                    journal_entry=entry,
                    account=cash_bank,
                    debit=Decimal('0.00'),
                    credit=payment.amount,
                    company_id=payment.company_id,
                    branch_id=payment.branch_id
                )
            payment.journal_entry = entry

        # 4. Bank account and transaction balance update
        if payment.bank_account:
            if payment.payment_type == 'RECEIPT':
                bank_txn_type = 'DEPOSIT'
            else:
                bank_txn_type = 'WITHDRAWAL'
                
            BankTransaction.objects.create(
                company_id=payment.company_id,
                branch_id=payment.branch_id,
                bank_account=payment.bank_account,
                transaction_date=payment.payment_date,
                amount=payment.amount,
                transaction_type=bank_txn_type,
                description=f"{payment.get_payment_type_display()} - {payment.reference_number or 'Manual'}",
                reference=payment.reference_number or '',
                reconciled=False,
                created_by=user,
                updated_by=user,
            )
            
            # Update book balance
            bank_account = payment.bank_account
            if bank_txn_type == 'DEPOSIT':
                bank_account.book_balance += payment.amount
            else:
                bank_account.book_balance -= payment.amount
            bank_account.save(update_fields=['book_balance'])
            
        payment.save()
        return True, "Payment confirmed successfully."


class PaymentViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ReadOnlyModelViewSet
):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_module = 'FINANCE'
    permission_resource = 'payment'
    lookup_field = '_id'

    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['payment_type', 'supplier_bill', 'customer_invoice']

    def get_queryset(self):
        qs = super().get_queryset()
        supplier_uuid = self.request.query_params.get('supplier')
        if supplier_uuid:
            # Filter by the supplier's UUID field (_id)
            qs = qs.filter(supplier_bill__supplier___id=supplier_uuid)
        return qs

    # Disable write operations (optional)
    def create(self, request, *args, **kwargs):
        return Response({"detail": "Method not allowed"}, status=405)

    def update(self, request, *args, **kwargs):
        return Response({"detail": "Method not allowed"}, status=405)

    def partial_update(self, request, *args, **kwargs):
        return Response({"detail": "Method not allowed"}, status=405)

    def destroy(self, request, *args, **kwargs):
        return Response({"detail": "Method not allowed"}, status=405)