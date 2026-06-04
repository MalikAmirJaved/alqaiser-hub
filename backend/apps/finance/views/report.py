from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from django.utils import timezone
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import JournalLine, Account
from collections import defaultdict
from decimal import Decimal

class ReportViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.GenericViewSet):
    permission_module = 'FINANCE'
    permission_resource = 'report'
    
    @action(detail=False, methods=['get'])
    def trial_balance(self, request):
        """Generate trial balance as of a given date"""
        as_of_date = request.query_params.get('as_of_date')
        
        # Base queryset
        lines = JournalLine.objects.filter(
            journal_entry__is_posted=True,
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        )
        
        if as_of_date:
            lines = lines.filter(journal_entry__date__lte=as_of_date)
        
        # Group by account
        balances = defaultdict(lambda: {'debit': Decimal('0.00'), 'credit': Decimal('0.00')})
        
        for line in lines.select_related('account'):
            account = line.account
            balances[account.id]['code'] = account.code
            balances[account.id]['name'] = account.name
            balances[account.id]['account_type'] = account.account_type
            balances[account.id]['debit'] += line.debit
            balances[account.id]['credit'] += line.credit
        
        # Calculate balance for each account
        result = []
        total_debits = Decimal('0.00')
        total_credits = Decimal('0.00')
        
        for account_id, data in balances.items():
            balance = data['debit'] - data['credit']
            result.append({
                'account_id': account_id,
                'code': data['code'],
                'name': data['name'],
                'account_type': data['account_type'],
                'debit': data['debit'],
                'credit': data['credit'],
                'balance': balance,
            })
            total_debits += data['debit']
            total_credits += data['credit']
        
        # Sort by account code
        result.sort(key=lambda x: x['code'])
        
        return Response({
            'success': True,
            'data': result,
            'summary': {
                'total_debits': total_debits,
                'total_credits': total_credits,
                'is_balanced': total_debits == total_credits,
            }
        })
    

    @action(detail=False, methods=['get'])
    def profit_loss(self, request):
        """
        Generate Profit & Loss statement for a date range.
        Income accounts (revenue) - Expense accounts = Net Profit/Loss
        """
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        
        if not start_date or not end_date:
            return Response(
                {"success": False, "error": "start_date and end_date are required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Base queryset – only posted journal entries within date range
        lines = JournalLine.objects.filter(
            journal_entry__is_posted=True,
            journal_entry__date__gte=start_date,
            journal_entry__date__lte=end_date,
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        ).select_related('account')
        
        # Separate income and expense accounts
        income_total = Decimal('0.00')
        expense_total = Decimal('0.00')
        
        income_accounts = []
        expense_accounts = []
        
        for line in lines:
            account = line.account
            balance = line.debit - line.credit
            if account.account_type == 'INCOME':
                income_total += balance
                income_accounts.append({
                    'code': account.code,
                    'name': account.name,
                    'amount': balance,
                })
            elif account.account_type == 'EXPENSE':
                expense_total += balance
                expense_accounts.append({
                    'code': account.code,
                    'name': account.name,
                    'amount': balance,
                })
        
        # Aggregate by account to avoid duplicates if multiple entries
        def aggregate_accounts(accounts):
            agg = {}
            for acc in accounts:
                key = f"{acc['code']}_{acc['name']}"
                if key in agg:
                    agg[key]['amount'] += acc['amount']
                else:
                    agg[key] = acc.copy()
            return sorted(agg.values(), key=lambda x: x['code'])
        
        income_agg = aggregate_accounts(income_accounts)
        expense_agg = aggregate_accounts(expense_accounts)
        
        net_profit = income_total - expense_total
        is_profit = net_profit >= 0
        
        return Response({
            'success': True,
            'period': {'start_date': start_date, 'end_date': end_date},
            'income': {
                'total': income_total,
                'accounts': income_agg,
            },
            'expenses': {
                'total': expense_total,
                'accounts': expense_agg,
            },
            'net_profit': net_profit,
            'is_profit': is_profit,
        })

    
    
    
    @action(detail=False, methods=['get'])
    def balance_sheet(self, request):
        """
        Generate Balance Sheet as of a specific date.
        Assets = Liabilities + Equity
        """
        as_of_date = request.query_params.get('as_of_date')
        
        if not as_of_date:
            return Response(
                {"success": False, "error": "as_of_date is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Get all journal lines up to the as_of_date
        lines = JournalLine.objects.filter(
            journal_entry__is_posted=True,
            journal_entry__date__lte=as_of_date,
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        ).select_related('account')
        
        # Calculate balance for each account
        balances = {}
        for line in lines:
            account = line.account
            if account.account_type not in ['ASSET', 'LIABILITY', 'EQUITY']:
                continue  # Only include balance sheet accounts
            
            balance = line.debit - line.credit
            if account.id not in balances:
                balances[account.id] = {
                    'code': account.code,
                    'name': account.name,
                    'account_type': account.account_type,
                    'balance': Decimal('0.00')
                }
            balances[account.id]['balance'] += balance
        
        # Separate into sections
        assets = []
        liabilities = []
        equity = []
        
        for acc in balances.values():
            item = {
                'code': acc['code'],
                'name': acc['name'],
                'balance': acc['balance']
            }
            if acc['account_type'] == 'ASSET':
                assets.append(item)
            elif acc['account_type'] == 'LIABILITY':
                liabilities.append(item)
            elif acc['account_type'] == 'EQUITY':
                equity.append(item)
        
        # Sort by code
        assets.sort(key=lambda x: x['code'])
        liabilities.sort(key=lambda x: x['code'])
        equity.sort(key=lambda x: x['code'])
        
        # Calculate totals
        total_assets = sum(a['balance'] for a in assets)
        total_liabilities = sum(l['balance'] for l in liabilities)
        total_equity = sum(e['balance'] for e in equity)
        
        return Response({
            'success': True,
            'as_of_date': as_of_date,
            'assets': {
                'accounts': assets,
                'total': total_assets
            },
            'liabilities': {
                'accounts': liabilities,
                'total': total_liabilities
            },
            'equity': {
                'accounts': equity,
                'total': total_equity
            },
            'is_balanced': total_assets == (total_liabilities + total_equity)
        })
    

    @action(detail=False, methods=['get'])
    def ar_aging(self, request):
        """Accounts Receivable aging report"""
        from apps.finance.models import CustomerInvoice
        today = timezone.now().date()
        invoices = CustomerInvoice.objects.filter(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            status__in=['POSTED', 'PARTIAL']
        ).select_related('customer')
        aging = {'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0}
        details = []
        for inv in invoices:
            outstanding = inv.outstanding
            if outstanding <= 0:
                continue
            days = (today - inv.due_date).days
            if days <= 0:
                aging['current'] += outstanding
                bucket = 'current'
            elif days <= 30:
                aging['1_30'] += outstanding
                bucket = '1-30 days'
            elif days <= 60:
                aging['31_60'] += outstanding
                bucket = '31-60 days'
            elif days <= 90:
                aging['61_90'] += outstanding
                bucket = '61-90 days'
            else:
                aging['90_plus'] += outstanding
                bucket = '90+ days'
            details.append({
                'invoice_number': inv.invoice_number,
                'customer': inv.customer.name,
                'due_date': inv.due_date,
                'outstanding': outstanding,
                'bucket': bucket,
            })
        return Response({'aging': aging, 'details': details})

    @action(detail=False, methods=['get'])
    def ap_aging(self, request):
        """Accounts Payable aging report"""
        from apps.finance.models import SupplierBill
        today = timezone.now().date()
        bills = SupplierBill.objects.filter(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            status__in=['POSTED', 'PARTIAL']
        ).select_related('supplier')
        aging = {'current': 0, '1_30': 0, '31_60': 0, '61_90': 0, '90_plus': 0}
        details = []
        for bill in bills:
            outstanding = bill.outstanding
            if outstanding <= 0:
                continue
            days = (today - bill.due_date).days
            if days <= 0:
                aging['current'] += outstanding
                bucket = 'current'
            elif days <= 30:
                aging['1_30'] += outstanding
                bucket = '1-30 days'
            elif days <= 60:
                aging['31_60'] += outstanding
                bucket = '31-60 days'
            elif days <= 90:
                aging['61_90'] += outstanding
                bucket = '61-90 days'
            else:
                aging['90_plus'] += outstanding
                bucket = '90+ days'
            details.append({
                'bill_number': bill.bill_number,
                'supplier': bill.supplier.name,
                'due_date': bill.due_date,
                'outstanding': outstanding,
                'bucket': bucket,
            })
        return Response({'aging': aging, 'details': details})

    @action(detail=False, methods=['get'])
    def expense_report(self, request):
        """Expense breakdown by category and department"""
        from apps.finance.models import Expense
        from django.db.models import Sum
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')
        qs = Expense.objects.filter(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        )
        if start_date:
            qs = qs.filter(expense_date__gte=start_date)
        if end_date:
            qs = qs.filter(expense_date__lte=end_date)
        by_category = qs.values('category').annotate(total=Sum('amount')).order_by('-total')
        return Response({'by_category': list(by_category)})
