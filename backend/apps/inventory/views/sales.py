# backend/apps/inventory/views/sales.py
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from django.db import transaction
from django.db.models import F
from django.utils import timezone
from datetime import timedelta
import uuid

from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    StockItem, InventoryTransaction, StockReservation, ProductVariant
)
from apps.inventory.models.sales import (
    SalesOrder, SalesOrderLine, SalesReturn, SalesReturnLine
)
from apps.inventory.serializers.sales import (
    SalesOrderSerializer, SalesReturnSerializer
)

import logging
logger = logging.getLogger(__name__)


def sync_invoice_for_return(sales_return, user):
    """Update the linked CustomerInvoice when a return is processed.

    Prorates discount_amount proportionally when quantity is reduced,
    so the invoice line total = (qty * unit_price) - (discount * qty/orig_qty).
    """
    from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
    from decimal import Decimal
    order = sales_return.sales_order
    invoice = CustomerInvoice.objects.filter(sales_order=order, is_deleted=False).first()
    if not invoice:
        return

    for ret_line in sales_return.lines.all():
        sol = ret_line.sales_order_line
        returned_qty = ret_line.quantity_returned
        inv_line = CustomerInvoiceLine.objects.filter(
            customer_invoice=invoice,
            variant=sol.variant,
            is_deleted=False,
        ).first()
        if inv_line:
            old_qty = inv_line.quantity
            if old_qty <= returned_qty:
                inv_line.is_deleted = True
                inv_line.updated_by = user
                inv_line.save(update_fields=['is_deleted', 'updated_by'])
            else:
                inv_line.quantity -= returned_qty
                if inv_line.discount_amount:
                    inv_line.discount_amount = (
                        inv_line.discount_amount * Decimal(inv_line.quantity) / Decimal(old_qty)
                    )
                inv_line.updated_by = user
                inv_line.save(update_fields=['quantity', 'discount_amount', 'updated_by'])

    remaining_lines = invoice.lines.filter(is_deleted=False)
    new_amount = sum(
        (l.quantity * l.unit_price) - (l.discount_amount or 0)
        for l in remaining_lines
    )
    invoice.notes = ''
    invoice.amount = max(new_amount, 0)
    invoice.updated_by = user
    invoice.save(update_fields=['amount', 'updated_by', 'notes'])


def _prorate_line_discount(line, effective_qty):
    """Return the prorated discount_amount for an order line at effective_qty."""
    from decimal import Decimal
    if effective_qty <= 0:
        return Decimal('0')
    if line.discount_amount:
        return (
            line.discount_amount * Decimal(effective_qty) / Decimal(line.quantity_ordered)
        ).quantize(Decimal('0.01'))
    if line.discount_percent:
        subtotal = Decimal(effective_qty) * line.unit_price
        return (subtotal * line.discount_percent / 100).quantize(Decimal('0.01'))
    return Decimal('0')


