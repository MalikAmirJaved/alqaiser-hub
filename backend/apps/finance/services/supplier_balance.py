from decimal import Decimal

from django.db import transaction

from apps.inventory.models import Supplier, SupplierHistory


def update_supplier_balance(
    supplier,
    amount,
    transaction_type,
    reference_type='',
    reference_id=None,
    notes='',
):
    """Update supplier balance and credit, and create a history entry.
    
    Balance rules:
    - PURCHASE (SupplierBill creation): balance += amount
    - PURCHASE_REVERSAL (bill cancelled/reduced before payment): balance -= amount
    - PAYMENT (payment confirmed): balance -= amount
    - CREDIT_NOTE (reduction on paid bill): credit += abs(amount)
    - INVOICE_ADJUSTMENT (increase on paid bill): balance += amount
    - CREDIT_APPLIED (credit used for payment): credit -= amount, balance -= amount
    """
    amount = Decimal(str(amount))

    with transaction.atomic():
        supplier.refresh_from_db()

        if transaction_type == 'PURCHASE':
            supplier.balance += amount
        elif transaction_type == 'PURCHASE_REVERSAL':
            supplier.balance -= amount
        elif transaction_type == 'PAYMENT':
            # Full payment amount clears the bill obligation from balance.
            # Available credit is applied first; any remainder is cash paid.
            credit_used = Decimal('0')
            if supplier.credit > 0:
                credit_used = min(supplier.credit, amount)
                supplier.credit -= credit_used
                if credit_used > 0:
                    SupplierHistory.objects.create(
                        supplier=supplier,
                        transaction_type='CREDIT_APPLIED',
                        amount=credit_used,
                        balance_after=supplier.balance,
                        credit_after=supplier.credit,
                        reference_type=reference_type,
                        reference_id=reference_id,
                        notes=f'Credit applied: {credit_used} from payment',
                        company_id=supplier.company_id,
                        branch_id=supplier.branch_id,
                        created_by_id=supplier.updated_by_id or supplier.created_by_id,
                        updated_by_id=supplier.updated_by_id or supplier.created_by_id,
                    )
            supplier.balance -= amount
        elif transaction_type == 'CREDIT_NOTE':
            supplier.credit += amount
        elif transaction_type == 'INVOICE_ADJUSTMENT':
            supplier.balance += amount
        elif transaction_type == 'CREDIT_APPLIED':
            supplier.credit -= amount
            supplier.balance -= amount

        supplier.save(update_fields=['balance', 'credit', 'updated_at'])

        return SupplierHistory.objects.create(
            supplier=supplier,
            transaction_type=transaction_type,
            amount=amount,
            balance_after=supplier.balance,
            credit_after=supplier.credit,
            reference_type=reference_type,
            reference_id=reference_id,
            notes=notes,
            company_id=supplier.company_id,
            branch_id=supplier.branch_id,
            created_by_id=supplier.updated_by_id or supplier.created_by_id,
            updated_by_id=supplier.updated_by_id or supplier.created_by_id,
        )


def record_supplier_bill_created(bill, notes=''):
    """Record a new supplier bill as a PURCHASE on the vendor balance."""
    if not bill.supplier_id or not bill.amount:
        return None
    return update_supplier_balance(
        bill.supplier,
        bill.amount,
        'PURCHASE',
        reference_type='supplier_bill',
        reference_id=bill._id,
        notes=notes or f'Supplier bill {bill.bill_number} created',
    )
