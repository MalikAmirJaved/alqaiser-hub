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
            payment_remaining = amount
            if supplier.credit > 0:
                credit_used = min(supplier.credit, payment_remaining)
                supplier.credit -= credit_used
                payment_remaining -= credit_used
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
            supplier.balance -= payment_remaining
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
