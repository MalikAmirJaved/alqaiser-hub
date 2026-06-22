from decimal import Decimal

from django.db.models import Sum, Q
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.models import Account, BankAccount, CustomerInvoice, Expense, JournalLine, Payment, SupplierBill
from apps.finance.serializers import AccountSerializer, JournalLineSerializer
from apps.finance.services.payable import get_outstanding
from apps.hr.models import Asset
from apps.permissions.mixins import PermissionRequiredMixin


class AccountViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = Account.objects.all()
    serializer_class = AccountSerializer
    permission_module = 'FINANCE'
    permission_resource = 'account'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Account created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Account updated successfully",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save()
        return Response(
            {
                "success": True,
                "message": f"Account '{instance.code} - {instance.name}' deleted successfully"
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def balances(self, request):
        """
        Return the computed live balance for each account by mapping account
        codes to their actual transactional data sources.

        Supports optional query params:
          ?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD

        Mapping:
          AP               → SupplierBill (unpaid / outstanding)
          AR               → CustomerInvoice (unpaid / outstanding)
          INVENTORY        → HR Asset (purchase_price × available_quantity)
          SALES            → Confirmed RECEIPT payments
          COGS             → Expenses with category 'COGS'
          RENT             → Expenses with category 'RENT'
          SALARIES         → Expenses with category 'SALARIES'
          OTHER_EXPENSES   → Expenses with all OTHER categories combined
          CASH / BANK      → BankAccount book_balance
          EQUITY           → Journal-line credit – debit
        """
        company_id = request.user.company_id
        branch_id = request.user.branch_id

        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        accounts = self.get_queryset()
        mapping = {}

        # Build date filter Q objects for reuse
        date_filter = Q()
        if start_date:
            date_filter &= Q(expense_date__gte=start_date)
        if end_date:
            date_filter &= Q(expense_date__lte=end_date)

        payment_date_filter = Q()
        if start_date:
            payment_date_filter &= Q(payment_date__gte=start_date)
        if end_date:
            payment_date_filter &= Q(payment_date__lte=end_date)

        # Pre-fetch often-used querysets with the same filters
        invoices_qs = CustomerInvoice.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).exclude(status='CANCELLED')
        bills_qs = SupplierBill.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        ).exclude(status='CANCELLED')
        expenses_qs = Expense.objects.filter(
            company_id=company_id, branch_id=branch_id, is_deleted=False
        )
        if start_date or end_date:
            expenses_qs = expenses_qs.filter(date_filter)
            bills_qs = bills_qs.filter(
                Q(bill_date__gte=start_date) if start_date else Q(),
                Q(bill_date__lte=end_date) if end_date else Q(),
            )
            invoices_qs = invoices_qs.filter(
                Q(invoice_date__gte=start_date) if start_date else Q(),
                Q(invoice_date__lte=end_date) if end_date else Q(),
            )

        payments_qs = Payment.objects.filter(
            company_id=company_id, branch_id=branch_id,
            status='CONFIRMED', is_deleted=False,
        )
        if start_date or end_date:
            payments_qs = payments_qs.filter(payment_date_filter)

        for account in accounts:
            code = account.code
            balance = Decimal('0.00')

            # --- Specific live-data mappings ---
            if code == 'AR':
                # Accounts Receivable = unpaid invoices
                balance = sum(get_outstanding(inv) for inv in invoices_qs)

            elif code == 'AP':
                # Accounts Payable = unpaid supplier bills
                balance = sum(get_outstanding(bill) for bill in bills_qs)

            elif code == 'INVENTORY':
                # Inventory Asset = HR office inventory value
                assets = Asset.objects.filter(
                    company_id=company_id, is_deleted=False
                )
                balance = sum(
                    (asset.purchase_price or Decimal('0.00')) * asset.available_quantity
                    for asset in assets
                )

            elif code == 'SALES':
                # Sales Revenue = confirmed RECEIPT payments (paid invoices)
                balance = payments_qs.filter(
                    payment_type='RECEIPT',
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            elif code == 'RENT':
                # Rent Expense = expenses with RENT category
                balance = expenses_qs.filter(
                    category='RENT'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            elif code == 'SALARIES':
                # Salaries Expense = expenses with SALARIES category
                balance = expenses_qs.filter(
                    category='SALARIES'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            elif code in ('OTHER_EXPENSES', 'OTHER_EXPENSE'):
                # Other Expenses = all expense categories except RENT & SALARIES
                balance = expenses_qs.exclude(
                    category__in=['RENT', 'SALARIES']
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')

            elif code == 'COGS':
                # Cost of Goods Sold = expenses with COGS category (or journal lines)
                balance = expenses_qs.filter(
                    category='COGS'
                ).aggregate(total=Sum('amount'))['total'] or Decimal('0.00')
                if balance == Decimal('0.00'):
                    lines = JournalLine.objects.filter(
                        account=account,
                        journal_entry__is_posted=True,
                        company_id=company_id,
                        branch_id=branch_id,
                    )
                    total_debit = lines.aggregate(total=Sum('debit'))['total'] or Decimal('0.00')
                    total_credit = lines.aggregate(total=Sum('credit'))['total'] or Decimal('0.00')
                    balance = total_debit - total_credit

            elif code in ('CASH', 'BANK'):
                # Cash / Bank = all active BankAccount book balances
                balance = BankAccount.objects.filter(
                    company_id=company_id, branch_id=branch_id,
                    is_active=True, is_deleted=False,
                ).aggregate(total=Sum('book_balance'))['total'] or Decimal('0.00')

            elif code == 'EQUITY':
                # Owner's Equity = net credit balance from journal lines
                lines = JournalLine.objects.filter(
                    account=account,
                    journal_entry__is_posted=True,
                    company_id=company_id,
                    branch_id=branch_id,
                )
                total_debit = lines.aggregate(total=Sum('debit'))['total'] or Decimal('0.00')
                total_credit = lines.aggregate(total=Sum('credit'))['total'] or Decimal('0.00')
                balance = total_credit - total_debit

            else:
                # Fallback: derive from posted journal lines
                lines = JournalLine.objects.filter(
                    account=account,
                    journal_entry__is_posted=True,
                    company_id=company_id,
                    branch_id=branch_id,
                )
                total_debit = lines.aggregate(total=Sum('debit'))['total'] or Decimal('0.00')
                total_credit = lines.aggregate(total=Sum('credit'))['total'] or Decimal('0.00')

                if account.account_type in ('ASSET', 'EXPENSE'):
                    balance = total_debit - total_credit
                elif account.account_type in ('LIABILITY', 'EQUITY', 'INCOME'):
                    balance = total_credit - total_debit

            mapping[code] = {
                'code': code,
                'name': account.name,
                'account_type': account.account_type,
                'balance': str(balance),
            }

        return Response({
            'success': True,
            'data': mapping,
        })

    @action(detail=False, methods=['get'])
    def balances_by_type(self, request):
        """Return total balance per account type (ASSET, LIABILITY, EQUITY, INCOME, EXPENSE)"""
        as_of_date = request.query_params.get('as_of_date')
        
        lines = JournalLine.objects.filter(
            journal_entry__is_posted=True,
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        ).select_related('account')
        
        if as_of_date:
            lines = lines.filter(journal_entry__date__lte=as_of_date)
        
        # Group by account_type
        balances = {
            'ASSET': 0,
            'LIABILITY': 0,
            'EQUITY': 0,
            'INCOME': 0,
            'EXPENSE': 0,
        }
        
        for line in lines:
            acc_type = line.account.account_type
            balance = line.debit - line.credit
            if acc_type in balances:
                balances[acc_type] += balance
        
        return Response({
            'success': True,
            'data': balances
        })

    @action(detail=True, methods=['get'])
    def ledger(self, request, _id=None):
        """Return journal entries for this account (paginated)"""
        account = self.get_object()
        
        lines = JournalLine.objects.filter(
            account=account,
            journal_entry__is_posted=True,
            company_id=request.user.company_id,
            branch_id=request.user.branch_id
        ).select_related('journal_entry').order_by('-journal_entry__date')
        
        # Get pagination params
        page_size = int(request.query_params.get('page_size', 20))
        page = int(request.query_params.get('page', 1))
        
        # Simple pagination (since DRF pagination might not be set up)
        start = (page - 1) * page_size
        end = start + page_size
        total = lines.count()
        paginated_lines = lines[start:end]
        
        # Serialize the lines with additional context
        serializer = JournalLineSerializer(paginated_lines, many=True)
        
        return Response({
            'success': True,
            'data': serializer.data,
            'pagination': {
                'total': total,
                'page': page,
                'page_size': page_size,
                'total_pages': (total + page_size - 1) // page_size,
            }
        })

    @action(detail=False, methods=['get'])
    def tree(self, request):
        """Return accounts as hierarchical tree structure"""
        accounts = self.get_queryset().order_by('code')
        
        # Build map of accounts by id
        account_map = {}
        for account in accounts:
            account_map[str(account._id)] = {
                'id': str(account._id),
                'code': account.code,
                'name': account.name,
                'account_type': account.account_type,
                'is_active': account.is_active,
                'description': account.description,
                'parent_uuid': str(account.parent._id) if account.parent else None,
                'children': []
            }
        
        # Build tree
        roots = []
        for acc_id, acc in account_map.items():
            parent_id = acc['parent_uuid']
            if parent_id and parent_id in account_map:
                account_map[parent_id]['children'].append(acc)
            else:
                roots.append(acc)
        
        # Sort children by code
        def sort_children(node):
            node['children'].sort(key=lambda x: x['code'])
            for child in node['children']:
                sort_children(child)
        
        roots.sort(key=lambda x: x['code'])
        for root in roots:
            sort_children(root)
        
        return Response({
            'success': True,
            'data': roots
        })
