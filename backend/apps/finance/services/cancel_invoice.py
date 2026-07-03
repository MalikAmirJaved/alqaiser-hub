"""
Cancel a customer invoice and reverse all side-effects.

Reversal chain:
  1. Cancel DRAFT payments      → soft-delete
  2. Reverse inventory stock     → direct_release_stock()
  3. Cancel supplier bills       → depends on supplier_action + per-line actions
  4. Reverse journal entry       → create swapping JE
  5. Mark lines as cancelled
  6. Set invoice status          → CANCELLED

Everything runs inside a single transaction.atomic() block.
All reversals create history records (InventoryTransaction, SupplierHistory,
JournalEntry) for full audit trail.
"""
from decimal import Decimal

from django.db import transaction
from django.db.models import F

from apps.finance.services.payable import get_payments_queryset


def cancel_customer_invoice(invoice, user, reason='', supplier_action='return_to_supplier', line_actions=None, stock_dispositions=None):
    """
    Cancel a customer invoice and reverse all effects.

    Args:
        invoice: CustomerInvoice instance
        user: User performing the cancellation
        reason: Cancellation reason (required)
        supplier_action: 'go_to_inventory' or 'return_to_supplier' (default for manual lines)
        line_actions: List of {source_line_id: str, action: "go_to_inventory"|"return_to_supplier"}
            Per-line action overrides for manual entry items.
        stock_dispositions: List of {source_line_id: str, disposition: "add_stock"|"damaged"}
            Per-line stock disposition. "damaged" creates DAMAGE transaction instead of restocking.

    Returns (success: bool, message: str).
    """
    from apps.inventory.services.stock_service import direct_release_stock
    from apps.finance.models import (
        CustomerInvoiceLine, SupplierBill, Payment, JournalEntry, JournalLine,
    )
    from apps.finance.services.supplier_balance import update_supplier_balance

    # ── Pre-checks ──────────────────────────────────────────────────────
    if invoice.status == 'CANCELLED':
        return False, 'Invoice is already cancelled'

    if not reason or not reason.strip():
        return False, 'Cancellation reason is required'

    line_actions = line_actions or []
    stock_dispositions = stock_dispositions or []
    line_action_map = {la['source_line_id']: la['action'] for la in line_actions if 'source_line_id' in la and 'action' in la}
    stock_disp_map = {sd['source_line_id']: sd['disposition'] for sd in stock_dispositions if 'source_line_id' in sd and 'disposition' in sd}

    # Validate stock dispositions
    for sd in stock_dispositions:
        if sd.get('disposition') not in ('add_stock', 'damaged'):
            raise ValueError(f"Invalid stock disposition: {sd.get('disposition')}. Must be 'add_stock' or 'damaged'.")

    with transaction.atomic():
        # ── 1. Cancel DRAFT payments ────────────────────────────────────
        draft_payments = get_payments_queryset(invoice, status='DRAFT')
        for payment in draft_payments:
            payment.is_deleted = True
            payment.deleted_by = user
            payment.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])

        # ── 2. Reverse inventory stock ──────────────────────────────────
        try:
            _reverse_invoice_stock_with_dispositions(
                invoice, user, stock_disp_map,
            )
        except Exception as e:
            raise ValueError(f'Failed to reverse stock: {e}')

        # ── 3. Cancel supplier bills ────────────────────────────────────
        supplier_bills = SupplierBill.objects.filter(
            customer_invoice=invoice,
            is_deleted=False,
        )
        for bill in supplier_bills:
            if bill.status == 'CANCELLED':
                continue

            if bill.supplier_id and bill.amount > 0:
                bill_payments = get_payments_queryset(bill, status='CONFIRMED')
                has_payments = bill_payments.exists()

                # Find which line this bill belongs to
                line = invoice.lines.filter(
                    supplier_bill=bill,
                    is_deleted=False,
                ).first()
                effective_action = supplier_action
                if line and str(line._id) in line_action_map:
                    effective_action = line_action_map[str(line._id)]

                if has_payments:
                    if effective_action == 'return_to_supplier':
                        # ── KEEP payments intact, just create CREDIT_NOTE ──
                        # Don't reverse the payments - keep payment history
                        # The paid amount becomes supplier credit
                        update_supplier_balance(
                            bill.supplier,
                            bill.amount,
                            'CREDIT_NOTE',
                            reference_type='supplier_bill',
                            reference_id=bill._id,
                            notes=f'Invoice {invoice.invoice_number} cancelled – credit for returned goods (bill {bill.bill_number})',
                        )
                    # else: go_to_inventory — skip all supplier balance changes
                else:
                    # No confirmed payments — normal PURCHASE_REVERSAL
                    if effective_action == 'return_to_supplier':
                        update_supplier_balance(
                            bill.supplier,
                            bill.amount,
                            'PURCHASE_REVERSAL',
                            reference_type='supplier_bill',
                            reference_id=bill._id,
                            notes=f'Invoice {invoice.invoice_number} cancelled – bill {bill.bill_number} reversed',
                        )
                    # else: go_to_inventory — skip supplier balance changes

            # Cancel the bill's journal entry if exists
            if bill.journal_entry_id:
                reverse_journal_entry(bill.journal_entry, user, f'Invoice {invoice.invoice_number} cancelled')

            bill.status = 'CANCELLED'
            bill.save(update_fields=['status', 'updated_at'])

        # ── 4. Handle manual lines with go_to_inventory ─────────────────
        # For manual lines where the user chose "go_to_inventory",
        # create a new product+variant and add stock
        for la in line_actions:
            if la.get('action') == 'go_to_inventory':
                try:
                    line = invoice.lines.get(
                        _id=la['source_line_id'],
                        is_deleted=False,
                        is_manual_entry=True,
                    )
                    _create_product_for_manual_line(line, user)
                except CustomerInvoiceLine.DoesNotExist:
                    pass  # Line already handled or not found

        # ── 5. Reverse invoice journal entry ────────────────────────────
        if invoice.journal_entry_id:
            reverse_journal_entry(invoice.journal_entry, user, f'Invoice {invoice.invoice_number} cancelled')

        # ── 6. Mark all invoice lines as cancelled ──────────────────────
        invoice.lines.filter(is_deleted=False).update(
            status='CANCELLED',
            updated_by=user,
        )

        # ── 7. Set invoice status to CANCELLED ──────────────────────────
        from django.utils import timezone
        invoice.status = 'CANCELLED'
        invoice.cancelled_by = user
        invoice.cancelled_at = timezone.now()
        cancel_notes = f'Cancelled by {user.username}'
        if reason:
            cancel_notes += f': {reason}'
        if invoice.notes:
            invoice.notes = f'{invoice.notes}\n\n{cancel_notes}'
        else:
            invoice.notes = cancel_notes
        invoice.save(update_fields=['status', 'notes', 'updated_at'])

    return True, 'Invoice cancelled successfully'


