"""
Core business logic for the Return & Refund module.

Workflow:
  1. Look up a paid document by number (CustomerInvoice or SalesOrder)
  2. Create ReturnRefund record with selected lines
  3. Process the return:
     a. Restock inventory (for variants with restock=True)
     b. Reverse supplier bill/balance (for lines with return_to_supplier=True)
     c. Refund payment (reverse to original payment method)
     d. Update source document (mark lines as RETURNED, recalc totals)
  4. Create audit trail at every step
"""
import uuid
from decimal import Decimal
from datetime import datetime

from django.db import transaction
from django.db.models import F, Sum
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.inventory.models.return_refund import ReturnRefund, ReturnRefundLine


def lookup_paid_document(return_type, document_number, company_id):
    """
    Look up a paid CustomerInvoice or SalesOrder by its number.
    Returns (document, customer, lines_list) or raises ValidationError.
    
    `lines_list` is a list of dicts with keys:
      source_line_id, variant, unit_price, quantity (max returnable),
      is_manual_entry, manual_variant_name, manual_variant_sku, vendor, tax_rate
    """
    if return_type == 'INVOICE':
        return _lookup_invoice(document_number, company_id)
    elif return_type == 'POS':
        return _lookup_sales_order(document_number, company_id)
    else:
        raise ValidationError(f"Invalid return type: {return_type}")


def _lookup_invoice(document_number, company_id):
    from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
    from apps.finance.services.payable import get_payment_status

    try:
        invoice = CustomerInvoice.objects.select_related('customer').get(
            invoice_number=document_number,
            company_id=company_id,
            is_deleted=False,
        )
    except CustomerInvoice.DoesNotExist:
        raise ValidationError(f"Invoice '{document_number}' not found")

    if invoice.status == 'CANCELLED':
        raise ValidationError(f"Invoice '{document_number}' is cancelled")

    payment_status = get_payment_status(invoice)
    if payment_status != 'PAID':
        raise ValidationError(
            f"Cannot return invoice '{document_number}' — status is {payment_status}. "
            f"Only fully paid invoices can be returned."
        )

    lines = []
    for inv_line in invoice.lines.filter(is_deleted=False, status='ACTIVE'):
        max_returnable = inv_line.quantity  # full qty is returnable
        lines.append({
            'source_line_id': inv_line._id,
            'variant': inv_line.variant,
            'unit_price': inv_line.unit_price,
            'quantity': max_returnable,
            'is_manual_entry': inv_line.is_manual_entry,
            'manual_variant_name': inv_line.manual_variant_name,
            'manual_variant_sku': inv_line.manual_variant_sku,
            'vendor': inv_line.vendor,
            'tax_rate': inv_line.tax_rate,
            'discount_amount': inv_line.discount_amount,
        })

    return invoice, invoice.customer, lines


def _lookup_sales_order(document_number, company_id):
    from apps.inventory.models.sales import SalesOrder, SalesOrderLine
    from apps.finance.services.payable import get_payment_status

    try:
        order = SalesOrder.objects.select_related('customer', 'warehouse').get(
            order_number=document_number,
            company_id=company_id,
        )
    except SalesOrder.DoesNotExist:
        raise ValidationError(f"Sales order '{document_number}' not found")

    if order.status == 'CANCELLED':
        raise ValidationError(f"Order '{document_number}' is cancelled")

    # For POS orders, check payment status via linked invoice or directly
    from apps.finance.models import CustomerInvoice
    invoice = CustomerInvoice.objects.filter(
        sales_order=order, is_deleted=False
    ).first()
    if invoice:
        payment_status = get_payment_status(invoice)
        if payment_status != 'PAID':
            raise ValidationError(
                f"Cannot return order '{document_number}' — linked invoice status is {payment_status}."
            )
    elif order.total_amount > 0:
        # Check direct payments on the sales order
        payment_status = get_payment_status(order)
        if payment_status != 'PAID':
            raise ValidationError(
                f"Cannot return order '{document_number}' — payment status is {payment_status}."
            )

    lines = []
    for sol in order.lines.filter(status='COMPLETE'):
        max_returnable = sol.max_returnable
        if max_returnable <= 0:
            continue
        lines.append({
            'source_line_id': sol._id,
            'variant': sol.variant,
            'unit_price': sol.unit_price,
            'quantity': max_returnable,
            'is_manual_entry': False,
            'manual_variant_name': '',
            'manual_variant_sku': '',
            'vendor': None,
            'tax_rate': sol.tax_rate,
            'discount_amount': sol.discount_amount,
        })

    return order, order.customer, lines


