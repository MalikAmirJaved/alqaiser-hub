"""
Centralized payment utilities.

All payment amounts and statuses are derived from the Payment table.
Document models (invoice, bill, expense, payroll) must not store paid_amount
or payment status fields.
"""
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType
from django.db.models import OuterRef, Subquery, Sum, Value, DecimalField
from django.db.models.functions import Coalesce


PAYABLE_CONFIG = {
    'customerinvoice': {
        'payment_type': 'RECEIPT',
        'amount_field': 'amount',
        'label': 'customer_invoice',
    },
    'supplierbill': {
        'payment_type': 'PAYMENT',
        'amount_field': 'amount',
        'label': 'supplier_bill',
    },
    'expense': {
        'payment_type': 'PAYMENT',
        'amount_field': 'amount',
        'label': 'expense',
    },
    'payrollrecord': {
        'payment_type': 'PAYMENT',
        'amount_field': 'net_salary',
        'label': 'payroll',
    },
    'employeeloan': {
        'payment_type': 'PAYMENT',
        'amount_field': 'total_payable',
        'label': 'employee_loan',
    },
    'salesorder': {
        'payment_type': 'RECEIPT',
        'amount_field': 'total_amount',
        'label': 'pos_sale',
    },
}


def is_payable(obj):
    return obj._meta.model_name in PAYABLE_CONFIG


def get_payment_type_for(obj):
    config = PAYABLE_CONFIG.get(obj._meta.model_name)
    return config['payment_type'] if config else 'PAYMENT'


def get_payable_amount(obj):
    config = PAYABLE_CONFIG.get(obj._meta.model_name)
    if not config:
        return Decimal('0.00')
    return getattr(obj, config['amount_field'], Decimal('0.00'))


def get_content_type_for_model(model_class):
    return ContentType.objects.get_for_model(model_class, for_concrete_model=False)


def get_payments_queryset(obj, status=None):
    from apps.finance.models import Payment

    ct = ContentType.objects.get_for_model(obj.__class__, for_concrete_model=False)
    qs = Payment.objects.filter(
        content_type=ct,
        object_id=obj.pk,
        is_deleted=False,
    )
    if status:
        qs = qs.filter(status=status)
    return qs


def get_total_paid(obj):
    total = get_payments_queryset(obj, status='CONFIRMED').aggregate(
        total=Coalesce(
            Sum('amount'),
            Value(Decimal('0.00'), output_field=DecimalField()),
        )
    )['total']
    return total if total is not None else Decimal('0.00')


def get_payment_status(obj):
    total_amount = get_payable_amount(obj)
    total_paid = get_total_paid(obj)
    if total_paid <= 0:
        return 'UNPAID'
    if total_paid >= total_amount:
        return 'PAID'
    return 'PARTIAL'


def get_outstanding(obj):
    return max(Decimal('0.00'), get_payable_amount(obj) - get_total_paid(obj))


def get_payable_label(obj):
    config = PAYABLE_CONFIG.get(obj._meta.model_name)
    return config['label'] if config else obj._meta.model_name


def get_latest_confirmed_payment(obj):
    return get_payments_queryset(obj, status='CONFIRMED').order_by(
        '-payment_date', '-created_at'
    ).first()


def annotate_total_paid(queryset, model_class):
    from apps.finance.models import Payment

    ct = ContentType.objects.get_for_model(model_class, for_concrete_model=False)
    paid_subquery = Payment.objects.filter(
        content_type=ct,
        object_id=OuterRef('pk'),
        status='CONFIRMED',
        is_deleted=False,
    ).values('object_id').annotate(total=Sum('amount')).values('total')[:1]
    return queryset.annotate(
        _total_paid=Coalesce(
            Subquery(paid_subquery, output_field=DecimalField()),
            Value(Decimal('0.00'), output_field=DecimalField()),
        )
    )


def create_payment_for(
    payable,
    *,
    amount,
    payment_date,
    user,
    payment_method='BANK_TRANSFER',
    payment_type=None,
    bank_account=None,
    reference_number='',
    notes='',
    auto_confirm=False,
):
    """Create a payment record linked to any payable document."""
    from apps.finance.models import Payment

    if not is_payable(payable):
        raise ValueError(f'{payable.__class__.__name__} is not a payable model')

    ct = ContentType.objects.get_for_model(payable.__class__, for_concrete_model=False)
    payment = Payment.objects.create(
        company_id=payable.company_id,
        branch_id=payable.branch_id,
        content_type=ct,
        object_id=payable.pk,
        payment_type=payment_type or get_payment_type_for(payable),
        payment_method=payment_method,
        amount=amount,
        payment_date=payment_date,
        reference_number=reference_number,
        bank_account=bank_account,
        status='DRAFT',
        notes=notes,
        created_by=user,
        updated_by=user,
    )

    if auto_confirm:
        from apps.finance.views.payment import confirm_payment_logic
        success, message = confirm_payment_logic(payment, user)
        if not success:
            raise ValueError(message)

    return payment


def generate_expense_number(company_id):
    """Generate a unique expense number using Redis atomic counter."""
    from django.core.cache import cache
    counter = cache.incr('code_counter:expense')
    return f'EXP-{counter:04d}'


def create_expense_for_payroll(
    *,
    company_id,
    branch_id,
    category,
    amount,
    description,
    user,
    notes='',
    expense_date=None,
    skip_payment=False,
):
    """Auto-create an expense record for salary/loan/exit payments.

    When called from payroll or exit settlement (which already create a
    payment for the source document), pass ``skip_payment=True`` to avoid
    creating a duplicate payment for the expense itself.
    """
    from datetime import date as _date
    from apps.finance.models import Expense

    expense = Expense.objects.create(
        expense_number=generate_expense_number(company_id),
        category=category,
        expense_date=expense_date or _date.today(),
        amount=amount,
        description=description,
        notes=notes,
        company_id=company_id,
        branch_id=branch_id,
        created_by=user,
        updated_by=user,
    )

    if not skip_payment:
        # Create a confirmed payment so the expense shows as PAID
        payment = create_payment_for(
            expense,
            amount=amount,
            payment_date=expense_date or _date.today(),
            user=user,
            payment_method='BANK_TRANSFER',
            reference_number=expense.expense_number,
            notes=description,
            auto_confirm=False,
        )
        payment.status = 'CONFIRMED'
        payment.save(update_fields=['status', 'updated_at'])

    return expense


class PayableModelMixin:
    """Mixin for models whose payments live in the central Payment table."""

    @property
    def paid_amount(self):
        return get_total_paid(self)

    @property
    def payment_status(self):
        return get_payment_status(self)

    @property
    def outstanding(self):
        return get_outstanding(self)

    @property
    def payments(self):
        return get_payments_queryset(self)
