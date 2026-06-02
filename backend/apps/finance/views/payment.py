from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Payment, JournalEntry, JournalLine, Account
from apps.finance.serializers import PaymentSerializer
from apps.finance.mixins import CompanyBranchUserMixin

class PaymentViewSet(CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
    permission_module = 'FINANCE'
    permission_resource = 'payment'

    def perform_create(self, serializer):
        with transaction.atomic():
            payment = serializer.save(
                company_id=self.request.user.company_id,
                branch_id=self.request.user.branch_id,
                created_by=self.request.user
            )
            # Update linked bill or invoice paid amount
            if payment.supplier_bill:
                bill = payment.supplier_bill
                bill.paid_amount += payment.amount
                if bill.paid_amount >= bill.amount:
                    bill.status = 'PAID'
                else:
                    bill.status = 'PARTIAL'
                bill.save()
            if payment.customer_invoice:
                inv = payment.customer_invoice
                inv.paid_amount += payment.amount
                if inv.paid_amount >= inv.amount:
                    inv.status = 'PAID'
                else:
                    inv.status = 'PARTIAL'
                inv.save()

            cash_bank = Account.objects.get(code='CASH', company_id=payment.company_id, branch_id=payment.branch_id)
            if payment.payment_type == 'RECEIPT':
                ar = Account.objects.get(code='AR', company_id=payment.company_id, branch_id=payment.branch_id)
                entry = JournalEntry.objects.create(
                    entry_number=f"JE-PMT-{payment.id}",
                    date=payment.payment_date,
                    description=f"Receipt from {payment.customer_invoice.customer.name if payment.customer_invoice else 'Customer'}",
                    reference_type='Payment',
                    reference_id=payment._id,
                    company_id=payment.company_id,
                    branch_id=payment.branch_id,
                    created_by=self.request.user
                )
                JournalLine.objects.create(journal_entry=entry, account=cash_bank, debit=payment.amount, credit=Decimal('0.00'),
                                           company_id=payment.company_id, branch_id=payment.branch_id)
                JournalLine.objects.create(journal_entry=entry, account=ar, debit=Decimal('0.00'), credit=payment.amount,
                                           company_id=payment.company_id, branch_id=payment.branch_id)
            else:
                ap = Account.objects.get(code='AP', company_id=payment.company_id, branch_id=payment.branch_id)
                entry = JournalEntry.objects.create(
                    entry_number=f"JE-PMT-{payment.id}",
                    date=payment.payment_date,
                    description=f"Payment to {payment.supplier_bill.supplier.name if payment.supplier_bill else 'Supplier'}",
                    reference_type='Payment',
                    reference_id=payment._id,
                    company_id=payment.company_id,
                    branch_id=payment.branch_id,
                    created_by=self.request.user
                )
                JournalLine.objects.create(journal_entry=entry, account=ap, debit=payment.amount, credit=Decimal('0.00'),
                                           company_id=payment.company_id, branch_id=payment.branch_id)
                JournalLine.objects.create(journal_entry=entry, account=cash_bank, debit=Decimal('0.00'), credit=payment.amount,
                                           company_id=payment.company_id, branch_id=payment.branch_id)
            payment.journal_entry = entry
            payment.save()