from decimal import Decimal
from datetime import timedelta
from django.db.models import Sum, Count, F, Q
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import CustomerInvoice, SupplierBill, Payment, BankAccount
from apps.finance.services.payable import get_outstanding
from apps.inventory.models import ProductVariant, StockItem, PurchaseOrder, SalesOrder, InventoryTransaction
from apps.sales.models import Lead, Quote


class OverallDashboardViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    """
    Unified dashboard combining finance, inventory and sales KPIs.
    """
    permission_module = 'DASHBOARD'
    permission_resource = 'overall'
    # Allow read access if user has any of the module view permissions
    action_permission_any_of = {
        'summary': [
            ('FINANCE', 'dashboard'), ('INVENTORY', 'report'), ('SALES', 'dashboard')
        ],
        'trends': [
            ('FINANCE', 'dashboard'), ('INVENTORY', 'report'), ('SALES', 'dashboard')
        ],
        'recent_activity': [
            ('FINANCE', 'dashboard'), ('INVENTORY', 'report'), ('SALES', 'dashboard')
        ],
        'alerts': [
            ('FINANCE', 'dashboard'), ('INVENTORY', 'report'), ('SALES', 'dashboard')
        ],
    }

    def _get_company_branch(self, request):
        return request.user.company_id, request.user.branch_id

    @action(detail=False, methods=['get'])
    def summary(self, request):
        """Main KPIs: Revenue, Expenses, Profit, Sales, Purchases, Stock Value, Leads, Quotes"""
        company_id, branch_id = self._get_company_branch(request)

        # ---- Finance KPIs ----
        today = timezone.now().date()
        month_start = today.replace(day=1)

        payments = Payment.objects.filter(
            company_id=company_id, branch_id=branch_id,
            status='CONFIRMED', is_deleted=False
        )
        revenue_mtd = payments.filter(
            payment_type='RECEIPT', payment_date__gte=month_start
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        expenses_mtd = payments.filter(
            payment_type='PAYMENT', payment_date__gte=month_start
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
        net_profit_mtd = revenue_mtd - expenses_mtd

        cash_position = BankAccount.objects.filter(
            company_id=company_id, is_active=True, is_deleted=False
        ).aggregate(total=Sum('book_balance'))['total'] or Decimal('0.00')

        # AR / AP summary
        invoices = CustomerInvoice.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).exclude(status='CANCELLED')
        bills = SupplierBill.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).exclude(status='CANCELLED')
        receivables = sum(get_outstanding(inv) for inv in invoices)
        payables = sum(get_outstanding(bill) for bill in bills)

        # ---- Inventory KPIs ----
        total_variants = ProductVariant.objects.filter(company_id=company_id, is_deleted=False).count()
        stock_items = StockItem.objects.filter(company_id=company_id)
        total_stock_value = sum(
            (item.quantity_on_hand * item.variant.buying_price) for item in stock_items.select_related('variant')
        )
        low_stock_count = stock_items.filter(quantity_on_hand__lt=F('variant__min_stock_level')).count()

        # Sales vs Purchase (YTD)
        year_start = today.replace(month=1, day=1)
        total_sales_amount = SalesOrder.objects.filter(
            company_id=company_id, branch_id=branch_id, status='COMPLETE',
            order_date__gte=year_start
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')
        total_purchase_amount = PurchaseOrder.objects.filter(
            company_id=company_id, branch_id=branch_id,
            status__in=['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
            order_date__gte=year_start
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        # ---- Sales KPIs ----
        total_leads = Lead.objects.filter(company_id=company_id, branch_id=branch_id, is_deleted=False).count()
        new_leads_mtd = Lead.objects.filter(
            company_id=company_id, branch_id=branch_id,
            created_at__date__gte=month_start, is_deleted=False
        ).count()
        total_quotes = Quote.objects.filter(company_id=company_id, branch_id=branch_id, is_deleted=False).count()
        quote_value = Quote.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).aggregate(total=Sum('total_amount'))['total'] or Decimal('0.00')

        won_leads = Lead.objects.filter(company_id=company_id, branch_id=branch_id, status='WON').count()
        conversion_rate = round((won_leads / total_leads) * 100, 1) if total_leads else 0

        return Response({
            'finance': {
                'revenue_mtd': str(revenue_mtd),
                'expenses_mtd': str(expenses_mtd),
                'net_profit_mtd': str(net_profit_mtd),
                'cash_position': str(cash_position),
                'receivables': str(receivables),
                'payables': str(payables),
            },
            'inventory': {
                'total_variants': total_variants,
                'total_stock_value': str(total_stock_value),
                'low_stock_count': low_stock_count,
                'total_sales_amount_ytd': str(total_sales_amount),
                'total_purchase_amount_ytd': str(total_purchase_amount),
            },
            'sales': {
                'total_leads': total_leads,
                'new_leads_mtd': new_leads_mtd,
                'total_quotes': total_quotes,
                'quote_value': str(quote_value),
                'conversion_rate': conversion_rate,
            }
        })

    @action(detail=False, methods=['get'])
    def trends(self, request):
        """Monthly trends: revenue/expense, sales/purchases, stock movement (incoming/outgoing)"""
        company_id, branch_id = self._get_company_branch(request)
        today = timezone.now().date()
        start_date = today - timedelta(days=365)  # last 12 months

        # 1. Revenue vs Expense (from Finance payments)
        payments = Payment.objects.filter(
            company_id=company_id, branch_id=branch_id,
            status='CONFIRMED', payment_date__gte=start_date, is_deleted=False
        )
        monthly_flow = {}
        for p in payments:
            key = p.payment_date.strftime('%Y-%m')
            if key not in monthly_flow:
                monthly_flow[key] = {'revenue': Decimal('0.00'), 'expense': Decimal('0.00')}
            if p.payment_type == 'RECEIPT':
                monthly_flow[key]['revenue'] += p.amount
            else:
                monthly_flow[key]['expense'] += p.amount

        revenue_expense_trend = [
            {'month': k, 'revenue': float(v['revenue']), 'expense': float(v['expense'])}
            for k, v in sorted(monthly_flow.items())
        ]

        # 2. Sales vs Purchases (from SalesOrder & PurchaseOrder)
        sales_qs = SalesOrder.objects.filter(
            company_id=company_id, branch_id=branch_id, status='COMPLETE',
            order_date__gte=start_date
        )
        purchases_qs = PurchaseOrder.objects.filter(
            company_id=company_id, branch_id=branch_id,
            status__in=['CONFIRMED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED'],
            order_date__gte=start_date
        )

        sales_by_month = sales_qs.values('order_date').annotate(total=Sum('total_amount'))
        purchases_by_month = purchases_qs.values('order_date').annotate(total=Sum('total_amount'))

        monthly_sales_purchases = {}
        for s in sales_by_month:
            key = s['order_date'].strftime('%Y-%m')
            monthly_sales_purchases.setdefault(key, {'sales': Decimal('0.00'), 'purchases': Decimal('0.00')})
            monthly_sales_purchases[key]['sales'] += s['total'] or Decimal('0.00')
        for p in purchases_by_month:
            key = p['order_date'].strftime('%Y-%m')
            monthly_sales_purchases.setdefault(key, {'sales': Decimal('0.00'), 'purchases': Decimal('0.00')})
            monthly_sales_purchases[key]['purchases'] += p['total'] or Decimal('0.00')

        sales_purchases_trend = [
            {'month': k, 'sales': float(v['sales']), 'purchases': float(v['purchases'])}
            for k, v in sorted(monthly_sales_purchases.items())
        ]

        # 3. Stock Movement (last 6 months)
        stock_movement_start = today - timedelta(days=180)
        transactions = InventoryTransaction.objects.filter(
            company_id=company_id, branch_id=branch_id,
            created_at__date__gte=stock_movement_start,
            transaction_type__in=['PURCHASE_RECEIPT', 'SALE', 'TRANSFER_IN', 'TRANSFER_OUT']
        )
        movement_by_month = {}
        for tx in transactions:
            key = tx.created_at.strftime('%Y-%m')
            if key not in movement_by_month:
                movement_by_month[key] = {'incoming': 0, 'outgoing': 0}
            if tx.transaction_type in ['PURCHASE_RECEIPT', 'TRANSFER_IN']:
                movement_by_month[key]['incoming'] += abs(tx.quantity_change)
            elif tx.transaction_type in ['SALE', 'TRANSFER_OUT']:
                movement_by_month[key]['outgoing'] += abs(tx.quantity_change)

        stock_movement_trend = [
            {'month': k, 'incoming': v['incoming'], 'outgoing': v['outgoing']}
            for k, v in sorted(movement_by_month.items())
        ]

        return Response({
            'revenue_expense': revenue_expense_trend,
            'sales_purchases': sales_purchases_trend,
            'stock_movement': stock_movement_trend,
        })

    @action(detail=False, methods=['get'])
    def recent_activity(self, request):
        """Last 5 records from: payments, sales orders, stock transactions, leads, quotes"""
        company_id, branch_id = self._get_company_branch(request)

        # Payments
        recent_payments = Payment.objects.filter(
            company_id=company_id, branch_id=branch_id, status='CONFIRMED', is_deleted=False
        ).order_by('-payment_date')[:5]
        payments_data = [{
            'id': str(p._id),
            'type': p.payment_type,
            'amount': str(p.amount),
            'date': p.payment_date.isoformat(),
            'reference': p.reference_number,
        } for p in recent_payments]

        # Sales Orders (completed)
        recent_orders = SalesOrder.objects.filter(
            company_id=company_id, branch_id=branch_id, status='COMPLETE'
        ).order_by('-order_date')[:5]
        orders_data = [{
            'id': str(o._id),
            'number': o.order_number,
            'total': str(o.total_amount),
            'date': o.order_date.isoformat(),
            'customer': o.customer.name if o.customer else None,
        } for o in recent_orders]

        # Stock Transactions
        recent_stock_tx = InventoryTransaction.objects.filter(
            company_id=company_id, branch_id=branch_id
        ).order_by('-created_at')[:5]
        stock_tx_data = [{
            'id': str(t._id),
            'variant': t.variant.sku,
            'change': t.quantity_change,
            'type': t.get_transaction_type_display(),
            'date': t.created_at.isoformat(),
        } for t in recent_stock_tx]

        # Leads
        recent_leads = Lead.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).order_by('-created_at')[:5]
        leads_data = [{
            'id': str(l._id),
            'name': f"{l.first_name} {l.last_name}".strip(),
            'status': l.status,
            'date': l.created_at.isoformat(),
        } for l in recent_leads]

        # Quotes
        recent_quotes = Quote.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).order_by('-created_at')[:5]
        quotes_data = [{
            'id': str(q._id),
            'number': q.quote_number,
            'total': str(q.total_amount),
            'status': q.status,
            'date': q.created_at.isoformat(),
        } for q in recent_quotes]

        return Response({
            'payments': payments_data,
            'sales_orders': orders_data,
            'stock_transactions': stock_tx_data,
            'leads': leads_data,
            'quotes': quotes_data,
        })

    @action(detail=False, methods=['get'])
    def alerts(self, request):
        """Critical alerts: low stock, overdue invoices/bills, pending approvals"""
        company_id, branch_id = self._get_company_branch(request)
        today = timezone.now().date()

        alerts = []

        # Low stock items (top 5)
        low_stock_items = StockItem.objects.filter(
            company_id=company_id,
            quantity_on_hand__lt=F('variant__min_stock_level')
        ).select_related('variant', 'warehouse').only(
            'quantity_on_hand', 'variant__sku', 'variant__min_stock_level',
            'variant___id', 'warehouse__warehouse_name'
        )[:5]
        for item in low_stock_items:
            alerts.append({
                'type': 'LOW_STOCK',
                'severity': 'warning',
                'title': f'Low stock: {item.variant.sku}',
                'message': f'Only {item.quantity_on_hand} left in {item.warehouse.warehouse_name} (min {item.variant.min_stock_level})',
                'entity_type': 'variant',
                'entity_id': str(item.variant._id),
            })

        # Overdue invoices (top 5 unpaid)
        overdue_invoices = CustomerInvoice.objects.filter(
            company_id=company_id, branch_id=branch_id,
            due_date__lt=today, is_deleted=False
        ).exclude(status='CANCELLED').only(
            'invoice_number', 'due_date', '_id'
        )[:5]
        for inv in overdue_invoices:
            if inv.outstanding > 0:
                alerts.append({
                    'type': 'OVERDUE_INVOICE',
                    'severity': 'critical',
                    'title': f'Overdue invoice {inv.invoice_number}',
                    'message': f'Amount {inv.outstanding} due since {inv.due_date}',
                    'entity_type': 'invoice',
                    'entity_id': str(inv._id),
                })

        # Overdue bills (top 5 unpaid)
        overdue_bills = SupplierBill.objects.filter(
            company_id=company_id, branch_id=branch_id,
            due_date__lt=today, is_deleted=False
        ).exclude(status='CANCELLED').only(
            'bill_number', 'due_date', '_id'
        )[:5]
        for bill in overdue_bills:
            if bill.outstanding > 0:
                alerts.append({
                    'type': 'OVERDUE_BILL',
                    'severity': 'critical',
                    'title': f'Overdue bill {bill.bill_number}',
                    'message': f'Amount {bill.outstanding} due since {bill.due_date}',
                    'entity_type': 'bill',
                    'entity_id': str(bill._id),
                })

        # Pending approvals (e.g., leads in NEW status, quotes in DRAFT)
        pending_leads = Lead.objects.filter(
            company_id=company_id, branch_id=branch_id, status='NEW', is_deleted=False
        ).count()
        if pending_leads:
            alerts.append({
                'type': 'PENDING_LEADS',
                'severity': 'info',
                'title': f'{pending_leads} new leads pending',
                'message': 'Assign or contact these leads',
            })

        pending_quotes = Quote.objects.filter(
            company_id=company_id, branch_id=branch_id, status='DRAFT', is_deleted=False
        ).count()
        if pending_quotes:
            alerts.append({
                'type': 'PENDING_QUOTES',
                'severity': 'info',
                'title': f'{pending_quotes} draft quotes',
                'message': 'Review and send to customers',
            })

        return Response(alerts)