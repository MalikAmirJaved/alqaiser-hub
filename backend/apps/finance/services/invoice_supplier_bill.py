"""
Sync supplier bills and vendor balances for manual customer-invoice lines.

One supplier bill per manual line. The bill is always updated in place:
  bill.amount = quantity × cost_price

Vendor balance always reflects outstanding on that bill:
  outstanding = max(0, bill.amount − total_paid)
  overpayment  = max(0, total_paid − bill.amount)  → supplier credit

All changes are recorded in SupplierHistory.
"""
import random
import time
from decimal import Decimal

from django.contrib.contenttypes.models import ContentType

from apps.finance.models import Payment, SupplierBill
from apps.finance.services.payable import get_total_paid
from apps.finance.services.supplier_balance import update_supplier_balance, record_supplier_bill_created


def line_cost(quantity, cost_price):
    return Decimal(str(quantity)) * Decimal(str(cost_price or 0))


def generate_bill_number():
    return f"BILL-INV-{int(time.time())}-{random.randint(1000, 9999)}"


def bill_has_confirmed_payment(bill):
    bill_ct = ContentType.objects.get_for_model(SupplierBill)
    return Payment.objects.filter(
        content_type=bill_ct,
        object_id=bill.pk,
        status='CONFIRMED',
        is_deleted=False,
    ).exists()


def bill_outstanding(bill, amount=None):
    """Outstanding owed on a bill (balance portion)."""
    bill_amount = Decimal(str(amount if amount is not None else bill.amount))
    paid = get_total_paid(bill)
    return max(Decimal('0'), bill_amount - paid)


def bill_overpayment(bill, amount=None):
    """Amount paid in excess of the bill (credit portion)."""
    bill_amount = Decimal(str(amount if amount is not None else bill.amount))
    paid = get_total_paid(bill)
    return max(Decimal('0'), paid - bill_amount)


def reconcile_bill_vendors(
    bill,
    *,
    old_vendor,
    new_vendor,
    old_amount,
    new_amount,
    notes='',
):
    """Sync vendor balance/credit after a bill amount or supplier change.

    Removes the old outstanding from old_vendor, applies new outstanding to
    new_vendor, and issues credit when total_paid exceeds the new amount.
    """
    old_amount = Decimal(str(old_amount))
    new_amount = Decimal(str(new_amount))
    paid = get_total_paid(bill)

    old_outstanding = max(Decimal('0'), old_amount - paid)
    new_outstanding = max(Decimal('0'), new_amount - paid)
    overpayment = max(Decimal('0'), paid - new_amount)

    ref_type = 'supplier_bill'
    ref_id = bill._id
    note = notes or f'Bill {bill.bill_number} updated'

    same_vendor = (
        old_vendor
        and new_vendor
        and old_vendor.pk == new_vendor.pk
    )

    if same_vendor:
        delta = new_outstanding - old_outstanding
        if delta > 0:
            update_supplier_balance(
                new_vendor, delta, 'PURCHASE',
                reference_type=ref_type, reference_id=ref_id,
                notes=f'{note}: outstanding +{delta}',
            )
        elif delta < 0:
            update_supplier_balance(
                new_vendor, abs(delta), 'PURCHASE_REVERSAL',
                reference_type=ref_type, reference_id=ref_id,
                notes=f'{note}: outstanding -{abs(delta)}',
            )
    else:
        if old_vendor and old_outstanding > 0:
            update_supplier_balance(
                old_vendor, old_outstanding, 'PURCHASE_REVERSAL',
                reference_type=ref_type, reference_id=ref_id,
                notes=f'{note}: vendor changed from {old_vendor.name}',
            )
        if new_vendor and new_outstanding > 0:
            update_supplier_balance(
                new_vendor, new_outstanding, 'PURCHASE',
                reference_type=ref_type, reference_id=ref_id,
                notes=f'{note}: vendor changed to {new_vendor.name}',
            )

    if overpayment > 0:
        credit_vendor = new_vendor or old_vendor
        if credit_vendor:
            update_supplier_balance(
                credit_vendor, overpayment, 'CREDIT_NOTE',
                reference_type=ref_type, reference_id=ref_id,
                notes=f'{note}: overpayment credited',
            )

    bill.supplier = new_vendor
    bill.amount = new_amount
    bill.save(update_fields=['supplier', 'amount', 'updated_at'])


