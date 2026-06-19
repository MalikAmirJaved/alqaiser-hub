from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from rest_framework import viewsets, status
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.models import Payment, JournalEntry, JournalLine, Account, BankTransaction
from apps.finance.serializers import PaymentSerializer
from apps.finance.services.payable import get_payable_label
from apps.permissions.mixins import PermissionRequiredMixin


def _get_cash_account(payment):
    return Account.objects.get(
        code='CASH',
        company_id=payment.company_id,
        branch_id=payment.branch_id,
        is_deleted=False,
    )


def _get_or_create_account(code, name, account_type, payment):
    account, _ = Account.objects.get_or_create(
        code=code,
        company_id=payment.company_id,
        branch_id=payment.branch_id,
        defaults={
            'name': name,
            'account_type': account_type,
            'is_active': True,
        },
    )
    return account


def _journal_description(payment):
    payable = payment.payable
    if payable is None:
        return 'Payment'

    model_name = payable._meta.model_name
    if model_name == 'customerinvoice':
        customer_name = payable.customer.name if payable.customer else 'Customer'
        return f'Receipt from {customer_name}'
    if model_name == 'supplierbill':
        supplier_name = payable.supplier.name if payable.supplier else 'Supplier'
        return f'Payment to {supplier_name}'
    if model_name == 'expense':
        return f'Expense: {payable.category} - {payable.description[:50]}'
    if model_name == 'payrollrecord':
        employee_name = payable.employee.full_name if payable.employee else 'Employee'
        return f'Payroll payment - {employee_name}'
    if model_name == 'employeeloan':
        employee_name = payable.employee.full_name if payable.employee else 'Employee'
        return f'Loan disbursement - {employee_name}'
    return 'Payment'


