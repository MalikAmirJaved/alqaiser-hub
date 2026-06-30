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

    No-op when vendor and amount are unchanged to prevent duplicate credit
    entries on subsequent non-bill-related invoice updates.
    """
    old_amount = Decimal(str(old_amount))
    new_amount = Decimal(str(new_amount))

    same_vendor = (
        old_vendor
        and new_vendor
        and old_vendor.pk == new_vendor.pk
    )

    # No-op: nothing to reconcile when both vendor and amount are unchanged.
    # Without this guard, subsequent invoice updates (e.g. changing due date)
    # would re-trigger the overpayment → CREDIT_NOTE logic, doubling the
    # supplier credit on every save.
    if same_vendor and old_amount == new_amount:
        return

    paid = get_total_paid(bill)

    old_outstanding = max(Decimal('0'), old_amount - paid)
    new_outstanding = max(Decimal('0'), new_amount - paid)
    overpayment = max(Decimal('0'), paid - new_amount)

    ref_type = 'supplier_bill'
    ref_id = bill._id
    note = notes or f'Bill {bill.bill_number} updated'

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

    new_cost_price_val = Decimal(str(new_cost_price))
    old_qty = old_line.quantity
    old_cost_price = old_line.cost_price or Decimal('0')
    old_vendor = old_line.vendor
    bill = old_line.supplier_bill

    if not bill:
        new_amount = line_cost(new_qty, new_cost_price_val)
        bill = create_supplier_bill_for_line(
            invoice,
            new_vendor,
            new_amount,
            user,
            notes=f"Auto-created from invoice {invoice.invoice_number}",
        )
        old_line.supplier_bill = bill
        return None

    if old_cost_price > 0:
        billed_qty = (bill.amount / old_cost_price).to_integral_value()
    else:
        billed_qty = Decimal(str(old_qty))

    cost_delta_amount = billed_qty * (new_cost_price_val - old_cost_price)
    bill_amount_after_cost = bill.amount + cost_delta_amount
    qty_delta_amount = Decimal(str(new_qty - old_qty)) * new_cost_price_val

    qty_decreased = new_qty < old_qty

    # Quantity decrease → apply cost/vendor changes immediately so the
    # supplier bill always reflects the current per-unit cost for ALL
    # items (including those that will go to inventory).
    #
    # The qty reduction itself is deferred to the resolution step where
    # the user picks "return_to_vendor" (deduct qty from bill) or
    # "go_to_inventory" (bill stays cost-adjusted, stock added to
    # inventory).
    if qty_decreased:
        if cost_delta_amount != 0 or (old_vendor and old_vendor != new_vendor):
            reconcile_bill_vendors(
                bill,
                old_vendor=old_vendor or bill.supplier,
                new_vendor=new_vendor,
                old_amount=bill.amount,
                new_amount=bill_amount_after_cost,
                notes=f'Invoice {invoice.invoice_number} line cost/vendor updated before reduction',
            )

        if old_line.resolved:
            # Reset resolved flag so a new reduction cycle can begin
            old_line.resolved = False
        old_line.original_quantity = old_qty
        old_line.save(update_fields=['original_quantity', 'resolved', 'updated_at'])

        expected_new_bill_amount = line_cost(new_qty, new_cost_price_val)
        return {
            'line_id': str(old_line._id),
            'line_index': line_index,
            'line_name': line_name,
            'bill_id': str(bill._id),
            'supplier_id': str(new_vendor._id),
            'supplier_name': new_vendor.name,
            'delta': abs(qty_delta_amount),
            'old_qty': old_qty,
            'new_qty': new_qty,
            'unit_price': old_line.unit_price,
            'cost_price': new_cost_price_val,
            'bill_paid': bill_has_confirmed_payment(bill),
            'old_bill_amount': str(bill.amount),
            'new_bill_amount': str(expected_new_bill_amount),
        }

    # Increase or vendor/cost change → update bill in place immediately
    total_new_bill_amount = bill_amount_after_cost + qty_delta_amount

    # Skip if nothing changed — prevents duplicate credit/balance updates on
    # unrelated invoice edits (e.g. due date change) after a reduction was
    # already resolved. The early-return in reconcile_bill_vendors() also
    # guards against this, but checking here avoids the function call entirely.
    if total_new_bill_amount != bill.amount or (
        old_vendor and new_vendor and old_vendor.pk != new_vendor.pk
    ):
        reconcile_bill_vendors(
            bill,
            old_vendor=old_vendor or bill.supplier,
            new_vendor=new_vendor,
            old_amount=bill.amount,
            new_amount=total_new_bill_amount,
            notes=f'Invoice {invoice.invoice_number} line updated',
        )
    return None


def apply_line_reduction(bill, line, user, action_notes=''):
    """Apply qty-reduction effects on a supplier bill after resolution.

    Cost/vendor adjustments were already applied during sync via
    ``reconcile_bill_vendors``. This function only applies the QTY
    reduction: reduces the bill amount by ``delta_qty × cost_price``
    and adjusts supplier balance/credit for the returned items only.

    Using ``reconcile_bill_vendors`` here with the full new amount would
    double-count the overpayment because credit was already given for
    the cost-only portion during sync.  By calculating only the qty
    delta, we avoid the double-credit bug.
    """

    delta_qty = line.original_quantity - line.quantity
    new_cost = Decimal(str(line.cost_price or 0))
    paid = get_total_paid(bill)

    reduction_amount = line_cost(delta_qty, new_cost)

    old_amount = bill.amount
    new_amount = old_amount - reduction_amount

    old_overpayment = max(Decimal('0'), paid - old_amount)
    new_overpayment = max(Decimal('0'), paid - new_amount)
    additional_overpayment = new_overpayment - old_overpayment

    old_outstanding = max(Decimal('0'), old_amount - paid)
    new_outstanding = max(Decimal('0'), new_amount - paid)
    outstanding_delta = new_outstanding - old_outstanding

    ref_type = 'supplier_bill'
    ref_id = bill._id
    note = action_notes or f'Qty reduction on invoice {line.customer_invoice.invoice_number}'
    vendor = line.vendor

    if outstanding_delta < 0:
        update_supplier_balance(
            vendor, abs(outstanding_delta), 'PURCHASE_REVERSAL',
            reference_type=ref_type, reference_id=ref_id,
            notes=f'{note}: outstanding -{abs(outstanding_delta)}',
        )

    if additional_overpayment > 0:
        update_supplier_balance(
            vendor, additional_overpayment, 'CREDIT_NOTE',
            reference_type=ref_type, reference_id=ref_id,
            notes=f'{note}: additional overpayment from qty reduction',
        )

    bill.amount = new_amount
    bill.save(update_fields=['amount', 'updated_at'])


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
