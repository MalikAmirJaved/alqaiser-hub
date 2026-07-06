from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import (
    Sum, F, Q, DecimalField, IntegerField, Count, Value, OuterRef
)
from django.db.models.functions import Coalesce, TruncDay
from django.utils import timezone
from datetime import datetime, timedelta

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    Product, ProductVariant, StockItem, PurchaseOrder, SalesOrder, Warehouse,
    Category, PurchaseOrderLine, SalesOrderLine, Supplier, InventoryTransaction,
    GoodsReceipt, GoodsReceiptLine, Brand, StockTransfer, Alert, Customer
)
from apps.inventory.serializers.report import (
    OverallSummarySerializer, StockItemReportSerializer, StockSummarySerializer,
    ValuationReportSerializer, StockMovementSerializer, SalesVsPurchaseSerializer,
    ProfitLossSerializer, SlowMovingSerializer, ReorderPlanningSerializer,
    SupplierPerformanceSerializer, InventoryAnalyticsSerializer
)


class ReportViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'report'
    permission_classes = CompanyBranchMixin.permission_classes
    branch_filter_enabled = True

    # ------------------------------------------------------------------
    # Helper: parse date params with defaults
    # ------------------------------------------------------------------
    def _get_date_range(self, request):
        start_date_str = request.query_params.get('start_date')
        end_date_str = request.query_params.get('end_date')

        if start_date_str:
            start_date = datetime.strptime(start_date_str, "%Y-%m-%d")
        else:
            start_date = datetime.now() - timedelta(days=30)

        if end_date_str:
            end_date = datetime.strptime(end_date_str, "%Y-%m-%d")
        else:
            end_date = datetime.now()

        return start_date, end_date

    # ------------------------------------------------------------------
    #  OVERALL SUMMARY
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='overall-summary')
    def overall_summary(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')
        start_date, end_date = self._get_date_range(request)

        # --- Stock value & low stock (combined single pass) ---
        stock_qs = StockItem.objects.filter(company_id=company_id)
        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        total_stock_value = 0
        low_stock_count = 0
        for item in stock_qs.select_related('variant').only(
            'quantity_on_hand', 'quantity_reserved',
            'variant__buying_price', 'variant__min_stock_level'
        ):
            total_stock_value += item.quantity_on_hand * (item.variant.buying_price or 0)
            available = item.quantity_on_hand - item.quantity_reserved
            if available <= (item.variant.min_stock_level or 0):
                low_stock_count += 1

        total_variants = ProductVariant.objects.filter(
            company_id=company_id, is_deleted=False
        ).count()

        # --- Total purchases (date filtered) ---
        po_qs = PurchaseOrder.objects.filter(company_id=company_id)
        if start_date:
            po_qs = po_qs.filter(order_date__gte=start_date.date())
        if end_date:
            po_qs = po_qs.filter(order_date__lte=end_date.date())

        total_purchase = po_qs.aggregate(
            total=Coalesce(
                Sum('total_amount'),
                Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
            )
        )['total']

        # --- Total sales (COMPLETE orders, date filtered) ---
        so_qs = SalesOrder.objects.filter(company_id=company_id, status='COMPLETE')
        if start_date:
            so_qs = so_qs.filter(order_date__gte=start_date.date())
        if end_date:
            so_qs = so_qs.filter(order_date__lte=end_date.date())

        total_sales = so_qs.aggregate(
            total=Coalesce(
                Sum('total_amount'),
                Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
            )
        )['total']

        # --- Active warehouses ---
        wh_qs = Warehouse.objects.filter(company_id=company_id, is_active=True)
        if warehouse_id:
            wh_qs = wh_qs.filter(_id=warehouse_id)
        total_warehouses = wh_qs.count()

        # --- Stock turnover rate (COGS / avg inventory value) ---
        # COGS from completed sales in the period
        cogs_data = SalesOrderLine.objects.filter(
            company_id=company_id,
            sales_order__status='COMPLETE',
        )
        if start_date:
            cogs_data = cogs_data.filter(sales_order__order_date__gte=start_date.date())
        if end_date:
            cogs_data = cogs_data.filter(sales_order__order_date__lte=end_date.date())

        total_cogs = 0
        for sol in cogs_data.select_related('variant').only(
            'quantity_ordered', 'quantity_returned', 'variant__buying_price'
        ):
            net_qty = sol.quantity_ordered - (sol.quantity_returned or 0)
            total_cogs += net_qty * float(sol.variant.buying_price or 0)

        stock_turnover_rate = 0.0
        if total_stock_value > 0 and total_cogs > 0:
            # Annualized: COGS in period / avg stock value * (365 / days in period)
            days_in_period = (end_date - start_date).days or 1
            avg_stock_value = total_stock_value  # using current value as proxy
            stock_turnover_rate = round(
                (total_cogs / float(avg_stock_value)) * (365 / days_in_period), 2
            )

        summary_data = {
            'total_stock_value': total_stock_value,
            'total_variants': total_variants,
            'low_stock_count': low_stock_count,
            'total_purchase_amount': total_purchase or 0,
            'total_sales_amount': total_sales or 0,
            'total_warehouses': total_warehouses,
            'stock_turnover_rate': stock_turnover_rate,
        }
        serializer = OverallSummarySerializer(summary_data)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  STOCK REPORT (flat list)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='stock-report')
    def stock_report(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        stock_qs = StockItem.objects.filter(company_id=company_id).select_related(
            'variant__product', 'warehouse', 'variant__product__category'
        )
        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        results = []
        for item in stock_qs:
            available = item.quantity_on_hand - item.quantity_reserved
            results.append({
                'variant_sku': item.variant.sku,
                'variant_name': item.variant.product.product_name,
                'warehouse_name': item.warehouse.warehouse_name,
                'quantity_on_hand': item.quantity_on_hand,
                'quantity_reserved': item.quantity_reserved,
                'quantity_available': max(available, 0),
                'unit_cost': item.variant.buying_price or 0,
                'total_value': item.quantity_on_hand * (item.variant.buying_price or 0),
            })
        serializer = StockItemReportSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  STOCK SUMMARY (with category)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='stock-summary')
    def stock_summary(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        stock_qs = StockItem.objects.filter(company_id=company_id).select_related(
            'variant__product__category', 'warehouse'
        )
        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        results = []
        for item in stock_qs:
            category_name = (
                item.variant.product.category.name
                if item.variant.product.category else "Uncategorized"
            )
            available = item.quantity_on_hand - item.quantity_reserved
            results.append({
                'product_name': item.variant.product.product_name,
                'category_name': category_name,
                'warehouse_name': item.warehouse.warehouse_name,
                'variant_sku': item.variant.sku,
                'quantity_on_hand': item.quantity_on_hand,
                'quantity_reserved': item.quantity_reserved,
                'quantity_available': max(available, 0),
                'unit_cost': item.variant.buying_price or 0,
                'total_value': item.quantity_on_hand * (item.variant.buying_price or 0),
            })
        serializer = StockSummarySerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  INVENTORY VALUATION
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='inventory-valuation')
    def inventory_valuation(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        stock_qs = StockItem.objects.filter(company_id=company_id)
        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        total_quantity = 0
        total_value = 0
        for item in stock_qs.select_related('variant').only(
            'quantity_on_hand', 'variant__buying_price'
        ):
            total_quantity += item.quantity_on_hand
            total_value += item.quantity_on_hand * float(item.variant.buying_price or 0)

        average_unit_cost = (total_value / total_quantity) if total_quantity > 0 else 0

        valuation_data = {
            'methodology': 'Weighted Average Cost (WAC) based on standard buying cost basis.',
            'total_quantity': total_quantity,
            'total_value': total_value,
            'average_unit_cost': average_unit_cost,
        }
        serializer = ValuationReportSerializer(valuation_data)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  STOCK MOVEMENT (inflow vs outflow aggregated by day)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='stock-movement')
    def stock_movement(self, request):
        user = request.user
        company_id = user.company_id
        start_date, end_date = self._get_date_range(request)

        tx_qs = InventoryTransaction.objects.filter(
            company_id=company_id,
            created_at__range=(start_date, end_date)
        ).annotate(
            day=TruncDay('created_at')
        ).values('day', 'transaction_type').annotate(
            net_qty=Sum('quantity_change'),
            inflow=Coalesce(
                Sum('quantity_change', filter=Q(quantity_change__gt=0)),
                Value(0, output_field=IntegerField())
            ),
            outflow=Coalesce(
                Sum('quantity_change', filter=Q(quantity_change__lt=0)),
                Value(0, output_field=IntegerField())
            ),
            tx_count=Count('id')
        ).order_by('day')

        results = []
        for tx in tx_qs:
            results.append({
                'period': tx['day'].strftime('%Y-%m-%d'),
                'transaction_type': tx['transaction_type'],
                'total_quantity': abs(tx['net_qty']),
                'inflow': abs(tx['inflow'] or 0),
                'outflow': abs(tx['outflow'] or 0),
                'transaction_count': tx['tx_count'],
            })
        serializer = StockMovementSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  SALES VS PURCHASE (daily timeline)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='sales-vs-purchase')
    def sales_vs_purchase(self, request):
        user = request.user
        company_id = user.company_id
        start_date, end_date = self._get_date_range(request)
        start_date_d = start_date.date()
        end_date_d = end_date.date()

        # Sales aggregated by order_date
        sales_by_date = dict(
            SalesOrder.objects.filter(
                company_id=company_id,
                status='COMPLETE',
                order_date__range=(start_date_d, end_date_d),
            ).values('order_date').annotate(
                total=Coalesce(Sum('total_amount'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=2)))
            ).values_list('order_date', 'total')
        )

        # Purchases aggregated by order_date
        purchase_by_date = dict(
            PurchaseOrder.objects.filter(
                company_id=company_id,
                status__in=['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
                order_date__range=(start_date_d, end_date_d),
            ).values('order_date').annotate(
                total=Coalesce(Sum('total_amount'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=2)))
            ).values_list('order_date', 'total')
        )

        # Build full timeline
        results = []
        curr = start_date_d
        while curr <= end_date_d:
            date_str = curr.strftime('%Y-%m-%d')
            results.append({
                'period': date_str,
                'sales_amount': float(sales_by_date.get(curr, 0) or 0),
                'purchase_amount': float(purchase_by_date.get(curr, 0) or 0),
            })
            curr += timedelta(days=1)

        serializer = SalesVsPurchaseSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  PROFIT & LOSS (per product variant)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='profit-loss')
    def profit_loss(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')
        start_date, end_date = self._get_date_range(request)

        lines_qs = SalesOrderLine.objects.filter(
            company_id=company_id,
            sales_order__status='COMPLETE',
        ).select_related('variant__product', 'sales_order')

        if warehouse_id:
            lines_qs = lines_qs.filter(sales_order__warehouse___id=warehouse_id)

        if start_date:
            lines_qs = lines_qs.filter(sales_order__order_date__gte=start_date.date())
        if end_date:
            lines_qs = lines_qs.filter(sales_order__order_date__lte=end_date.date())

        aggregations = {}
        for line in lines_qs:
            sku = line.variant.sku
            if sku not in aggregations:
                aggregations[sku] = {
                    'product_name': line.variant.product.product_name,
                    'variant_sku': sku,
                    'sales_quantity': 0,
                    'sales_revenue': 0,
                    'total_discount': 0,
                    'buying_price': float(line.variant.buying_price or 0),
                }
            qty = line.quantity_ordered
            returned = line.quantity_returned or 0
            net_qty = qty - returned
            aggregations[sku]['sales_quantity'] += net_qty
            # Revenue = net qty * unit_price - discount
            if net_qty > 0:
                line_revenue = (net_qty * float(line.unit_price)) - float(line.discount_amount or 0)
            else:
                line_revenue = 0
            aggregations[sku]['sales_revenue'] += line_revenue
            aggregations[sku]['total_discount'] += float(line.discount_amount or 0)

        results = []
        for sku, data in aggregations.items():
            sales_revenue = data['sales_revenue']
            cogs = data['sales_quantity'] * data['buying_price']
            gross_profit = sales_revenue - cogs
            margin_percent = round(
                float((gross_profit / sales_revenue) * 100), 2
            ) if sales_revenue > 0 else 0.0
            results.append({
                'product_name': data['product_name'],
                'variant_sku': sku,
                'sales_quantity': data['sales_quantity'],
                'sales_revenue': sales_revenue,
                'cogs': cogs,
                'gross_profit': gross_profit,
                'margin_percent': margin_percent,
            })

        results.sort(key=lambda x: x['gross_profit'], reverse=True)
        serializer = ProfitLossSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  SLOW MOVING / OBSOLETE STOCK
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='slow-moving')
    def slow_moving(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        stock_qs = StockItem.objects.filter(company_id=company_id).select_related(
            'variant__product', 'warehouse'
        )
        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        now = timezone.now()
        results = []
        for item in stock_qs:
            # Find last sale transaction for this variant+warehouse
            last_sale_qs = InventoryTransaction.objects.filter(
                company_id=company_id,
                variant=item.variant,
                transaction_type='SALE',
            )
            if warehouse_id:
                last_sale_qs = last_sale_qs.filter(warehouse=item.warehouse)

            last_sale = last_sale_qs.order_by('-created_at').first()

            if last_sale:
                days = (now - last_sale.created_at).days
            else:
                # No sales ever — use variant creation date
                days = (now - item.variant.created_at).days if item.variant.created_at else 999

            if days > 90:
                status_label = 'OBSOLETE'
            elif days > 30:
                status_label = 'SLOW_MOVING'
            else:
                status_label = 'HEALTHY'

            results.append({
                'product_name': item.variant.product.product_name,
                'variant_sku': item.variant.sku,
                'warehouse_name': item.warehouse.warehouse_name,
                'quantity_on_hand': item.quantity_on_hand,
                'days_since_last_sale': days,
                'status': status_label,
            })

        results.sort(key=lambda x: x['days_since_last_sale'], reverse=True)
        serializer = SlowMovingSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  REORDER PLANNING
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='reorder-planning')
    def reorder_planning(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        variants = ProductVariant.objects.filter(
            company_id=company_id, is_deleted=False
        ).select_related('product')

        results = []
        for var in variants:
            stock_qs = StockItem.objects.filter(company_id=company_id, variant=var)
            if warehouse_id:
                stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

            stock_agg = stock_qs.aggregate(
                total_on_hand=Coalesce(Sum('quantity_on_hand'), 0),
                total_reserved=Coalesce(Sum('quantity_reserved'), 0),
            )
            total_on_hand = stock_agg['total_on_hand']
            total_reserved = stock_agg['total_reserved']
            available = total_on_hand - total_reserved

            # Find latest PO supplier for this variant
            latest_line = PurchaseOrderLine.objects.filter(
                variant=var,
                company_id=company_id,
                purchase_order__status__in=['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
            ).select_related('purchase_order__supplier').order_by('-purchase_order__created_at').first()

            supplier_name = "—"
            if latest_line and latest_line.purchase_order and latest_line.purchase_order.supplier:
                supplier_name = latest_line.purchase_order.supplier.name

            reorder_qty = max(0, var.max_stock_level - available)
            diff = var.min_stock_level - available

            if var.min_stock_level > 0:
                urgency = min(100.0, max(0.0, float(diff) / float(var.min_stock_level) * 100.0))
            else:
                urgency = 100.0 if available <= 0 else 0.0

            results.append({
                'product_name': var.product.product_name,
                'variant_sku': var.sku,
                'quantity_on_hand': total_on_hand,
                'min_stock_level': var.min_stock_level,
                'max_stock_level': var.max_stock_level,
                'recommended_reorder_qty': reorder_qty,
                'urgency_score': round(urgency, 2),
                'suggested_supplier_name': supplier_name,
                'available_stock': available,
            })

        # Sort by urgency descending (most urgent first)
        results.sort(key=lambda x: x['urgency_score'], reverse=True)
        serializer = ReorderPlanningSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  SUPPLIER PERFORMANCE (with REAL lead time calculation)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='supplier-performance')
    def supplier_performance(self, request):
        user = request.user
        company_id = user.company_id

        suppliers = Supplier.objects.filter(company_id=company_id, status='active')
        results = []

        for sup in suppliers:
            po_qs = PurchaseOrder.objects.filter(company_id=company_id, supplier=sup)
            po_count = po_qs.count()

            total_spend = po_qs.aggregate(
                total=Coalesce(
                    Sum('total_amount'),
                    Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
                )
            )['total']

            # --- REAL Lead Time Calculation ---
            # For each PO that has both order_date and goods receipts, calculate
            # the average days from order to first receipt
            lead_times = []
            for po in po_qs.filter(
                order_date__isnull=False,
                status__in=['PARTIALLY_RECEIVED', 'FULLY_RECEIVED']
            ):
                first_receipt = GoodsReceipt.objects.filter(
                    purchase_order=po,
                    company_id=company_id,
                ).order_by('received_date').first()

                if first_receipt and first_receipt.received_date:
                    delta = (first_receipt.received_date.date() - po.order_date).days
                    if delta >= 0:
                        lead_times.append(delta)

            average_lead_time = (
                round(sum(lead_times) / len(lead_times), 1) if lead_times else 0
            )

            # --- Fulfillment rate ---
            lines = PurchaseOrderLine.objects.filter(
                company_id=company_id,
                purchase_order__supplier=sup
            )
            totals = lines.aggregate(
                ordered=Coalesce(Sum('quantity_ordered'), 0),
                received=Coalesce(Sum('quantity_received'), 0)
            )
            ordered = totals['ordered']
            received = totals['received']
            fulfillment = round(
                float(received / ordered * 100), 2
            ) if ordered > 0 else 100.0

            # --- Composite Score ---
            # 60% fulfillment + 40% lead time (lower is better)
            lead_time_score = 0
            if average_lead_time > 0:
                # Score = max 100, decreasing with lead time; 30+ days → 0
                lead_time_score = max(0, 100 - (average_lead_time / 30.0 * 100))
            else:
                lead_time_score = 100  # No lead time data → assume good

            if po_count == 0:
                performance = 0
            else:
                performance = round(
                    (fulfillment * 0.6) + (lead_time_score * 0.4), 2
                )

            results.append({
                'supplier_name': sup.name,
                'supplier_code': sup.code,
                'fulfillment_rate': fulfillment,
                'average_lead_time_days': average_lead_time,
                'total_purchase_amount': total_spend or 0,
                'orders_count': po_count,
                'performance_score': min(100, performance),
            })

        results.sort(key=lambda x: x['performance_score'], reverse=True)
        serializer = SupplierPerformanceSerializer(results, many=True)
        return Response(serializer.data)

    # ------------------------------------------------------------------
    #  COMPREHENSIVE INVENTORY ANALYTICS (all-in-one dashboard data)
    # ------------------------------------------------------------------
    @action(detail=False, methods=['get'], url_path='analytics')
    def analytics(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')
        start_date, end_date = self._get_date_range(request)
        start_date_d = start_date.date()
        end_date_d = end_date.date()

        # ── Products: sales + purchase + value per variant ──
        variants = ProductVariant.objects.filter(
            company_id=company_id, is_deleted=False
        ).select_related('product__category', 'product__brand')

        # Sales per variant (completed orders in period)
        sol_qs = SalesOrderLine.objects.filter(
            company_id=company_id,
            sales_order__status='COMPLETE',
            sales_order__order_date__range=(start_date_d, end_date_d),
        ).values('variant_id').annotate(
            total_sold=Coalesce(Sum('quantity_ordered'), 0),
            total_returned=Coalesce(Sum('quantity_returned'), 0),
            total_revenue=Coalesce(
                Sum(F('quantity_ordered') * F('unit_price') - F('discount_amount')),
                Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
            ),
        )

        # Purchases per variant (confirmed/received POs in period)
        pol_qs = PurchaseOrderLine.objects.filter(
            company_id=company_id,
            purchase_order__status__in=['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
            purchase_order__order_date__range=(start_date_d, end_date_d),
        ).exclude(variant__isnull=True).values('variant_id').annotate(
            total_ordered_qty=Coalesce(Sum('quantity_ordered'), 0),
            total_purch_cost=Coalesce(
                Sum(F('quantity_ordered') * F('unit_cost')),
                Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
            ),
        )

        sales_map = {s['variant_id']: s for s in sol_qs}
        purchase_map = {p['variant_id']: p for p in pol_qs}

        # Stock value per variant
        stock_qs = StockItem.objects.filter(company_id=company_id)
        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        stock_agg = stock_qs.values('variant_id').annotate(
            total_qty=Coalesce(Sum('quantity_on_hand'), 0),
        )
        stock_map = {s['variant_id']: s['total_qty'] for s in stock_agg}

        product_data = []
        low_stock_data = []
        for var in variants:
            sku = var.sku
            pid = var.id
            sales_info = sales_map.get(pid, {})
            purchase_info = purchase_map.get(pid, {})
            stock_qty = stock_map.get(pid, 0)
            stock_value = float(stock_qty * float(var.buying_price or 0))
            sold_qty = int(sales_info.get('total_sold', 0) or 0) - int(sales_info.get('total_returned', 0) or 0)
            revenue = float(sales_info.get('total_revenue', 0) or 0)
            purch_qty = int(purchase_info.get('total_ordered_qty', 0) or 0)
            purch_cost = float(purchase_info.get('total_purch_cost', 0) or 0)
            margin = revenue - (sold_qty * float(var.buying_price or 0))
            margin_pct = round((margin / revenue * 100), 1) if revenue > 0 else 0
            cat_name = var.product.category.name if var.product.category else "—"
            brand_name = var.product.brand.name if var.product.brand else "—"

            entry = {
                'product_name': var.product.product_name,
                'variant_sku': sku,
                'total_stock_value': round(stock_value, 2),
                'total_sales_qty': max(sold_qty, 0),
                'total_sales_revenue': round(revenue, 2),
                'total_purchase_qty': purch_qty,
                'total_purchase_cost': round(purch_cost, 2),
                'margin': round(margin, 2),
                'margin_percent': margin_pct,
                'category_name': cat_name,
                'brand_name': brand_name,
            }
            product_data.append(entry)

            # Low stock check
            stock_items = StockItem.objects.filter(company_id=company_id, variant=var)
            if warehouse_id:
                stock_items = stock_items.filter(warehouse___id=warehouse_id)
            on_hand = stock_items.aggregate(
                total=Coalesce(Sum('quantity_on_hand'), 0),
                reserved=Coalesce(Sum('quantity_reserved'), 0),
            )
            avail = on_hand['total'] - on_hand['reserved']
            if avail <= var.min_stock_level:
                low_stock_data.append(entry)

        top_by_value = sorted(product_data, key=lambda x: x['total_stock_value'], reverse=True)[:10]
        top_by_sales = sorted(product_data, key=lambda x: x['total_sales_revenue'], reverse=True)[:10]
        top_by_purchase = sorted(product_data, key=lambda x: x['total_purchase_cost'], reverse=True)[:10]
        low_stock_sorted = sorted(low_stock_data, key=lambda x: x['total_stock_value'], reverse=True)[:10]

        total_customers_count = Customer.objects.filter(company_id=company_id, is_active=True).count()

        products_summary = {
            'total_products': Product.objects.filter(company_id=company_id, is_deleted=False).count(),
            'total_variants': len(variants),
            'active_products': Product.objects.filter(company_id=company_id, is_deleted=False, is_active=True).count(),
            'total_customers': total_customers_count,
        }

        # ── Brands ──
        brands_data = []
        for brand in Brand.objects.filter(company_id=company_id, is_deleted=False):
            brand_variants = variants.filter(product__brand=brand)
            if not brand_variants.exists():
                continue
            b_stock_value = sum(
                float(stock_map.get(v.id, 0) * float(v.buying_price or 0))
                for v in brand_variants
            )
            b_sales_rev = sum(
                float(sales_map.get(v.id, {}).get('total_revenue', 0) or 0)
                for v in brand_variants
            )
            b_sales_qty = sum(
                int(sales_map.get(v.id, {}).get('total_sold', 0) or 0) -
                int(sales_map.get(v.id, {}).get('total_returned', 0) or 0)
                for v in brand_variants
            )
            b_purch_cost = sum(
                float(purchase_map.get(v.id, {}).get('total_purch_cost', 0) or 0)
                for v in brand_variants
            )
            brands_data.append({
                'brand_name': brand.name,
                'product_count': brand_variants.count(),
                'total_stock_value': round(b_stock_value, 2),
                'total_sales_revenue': round(b_sales_rev, 2),
                'total_sales_qty': b_sales_qty,
                'total_purchase_cost': round(b_purch_cost, 2),
            })
        brands_data.sort(key=lambda x: x['total_sales_revenue'], reverse=True)

        # ── Categories ──
        cats_data = []
        for cat in Category.objects.filter(company_id=company_id, is_deleted=False):
            cat_variants = variants.filter(product__category=cat)
            if not cat_variants.exists():
                continue
            c_stock_value = sum(
                float(stock_map.get(v.id, 0) * float(v.buying_price or 0))
                for v in cat_variants
            )
            c_sales_rev = sum(
                float(sales_map.get(v.id, {}).get('total_revenue', 0) or 0)
                for v in cat_variants
            )
            c_sales_qty = sum(
                int(sales_map.get(v.id, {}).get('total_sold', 0) or 0) -
                int(sales_map.get(v.id, {}).get('total_returned', 0) or 0)
                for v in cat_variants
            )
            cats_data.append({
                'category_name': cat.name,
                'product_count': cat_variants.count(),
                'total_stock_value': round(c_stock_value, 2),
                'total_sales_revenue': round(c_sales_rev, 2),
                'total_sales_qty': c_sales_qty,
            })
        cats_data.sort(key=lambda x: x['total_sales_revenue'], reverse=True)

        # ── Suppliers (reuse performance logic) ──
        supplier_results = []
        for sup in Supplier.objects.filter(company_id=company_id, status='active'):
            po_qs = PurchaseOrder.objects.filter(company_id=company_id, supplier=sup)
            po_count = po_qs.count()
            total_spend = po_qs.aggregate(
                total=Coalesce(Sum('total_amount'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=2)))
            )['total']
            lines = PurchaseOrderLine.objects.filter(company_id=company_id, purchase_order__supplier=sup)
            totals = lines.aggregate(
                ordered=Coalesce(Sum('quantity_ordered'), 0),
                received=Coalesce(Sum('quantity_received'), 0)
            )
            ordered = totals['ordered']
            received = totals['received']
            fulfillment = round(float(received / ordered * 100), 2) if ordered > 0 else 100.0
            lead_times = []
            for po in po_qs.filter(order_date__isnull=False, status__in=['PARTIALLY_RECEIVED', 'FULLY_RECEIVED']):
                first_receipt = GoodsReceipt.objects.filter(purchase_order=po, company_id=company_id).order_by('received_date').first()
                if first_receipt and first_receipt.received_date:
                    delta = (first_receipt.received_date.date() - po.order_date).days
                    if delta >= 0:
                        lead_times.append(delta)
            avg_lead_time = round(sum(lead_times) / len(lead_times), 1) if lead_times else 0
            lead_time_score = max(0, 100 - (avg_lead_time / 30.0 * 100)) if avg_lead_time > 0 else 100
            performance = round((fulfillment * 0.6) + (lead_time_score * 0.4), 2) if po_count > 0 else 0
            supplier_results.append({
                'supplier_name': sup.name,
                'supplier_code': sup.code,
                'fulfillment_rate': fulfillment,
                'average_lead_time_days': avg_lead_time,
                'total_purchase_amount': total_spend or 0,
                'orders_count': po_count,
                'performance_score': min(100, performance),
            })
        supplier_results.sort(key=lambda x: x['performance_score'], reverse=True)

        # ── Customers ──
        cust_data = []
        for cust in Customer.objects.filter(company_id=company_id, is_active=True):
            orders = SalesOrder.objects.filter(
                company_id=company_id, customer=cust, status='COMPLETE'
            )
            so_ids = orders.values_list('id', flat=True)
            totals = orders.aggregate(
                rev=Coalesce(Sum('total_amount'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=2)))
            )
            last_order = orders.order_by('-order_date').first()
            line_count = SalesOrderLine.objects.filter(
                sales_order_id__in=so_ids
            ).aggregate(total=Coalesce(Sum('quantity_ordered'), 0))['total']

            cust_data.append({
                'customer_name': cust.name,
                'total_orders': orders.count(),
                'total_revenue': float(totals['rev'] or 0),
                'total_products': int(line_count or 0),
                'last_order_date': last_order.order_date.strftime('%Y-%m-%d') if last_order and last_order.order_date else None,
            })
        cust_data.sort(key=lambda x: x['total_revenue'], reverse=True)

        top_customers = cust_data[:10]

        # ── Warehouses ──
        wh_data = []
        for wh in Warehouse.objects.filter(company_id=company_id, is_active=True):
            wh_stock = stock_qs.filter(warehouse=wh)
            wh_agg = wh_stock.aggregate(
                total_qty=Coalesce(Sum('quantity_on_hand'), 0),
                unique_variants=Count('variant', distinct=True),
            )
            wh_value = sum(
                (s.quantity_on_hand * float(s.variant.buying_price or 0))
                for s in wh_stock.select_related('variant').only(
                    'quantity_on_hand', 'variant__buying_price'
                )
            )
            wh_sales = SalesOrder.objects.filter(
                company_id=company_id, warehouse=wh, status='COMPLETE'
            ).aggregate(
                total=Coalesce(Sum('total_amount'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=2)))
            )['total']
            wh_transfers_out = StockTransfer.objects.filter(
                company_id=company_id, source_warehouse=wh
            ).count()
            wh_transfers_in = StockTransfer.objects.filter(
                company_id=company_id, destination_warehouse=wh
            ).count()

            wh_data.append({
                'warehouse_name': wh.warehouse_name,
                'total_stock_value': round(wh_value, 2),
                'total_on_hand': wh_agg['total_qty'],
                'unique_variants': wh_agg['unique_variants'],
                'total_sales': float(wh_sales or 0),
                'total_transfers_out': wh_transfers_out,
                'total_transfers_in': wh_transfers_in,
            })
        wh_data.sort(key=lambda x: x['total_stock_value'], reverse=True)

        # ── Movement by type ──
        tx_by_type = InventoryTransaction.objects.filter(
            company_id=company_id,
            created_at__range=(start_date, end_date),
        ).values('transaction_type').annotate(
            total_qty=Sum('quantity_change'),
            total_count=Count('id'),
        ).order_by('-total_count')

        movement_data = []
        for tx in tx_by_type:
            movement_data.append({
                'transaction_type': tx['transaction_type'],
                'total_qty': abs(tx['total_qty'] or 0),
                'total_count': tx['total_count'],
            })

        # ── Transfers by status ──
        transfer_data = list(
            StockTransfer.objects.filter(company_id=company_id)
            .values('status')
            .annotate(
                total_count=Count('id'),
                total_quantity=Coalesce(Sum('quantity'), 0),
            )
        )

        # ── Alerts by type & severity ──
        alert_summary = list(
            Alert.objects.filter(company_id=company_id)
            .values('type', 'severity')
            .annotate(count=Count('id'))
            .order_by('-count')[:15]
        )

        # ── POS / Order Source summary ──
        pos_data = list(
            SalesOrder.objects.filter(
                company_id=company_id, status='COMPLETE',
            ).values('source').annotate(
                total_orders=Count('id'),
                total_revenue=Coalesce(Sum('total_amount'), Value(0, output_field=DecimalField(max_digits=15, decimal_places=2)))
            )
        )

        analytics_data = {
            'top_products_by_value': top_by_value,
            'top_products_by_sales': top_by_sales,
            'top_products_by_purchase': top_by_purchase,
            'low_stock_products': low_stock_sorted,
            'products_summary': products_summary,
            'brands': brands_data,
            'categories': cats_data,
            'top_customers': top_customers,
            'top_suppliers': supplier_results[:10] if supplier_results else [],
            'warehouses': wh_data,
            'movement_by_type': movement_data,
            'transfers': transfer_data,
            'alerts': alert_summary,
            'pos_summary': pos_data,
        }
        serializer = InventoryAnalyticsSerializer(analytics_data)
        return Response(serializer.data)