@transaction.atomic
def create_return_refund(return_data, user):
    """
    Create and process a ReturnRefund.
    
    return_data keys:
      - return_type, document_id, warehouse_id
      - return_date, reason
      - lines: [{ source_line_id, quantity, unit_price, refund_amount,
                  restock, return_to_supplier, reason }]
    
    Returns the created ReturnRefund instance.
    """
    from apps.inventory.models import Warehouse, ProductVariant, StockItem, InventoryTransaction

    company_id = user.company_id
    branch_id = user.branch_id

    # ── Resolve source document ────────────────────────────────────
    doc, customer, _ = _resolve_document(
        return_data['return_type'], return_data['document_id'], company_id
    )
    warehouse = Warehouse.objects.get(
        _id=return_data['warehouse_id'],
        company_id=company_id,
    )

    # ── Create ReturnRefund header ─────────────────────────────────
    ret = ReturnRefund.objects.create(
        return_number=_generate_return_number(),
        return_type=return_data['return_type'],
        document_id=return_data['document_id'],
        document_number=_get_document_number(doc),
        customer=customer,
        warehouse=warehouse,
        return_date=return_data.get('return_date') or timezone.now(),
        status='DRAFT',
        reason=return_data.get('reason', ''),
        company_id=company_id,
        branch_id=branch_id,
        created_by=user,
        updated_by=user,
    )

    # ── Create lines & validate ────────────────────────────────────
    total_refund = Decimal('0.00')
    for line_data in return_data['lines']:
        qty = line_data['quantity']
        refund_amt = line_data.get('refund_amount', Decimal('0.00'))
        total_refund += Decimal(str(refund_amt))

        ReturnRefundLine.objects.create(
            return_refund=ret,
            source_line_id=line_data['source_line_id'],
            variant=line_data.get('variant'),
            is_manual_entry=line_data.get('is_manual_entry', False),
            manual_variant_name=line_data.get('manual_variant_name', ''),
            manual_variant_sku=line_data.get('manual_variant_sku', ''),
            vendor=line_data.get('vendor'),
            quantity=qty,
            unit_price=line_data.get('unit_price', Decimal('0')),
            refund_amount=refund_amt,
            tax_rate=line_data.get('tax_rate', Decimal('0.00')),
            restock=line_data.get('restock', True),
            return_to_supplier=line_data.get('return_to_supplier', False),
            reason=line_data.get('reason', ''),
            company_id=company_id,
            branch_id=branch_id,
            created_by=user,
            updated_by=user,
        )

    ret.total_refund_amount = total_refund
    ret.save(update_fields=['total_refund_amount'])

    # ── Execute the return workflow ────────────────────────────────
    _execute_return(ret, user)

    return ret


def _resolve_document(return_type, document_id, company_id):
    """
    Resolve the source document and customer from return_type + document_id.
    Returns (document_object, customer, source_lines_queryset).
    """
    if return_type == 'INVOICE':
        from apps.finance.models import CustomerInvoice
        try:
            doc = CustomerInvoice.objects.select_related('customer').get(
                _id=document_id, company_id=company_id, is_deleted=False
            )
        except CustomerInvoice.DoesNotExist:
            raise ValidationError(f"Invoice document not found (id={document_id})")
        return doc, doc.customer, doc.lines.filter(is_deleted=False, status='ACTIVE')

    elif return_type == 'POS':
        from apps.inventory.models.sales import SalesOrder
        try:
            doc = SalesOrder.objects.select_related('customer').get(
                _id=document_id, company_id=company_id
            )
        except SalesOrder.DoesNotExist:
            raise ValidationError(f"Sales order document not found (id={document_id})")
        return doc, doc.customer, doc.lines.filter(status='COMPLETE')

    raise ValidationError(f"Invalid return_type: {return_type}")


def _get_document_number(doc):
    """Get human-readable number from any document type."""
    if hasattr(doc, 'invoice_number'):
        return doc.invoice_number
    if hasattr(doc, 'order_number'):
        return doc.order_number
    return str(doc._id)


def _generate_return_number():
    """Generate a unique return number."""
    import random
    ts = int(timezone.now().timestamp())
    return f"RET-{ts}-{random.randint(1000, 9999)}"