def _create_journal_entry(payment, user):
    cash_bank = _get_cash_account(payment)
    payable = payment.payable
    model_name = payable._meta.model_name if payable else None

    entry = JournalEntry.objects.create(
        entry_number=f'JE-PMT-{payment.id}',
        date=payment.payment_date,
        description=_journal_description(payment),
        reference_type='Payment',
        reference_id=payment._id,
        company_id=payment.company_id,
        branch_id=payment.branch_id,
        created_by=user,
        is_posted=True,
    )

    if payment.payment_type == 'RECEIPT':
        ar = Account.objects.get(
            code='AR',
            company_id=payment.company_id,
            branch_id=payment.branch_id,
            is_deleted=False,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=cash_bank,
            debit=payment.amount,
            credit=Decimal('0.00'),
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=ar,
            debit=Decimal('0.00'),
            credit=payment.amount,
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
    elif model_name == 'supplierbill':
        ap = Account.objects.get(
            code='AP',
            company_id=payment.company_id,
            branch_id=payment.branch_id,
            is_deleted=False,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=ap,
            debit=payment.amount,
            credit=Decimal('0.00'),
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=cash_bank,
            debit=Decimal('0.00'),
            credit=payment.amount,
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
    elif model_name == 'expense':
        expense_account = _get_or_create_account(
            'EXPENSE', 'General Expenses', 'EXPENSE', payment
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=expense_account,
            debit=payment.amount,
            credit=Decimal('0.00'),
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=cash_bank,
            debit=Decimal('0.00'),
            credit=payment.amount,
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
    elif model_name == 'payrollrecord':
        salaries_account = _get_or_create_account(
            'SALARIES', 'Salaries Expense', 'EXPENSE', payment
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=salaries_account,
            debit=payment.amount,
            credit=Decimal('0.00'),
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=cash_bank,
            debit=Decimal('0.00'),
            credit=payment.amount,
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
    elif model_name == 'employeeloan':
        loan_account = _get_or_create_account(
            'LOANS', 'Employee Loans', 'ASSET', payment
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=loan_account,
            debit=payment.amount,
            credit=Decimal('0.00'),
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=cash_bank,
            debit=Decimal('0.00'),
            credit=payment.amount,
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
    else:
        ap = Account.objects.get(
            code='AP',
            company_id=payment.company_id,
            branch_id=payment.branch_id,
            is_deleted=False,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=ap,
            debit=payment.amount,
            credit=Decimal('0.00'),
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )
        JournalLine.objects.create(
            journal_entry=entry,
            account=cash_bank,
            debit=Decimal('0.00'),
            credit=payment.amount,
            company_id=payment.company_id,
            branch_id=payment.branch_id,
        )

    return entry


def confirm_payment_logic(payment, user):
    if payment.status == 'CONFIRMED':
        return True, 'Payment already confirmed.'

    if payment.payable is None:
        return False, 'Payment is not linked to a payable document.'

    with transaction.atomic():
        payment.status = 'CONFIRMED'

        if not payment.journal_entry:
            try:
                payment.journal_entry = _create_journal_entry(payment, user)
            except ObjectDoesNotExist as exc:
                return False, f'Required account not found: {exc}'

        if payment.bank_account:
            bank_txn_type = 'DEPOSIT' if payment.payment_type == 'RECEIPT' else 'WITHDRAWAL'
            BankTransaction.objects.create(
                company_id=payment.company_id,
                branch_id=payment.branch_id,
                bank_account=payment.bank_account,
                transaction_date=payment.payment_date,
                amount=payment.amount,
                transaction_type=bank_txn_type,
                description=f'{payment.get_payment_type_display()} - {payment.reference_number or "Manual"}',
                reference=payment.reference_number or '',
                reconciled=False,
                created_by=user,
                updated_by=user,
            )

            bank_account = payment.bank_account
            if bank_txn_type == 'DEPOSIT':
                bank_account.book_balance += payment.amount
            else:
                bank_account.book_balance -= payment.amount
            bank_account.save(update_fields=['book_balance'])

        payment.save()
        return True, 'Payment confirmed successfully.'


class PaymentViewSet(
    GenericFilterMixin,
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ReadOnlyModelViewSet,
):
    queryset = Payment.objects.select_related('content_type', 'bank_account').all()
    serializer_class = PaymentSerializer
    permission_module = 'FINANCE'
    permission_resource = 'payment'
    lookup_field = '_id'
    filter_fields = {
        'search': ['reference_number', 'notes'],
        'payment_type': 'payment_type',
        'payment_method': 'payment_method',
        'status': 'status',
        'start_date': 'payment_date__gte',
        'end_date': 'payment_date__lte',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        payable_type = self.request.query_params.get('payable_type')
        payable_id = self.request.query_params.get('payable_id')
        supplier_uuid = self.request.query_params.get('supplier')

        if payable_type and payable_id:
            from django.contrib.contenttypes.models import ContentType
            from apps.finance.models import CustomerInvoice, SupplierBill, Expense
            from apps.hr.models import PayrollRecord

            model_map = {
                'customer_invoice': CustomerInvoice,
                'supplier_bill': SupplierBill,
                'expense': Expense,
                'payroll': PayrollRecord,
            }
            model_class = model_map.get(payable_type)
            if model_class:
                try:
                    payable = model_class.objects.get(
                        _id=payable_id,
                        company_id=self.request.user.company_id,
                    )
                    ct = ContentType.objects.get_for_model(model_class)
                    qs = qs.filter(content_type=ct, object_id=payable.pk)
                except model_class.DoesNotExist:
                    return qs.none()

        if supplier_uuid:
            from django.contrib.contenttypes.models import ContentType
            from apps.finance.models import SupplierBill

            bill_ids = SupplierBill.objects.filter(
                supplier___id=supplier_uuid,
                company_id=self.request.user.company_id,
            ).values_list('pk', flat=True)
            ct = ContentType.objects.get_for_model(SupplierBill)
            qs = qs.filter(content_type=ct, object_id__in=bill_ids)

        return qs

    def create(self, request, *args, **kwargs):
        return Response({'detail': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def update(self, request, *args, **kwargs):
        return Response({'detail': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def partial_update(self, request, *args, **kwargs):
        return Response({'detail': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)

    def destroy(self, request, *args, **kwargs):
        return Response({'detail': 'Method not allowed'}, status=status.HTTP_405_METHOD_NOT_ALLOWED)
