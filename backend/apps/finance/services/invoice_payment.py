"""Shared invoice/bill payment flows."""
from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone

from apps.finance.services.document import ensure_customer_invoice_journal, ensure_supplier_bill_journal
from apps.finance.services.payable import create_payment_for


def pay_customer_invoice(invoice, request, amount=None):
    if invoice.status == 'CANCELLED':
        return False, 'Cannot pay a cancelled invoice'
    if invoice.payment_status == 'PAID':
        return False, 'Invoice is already fully paid'

    pay_amount = Decimal(str(amount if amount is not None else request.data.get('amount', invoice.outstanding)))
    if pay_amount <= 0:
        return False, 'Payment amount must be positive'
    if pay_amount > invoice.outstanding:
        return False, f'Amount {pay_amount} exceeds outstanding {invoice.outstanding}'

    bank_account = None
    bank_account_uuid = request.data.get('bank_account_id')
    payment_method = request.data.get('payment_method', 'CASH')

    with transaction.atomic():
        try:
            ensure_customer_invoice_journal(invoice, request.user)
        except ObjectDoesNotExist as exc:
            return False, f'Missing account: {exc}. Ensure AR and SALES accounts exist.'

        if bank_account_uuid:
            from apps.finance.models import BankAccount
            try:
                bank_account = BankAccount.objects.get(
                    _id=bank_account_uuid,
                    company_id=invoice.company_id,
                )
            except BankAccount.DoesNotExist:
                return False, 'Bank account not found'

        create_payment_for(
            invoice,
            amount=pay_amount,
            payment_date=timezone.now().date(),
            payment_method=payment_method,
            bank_account=bank_account,
            user=request.user,
            auto_confirm=True,
        )

    invoice.refresh_from_db()
    return True, 'Payment recorded successfully'


def pay_supplier_bill(bill, request, amount=None):
    if bill.status == 'CANCELLED':
        return False, 'Cannot pay a cancelled bill'
    if bill.payment_status == 'PAID':
        return False, 'Bill is already fully paid'

    pay_amount = Decimal(str(amount if amount is not None else request.data.get('amount', bill.outstanding)))
    if pay_amount <= 0:
        return False, 'Payment amount must be positive'
    if pay_amount > bill.outstanding:
        return False, f'Amount {pay_amount} exceeds outstanding {bill.outstanding}'

    bank_account = None
    bank_account_uuid = request.data.get('bank_account_id')
    payment_method = request.data.get('payment_method', 'BANK_TRANSFER')

    with transaction.atomic():
        try:
            ensure_supplier_bill_journal(bill, request.user)
        except ObjectDoesNotExist as exc:
            return False, f'Missing account: {exc}'

        if bank_account_uuid:
            from apps.finance.models import BankAccount
            try:
                bank_account = BankAccount.objects.get(
                    _id=bank_account_uuid,
                    company_id=bill.company_id,
                )
            except BankAccount.DoesNotExist:
                pass
        if not bank_account:
            from apps.finance.models import BankAccount
            bank_account = BankAccount.objects.filter(
                company_id=bill.company_id,
                is_active=True,
            ).first()

        create_payment_for(
            bill,
            amount=pay_amount,
            payment_date=bill.bill_date,
            payment_method=payment_method,
            bank_account=bank_account,
            user=request.user,
            auto_confirm=True,
        )

    bill.refresh_from_db()
    return True, 'Payment recorded successfully'
