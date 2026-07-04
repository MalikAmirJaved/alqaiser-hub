from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Sum
from django.utils import timezone
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.finance.models import (
    BankAccount,
    CustomerInvoice,
    Expense,
    Payment,
    SupplierBill,
)
from apps.finance.services.payable import get_outstanding
from apps.hr.models import PayrollRecord
from apps.permissions.mixins import PermissionRequiredMixin


class FinanceDashboardViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    permission_module = 'FINANCE'
    permission_resource = 'dashboard'

    @action(detail=False, methods=['get'])
    def summary(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        today = timezone.now().date()
        month_start = today.replace(day=1)
        year_start = today.replace(month=1, day=1)

        invoices = CustomerInvoice.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).exclude(status='CANCELLED')
        bills = SupplierBill.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        ).exclude(status='CANCELLED')
        expenses = Expense.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
        )
        payments = Payment.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            status='CONFIRMED',
            is_deleted=False,
        )

        receivables = sum(get_outstanding(inv) for inv in invoices)
        payables = sum(get_outstanding(bill) for bill in bills)

        revenue_mtd = payments.filter(
            payment_type='RECEIPT',
            payment_date__gte=month_start,
        ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        expenses_mtd = payments.filter(
            payment_type='PAYMENT',
            payment_date__gte=month_start,
        ).exclude(payment_method='CREDIT').aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

        cash_position = BankAccount.objects.filter(
            company_id=company_id,
            is_active=True,
            is_deleted=False,
        ).aggregate(total=Sum('book_balance'))['total'] or Decimal('0.00')

        unpaid_invoices = sum(1 for inv in invoices if inv.payment_status != 'PAID')
        unpaid_bills = sum(1 for bill in bills if bill.payment_status != 'PAID')
        payroll_pending = PayrollRecord.objects.filter(
            company_id=company_id,
            is_deleted=False,
            is_cancelled=False,
        ).count()

        return Response({
            'kpis': {
                'revenue_mtd': str(revenue_mtd),
                'expenses_mtd': str(expenses_mtd),
                'net_profit_mtd': str(revenue_mtd - expenses_mtd),
                'cash_position': str(cash_position),
                'receivables': str(receivables),
                'payables': str(payables),
                'unpaid_invoices': unpaid_invoices,
                'unpaid_bills': unpaid_bills,
                'payroll_records': payroll_pending,
            },
        })

    @action(detail=False, methods=['get'])
    def cashflow(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        today = timezone.now().date()
        start = today - timedelta(days=180)

        payments = Payment.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            status='CONFIRMED',
            payment_date__gte=start,
            is_deleted=False,
        )

        monthly = defaultdict(lambda: {'inflow': Decimal('0.00'), 'outflow': Decimal('0.00')})
        for payment in payments:
            if payment.payment_method == 'CREDIT':
                continue
            key = payment.payment_date.strftime('%Y-%m')
            if payment.payment_type == 'RECEIPT':
                monthly[key]['inflow'] += payment.amount
            else:
                monthly[key]['outflow'] += payment.amount

        data = [
            {'month': month, 'inflow': float(vals['inflow']), 'outflow': float(vals['outflow'])}
            for month, vals in sorted(monthly.items())
        ]
        return Response({'data': data})

    @action(detail=False, methods=['get'])
    def expense_breakdown(self, request):
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        today = timezone.now().date()
        year_start = today.replace(month=1, day=1)

        breakdown = Expense.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            expense_date__gte=year_start,
            is_deleted=False,
        ).values('category').annotate(total=Sum('amount')).order_by('-total')

        return Response({
            'data': [
                {'name': row['category'], 'value': float(row['total'] or 0)}
                for row in breakdown
            ],
        })

    @action(detail=False, methods=['get'])
    def bank_balances(self, request):
        accounts = BankAccount.objects.filter(
            company_id=request.user.company_id,
            is_active=True,
            is_deleted=False,
        )
        return Response({
            'data': [
                {
                    'name': acc.account_name,
                    'currency': acc.currency,
                    'balance': str(acc.book_balance),
                }
                for acc in accounts
            ],
        })

    @action(detail=False, methods=['get'])
    def recent_payments(self, request):
        payments = Payment.objects.filter(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            status='CONFIRMED',
            is_deleted=False,
        ).select_related('content_type', 'bank_account').order_by('-payment_date')[:10]

        from apps.finance.serializers import PaymentSerializer
        return Response({'data': PaymentSerializer(payments, many=True).data})

    @action(detail=False, methods=['get'])
    def revenue_trend(self, request):
        """
        Revenue & expense trend based on **confirmed payments only**
        (i.e. only paid invoices/bills).
        """
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        today = timezone.now().date()
        start = today - timedelta(days=365)

        from collections import OrderedDict

        # Revenue = confirmed RECEIPT payments (paid invoices)
        receipts = Payment.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            status='CONFIRMED',
            payment_type='RECEIPT',
            payment_date__gte=start,
            is_deleted=False,
        )

        # Expenses = confirmed PAYMENT payments (paid bills/expenses)
        # Exclude CREDIT payments — those are supplier credit applications, not cash movements
        expenses = Payment.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            status='CONFIRMED',
            payment_type='PAYMENT',
            payment_date__gte=start,
            is_deleted=False,
        ).exclude(payment_method='CREDIT')

        # Build monthly buckets (12 months, back from current)
        months = OrderedDict()
        for i in range(11, -1, -1):
            m = today.month - i
            y = today.year
            while m <= 0:
                m += 12
                y -= 1
            key = f"{y:04d}-{m:02d}"
            months[key] = {
                'month': date(y, m, 1).strftime('%b'),
                'revenue': 0.0,
                'expense': 0.0,
            }

        for receipt in receipts:
            key = receipt.payment_date.strftime('%Y-%m')
            if key in months:
                months[key]['revenue'] += float(receipt.amount)

        for expense in expenses:
            key = expense.payment_date.strftime('%Y-%m')
            if key in months:
                months[key]['expense'] += float(expense.amount)

        return Response({'data': list(months.values())})
