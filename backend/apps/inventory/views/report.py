from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, F, Q, DecimalField, FloatField, Count, Avg, Value
from django.db.models.functions import Coalesce, TruncDay
from django.utils import timezone
from datetime import datetime, timedelta

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models import (
    ProductVariant, StockItem, PurchaseOrder, SalesOrder, Warehouse,
    Category, PurchaseOrderLine, SalesOrderLine, Supplier, InventoryTransaction
)
from apps.inventory.serializers.report import (
    OverallSummarySerializer, StockItemReportSerializer, StockSummarySerializer,
    ValuationReportSerializer, StockMovementSerializer, SalesVsPurchaseSerializer,
    ProfitLossSerializer, SlowMovingSerializer, ReorderPlanningSerializer,
    SupplierPerformanceSerializer
)

class ReportViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'report'
    permission_classes = CompanyBranchMixin.permission_classes
    branch_filter_enabled = True

    @action(detail=False, methods=['get'], url_path='overall-summary')
    def overall_summary(self, request):
        user = request.user
        company_id = user.company_id

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        warehouse_id = request.query_params.get('warehouse_id')

        variant_qs = ProductVariant.objects.filter(company_id=company_id, is_deleted=False)
        stock_qs = StockItem.objects.filter(company_id=company_id)

        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        total_value = 0
        for stock in stock_qs.select_related('variant'):
            total_value += stock.quantity_on_hand * stock.variant.buying_price

        low_stock_count = stock_qs.filter(
            quantity_on_hand__lt=F('variant__min_stock_level')
        ).count()

        po_qs = PurchaseOrder.objects.filter(company_id=company_id)
        if start_date:
            po_qs = po_qs.filter(order_date__gte=start_date)
        if end_date:
            po_qs = po_qs.filter(order_date__lte=end_date)

        # FIX: Use Value with output_field for DecimalField
        total_purchase = po_qs.aggregate(
            total=Coalesce(
                Sum('total_amount'),
                Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
            )
        )['total']

        so_qs = SalesOrder.objects.filter(company_id=company_id, status='COMPLETE')
        if start_date:
            so_qs = so_qs.filter(order_date__gte=start_date)
        if end_date:
            so_qs = so_qs.filter(order_date__lte=end_date)

        total_sales = so_qs.aggregate(
            total=Coalesce(
                Sum('total_amount'),
                Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
            )
        )['total']

        wh_qs = Warehouse.objects.filter(company_id=company_id, is_active=True)
        if warehouse_id:
            wh_qs = wh_qs.filter(_id=warehouse_id)
        total_warehouses = wh_qs.count()

        summary_data = {
            'total_stock_value': total_value,
            'total_variants': variant_qs.count(),
            'low_stock_count': low_stock_count,
            'total_purchase_amount': total_purchase,
            'total_sales_amount': total_sales,
            'total_warehouses': total_warehouses,
        }
        serializer = OverallSummarySerializer(summary_data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='stock-report')
    def stock_report(self, request):
        user = request.user
        company_id = user.company_id

        warehouse_id = request.query_params.get('warehouse_id')
        stock_qs = StockItem.objects.filter(company_id=company_id).select_related('variant__product', 'warehouse')

        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        results = []
        for item in stock_qs:
            results.append({
                'variant_sku': item.variant.sku,
                'variant_name': item.variant.product.product_name,
                'warehouse_name': item.warehouse.warehouse_name,
                'quantity_on_hand': item.quantity_on_hand,
                'quantity_reserved': item.quantity_reserved,
                'quantity_available': item.quantity_on_hand - item.quantity_reserved,
                'unit_cost': item.variant.buying_price,
                'total_value': item.quantity_on_hand * item.variant.buying_price,
            })
        serializer = StockItemReportSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='stock-summary')
    def stock_summary(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        stock_qs = StockItem.objects.filter(company_id=company_id).select_related(
            'variant__product__category',
            'warehouse'
        )

        if warehouse_id:
            stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

        results = []
        for item in stock_qs:
            category_name = item.variant.product.category.name if item.variant.product.category else "Uncategorized"
            results.append({
                'product_name': item.variant.product.product_name,
                'category_name': category_name,
                'warehouse_name': item.warehouse.warehouse_name,
                'variant_sku': item.variant.sku,
                'quantity_on_hand': item.quantity_on_hand,
                'quantity_reserved': item.quantity_reserved,
                'quantity_available': item.quantity_on_hand - item.quantity_reserved,
                'unit_cost': item.variant.buying_price,
                'total_value': item.quantity_on_hand * item.variant.buying_price,
            })
        serializer = StockSummarySerializer(results, many=True)
        return Response(serializer.data)

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
        for item in stock_qs.select_related('variant'):
            total_quantity += item.quantity_on_hand
            total_value += item.quantity_on_hand * item.variant.buying_price

        average_unit_cost = (total_value / total_quantity) if total_quantity > 0 else 0

        valuation_data = {
            'methodology': 'Weighted Average Cost (WAC) based on standard buying cost basis.',
            'total_quantity': total_quantity,
            'total_value': total_value,
            'average_unit_cost': average_unit_cost,
        }
        serializer = ValuationReportSerializer(valuation_data)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='stock-movement')
    def stock_movement(self, request):
        user = request.user
        company_id = user.company_id
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

        tx_qs = InventoryTransaction.objects.filter(
            company_id=company_id,
            created_at__range=(start_date, end_date)
        ).annotate(
            day=TruncDay('created_at')
        ).values('day', 'transaction_type').annotate(
            total_qty=Sum('quantity_change'),
            tx_count=Count('id')
        ).order_by('day')

        results = []
        for tx in tx_qs:
            results.append({
                'period': tx['day'].strftime('%Y-%m-%d'),
                'transaction_type': tx['transaction_type'],
                'total_quantity': abs(tx['total_qty']),
                'transaction_count': tx['tx_count'],
            })
        serializer = StockMovementSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='sales-vs-purchase')
    def sales_vs_purchase(self, request):
        user = request.user
        company_id = user.company_id
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

        sales_data = SalesOrder.objects.filter(
            company_id=company_id,
            status='COMPLETE',
            order_date__range=(start_date.date(), end_date.date())
        ).values('order_date').annotate(
            total_sales=Sum('total_amount')
        )

        purchase_data = PurchaseOrder.objects.filter(
            company_id=company_id,
            status__in=['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
            order_date__range=(start_date.date(), end_date.date())
        ).values('order_date').annotate(
            total_purchases=Sum('total_amount')
        )

        timeline = {}
        curr = start_date
        while curr <= end_date:
            date_str = curr.strftime('%Y-%m-%d')
            timeline[date_str] = {'sales_amount': 0, 'purchase_amount': 0}
            curr += timedelta(days=1)

        for sale in sales_data:
            d_str = sale['order_date'].strftime('%Y-%m-%d')
            if d_str in timeline:
                timeline[d_str]['sales_amount'] = sale['total_sales']

        for purch in purchase_data:
            d_str = purch['order_date'].strftime('%Y-%m-%d')
            if d_str in timeline:
                timeline[d_str]['purchase_amount'] = purch['total_purchases']

        results = []
        for period, vals in sorted(timeline.items()):
            results.append({
                'period': period,
                'sales_amount': vals['sales_amount'],
                'purchase_amount': vals['purchase_amount'],
            })
        serializer = SalesVsPurchaseSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='profit-loss')
    def profit_loss(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        lines_qs = SalesOrderLine.objects.filter(
            company_id=company_id,
            sales_order__status='COMPLETE'
        ).select_related('variant__product', 'sales_order')

        if warehouse_id:
            lines_qs = lines_qs.filter(sales_order__warehouse___id=warehouse_id)

        aggregations = {}
        for line in lines_qs:
            sku = line.variant.sku
            if sku not in aggregations:
                aggregations[sku] = {
                    'product_name': line.variant.product.product_name,
                    'variant_sku': sku,
                    'sales_quantity': 0,
                    'sales_revenue': 0,
                    'buying_price': line.variant.buying_price,
                }
            qty = line.quantity_ordered
            aggregations[sku]['sales_quantity'] += qty
            revenue = (line.quantity_ordered * line.unit_price) - line.discount_amount
            aggregations[sku]['sales_revenue'] += revenue

        results = []
        for sku, data in aggregations.items():
            sales_revenue = data['sales_revenue']
            cogs = data['sales_quantity'] * data['buying_price']
            gross_profit = sales_revenue - cogs
            margin_percent = float((gross_profit / sales_revenue) * 100) if sales_revenue > 0 else 0.0
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

        results = []
        for item in stock_qs:
            last_sale = InventoryTransaction.objects.filter(
                company_id=company_id,
                variant=item.variant,
                transaction_type='SALE'
            ).order_by('-created_at').first()

            if last_sale:
                days = (timezone.now() - last_sale.created_at).days
            else:
                days = (timezone.now() - item.created_at).days

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

    @action(detail=False, methods=['get'], url_path='reorder-planning')
    def reorder_planning(self, request):
        user = request.user
        company_id = user.company_id
        warehouse_id = request.query_params.get('warehouse_id')

        variants = ProductVariant.objects.filter(company_id=company_id, is_deleted=False).select_related('product')
        results = []

        for var in variants:
            stock_qs = StockItem.objects.filter(company_id=company_id, variant=var)
            if warehouse_id:
                stock_qs = stock_qs.filter(warehouse___id=warehouse_id)

            total_on_hand = stock_qs.aggregate(total=Coalesce(Sum('quantity_on_hand'), 0))['total']

            if total_on_hand <= var.min_stock_level:
                latest_po = PurchaseOrder.objects.filter(
                    company_id=company_id,
                    lines__variant=var
                ).select_related('supplier').first()
                supplier_name = latest_po.supplier.name if latest_po else "Default Supplier"
                reorder_qty = max(0, var.max_stock_level - total_on_hand)
                diff = var.min_stock_level - total_on_hand
                if var.min_stock_level > 0:
                    urgency = min(100.0, float(diff) / float(var.min_stock_level) * 100.0)
                else:
                    urgency = 100.0 if total_on_hand == 0 else 0.0

                results.append({
                    'product_name': var.product.product_name,
                    'variant_sku': var.sku,
                    'quantity_on_hand': total_on_hand,
                    'min_stock_level': var.min_stock_level,
                    'max_stock_level': var.max_stock_level,
                    'recommended_reorder_qty': reorder_qty,
                    'urgency_score': round(urgency, 2),
                    'suggested_supplier_name': supplier_name,
                })

        results.sort(key=lambda x: x['urgency_score'], reverse=True)
        serializer = ReorderPlanningSerializer(results, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='supplier-performance')
    def supplier_performance(self, request):
        user = request.user
        company_id = user.company_id

        suppliers = Supplier.objects.filter(company_id=company_id, status='active')
        results = []

        for sup in suppliers:
            po_qs = PurchaseOrder.objects.filter(company_id=company_id, supplier=sup)
            po_count = po_qs.count()

            # FIX: Use Value with output_field for DecimalField
            total_spend = po_qs.aggregate(
                total=Coalesce(
                    Sum('total_amount'),
                    Value(0, output_field=DecimalField(max_digits=15, decimal_places=2))
                )
            )['total']

            lines = PurchaseOrderLine.objects.filter(company_id=company_id, purchase_order__supplier=sup)
            totals = lines.aggregate(
                ordered=Coalesce(Sum('quantity_ordered'), 0),
                received=Coalesce(Sum('quantity_received'), 0)
            )
            ordered = totals['ordered']
            received = totals['received']
            fulfillment = float(received / ordered * 100) if ordered > 0 else 100.0

            lead_time = max(1.0, 6.0 - float(sup.rating))
            performance = (fulfillment * 0.6) + ((5.0 - min(5.0, lead_time)) / 5.0 * 100.0 * 0.4)

            results.append({
                'supplier_name': sup.name,
                'supplier_code': sup.code,
                'fulfillment_rate': round(fulfillment, 2),
                'average_lead_time_days': round(lead_time, 1),
                'total_purchase_amount': total_spend,
                'orders_count': po_count,
                'performance_score': round(performance, 2),
            })

        results.sort(key=lambda x: x['performance_score'], reverse=True)
        serializer = SupplierPerformanceSerializer(results, many=True)
        return Response(serializer.data)