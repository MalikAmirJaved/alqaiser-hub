"""Journal entry helpers for payable documents (no POSTED status workflow)."""
from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist

from apps.finance.models import Account, JournalEntry, JournalLine


def ensure_customer_invoice_journal(invoice, user):
    """Create AR/SALES journal entry if the invoice has not been booked yet."""
    if invoice.journal_entry_id:
        return invoice.journal_entry

    accounts_receivable = Account.objects.get(
        code='AR',
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
        is_deleted=False,
    )
    sales_revenue = Account.objects.get(
        code='SALES',
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
        is_deleted=False,
    )

    entry = JournalEntry.objects.create(
        entry_number=f'JE-INV-{invoice.invoice_number}',
        date=invoice.invoice_date,
        description=(
            f'Customer invoice {invoice.invoice_number} for '
            f'{invoice.customer.name if invoice.customer else "Customer"}'
        ),
        reference_type='CustomerInvoice',
        reference_id=invoice._id,
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
        created_by=user,
        is_posted=True,
    )
    JournalLine.objects.create(
        journal_entry=entry,
        account=accounts_receivable,
        debit=invoice.amount,
        credit=Decimal('0.00'),
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
    )
    JournalLine.objects.create(
        journal_entry=entry,
        account=sales_revenue,
        debit=Decimal('0.00'),
        credit=invoice.amount,
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
    )
    invoice.journal_entry = entry
    invoice.save(update_fields=['journal_entry'])
    return entry


def ensure_supplier_bill_journal(bill, user):
    """Create INVENTORY/AP journal entry if the bill has not been booked yet."""
    if bill.journal_entry_id:
        return bill.journal_entry

    inventory_asset = Account.objects.get(
        code='INVENTORY',
        company_id=bill.company_id,
        branch_id=bill.branch_id,
        is_deleted=False,
    )
    accounts_payable = Account.objects.get(
        code='AP',
        company_id=bill.company_id,
        branch_id=bill.branch_id,
        is_deleted=False,
    )

    entry = JournalEntry.objects.create(
        entry_number=f'JE-BILL-{bill.bill_number}',
        date=bill.bill_date,
        description=f'Supplier bill {bill.bill_number} from {bill.supplier.name}',
        reference_type='SupplierBill',
        reference_id=bill._id,
        company_id=bill.company_id,
        branch_id=bill.branch_id,
        created_by=user,
        is_posted=True,
    )
    JournalLine.objects.create(
        journal_entry=entry,
        account=inventory_asset,
        debit=bill.amount,
        credit=Decimal('0.00'),
        company_id=bill.company_id,
        branch_id=bill.branch_id,
    )
    JournalLine.objects.create(
        journal_entry=entry,
        account=accounts_payable,
        debit=Decimal('0.00'),
        credit=bill.amount,
        company_id=bill.company_id,
        branch_id=bill.branch_id,
    )
    bill.journal_entry = entry
    bill.save(update_fields=['journal_entry'])
    return entry