def create_supplier_bill_for_line(invoice, vendor, amount, user, notes=''):
    bill = SupplierBill.objects.create(
        bill_number=generate_bill_number(),
        supplier=vendor,
        bill_date=invoice.invoice_date,
        due_date=invoice.due_date or invoice.invoice_date,
        amount=amount,
        status='DRAFT',
        customer_invoice=invoice,
        notes=notes or f"Auto-created from invoice {invoice.invoice_number}",
        company_id=invoice.company_id,
        branch_id=invoice.branch_id,
        created_by=user,
        updated_by=user,
    )
    record_supplier_bill_created(
        bill,
        notes=notes or f"Auto-created from invoice {invoice.invoice_number}",
    )
    return bill


def sync_manual_line_bill(
    *,
    invoice,
    old_line,
    new_vendor,
    new_qty,
    new_cost_price,
    user,
    line_index=0,
    line_name='',
):
    """Sync supplier bill for an updated manual line.

    Returns a reduction-conflict dict when quantity decreased (user must pick
    return_to_vendor or go_to_inventory). Otherwise None.
    """
    if not new_vendor or new_cost_price is None:
        return None

    new_amount = line_cost(new_qty, new_cost_price)
    old_qty = old_line.quantity
    old_cost_price = old_line.cost_price or Decimal('0')
    old_amount = line_cost(old_qty, old_cost_price)
    old_vendor = old_line.vendor
    bill = old_line.supplier_bill

    if not bill:
        bill = create_supplier_bill_for_line(
            invoice,
            new_vendor,
            new_amount,
            user,
            notes=f"Auto-created from invoice {invoice.invoice_number}",
        )
        old_line.supplier_bill = bill
        return None

    qty_decreased = new_qty < old_qty

    # Quantity decrease → defer bill update until user resolves
    if qty_decreased:
        if old_line.resolved:
            # Reset resolved flag so a new reduction cycle can begin
            old_line.resolved = False
        old_line.original_quantity = old_qty
        old_line.save(update_fields=['original_quantity', 'resolved', 'updated_at'])
        return {
            'line_id': str(old_line._id),
            'line_index': line_index,
            'line_name': line_name,
            'bill_id': str(bill._id),
            'supplier_id': str(new_vendor._id),
            'supplier_name': new_vendor.name,
            'delta': abs(old_amount - new_amount),
            'old_qty': old_qty,
            'new_qty': new_qty,
            'unit_price': old_line.unit_price,
            'cost_price': new_cost_price,
            'bill_paid': bill_has_confirmed_payment(bill),
            'old_bill_amount': str(bill.amount),
            'new_bill_amount': str(new_amount),
        }

    # Increase or vendor/cost change → update bill in place immediately
    reconcile_bill_vendors(
        bill,
        old_vendor=old_vendor or bill.supplier,
        new_vendor=new_vendor,
        old_amount=bill.amount,
        new_amount=new_amount,
        notes=f'Invoice {invoice.invoice_number} line updated',
    )
    return None


def apply_line_reduction(bill, line, user, action_notes=''):
    """Apply bill + vendor sync after a quantity reduction is resolved."""
    old_amount = bill.amount
    new_amount = line_cost(line.quantity, line.cost_price)
    reconcile_bill_vendors(
        bill,
        old_vendor=bill.supplier,
        new_vendor=line.vendor,
        old_amount=old_amount,
        new_amount=new_amount,
        notes=action_notes or f'Qty reduction on invoice {line.customer_invoice.invoice_number}',
    )


def handle_removed_line(old_line, invoice, user):
    """Reverse supplier bill when a manual line is removed."""
    bill = old_line.supplier_bill
    vendor = old_line.vendor or bill.supplier if bill else None
    if not bill or not vendor:
        return

    reconcile_bill_vendors(
        bill,
        old_vendor=vendor,
        new_vendor=vendor,
        old_amount=bill.amount,
        new_amount=Decimal('0'),
        notes=f'Line removed from invoice {invoice.invoice_number}',
    )
    bill.is_deleted = True
    bill.save(update_fields=['is_deleted', 'updated_at'])