def _reverse_invoice_stock_with_dispositions(invoice, user, stock_disp_map):
    """
    Reverse stock deductions for an invoice, respecting per-line dispositions.
    
    For lines with "damaged" disposition: create DAMAGE transaction, don't restock.
    For lines with "add_stock" or no disposition: normal restock via direct_release_stock.
    """
    from apps.inventory.services.stock_service import direct_release_stock
    from apps.inventory.models import InventoryTransaction, StockItem
    import uuid

    # Get all transactions for this invoice
    transactions = InventoryTransaction.objects.filter(
        source_document_id=invoice._id,
        source_document_type='CUSTOMER_INVOICE',
        company_id=invoice.company_id,
    ).select_related('variant', 'warehouse')

    # Group by line to check dispositions
    transactions_by_line = {}
    for txn in transactions:
        line_id = str(txn.source_line_id) if txn.source_line_id else 'unknown'
        if line_id not in transactions_by_line:
            transactions_by_line[line_id] = []
        transactions_by_line[line_id].append(txn)

    # Handle damaged lines separately
    damaged_line_ids = {lid for lid, disp in stock_disp_map.items() if disp == 'damaged'}
    
    for line_id, txns in transactions_by_line.items():
        if line_id in damaged_line_ids:
            for txn in txns:
                if txn.quantity_change < 0:  # Was a deduction
                    stock, _ = StockItem.objects.select_for_update().get_or_create(
                        variant=txn.variant,
                        warehouse=txn.warehouse,
                        company_id=invoice.company_id,
                        defaults={
                            'quantity_on_hand': 0,
                            'quantity_reserved': 0,
                            'branch_id': user.branch_id or invoice.company_id,
                        },
                    )
                    # DON'T add back to on_hand - create DAMAGE audit record
                    InventoryTransaction.objects.create(
                        transaction_id=uuid.uuid4(),
                        variant=txn.variant,
                        warehouse=txn.warehouse,
                        company_id=invoice.company_id,
                        branch_id=user.branch_id or invoice.company_id,
                        quantity_change=0,
                        quantity_before=stock.quantity_on_hand,
                        quantity_after=stock.quantity_on_hand,
                        unit_cost=txn.unit_cost,
                        transaction_type='DAMAGE',
                        source_document_type='CUSTOMER_INVOICE_CANCELLATION',
                        source_document_id=invoice._id,
                        source_line_id=txn.source_line_id,
                        reason_text=f'Marked as damaged on invoice {invoice.invoice_number} cancellation',
                        created_by=user,
                        updated_by=user,
                    )

    # Restock non-damaged lines
    non_damaged_line_ids = {lid for lid in transactions_by_line.keys() if lid not in damaged_line_ids}
    if non_damaged_line_ids:
        _restock_specific_lines(invoice, user, non_damaged_line_ids)
    elif not damaged_line_ids:
        # No damaged lines at all — use existing function for simplicity
        direct_release_stock(
            invoice._id,
            invoice.company_id,
            user,
        )


