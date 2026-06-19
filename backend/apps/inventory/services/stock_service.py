import uuid
from decimal import Decimal
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from datetime import timedelta


def _get_warehouse(company_id):
    from apps.inventory.models import Warehouse
    return Warehouse.objects.filter(
        company_id=company_id,
        is_deleted=False,
    ).first()


def _get_or_create_stock_item(variant, warehouse, company_id, branch_id):
    from apps.inventory.models import StockItem
    item, _ = StockItem.objects.select_for_update().get_or_create(
        variant=variant,
        warehouse=warehouse,
        company_id=company_id,
        defaults={
            'quantity_on_hand': 0,
            'quantity_reserved': 0,
            'branch_id': branch_id,
        },
    )
    return item


def _create_reservation(variant, warehouse, quantity, company_id, branch_id,
                        reference_id, reference_line_id, reservation_type, user):
    from apps.inventory.models import StockReservation
    StockReservation.objects.create(
        variant=variant,
        warehouse=warehouse,
        quantity=quantity,
        reservation_type=reservation_type,
        reference_id=reference_id,
        reference_line_id=reference_line_id,
        reserved_until=timezone.now() + timedelta(days=30),
        status='ACTIVE',
        company_id=company_id,
        branch_id=branch_id,
        created_by=user,
        updated_by=user,
    )


@transaction.atomic
def reserve_stock_for_lines(lines, company_id, branch_id, reference_id,
                            reservation_type, user, warehouse=None):
    """Reserve stock for each line and create StockReservation records.

    ``lines`` is an iterable of objects with ``.variant`` and ``.quantity``
    (e.g. QuoteLine or CustomerInvoiceLine queryset).

    ``warehouse`` — if None the company's first active warehouse is used.
    """
    if warehouse is None:
        warehouse = _get_warehouse(company_id)
    if not warehouse:
        return

    for line in lines.select_related('variant').all():
        if not line.variant:
            continue
        stock = _get_or_create_stock_item(
            line.variant, warehouse, company_id, branch_id,
        )
        qty = line.quantity
        stock.quantity_reserved = F('quantity_reserved') + qty
        stock.version = F('version') + 1
        stock.save(update_fields=['quantity_reserved', 'version'])

        _create_reservation(
            line.variant, warehouse, qty,
            company_id, branch_id,
            reference_id, line._id,
            reservation_type, user,
        )


@transaction.atomic
def adjust_reservation(lines, company_id, branch_id, reference_id,
                       reservation_type, user, warehouse=None):
    """Adjust existing reservations to match current line quantities.

    Compares each line's quantity against existing active reservations
    for the same reference+line.  Adds or releases stock as needed.
    """
    from apps.inventory.models import StockReservation

    if warehouse is None:
        warehouse = _get_warehouse(company_id)
    if not warehouse:
        return

    existing = {
        str(r.reference_line_id): r
        for r in StockReservation.objects.filter(
            reference_id=reference_id,
            status='ACTIVE',
            company_id=company_id,
        ).select_related('variant')
    }

    for line in lines.select_related('variant').all():
        if not line.variant:
            continue
        line_id = str(line._id)
        reservation = existing.pop(line_id, None)

        if reservation is None:
            # new line – create reservation
            stock = _get_or_create_stock_item(
                line.variant, warehouse, company_id, branch_id,
            )
            stock.quantity_reserved = F('quantity_reserved') + line.quantity
            stock.version = F('version') + 1
            stock.save(update_fields=['quantity_reserved', 'version'])

            _create_reservation(
                line.variant, warehouse, line.quantity,
                company_id, branch_id,
                reference_id, line._id,
                reservation_type, user,
            )
        else:
            diff = line.quantity - reservation.quantity
            if diff == 0:
                continue

            stock = _get_or_create_stock_item(
                line.variant, warehouse, company_id, branch_id,
            )

            if diff > 0:
                stock.quantity_reserved = F('quantity_reserved') + diff
            else:
                stock.quantity_reserved = F('quantity_reserved') - abs(diff)
            stock.version = F('version') + 1
            stock.save(update_fields=['quantity_reserved', 'version'])

            reservation.quantity = line.quantity
            reservation.updated_by = user
            reservation.save(update_fields=['quantity', 'updated_by'])

    # remaining reservations (lines removed) → release
    for reservation in existing.values():
        stock = _get_or_create_stock_item(
            reservation.variant, warehouse, company_id, branch_id,
        )
        stock.quantity_reserved = F('quantity_reserved') - reservation.quantity
        stock.version = F('version') + 1
        stock.save(update_fields=['quantity_reserved', 'version'])

        reservation.status = 'CANCELLED'
        reservation.updated_by = user
        reservation.save(update_fields=['status', 'updated_by'])


@transaction.atomic
def release_stock_for_reference(reference_id, company_id, user,
                                warehouse=None):
    """Cancel all ACTIVE reservations for a reference and release stock."""
    from apps.inventory.models import StockReservation

    if warehouse is None:
        warehouse = _get_warehouse(company_id)
    if not warehouse:
        return

    reservations = StockReservation.objects.filter(
        reference_id=reference_id,
        status='ACTIVE',
        company_id=company_id,
    ).select_related('variant')

    for reservation in reservations:
        stock = _get_or_create_stock_item(
            reservation.variant, warehouse, company_id, user.branch_id,
        )
        stock.quantity_reserved = F('quantity_reserved') - reservation.quantity
        stock.version = F('version') + 1
        stock.save(update_fields=['quantity_reserved', 'version'])

        reservation.status = 'CANCELLED'
        reservation.updated_by = user
        reservation.save(update_fields=['status', 'updated_by'])


@transaction.atomic
def deduct_reserved_stock(reference_id, company_id, user, warehouse=None):
    """Fulfill ACTIVE reservations — deduct from both on_hand and reserved."""
    from apps.inventory.models import StockReservation, InventoryTransaction
    import uuid

    if warehouse is None:
        warehouse = _get_warehouse(company_id)
    if not warehouse:
        return

    reservations = StockReservation.objects.filter(
        reference_id=reference_id,
        status='ACTIVE',
        company_id=company_id,
    ).select_related('variant')

    for reservation in reservations:
        stock = _get_or_create_stock_item(
            reservation.variant, warehouse, company_id, user.branch_id,
        )
        qty = reservation.quantity
        before = stock.quantity_on_hand
        after = before - qty

        if after < 0:
            sku = getattr(reservation.variant, 'sku', 'unknown')
            name = getattr(reservation.variant, 'product_name', sku)
            raise ValueError(
                f'Insufficient stock for "{name}" ({sku}). '
                f'Only {before} available, but {qty} required. '
                f'Please reduce the quantity or receive more stock first.'
            )

        stock.quantity_on_hand = after
        stock.quantity_reserved = F('quantity_reserved') - qty
        stock.version = F('version') + 1
        stock.save(update_fields=['quantity_on_hand', 'quantity_reserved', 'version'])

        InventoryTransaction.objects.create(
            transaction_id=uuid.uuid4(),
            variant=reservation.variant,
            warehouse=warehouse,
            company_id=company_id,
            branch_id=user.branch_id or company_id,
            quantity_change=-qty,
            quantity_before=before,
            quantity_after=after,
            unit_cost=reservation.variant.buying_price or 0,
            transaction_type='SALE',
            source_document_type='CUSTOMER_INVOICE',
            source_document_id=reference_id,
            reason_text=f'Invoice payment – reservation fulfilled',
            created_by=user,
            updated_by=user,
        )

        reservation.status = 'FULFILLED'
        reservation.updated_by = user
        reservation.save(update_fields=['status', 'updated_by'])
