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