def sync_sales_order_to_invoice(order, user, create_invoice=True):
    """
    Create a CustomerInvoice + payment for a completed SalesOrder.

    When create_invoice=False, creates only a standalone Payment record
    linked to the SalesOrder (no CustomerInvoice).
    """
    from apps.finance.models import CustomerInvoice, CustomerInvoiceLine
    from apps.finance.services.payable import create_payment_for, get_payments_queryset
    from django.utils import timezone
    from decimal import Decimal

    if not create_invoice:
        # Create a standalone payment linked directly to the SalesOrder
        # (no CustomerInvoice created)
        if order.status == 'COMPLETE' and order.total_amount > 0:
            if not get_payments_queryset(order).exists():
                try:
                    create_payment_for(
                        order,
                        amount=order.total_amount,
                        payment_date=timezone.now().date(),
                        payment_method=order.payment_method or 'CASH',
                        bank_account=order.bank_account,
                        user=user,
                        auto_confirm=True,
                    )
                except ValueError as e:
                    # If payment creation fails (e.g. missing account), log but don't block
                    import logging
                    logger = logging.getLogger(__name__)
                    logger.warning(f'POS payment creation skipped: {e}')
        return None

    # 1. Get or create CustomerInvoice
    invoice, created = CustomerInvoice.objects.get_or_create(
        sales_order=order,
        company_id=order.company_id,
        branch_id=order.branch_id,
        defaults={
            'invoice_number': f"INV-{order.order_number}",
            'customer': order.customer,
            'invoice_date': order.order_date or timezone.now().date(),
            'due_date': order.order_date or timezone.now().date(),
            'amount': order.total_amount,
            'status': 'DRAFT',
            'source': 'SALES_POS',
            'created_by': user,
            'updated_by': user,
            'payment_method': order.payment_method,
            'bank_account': order.bank_account,
            'notes': '',
        }
    )

    active_lines = order.lines.exclude(status='CANCELLED')

    def _recreate_invoice_lines():
        """Soft-delete old lines and recreate with prorated discounts."""
        invoice.lines.all().update(is_deleted=True)
        total = Decimal('0')
        for line in active_lines:
            effective_qty = line.quantity_ordered - (line.quantity_returned or 0)
            if effective_qty <= 0:
                continue
            prorated = _prorate_line_discount(line, effective_qty)
            CustomerInvoiceLine.objects.create(
                customer_invoice=invoice,
                variant=line.variant,
                quantity=effective_qty,
                unit_price=line.unit_price,
                tax_rate=line.tax_rate,
                discount_amount=prorated,
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=user,
                updated_by=user,
            )
            total += (Decimal(effective_qty) * line.unit_price) - prorated
        return total

    if created:
        # Fresh invoice — create lines and set amount from order total
        calc_total = _recreate_invoice_lines()
        invoice.amount = max(calc_total, Decimal('0'))
        invoice.save(update_fields=['amount'])

    if not created and invoice.status == 'DRAFT':
        invoice.payment_method = order.payment_method
        invoice.bank_account = order.bank_account
        invoice.notes = ''
        # Recalculate from freshly recreated lines with prorated discounts
        calc_total = _recreate_invoice_lines()
        invoice.amount = max(calc_total, Decimal('0'))
        invoice.save(update_fields=['amount', 'payment_method', 'bank_account', 'notes'])

    # 2. If SalesOrder is COMPLETE, post/confirm invoice and handle auto-payment
    if order.status == 'COMPLETE':
        if not invoice.journal_entry_id:
            from apps.finance.services.document import ensure_customer_invoice_journal
            from django.core.exceptions import ObjectDoesNotExist
            try:
                ensure_customer_invoice_journal(invoice, user)
            except ObjectDoesNotExist:
                raise Exception('AR or SALES account not found in Chart of Accounts. Cannot complete order.')

        # 3. Auto-payment for immediate POS settlement
        if not get_payments_queryset(invoice).exists():
            create_payment_for(
                invoice,
                amount=invoice.amount,
                payment_date=timezone.now().date(),
                payment_method=order.payment_method or 'CASH',
                bank_account=order.bank_account,
                user=user,
                auto_confirm=True,
            )

    return invoice


class SalesOrderViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'sales_order'
    queryset = SalesOrder.objects.all()
    serializer_class = SalesOrderSerializer
    lookup_field = '_id'
    filter_fields = {
        'status': 'status',
        'customer': 'customer___id',
        'search': ['order_number', 'customer__name'],
    }

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.prefetch_related('lines__variant__product')
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        status_val = serializer.validated_data.get('status', 'PENDING')
        create_invoice = request.data.get('create_invoice', False)
        invoice_id = None

        if status_val == 'COMPLETE':
            order = self._create_complete_order(serializer, request.user)
            invoice = sync_sales_order_to_invoice(order, request.user, create_invoice=create_invoice)
            if invoice:
                invoice_id = str(invoice._id)
        elif status_val == 'DRAFT':
            order = serializer.save()
            self._create_reservations(order, request.user)
        else:
            order = serializer.save()

        response_data = SalesOrderSerializer(order, context={'request': request}).data
        if invoice_id:
            response_data['invoice_id'] = invoice_id
        
        return Response({
            'status': 'success',
            'message': f'Sales order {order.order_number} created.',
            'data': response_data
        }, status=status.HTTP_201_CREATED)

    def _create_complete_order(self, serializer, user):
        validated_data = serializer.validated_data
        line_items_data = validated_data.pop('line_items', [])
        company_id = user.company_id
        branch_id = user.branch_id

        validated_data['order_number'] = self._generate_order_number()
        validated_data['company_id'] = company_id
        validated_data['branch_id'] = branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        validated_data['status'] = 'COMPLETE'

        order = SalesOrder.objects.create(**validated_data)
        total_amount = 0

        for item in line_items_data:
            variant_uuid = item.get('variant')
            variant = ProductVariant.objects.get(_id=variant_uuid, company_id=company_id)
            qty = item['quantity_ordered']
            unit_price = item['unit_price']
            discount_pct = item.get('discount_pct', 0)
            discount_fixed = item.get('discount_fixed', 0)
            tax_rate = item.get('tax_rate', 0)

            # Calculate line total
            subtotal = qty * unit_price
            if discount_fixed > 0:
                discount = discount_fixed
            else:
                discount = subtotal * (discount_pct / 100)
            line_total = subtotal - discount
            total_amount += line_total

            # CRITICAL: set status='COMPLETE' explicitly
            order_line = SalesOrderLine.objects.create(
                sales_order=order,
                variant=variant,
                quantity_ordered=qty,
                unit_price=unit_price,
                tax_rate=tax_rate,
                discount_percent=discount_pct,
                discount_amount=discount_fixed,
                status='COMPLETE',   # <-- this was missing
                company_id=company_id,
                branch_id=branch_id,
                created_by=user,
                updated_by=user,
            )
            self._deduct_stock(order, order_line, variant, qty, user)

        order.total_amount = total_amount
        order.save(update_fields=['total_amount'])
        return order

    def _deduct_stock(self, order, order_line, variant, qty, user):
        warehouse = order.warehouse
        company_id = user.company_id

        with transaction.atomic():
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant, warehouse=warehouse, company_id=company_id
            )
            available = stock_item.quantity_on_hand - stock_item.quantity_reserved
            if available < qty:
                raise Exception(f'Insufficient stock for {variant.sku}')

            before = stock_item.quantity_on_hand
            after = before - qty
            stock_item.quantity_on_hand = after
            stock_item.version = F('version') + 1
            stock_item.save(update_fields=['quantity_on_hand', 'version'])

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=warehouse,
                company_id=company_id,
                branch_id=user.branch_id,
                quantity_change=-qty,
                quantity_before=before,
                quantity_after=after,
                unit_cost=variant.buying_price,
                transaction_type='SALE',
                source_document_type='SALES_ORDER',
                source_document_id=order._id,
                source_line_id=order_line._id,
                reason_text=f'Sale completed - {order.order_number}',
                created_by=user,
                updated_by=user,
            )

    def _create_reservations(self, order, user):
        for line in order.lines.all():
            variant = line.variant
            warehouse = order.warehouse
            qty = line.quantity_ordered

            stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                variant=variant,
                warehouse=warehouse,
                company_id=order.company_id,
                branch_id=order.branch_id,
                defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
            )
            stock_item.quantity_reserved += qty
            stock_item.save(update_fields=['quantity_reserved'])

            StockReservation.objects.create(
                variant=variant,
                warehouse=warehouse,
                quantity=qty,
                reservation_type='SALES_ORDER',
                reference_id=order._id,
                reference_line_id=line._id,
                reserved_until=timezone.now() + timedelta(days=7),
                status='ACTIVE',
                company_id=order.company_id,
                branch_id=order.branch_id,
                created_by=user,
                updated_by=user,
            )

    @action(detail=True, methods=['post'])
    def complete(self, request, _id=None):
        order = self.get_object()
        if order.status != 'DRAFT':
            return Response({'error': 'Only draft orders can be completed'}, status=400)

        user = request.user
        new_line_items = request.data.get('line_items', None)
        create_invoice = request.data.get('create_invoice', False)

        existing_by_id = {str(line._id): line for line in order.lines.all()}
        existing_by_variant = {str(line.variant._id): line for line in order.lines.all()}
        processed_line_ids = set()

        with transaction.atomic():
            variant_ids = [item['variant'] for item in new_line_items]
            stock_items = {
                str(si.variant._id): si for si in StockItem.objects.select_for_update().filter(
                    variant___id__in=variant_ids, warehouse=order.warehouse, company_id=user.company_id
                )
            }

            for new_item in new_line_items:
                variant_uuid = new_item['variant']
                new_qty = new_item['quantity_ordered']
                line_id = new_item.get('line_id')
                unit_price = new_item['unit_price']
                tax_rate = new_item.get('tax_rate', 0)
                discount_pct = new_item.get('discount_pct', 0)
                discount_fixed = new_item.get('discount_fixed', 0)

                order_line = None
                if line_id and line_id in existing_by_id:
                    order_line = existing_by_id[line_id]
                    processed_line_ids.add(line_id)
                elif variant_uuid in existing_by_variant:
                    order_line = existing_by_variant[variant_uuid]
                    processed_line_ids.add(str(order_line._id))

                if order_line is None:
                    # New line
                    variant = ProductVariant.objects.get(_id=variant_uuid, company_id=user.company_id)
                    stock_item = stock_items.get(variant_uuid)
                    if not stock_item:
                        stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                            variant=variant, warehouse=order.warehouse,
                            company_id=user.company_id, branch_id=user.branch_id,
                            defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
                        )
                    available = stock_item.quantity_on_hand - stock_item.quantity_reserved
                    if available < new_qty:
                        return Response({'error': f'Insufficient stock for variant {variant.sku}'}, status=400)

                    order_line = SalesOrderLine.objects.create(
                        sales_order=order,
                        variant=variant,
                        quantity_ordered=new_qty,
                        unit_price=unit_price,
                        tax_rate=tax_rate,
                        discount_percent=discount_pct,
                        discount_amount=discount_fixed,
                        status='COMPLETE',
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        created_by=user,
                        updated_by=user,
                    )
                    self._deduct_stock_for_line(order, order_line, variant, new_qty, user)
                    continue

                # Existing line
                variant = order_line.variant
                stock_item = stock_items.get(str(variant._id))
                if not stock_item:
                    stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                        variant=variant, warehouse=order.warehouse,
                        company_id=user.company_id, branch_id=user.branch_id,
                        defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
                    )

                reservation = StockReservation.objects.filter(
                    reference_id=order._id, variant=variant, status='ACTIVE'
                ).select_for_update().first()

                if not reservation:
                    self._deduct_stock_for_line(order, order_line, variant, new_qty, user)
                    order_line.quantity_ordered = new_qty
                    order_line.unit_price = unit_price
                    order_line.tax_rate = tax_rate
                    order_line.discount_percent = discount_pct
                    order_line.discount_amount = discount_fixed
                    order_line.status = 'COMPLETE'
                    order_line.save(update_fields=['quantity_ordered', 'unit_price', 'tax_rate', 'discount_percent', 'discount_amount', 'status'])
                    continue

                reserved_qty = reservation.quantity
                if new_qty > reserved_qty:
                    additional = new_qty - reserved_qty
                    available = stock_item.quantity_on_hand - stock_item.quantity_reserved
                    if available < additional:
                        return Response({'error': f'Insufficient stock for additional {additional} units'}, status=400)
                    stock_item.quantity_reserved += additional
                    reservation.quantity = new_qty
                    reservation.save(update_fields=['quantity'])
                elif new_qty < reserved_qty:
                    excess = reserved_qty - new_qty
                    stock_item.quantity_reserved -= excess
                    reservation.quantity = new_qty
                    reservation.save(update_fields=['quantity'])

                if stock_item.quantity_on_hand < new_qty:
                    return Response({'error': f'Not enough on-hand stock for {variant.sku}'}, status=400)

                before = stock_item.quantity_on_hand
                after = before - new_qty
                stock_item.quantity_on_hand = after
                stock_item.quantity_reserved -= new_qty
                stock_item.version += 1
                stock_item.save(update_fields=['quantity_on_hand', 'quantity_reserved', 'version'])

                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=order.warehouse,
                    company_id=user.company_id,
                    branch_id=user.branch_id,
                    quantity_change=-new_qty,
                    quantity_before=before,
                    quantity_after=after,
                    unit_cost=variant.buying_price,
                    transaction_type='SALE',
                    source_document_type='SALES_ORDER',
                    source_document_id=order._id,
                    source_line_id=order_line._id,
                    reason_text=f'Order completed – {order.order_number}',
                    created_by=user,
                    updated_by=user,
                )

                # Update line with all fields including discount and status
                order_line.quantity_ordered = new_qty
                order_line.unit_price = unit_price
                order_line.tax_rate = tax_rate
                order_line.discount_percent = discount_pct
                order_line.discount_amount = discount_fixed
                order_line.status = 'COMPLETE'
                order_line.save(update_fields=['quantity_ordered', 'unit_price', 'tax_rate', 'discount_percent', 'discount_amount', 'status'])

                reservation.status = 'FULFILLED'
                reservation.save(update_fields=['status'])

            # Cancel lines not present
            for line in order.lines.all():
                if str(line._id) not in processed_line_ids and line.status != 'CANCELLED':
                    reservation = StockReservation.objects.filter(
                        reference_id=order._id, variant=line.variant, status='ACTIVE'
                    ).select_for_update().first()
                    if reservation:
                        stock_item = StockItem.objects.select_for_update().get(
                            variant=line.variant, warehouse=order.warehouse, company_id=user.company_id
                        )
                        stock_item.quantity_reserved -= reservation.quantity
                        stock_item.save(update_fields=['quantity_reserved'])
                        reservation.status = 'CANCELLED'
                        reservation.save(update_fields=['status'])
                    line.status = 'CANCELLED'
                    line.save(update_fields=['status'])

            # Recalculate total with discounts
            total_amount = 0
            for item in new_line_items:
                qty = item['quantity_ordered']
                price = item['unit_price']
                d_pct = item.get('discount_pct', 0)
                d_fixed = item.get('discount_fixed', 0)
                subtotal = qty * price
                discount = d_fixed if d_fixed > 0 else subtotal * (d_pct / 100)
                total_amount += (subtotal - discount)
            order.total_amount = total_amount
            order.status = 'COMPLETE'
            order.save(update_fields=['total_amount', 'status'])

        invoice = sync_sales_order_to_invoice(order, request.user, create_invoice=create_invoice)
        invoice_id = str(invoice._id) if invoice else None
        response_data = {'status': 'success', 'message': 'Order completed with modifications'}
        if invoice_id:
            response_data['invoice_id'] = invoice_id
        return Response(response_data)

    def _complete_without_changes(self, order, user, create_invoice=False):
        warehouse = order.warehouse
        company_id = user.company_id

        with transaction.atomic():
            reservations = StockReservation.objects.filter(
                reference_id=order._id, status='ACTIVE'
            ).select_related('variant').select_for_update()

            if not reservations.exists():
                return Response({'error': 'No active reservations found'}, status=400)

            for reservation in reservations:
                variant = reservation.variant
                qty = reservation.quantity
                stock_item = StockItem.objects.select_for_update().get(
                    variant=variant, warehouse=warehouse, company_id=company_id
                )
                available = stock_item.quantity_on_hand - stock_item.quantity_reserved
                if available < qty:
                    return Response({'error': f'Insufficient stock for {variant.sku}'}, status=400)

                before = stock_item.quantity_on_hand
                after = before - qty
                stock_item.quantity_on_hand = after
                stock_item.quantity_reserved = F('quantity_reserved') - qty
                stock_item.version = F('version') + 1
                stock_item.save(update_fields=['quantity_on_hand', 'quantity_reserved', 'version'])

                order_line = order.lines.filter(variant=variant).first()
                if order_line:
                    order_line.status = 'COMPLETE'
                    order_line.save(update_fields=['status'])

                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=warehouse,
                    company_id=company_id,
                    branch_id=user.branch_id,
                    quantity_change=-qty,
                    quantity_before=before,
                    quantity_after=after,
                    unit_cost=variant.buying_price,
                    transaction_type='SALE',
                    source_document_type='SALES_ORDER',
                    source_document_id=order._id,
                    source_line_id=order_line._id if order_line else None,
                    reason_text=f'Order completed – {order.order_number}',
                    created_by=user,
                    updated_by=user,
                )
                reservation.status = 'FULFILLED'
                reservation.save(update_fields=['status'])

            order.status = 'COMPLETE'
            order.save(update_fields=['status'])

        invoice = sync_sales_order_to_invoice(order, user, create_invoice=create_invoice)
        invoice_id = str(invoice._id) if invoice else None
        response_data = {'status': 'success', 'message': 'Order completed, stock deducted'}
        if invoice_id:
            response_data['invoice_id'] = invoice_id
        return Response(response_data)

    @action(detail=True, methods=['post'])
    def generate_invoice(self, request, _id=None):
        """
        Generate a CustomerInvoice for an existing completed SalesOrder
        that doesn't already have one.
        """
        order = self.get_object()
        if order.status != 'COMPLETE':
            return Response(
                {'error': 'Invoice can only be generated for completed orders'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check if invoice already exists
        from apps.finance.models import CustomerInvoice
        existing = CustomerInvoice.objects.filter(
            sales_order=order, is_deleted=False
        ).first()
        if existing:
            return Response({
                'status': 'success',
                'message': 'Invoice already exists',
                'invoice_id': str(existing._id),
            })

        try:
            invoice = sync_sales_order_to_invoice(order, request.user, create_invoice=True)
            if not invoice:
                return Response(
                    {'error': 'Failed to generate invoice'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response({
                'status': 'success',
                'message': f'Invoice {invoice.invoice_number} generated',
                'invoice_id': str(invoice._id),
            })
        except Exception as e:
            return Response(
                {'error': str(e)},
                status=status.HTTP_400_BAD_REQUEST,
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, _id=None):
        order = self.get_object()
        if order.status not in ['PENDING', 'DRAFT']:
            return Response({'error': 'Only PENDING or DRAFT orders can be cancelled'}, status=400)

        with transaction.atomic():
            if order.status == 'DRAFT':
                reservations = StockReservation.objects.filter(
                    reference_id=order._id, status='ACTIVE'
                ).select_for_update()
                for reservation in reservations:
                    stock_item = StockItem.objects.select_for_update().get(
                        variant=reservation.variant,
                        warehouse=reservation.warehouse,
                        company_id=request.user.company_id
                    )
                    stock_item.quantity_reserved = F('quantity_reserved') - reservation.quantity
                    stock_item.version = F('version') + 1
                    stock_item.save(update_fields=['quantity_reserved', 'version'])
                    reservation.status = 'CANCELLED'
                    reservation.save(update_fields=['status'])

            order.lines.update(status='CANCELLED')
            order.status = 'CANCELLED'
            order.save(update_fields=['status'])

        return Response({'status': 'success', 'message': 'Order cancelled'})

    def _release_stock(self, order, order_line, variant, qty, user):
        warehouse = order.warehouse
        company_id = user.company_id
        with transaction.atomic():
            stock_item = StockItem.objects.select_for_update().get(
                variant=variant, warehouse=warehouse, company_id=company_id
            )
            before = stock_item.quantity_on_hand
            after = before + qty
            stock_item.quantity_on_hand = after
            stock_item.version += 1
            stock_item.save(update_fields=['quantity_on_hand', 'version'])

            InventoryTransaction.objects.create(
                transaction_id=uuid.uuid4(),
                variant=variant,
                warehouse=warehouse,
                company_id=company_id,
                branch_id=user.branch_id,
                quantity_change=qty,
                quantity_before=before,
                quantity_after=after,
                unit_cost=variant.buying_price,
                transaction_type='RETURN_IN',
                source_document_type='SALES_ORDER',
                source_document_id=order._id,
                source_line_id=order_line._id,
                reason_text=f'Order edited - stock release - {order.order_number}',
                created_by=user,
                updated_by=user,
            )

    @action(detail=True, methods=['post'])
    def edit_sale(self, request, _id=None):
        """Edit a completed sales order — adjust qty/price/variant."""
        order = self.get_object()
        if order.status != 'COMPLETE':
            return Response({'error': 'Only completed orders can be edited'}, status=400)

        line_items = request.data.get('line_items', [])
        if not line_items:
            return Response({'error': 'line_items is required'}, status=400)

        user = request.user
        old_lines = {str(line._id): line for line in order.lines.filter(status='COMPLETE')}
        old_variants = {str(line.variant._id): line for line in old_lines.values()}
        existing_returns = {str(line._id): line.quantity_returned for line in old_lines.values() if line.quantity_returned}

        # Snapshot original ordered qty for discount proration in total recalc
        original_line_qty = {}
        for _id, line in old_lines.items():
            original_line_qty[_id] = line.quantity_ordered

        processed_line_ids = set()
        activity_log = []

        with transaction.atomic():
            for item in line_items:
                variant_uuid = item['variant']
                new_qty = item['quantity_ordered']
                unit_price = item['unit_price']
                tax_rate = item.get('tax_rate', 0)
                discount_pct = item.get('discount_pct', 0)
                discount_fixed = item.get('discount_fixed', 0)
                line_id = item.get('line_id')

                existing_line = None
                if line_id and line_id in old_lines:
                    existing_line = old_lines[line_id]
                elif variant_uuid in old_variants:
                    existing_line = old_variants[variant_uuid]

                if existing_line:
                    processed_line_ids.add(str(existing_line._id))
                    old_qty = existing_line.quantity_ordered
                    old_returned = existing_line.quantity_returned or 0
                    old_effective_qty = old_qty - old_returned
                    variant = existing_line.variant
                    changes = []

                    if new_qty != old_effective_qty:
                        changes.append(f"qty {old_effective_qty}→{new_qty}")
                        if new_qty > old_effective_qty:
                            additional = new_qty - old_effective_qty
                            self._deduct_stock_for_line(order, existing_line, variant, additional, user)
                        else:
                            excess = old_effective_qty - new_qty
                            self._release_stock(order, existing_line, variant, excess, user)

                    if existing_line.unit_price != unit_price:
                        changes.append(f"price {existing_line.unit_price}→{unit_price}")

                    # Preserve return history: total ordered = effective + already returned
                    existing_line.quantity_ordered = new_qty + old_returned
                    existing_line.unit_price = unit_price
                    existing_line.tax_rate = tax_rate
                    existing_line.discount_percent = discount_pct
                    existing_line.discount_amount = discount_fixed
                    existing_line.updated_by = user
                    existing_line.save(update_fields=[
                        'quantity_ordered', 'unit_price', 'tax_rate',
                        'discount_percent', 'discount_amount', 'updated_by',
                    ])

                    if changes:
                        activity_log.append(
                            f"[{timezone.now().strftime('%b %d %Y %H:%M')}] {variant.sku or variant.product.product_name}: {', '.join(changes)}"
                        )
                else:
                    variant = ProductVariant.objects.get(_id=variant_uuid, company_id=user.company_id)
                    order_line = SalesOrderLine.objects.create(
                        sales_order=order,
                        variant=variant,
                        quantity_ordered=new_qty,
                        unit_price=unit_price,
                        tax_rate=tax_rate,
                        discount_percent=discount_pct,
                        discount_amount=discount_fixed,
                        status='COMPLETE',
                        company_id=user.company_id,
                        branch_id=user.branch_id,
                        created_by=user,
                        updated_by=user,
                    )
                    self._deduct_stock_for_line(order, order_line, variant, new_qty, user)
                    activity_log.append(
                        f"[{timezone.now().strftime('%b %d %Y %H:%M')}] Added {variant.sku or variant.product.product_name} x{new_qty} @ {unit_price}"
                    )

            for line in list(old_lines.values()):
                if str(line._id) not in processed_line_ids and line.status != 'CANCELLED':
                    effective_stock = line.quantity_ordered - (line.quantity_returned or 0)
                    if effective_stock > 0:
                        self._release_stock(order, line, line.variant, effective_stock, user)
                    line.status = 'CANCELLED'
                    line.updated_by = user
                    line.save(update_fields=['status', 'updated_by'])
                    activity_log.append(
                        f"[{timezone.now().strftime('%b %d %Y %H:%M')}] Removed {line.variant.sku or line.variant.product.product_name} x{line.quantity_ordered}"
                    )

            total_amount = 0
            for item in line_items:
                qty = item['quantity_ordered']
                line_id = item.get('line_id')
                price = item['unit_price']
                d_pct = item.get('discount_pct', 0)
                d_fixed = item.get('discount_fixed', 0)
                effective_qty = qty  # frontend sends effective qty
                subtotal = effective_qty * price
                if d_fixed > 0:
                    # Prorate fixed discount by original ordered qty (before this edit)
                    orig_qty = original_line_qty.get(line_id) if line_id else None
                    if orig_qty and orig_qty > 0:
                        discount = d_fixed * effective_qty / orig_qty
                    else:
                        discount = d_fixed
                else:
                    discount = subtotal * (d_pct / 100)
                total_amount += (subtotal - discount)
            order.total_amount = total_amount
            order.updated_by = user
            order.save(update_fields=['total_amount', 'updated_by'])

        if activity_log:
            log_entries = '\n'.join(activity_log)
            order.notes = (order.notes + '\n\n--- Edit Log ---\n' + log_entries) if order.notes else ('--- Edit Log ---\n' + log_entries)
            order.save(update_fields=['notes'])

        from apps.finance.models import CustomerInvoice
        invoice = CustomerInvoice.objects.filter(sales_order=order, is_deleted=False).first()
        if invoice:
            sync_sales_order_to_invoice(order, user, create_invoice=True)

        response_data = self.get_serializer(order, context={'request': request}).data
        response_data['invoice_id'] = str(invoice._id) if invoice else None
        return Response({
            'status': 'success',
            'message': 'Order edited successfully',
            'data': response_data,
        }, status=status.HTTP_200_OK)

    def _deduct_stock_for_line(self, order, order_line, variant, qty, user):
        warehouse = order.warehouse
        company_id = user.company_id
        stock_item = StockItem.objects.select_for_update().get(
            variant=variant, warehouse=warehouse, company_id=company_id
        )
        before = stock_item.quantity_on_hand
        if before < qty:
            from rest_framework import serializers
            raise serializers.ValidationError(f'Insufficient stock for {variant.sku}')
        after = before - qty
        stock_item.quantity_on_hand = after
        stock_item.version += 1
        stock_item.save(update_fields=['quantity_on_hand', 'version'])
        InventoryTransaction.objects.create(
            transaction_id=uuid.uuid4(),
            variant=variant,
            warehouse=warehouse,
            company_id=company_id,
            branch_id=user.branch_id,
            quantity_change=-qty,
            quantity_before=before,
            quantity_after=after,
            unit_cost=variant.buying_price,
            transaction_type='SALE',
            source_document_type='SALES_ORDER',
            source_document_id=order._id,
            source_line_id=order_line._id,
            reason_text=f'Order completed – {order.order_number}',
            created_by=user,
            updated_by=user,
        )

    def _generate_order_number(self):
        import time, random
        return f"SO-{int(time.time())}-{random.randint(1000, 9999)}"


class SalesReturnViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'sales_order'
    queryset = SalesReturn.objects.all()
    serializer_class = SalesReturnSerializer
    lookup_field = '_id'
    filter_fields = {
        'status': 'status',
        'sales_order': 'sales_order___id',
    }

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.select_related('sales_order', 'warehouse').prefetch_related('lines__sales_order_line__variant__product')
        return qs

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        ret = serializer.save()
        self._process_return(ret, request.user)
        sync_invoice_for_return(ret, request.user)
        order = ret.sales_order

        # Recalculate order total: subtract returned amounts
        total_return_value = sum(
            rl.refund_amount for rl in ret.lines.all()
        )
        order.total_amount = max(order.total_amount - total_return_value, 0)
        order.updated_by = request.user

        total_returned = sum(rl.quantity_returned for rl in ret.lines.all())
        item_list = ', '.join(
            f"{rl.sales_order_line.variant.sku or rl.sales_order_line.variant.product.product_name} x{rl.quantity_returned}"
            for rl in ret.lines.all()
        )
        log_entry = f"[{timezone.now().strftime('%b %d %Y %H:%M')}] Return {ret.return_number}: {item_list}"
        order.notes = (order.notes + '\n' + log_entry) if order.notes else log_entry
        order.save(update_fields=['total_amount', 'notes', 'updated_by'])
        read_serializer = SalesReturnSerializer(ret, context={'request': request})
        return Response({
            'status': 'success',
            'message': f'Return {ret.return_number} processed.',
            'data': read_serializer.data,
            'return_number': ret.return_number,
            'total_returned': total_returned,
        }, status=status.HTTP_201_CREATED)

    def _process_return(self, ret, user):
        warehouse = ret.warehouse
        company_id = user.company_id
        for ret_line in ret.lines.all():
            sol = ret_line.sales_order_line
            qty = ret_line.quantity_returned

            # The quantity_returned was already incremented in serializer, but if you want to be safe:
            # sol.quantity_returned = F('quantity_returned') + qty
            # sol.save(update_fields=['quantity_returned'])
            # Actually we already did that in serializer; this method is for stock restocking only.

            if ret_line.restock:
                variant = sol.variant
                stock_item, _ = StockItem.objects.select_for_update().get_or_create(
                    variant=variant,
                    warehouse=warehouse,
                    company_id=company_id,
                    branch_id=user.branch_id,
                    defaults={'quantity_on_hand': 0, 'quantity_reserved': 0}
                )
                before = stock_item.quantity_on_hand
                after = before + qty
                stock_item.quantity_on_hand = after
                stock_item.version = F('version') + 1
                stock_item.save(update_fields=['quantity_on_hand', 'version'])

                InventoryTransaction.objects.create(
                    transaction_id=uuid.uuid4(),
                    variant=variant,
                    warehouse=warehouse,
                    company_id=company_id,
                    branch_id=user.branch_id,
                    quantity_change=qty,
                    quantity_before=before,
                    quantity_after=after,
                    unit_cost=ret_line.unit_cost,
                    transaction_type='RETURN_IN',
                    source_document_type='SALES_RETURN',
                    source_document_id=ret._id,
                    source_line_id=sol._id,
                    reason_text=f'Return {ret.return_number}',
                    created_by=user,
                    updated_by=user,
                )