def _restock_specific_lines(invoice, user, line_ids_to_restock):
    """Restock only specific line IDs for an invoice."""
    from apps.inventory.models import InventoryTransaction, StockItem
    import uuid

    transactions = InventoryTransaction.objects.filter(
        source_document_id=invoice._id,
        source_document_type='CUSTOMER_INVOICE',
        company_id=invoice.company_id,
        source_line_id__in=[uuid.UUID(lid) for lid in line_ids_to_restock],
    ).select_related('variant', 'warehouse')

    net_changes = {}
    for txn in transactions:
        key = (txn.variant_id, txn.warehouse_id, txn.branch_id)
        if key not in net_changes:
            net_changes[key] = {
                'variant': txn.variant,
                'warehouse': txn.warehouse,
                'branch_id': txn.branch_id,
                'net_qty': 0,
                'unit_cost': txn.unit_cost,
            }
        net_changes[key]['net_qty'] += txn.quantity_change

    for data in net_changes.values():
        net_qty = data['net_qty']
        if net_qty >= 0:
            continue

        qty_to_release = abs(net_qty)
        variant = data['variant']
        wh = data['warehouse']
        branch_id = data['branch_id'] or invoice.company_id

        stock, _ = StockItem.objects.select_for_update().get_or_create(
            variant=variant,
            warehouse=wh,
            company_id=invoice.company_id,
            defaults={
                'quantity_on_hand': 0,
                'quantity_reserved': 0,
                'branch_id': branch_id,
            },
        )
        before = stock.quantity_on_hand
        after = before + qty_to_release

        stock.quantity_on_hand = after
        stock.version = F('version') + 1
        stock.save(update_fields=['quantity_on_hand', 'version'])

        InventoryTransaction.objects.create(
            transaction_id=uuid.uuid4(),
            variant=variant,
            warehouse=wh,
            company_id=invoice.company_id,
            branch_id=branch_id,
            quantity_change=qty_to_release,
            quantity_before=before,
            quantity_after=after,
            unit_cost=data['unit_cost'],
            transaction_type='ADJUSTMENT',
            source_document_type='CUSTOMER_INVOICE_REVERSAL',
            source_document_id=invoice._id,
            reason_text='Invoice cancelled – stock added back (non-damaged lines)',
            created_by=user,
            updated_by=user,
        )


def _create_product_for_manual_line(line, user):
    """Create a Product + ProductVariant for a manual invoice line (go_to_inventory)."""
    from apps.finance.models import InvoiceLineProductLink
    from apps.inventory.models import Product, ProductVariant, StockItem, Warehouse, InventoryTransaction
    import uuid

    # Check if a product link already exists
    existing_link = InvoiceLineProductLink.objects.filter(
        invoice_line=line,
        is_deleted=False,
    ).first()

    if existing_link:
        product = existing_link.product
        variant = existing_link.variant
    else:
        # Create new product + variant
        name = line.manual_variant_name or 'Cancelled Invoice Item'
        sku = line.manual_variant_sku or _generate_sku(name, line.company_id, line.branch_id)

        product = Product.objects.create(
            product_name=name,
            status='active',
            company_id=line.company_id,
            branch_id=line.branch_id,
            created_by=user,
            updated_by=user,
        )
        variant = ProductVariant.objects.create(
            product=product,
            sku=sku,
            variant_title=name,
            buying_price=line.cost_price or 0,
            selling_price=line.unit_price or 0,
            company_id=line.company_id,
            branch_id=line.branch_id,
            created_by=user,
            updated_by=user,
        )
        InvoiceLineProductLink.objects.create(
            invoice_line=line,
            product=product,
            variant=variant,
            company_id=line.company_id,
            branch_id=line.branch_id,
            created_by=user,
            updated_by=user,
        )

    # Add stock to warehouse
    warehouse = Warehouse.objects.filter(
        company_id=line.company_id,
        is_active=True,
    ).order_by('created_at').first()

    if warehouse:
        stock_item, _ = StockItem.objects.select_for_update().get_or_create(
            variant=variant,
            warehouse=warehouse,
            company_id=line.company_id,
            defaults={
                'quantity_on_hand': 0,
                'quantity_reserved': 0,
                'branch_id': line.branch_id,
            },
        )
        before = stock_item.quantity_on_hand
        after = before + line.quantity
        stock_item.quantity_on_hand = after
        stock_item.save(update_fields=['quantity_on_hand'])

        InventoryTransaction.objects.create(
            transaction_id=uuid.uuid4(),
            variant=variant,
            warehouse=warehouse,
            company_id=line.company_id,
            branch_id=line.branch_id,
            quantity_change=line.quantity,
            quantity_before=before,
            quantity_after=after,
            unit_cost=line.cost_price or 0,
            transaction_type='PURCHASE_RECEIPT',
            source_document_type='CUSTOMER_INVOICE_CANCELLATION',
            source_document_id=line.customer_invoice._id,
            source_line_id=line._id,
            reason_text='Stock added from invoice cancellation (go to inventory)',
            created_by=user,
            updated_by=user,
        )


