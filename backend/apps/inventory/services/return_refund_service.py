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
from apps.finance.services.manual_line_disposition import (
    DispositionValidationError,
    go_to_product_for_manual_line,
    return_qty_to_supplier_for_line,
    validate_qty_split,
)


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
        qty = int(line_data['quantity'])
        refund_amt = line_data.get('refund_amount', Decimal('0.00'))
        total_refund += Decimal(str(refund_amt))

        variant, vendor, inv_line = _resolve_return_line_refs(
            return_data['return_type'], line_data, company_id,
        )
        is_manual = line_data.get('is_manual_entry', False) or (inv_line.is_manual_entry if inv_line else False)
        return_to_supplier = line_data.get('return_to_supplier', False)
        disposition_action = line_data.get('disposition_action', '')
        if not disposition_action and is_manual:
            disposition_action = 'RETURN_TO_SUPPLIER' if return_to_supplier else 'GO_TO_PRODUCT'

        product_qty = line_data.get('product_qty')
        damage_qty = line_data.get('damage_qty', 0)
        damage_reason = (line_data.get('damage_reason') or '').strip()

        if is_manual and disposition_action == 'GO_TO_PRODUCT':
            validate_qty_split(qty, product_qty, damage_qty, damage_reason)
        elif not is_manual and variant:
            if product_qty is None and damage_qty:
                product_qty = max(0, qty - int(damage_qty))
            elif product_qty is None:
                product_qty = qty if line_data.get('restock', True) else 0
                damage_qty = qty - product_qty
            if int(damage_qty or 0) > 0:
                validate_qty_split(qty, product_qty, damage_qty, damage_reason)

        ReturnRefundLine.objects.create(
            return_refund=ret,
            source_line_id=line_data['source_line_id'],
            variant=variant,
            is_manual_entry=is_manual,
            manual_variant_name=line_data.get('manual_variant_name') or (inv_line.manual_variant_name if inv_line else ''),
            manual_variant_sku=line_data.get('manual_variant_sku') or (inv_line.manual_variant_sku if inv_line else ''),
            vendor=vendor,
            quantity=qty,
            unit_price=line_data.get('unit_price', Decimal('0')),
            refund_amount=refund_amt,
            tax_rate=line_data.get('tax_rate', Decimal('0.00')),
            restock=line_data.get('restock', True),
            return_to_supplier=return_to_supplier or disposition_action == 'RETURN_TO_SUPPLIER',
            disposition_action=disposition_action,
            product_qty=int(product_qty or 0),
            damage_qty=int(damage_qty or 0),
            damage_reason=damage_reason,
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


def _resolve_return_line_refs(return_type, line_data, company_id):
    """Resolve variant, vendor, and source invoice line from return line payload."""
    from apps.finance.models import CustomerInvoiceLine
    from apps.inventory.models import Supplier, ProductVariant

    inv_line = None
    variant = None
    vendor = None

    if return_type == 'INVOICE':
        inv_line = CustomerInvoiceLine.objects.filter(
            _id=line_data['source_line_id'],
            company_id=company_id,
            is_deleted=False,
        ).select_related('variant', 'vendor', 'supplier_bill').first()
        if inv_line:
            variant = inv_line.variant
            vendor = inv_line.vendor

    vendor_id = line_data.get('vendor') or line_data.get('vendor_id')
    if vendor_id and not vendor:
        vendor = Supplier.objects.filter(_id=vendor_id, company_id=company_id).first()

    variant_id = line_data.get('variant') or line_data.get('variant_id')
    if variant_id and not variant:
        variant = ProductVariant.objects.filter(_id=variant_id, company_id=company_id).first()

    return variant, vendor, inv_line


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
    from apps.finance.models import CustomerInvoiceLine

    for line in ret.lines.select_related('variant', 'vendor').all():
        inv_line = None
        if ret.return_type == 'INVOICE':
            inv_line = CustomerInvoiceLine.objects.filter(
                _id=line.source_line_id,
                company_id=ret.company_id,
                is_deleted=False,
            ).select_related('supplier_bill', 'vendor').first()

        if line.is_manual_entry and inv_line:
            if line.disposition_action == 'GO_TO_PRODUCT' or (
                not line.return_to_supplier and line.disposition_action != 'RETURN_TO_SUPPLIER'
            ):
                go_to_product_for_manual_line(
                    inv_line,
                    line.quantity,
                    user,
                    source_document_type='RETURN_REFUND',
                    source_document_id=ret._id,
                    source_line_id=line._id,
                    product_qty=line.product_qty or line.quantity,
                    damage_qty=line.damage_qty,
                    damage_reason=line.damage_reason,
                    stock_reason=f'Return {ret.return_number} – go to product',
                    damage_reason_prefix=f'Return {ret.return_number} damage',
                )
            elif line.return_to_supplier or line.disposition_action == 'RETURN_TO_SUPPLIER':
                _reverse_supplier_for_line(ret, line, user, inv_line)
        else:
            if line.quantity > 0 and line.variant:
                _restock_item(ret, line, user, quantity=line.quantity)
            if line.damage_qty > 0 and line.variant:
                _record_variant_damage(ret, line, user)

        _update_source_line_status(ret.return_type, line, user)

    refund_payment_id = _refund_payment(ret, user)
    _update_source_document_totals(ret, user)

    ret.status = 'COMPLETED'
    ret.completed_at = timezone.now()
    ret.completed_by = user
    ret.refund_payment_id = refund_payment_id
    ret.updated_by = user
    ret.save(update_fields=[
        'status', 'completed_at', 'completed_by',
        'refund_payment_id', 'updated_at', 'updated_by',
    ])


def _restock_item(ret, line, user, quantity=None):
    """Add quantity back to inventory and create RETURN_IN transaction."""
    from apps.inventory.models import StockItem, InventoryTransaction
    import uuid as _uuid

    qty = quantity if quantity is not None else line.quantity
    if qty <= 0:
        return

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
    after = before + qty
    stock_item.quantity_on_hand = after
    stock_item.version = F('version') + 1
    stock_item.save(update_fields=['quantity_on_hand', 'version'])

    InventoryTransaction.objects.create(
        transaction_id=_uuid.uuid4(),
        variant=line.variant,
        warehouse=ret.warehouse,
        company_id=ret.company_id,
        branch_id=ret.branch_id,
        quantity_change=qty,
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


def _record_variant_damage(ret, line, user):
    """Record damage for variant return line — deduct damaged qty from stock."""
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
    after = before - line.damage_qty
    stock_item.quantity_on_hand = after
    stock_item.version = F('version') + 1
    stock_item.save(update_fields=['quantity_on_hand', 'version'])

    InventoryTransaction.objects.create(
        transaction_id=_uuid.uuid4(),
        variant=line.variant,
        warehouse=ret.warehouse,
        company_id=ret.company_id,
        branch_id=ret.branch_id,
        quantity_change=-line.damage_qty,
        quantity_before=before,
        quantity_after=after,
        unit_cost=line.variant.buying_price or 0,
        transaction_type='DAMAGE',
        source_document_type='RETURN_REFUND',
        source_document_id=ret._id,
        source_line_id=line._id,
        reason_text=f'Return {ret.return_number} damage: {line.damage_reason}',
        created_by=user,
        updated_by=user,
    )


def _reverse_supplier_for_line(ret, line, user, inv_line=None):
    """Reverse supplier bill/balance using cost price (not selling/refund price)."""
    from apps.finance.models import CustomerInvoiceLine

    if not line.vendor:
        return

    if inv_line is None and ret.return_type == 'INVOICE':
        inv_line = CustomerInvoiceLine.objects.filter(
            _id=line.source_line_id,
            company_id=ret.company_id,
            is_deleted=False,
        ).select_related('supplier_bill', 'vendor').first()

    if inv_line:
        return_qty_to_supplier_for_line(
            inv_line,
            line.quantity,
            user,
            notes=f'Return {ret.return_number}: reversed {line.quantity} units at cost',
            cancel_bill_if_zero=True,
        )
        return

    from apps.finance.services.supplier_balance import update_supplier_balance
    cost_amount = Decimal(str(line.quantity)) * Decimal('0')
    update_supplier_balance(
        line.vendor,
        cost_amount,
        'PURCHASE_REVERSAL',
        reference_type='return_refund',
        reference_id=ret._id,
        notes=(
            f'Return {ret.return_number}: reversed {line.quantity} units of '
            f'{line.variant.sku if line.variant else line.manual_variant_sku}'
        ),
    )


def _refund_payment(ret, user):
    """
    Refund proportional amount based on return total vs document total.
    Returns the UUID of the refund payment, or None.
    """
    from django.contrib.contenttypes.models import ContentType
    from apps.finance.models import Payment
    from apps.finance.services.cancel_invoice import reverse_journal_entry
    from apps.finance.services.payable import get_payments_queryset

    if ret.total_refund_amount <= 0:
        return None

    doc, _, _ = _resolve_document(ret.return_type, ret.document_id, ret.company_id)
    confirmed_payments = list(
        get_payments_queryset(doc, status='CONFIRMED').select_related('bank_account', 'journal_entry')
    )
    if not confirmed_payments:
        return None

    doc_total = getattr(doc, 'amount', None) or getattr(doc, 'total_amount', Decimal('0'))
    doc_total = Decimal(str(doc_total))
    if doc_total <= 0:
        return None

    refund_ratio = min(Decimal('1'), Decimal(str(ret.total_refund_amount)) / doc_total)
    remaining_refund = Decimal(str(ret.total_refund_amount))

    for payment in confirmed_payments:
        if remaining_refund <= 0:
            break

        payment_refund = min(remaining_refund, payment.amount * refund_ratio)
        if payment_refund <= 0:
            continue

        if payment.journal_entry_id:
            reverse_journal_entry(
                payment.journal_entry, user,
                f'Partial refund for return {ret.return_number}',
            )

        if payment.bank_account_id:
            if payment.payment_type == 'RECEIPT':
                payment.bank_account.book_balance = F('book_balance') - payment_refund
            else:
                payment.bank_account.book_balance = F('book_balance') + payment_refund
            payment.bank_account.save(update_fields=['book_balance'])

        if payment_refund >= payment.amount:
            payment.status = 'CANCELLED'
            payment.notes = (
                (payment.notes + '\n' if payment.notes else '')
                + f'Cancelled by return {ret.return_number}'
            )
            payment.deleted_by = user
            payment.save(update_fields=['status', 'notes', 'deleted_by', 'updated_at'])
        else:
            payment.amount = payment.amount - payment_refund
            payment.notes = (
                (payment.notes + '\n' if payment.notes else '')
                + f'Reduced by {payment_refund} due to return {ret.return_number}'
            )
            payment.save(update_fields=['amount', 'notes', 'updated_at'])

        remaining_refund -= payment_refund

    ct = ContentType.objects.get_for_model(doc.__class__, for_concrete_model=False)
    refund_payment_obj = Payment.objects.create(
        company_id=ret.company_id,
        branch_id=ret.branch_id,
        content_type=ct,
        object_id=doc.pk,
        payment_type='PAYMENT',
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
        from apps.finance.models import CustomerInvoiceLine, CustomerInvoice

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

            # Propagate quantity_returned to linked POS SalesOrderLine
            _propagate_invoice_return_to_sales_order(inv_line, line.quantity, user)

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


def _propagate_invoice_return_to_sales_order(inv_line, returned_qty, user):
    """
    When an invoice is returned, check if the invoice was generated from a
    POS SalesOrder. If so, update the corresponding SalesOrderLine's
    quantity_returned so the POS detail page reflects the return.
    """
    from apps.finance.models import CustomerInvoice
    from apps.inventory.models.sales import SalesOrderLine

    # customer_invoice_id is the integer PK (BigAutoField), query by pk
    invoice = CustomerInvoice.objects.filter(
        pk=inv_line.customer_invoice_id,
        is_deleted=False,
    ).select_related('sales_order').first()

    if not invoice or not invoice.sales_order_id:
        return

    if not inv_line.variant_id:
        return

    # Find the matching SalesOrderLine by variant
    sol = SalesOrderLine.objects.filter(
        sales_order_id=invoice.sales_order_id,
        variant_id=inv_line.variant_id,
        is_deleted=False,
    ).first()

    if sol:
        sol.quantity_returned = F('quantity_returned') + returned_qty
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