def _execute_return(ret, user):
    """
    Core execution: restock, reverse supplier, refund, update document.
    All within the already-active transaction.
    """
    from apps.inventory.models import StockItem, InventoryTransaction

    for line in ret.lines.select_related('variant').all():
        # ── 1. Restock inventory ───────────────────────────────
        if line.restock and line.variant:
            _restock_item(ret, line, user)

        # ── 2. Reverse supplier bill/balance ───────────────────
        if line.return_to_supplier:
            _reverse_supplier_for_line(ret, line, user)

        # ── 3. Update source document line status ──────────────
        _update_source_line_status(ret.return_type, line, user)

    # ── 4. Refund payment ─────────────────────────────────────
    refund_payment_id = _refund_payment(ret, user)

    # ── 5. Update source document totals ──────────────────────
    _update_source_document_totals(ret, user)

    # ── 6. Mark as completed ──────────────────────────────────
    ret.status = 'COMPLETED'
    ret.completed_at = timezone.now()
    ret.completed_by = user
    ret.refund_payment_id = refund_payment_id
    ret.updated_by = user
    ret.save(update_fields=[
        'status', 'completed_at', 'completed_by',
        'refund_payment_id', 'updated_at', 'updated_by',
    ])


def _restock_item(ret, line, user):
    """Add quantity back to inventory and create RETURN_IN transaction."""
    from apps.inventory.models import StockItem, InventoryTransaction
    import uuid as _uuid

    stock_item, _ = StockItem.objects.select_for_update().get_or_create(
        variant=line.variant,
        warehouse=ret.warehouse,
        company_id=ret.company_id,
        defaults={
            'quantity_on_hand': 0,
            'quantity_reserved': 0,
            'branch_id': ret.branch_id,
        }
    )
    before = stock_item.quantity_on_hand
    after = before + line.quantity
    stock_item.quantity_on_hand = after
    stock_item.version = F('version') + 1
    stock_item.save(update_fields=['quantity_on_hand', 'version'])

    InventoryTransaction.objects.create(
        transaction_id=_uuid.uuid4(),
        variant=line.variant,
        warehouse=ret.warehouse,
        company_id=ret.company_id,
        branch_id=ret.branch_id,
        quantity_change=line.quantity,
        quantity_before=before,
        quantity_after=after,
        unit_cost=line.variant.buying_price or 0,
        transaction_type='RETURN_IN',
        source_document_type='RETURN_REFUND',
        source_document_id=ret._id,
        source_line_id=line._id,
        reason_text=f'Return {ret.return_number} - restock',
        created_by=user,
        updated_by=user,
    )


def _reverse_supplier_for_line(ret, line, user):
    """
    Reverse the supplier bill/balance for this line.
    Creates a SupplierHistory entry with PURCHASE_REVERSAL.
    """
    from apps.finance.services.supplier_balance import update_supplier_balance

    if not line.vendor:
        return

    # Calculate the cost of the returned quantity
    cost = line.refund_amount

    update_supplier_balance(
        line.vendor,
        cost,
        'PURCHASE_REVERSAL',
        reference_type='return_refund',
        reference_id=ret._id,
        notes=f'Return {ret.return_number}: reversed {line.quantity} units of {line.variant.sku if line.variant else line.manual_variant_sku}',
    )

    # Also update the linked supplier bill if this line had one
    if ret.return_type == 'INVOICE':
        _update_related_supplier_bill(ret, line, user)


def _update_related_supplier_bill(ret, line, user):
    """Update the supplier bill linked to an invoice line when returning."""
    from apps.finance.models import CustomerInvoiceLine, SupplierBill

    inv_line = CustomerInvoiceLine.objects.filter(
        _id=line.source_line_id,
        company_id=ret.company_id,
        is_deleted=False,
    ).select_related('supplier_bill').first()

    if inv_line and inv_line.supplier_bill:
        bill = inv_line.supplier_bill
        refund_ratio = Decimal(str(line.refund_amount)) / max(inv_line.line_total, Decimal('0.01'))
        reduction = bill.amount * refund_ratio
        bill.amount = max(bill.amount - reduction, Decimal('0'))
        bill.notes = (bill.notes + '\n' if bill.notes else '') + (
            f'Reduced by {reduction} due to return {ret.return_number}'
        )
        bill.save(update_fields=['amount', 'notes', 'updated_at'])