def _generate_sku(name, company_id, branch_id):
    from apps.inventory.models import ProductVariant
    import time, random
    base = ''.join(ch for ch in (name or 'ITEM').upper() if ch.isalnum())[:8] or 'ITEM'
    suffix = f"{int(time.time())}{random.randint(10, 99)}"
    candidate = f"{base}-{suffix}"
    while ProductVariant.objects.filter(
        sku=candidate,
        company_id=company_id,
        branch_id=branch_id,
    ).exists():
        suffix = f"{int(time.time())}{random.randint(100, 999)}"
        candidate = f"{base}-{suffix}"
    return candidate


def reverse_journal_entry(journal_entry, user, reason=''):
    """Create a reversing journal entry that swaps debit/credit."""
    from apps.finance.models import JournalEntry, JournalLine

    if not journal_entry or not journal_entry.is_posted:
        return

    original_lines = JournalLine.objects.filter(
        journal_entry=journal_entry,
        is_deleted=False,
    )

    entry = JournalEntry.objects.create(
        entry_number=f'REV-{journal_entry.entry_number}',
        date=journal_entry.date,
        description=f'Reversal of {journal_entry.entry_number}: {reason}',
        reference_type=journal_entry.reference_type,
        reference_id=journal_entry.reference_id,
        company_id=journal_entry.company_id,
        branch_id=journal_entry.branch_id,
        created_by=user,
        is_posted=True,
    )

    for line in original_lines:
        JournalLine.objects.create(
            journal_entry=entry,
            account=line.account,
            debit=line.credit,
            credit=line.debit,
            company_id=line.company_id,
            branch_id=line.branch_id,
        )


def refund_invoice_payments(invoice, user):
    """Cancel all confirmed payments for an invoice, reverse their effects,
    and create a refund payment record for audit trail.

    Returns (success, message).
    """
    from apps.finance.models import Payment, BankTransaction
    from django.contrib.contenttypes.models import ContentType
    from django.utils import timezone

    confirmed = get_payments_queryset(invoice, status='CONFIRMED')
    if not confirmed.exists():
        return False, 'No confirmed payments to refund'

    total_refunded = Decimal('0')

    with transaction.atomic():
        for payment in confirmed.select_related('bank_account', 'journal_entry'):
            # 1. Reverse journal entry
            if payment.journal_entry_id:
                reverse_journal_entry(
                    payment.journal_entry, user,
                    f'Refund for invoice {invoice.invoice_number}',
                )

            # 2. Reverse bank transaction + balance
            if payment.bank_account_id:
                bank_txn = BankTransaction.objects.filter(
                    bank_account=payment.bank_account,
                    amount=payment.amount,
                    transaction_date=payment.payment_date,
                    is_deleted=False,
                ).first()
                if bank_txn:
                    bank_txn.is_deleted = True
                    bank_txn.save(update_fields=['is_deleted', 'updated_at'])

                if payment.payment_type == 'RECEIPT':
                    payment.bank_account.book_balance = F('book_balance') - payment.amount
                else:
                    payment.bank_account.book_balance = F('book_balance') + payment.amount
                payment.bank_account.save(update_fields=['book_balance'])

            # 3. Soft-delete original payment
            payment.is_deleted = True
            payment.deleted_by = user
            payment.save(update_fields=['is_deleted', 'deleted_by', 'updated_at'])

            total_refunded += payment.amount

        # 4. Create refund payment record for audit trail
        ct = ContentType.objects.get_for_model(invoice.__class__, for_concrete_model=False)
        Payment.objects.create(
            company_id=invoice.company_id,
            branch_id=invoice.branch_id,
            content_type=ct,
            object_id=invoice.pk,
            payment_type='PAYMENT',
            payment_method='BANK_TRANSFER',
            amount=total_refunded,
            payment_date=timezone.now().date(),
            reference_number=f'REFUND-{invoice.invoice_number}',
            status='CONFIRMED',
            notes=f'Refund for cancelled invoice {invoice.invoice_number}',
            created_by=user,
            updated_by=user,
        )

    return True, f'Refunded {total_refunded} from {confirmed.count()} payment(s)'
