from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum, Q
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Account, JournalLine
from apps.finance.serializers import AccountSerializer, JournalLineSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin


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