def _refund_payment(ret, user):
    """
    Refund the total amount by reversing payments to the original method.
    Creates a refund Payment record for audit trail.
    
    Returns the UUID of the refund payment, or None.
    """
    from django.contrib.contenttypes.models import ContentType
    from apps.finance.models import Payment, BankTransaction, CustomerInvoice
    from apps.finance.services.cancel_invoice import reverse_journal_entry

    if ret.total_refund_amount <= 0:
        return None

    # Find the source document
    doc, _, _ = _resolve_document(ret.return_type, ret.document_id, ret.company_id)

    # Get all confirmed payments on this document
    from apps.finance.services.payable import get_payments_queryset
    confirmed_payments = get_payments_queryset(doc, status='CONFIRMED')

    refund_payment = None

    for payment in confirmed_payments.select_related('bank_account', 'journal_entry'):
        # Calculate proportional refund for this payment
        if payment.amount <= 0:
            continue

        # Reverse journal entry
        if payment.journal_entry_id:
            reverse_journal_entry(
                payment.journal_entry, user,
                f'Refund for return {ret.return_number}',
            )

        # Reverse bank balance
        if payment.bank_account_id:
            if payment.payment_type == 'RECEIPT':
                payment.bank_account.book_balance = F('book_balance') - payment.amount
            else:
                payment.bank_account.book_balance = F('book_balance') + payment.amount
            payment.bank_account.save(update_fields=['book_balance'])

        # Cancel the original payment
        payment.status = 'CANCELLED'
        payment.notes = (payment.notes + '\n' if payment.notes else '') + f'Cancelled by return {ret.return_number}'
        payment.deleted_by = user
        payment.save(update_fields=['status', 'notes', 'deleted_by', 'updated_at'])

    # Create a single refund payment record for audit trail
    ct = ContentType.objects.get_for_model(doc.__class__, for_concrete_model=False)
    refund_payment_obj = Payment.objects.create(
        company_id=ret.company_id,
        branch_id=ret.branch_id,
        content_type=ct,
        object_id=doc.pk,
        payment_type='PAYMENT' if ret.return_type == 'INVOICE' else 'PAYMENT',
        payment_method='BANK_TRANSFER',
        amount=ret.total_refund_amount,
        payment_date=timezone.now().date(),
        reference_number=f'RFND-{ret.return_number}',
        status='CONFIRMED',
        notes=f'Refund for return {ret.return_number} on {ret.document_number}',
        created_by=user,
        updated_by=user,
    )

    return refund_payment_obj._id


def _update_source_line_status(return_type, line, user):
    """Mark the source document line as RETURNED."""
    if return_type == 'INVOICE':
        from apps.finance.models import CustomerInvoiceLine

        inv_line = CustomerInvoiceLine.objects.filter(
            _id=line.source_line_id,
            company_id=line.company_id,
        ).first()
        if inv_line:
            if line.quantity >= inv_line.quantity:
                inv_line.status = 'RETURNED'
                inv_line.is_deleted = True
            else:
                inv_line.quantity -= line.quantity
                if inv_line.discount_amount:
                    inv_line.discount_amount = (
                        inv_line.discount_amount * Decimal(inv_line.quantity) /
                        max(Decimal(inv_line.quantity + line.quantity), Decimal('1'))
                    )
                inv_line.status = 'ACTIVE'
            inv_line.updated_by = user
            inv_line.save()

    elif return_type == 'POS':
        from apps.inventory.models.sales import SalesOrderLine

        sol = SalesOrderLine.objects.filter(
            _id=line.source_line_id,
            company_id=line.company_id,
        ).first()
        if sol:
            sol.quantity_returned = F('quantity_returned') + line.quantity
            sol.updated_by = user
            sol.save(update_fields=['quantity_returned', 'updated_by'])


def _update_source_document_totals(ret, user):
    """Recalculate the source document's total amount after return."""
    if ret.return_type == 'INVOICE':
        from apps.finance.models import CustomerInvoice, CustomerInvoiceLine

        invoice = CustomerInvoice.objects.filter(
            _id=ret.document_id, company_id=ret.company_id
        ).first()
        if not invoice:
            return

        active_lines = invoice.lines.filter(is_deleted=False)
        new_amount = sum(
            (l.quantity * l.unit_price) - (l.discount_amount or 0)
            for l in active_lines
        )
        invoice.amount = max(new_amount, Decimal('0'))
        invoice.updated_by = user
        invoice.save(update_fields=['amount', 'updated_by', 'updated_at'])

    elif ret.return_type == 'POS':
        from apps.inventory.models.sales import SalesOrder

        order = SalesOrder.objects.filter(
            _id=ret.document_id, company_id=ret.company_id
        ).first()
        if not order:
            return

        # Total return value = sum of refund_amounts from this return's lines
        total_return_value = ret.lines.aggregate(
            total=Sum('refund_amount')
        )['total'] or Decimal('0.00')
        order.total_amount = max(order.total_amount - total_return_value, Decimal('0'))
        order.updated_by = user
        order.save(update_fields=['total_amount', 'updated_by', 'updated_at'])
