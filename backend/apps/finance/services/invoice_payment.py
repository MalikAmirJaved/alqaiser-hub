"""Shared invoice/bill payment flows."""
from decimal import Decimal
import uuid

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.db.models import F
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
    payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
    reference_number = request.data.get('reference_number', '')

    from django.utils.dateparse import parse_date
    payment_date = parse_date(request.data.get('payment_date')) if request.data.get('payment_date') else timezone.now().date()

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
        if not bank_account:
            from apps.finance.models import BankAccount
            bank_account = BankAccount.objects.filter(
                company_id=invoice.company_id,
                is_active=True,
            ).first()

        create_payment_for(
            invoice,
            amount=pay_amount,
            payment_date=payment_date,
            payment_method=payment_method,
            bank_account=bank_account,
            reference_number=reference_number,
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

    cash_amount = Decimal(str(amount if amount is not None else request.data.get('amount', bill.outstanding)))
    if cash_amount < 0:
        return False, 'Payment amount must not be negative'

    bank_account = None
    bank_account_uuid = request.data.get('bank_account_id')
    cash_payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
    reference_number = request.data.get('reference_number', '')

    from django.utils.dateparse import parse_date
    payment_date = parse_date(request.data.get('payment_date')) if request.data.get('payment_date') else bill.bill_date

    from apps.finance.services.supplier_balance import update_supplier_balance
    from apps.finance.models import Payment
    from apps.finance.services.payable import get_content_type_for_model

    with transaction.atomic():
        supplier = bill.supplier
        credit_to_apply = Decimal('0')

        # ── Step 1: Apply available supplier credit against the bill ──
        if supplier and supplier.credit > 0 and bill.outstanding > 0:
            credit_to_apply = min(supplier.credit, bill.outstanding)
            update_supplier_balance(
                supplier, credit_to_apply, 'CREDIT_APPLIED',
                reference_type='supplier_bill',
                reference_id=bill._id,
                notes=f'Credit applied to bill {bill.bill_number}',
            )

            # Create a CONFIRMED Payment (no journal entry — no cash moved)
            # so the bill's paid_amount reflects the credit.
            ct = get_content_type_for_model(bill.__class__)
            Payment.objects.create(
                company_id=bill.company_id,
                branch_id=bill.branch_id,
                content_type=ct,
                object_id=bill.pk,
                payment_type='PAYMENT',
                payment_method='CREDIT',
                amount=credit_to_apply,
                payment_date=payment_date,
                reference_number=f'CREDIT-{reference_number or bill.bill_number}',
                status='CONFIRMED',
                notes=f'Applied supplier credit: {credit_to_apply}',
                created_by=request.user,
                updated_by=request.user,
            )

        # ── Step 2: Cash payment covers only what's left after credit ──
        actual_cash = cash_amount
        max_cash_needed = bill.outstanding  # outstanding now reduced by credit Payment above
        if actual_cash > max_cash_needed:
            actual_cash = max_cash_needed

        if actual_cash <= 0:
            # Credit alone fully covers the bill
            bill.refresh_from_db()
            return True, 'Bill settled using supplier credit only'

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
            amount=actual_cash,
            payment_date=payment_date,
            payment_method=cash_payment_method,
            bank_account=bank_account,
            reference_number=reference_number,
            user=request.user,
            auto_confirm=True,
        )

    bill.refresh_from_db()
    return True, 'Payment recorded successfully'
