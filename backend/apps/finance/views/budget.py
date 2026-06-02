from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Sum
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Budget, Account, JournalLine
from apps.finance.serializers import BudgetSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin

class BudgetViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = Budget.objects.all()
    serializer_class = BudgetSerializer
    permission_module = 'FINANCE'
    permission_resource = 'budget'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def get_queryset(self):
        qs = super().get_queryset()
        account_id = self.request.query_params.get('account_id')
        year = self.request.query_params.get('year')
        period_type = self.request.query_params.get('period_type')
        if account_id:
            qs = qs.filter(account_id=account_id)
        if year:
            qs = qs.filter(year=year)
        if period_type:
            qs = qs.filter(period_type=period_type)
        return qs

    def create(self, request, *args, **kwargs):
        # Validate that account exists and is EXPENSE or INCOME type
        account_uuid = request.data.get('account')
        if not account_uuid:
            return Response(
                {
                    "success": False,
                    "error": "Account is required",
                    "detail": "Please select an account for the budget"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            account = Account.objects.get(_id=account_uuid)
            if account.account_type not in ['EXPENSE', 'INCOME']:
                return Response(
                    {
                        "success": False,
                        "error": "Invalid account type",
                        "detail": f"Account '{account.name}' is of type '{account.account_type}'. Budgets can only be set for EXPENSE or INCOME accounts."
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )
        except Account.DoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Account not found",
                    "detail": f"No account found with id {account_uuid}"
                },
                status=status.HTTP_404_NOT_FOUND
            )
        
        # Validate unique constraint
        period_type = request.data.get('period_type')
        year = request.data.get('year')
        month = request.data.get('month')
        quarter = request.data.get('quarter')
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        existing = Budget.objects.filter(
            account=account,
            period_type=period_type,
            year=year,
            company_id=company_id,
            branch_id=branch_id
        )
        if period_type == 'MONTHLY' and month:
            existing = existing.filter(month=month)
        elif period_type == 'QUARTERLY' and quarter:
            existing = existing.filter(quarter=quarter)
        
        if existing.exists():
            return Response(
                {
                    "success": False,
                    "error": "Budget already exists",
                    "detail": f"A budget for '{account.name}' already exists for {period_type} period in {year}."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Budget created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        
        # Validate account if being updated
        account_uuid = request.data.get('account')
        if account_uuid:
            try:
                account = Account.objects.get(_id=account_uuid)
                if account.account_type not in ['EXPENSE', 'INCOME']:
                    return Response(
                        {
                            "success": False,
                            "error": "Invalid account type",
                            "detail": f"Account '{account.name}' is of type '{account.account_type}'. Budgets can only be set for EXPENSE or INCOME accounts."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )
            except Account.DoesNotExist:
                return Response(
                    {
                        "success": False,
                        "error": "Account not found",
                        "detail": f"No account found with id {account_uuid}"
                    },
                    status=status.HTTP_404_NOT_FOUND
                )
        
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Budget updated successfully",
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
                "message": f"Budget for '{instance.account.name}' deleted successfully"
            },
            status=status.HTTP_200_OK
        )

    @action(detail=False, methods=['get'])
    def variance_report(self, request):
        """Compare actuals vs budget for a given year and period type"""
        year = request.query_params.get('year')
        period_type = request.query_params.get('period_type', 'MONTHLY')
        
        if not year:
            return Response(
                {
                    "success": False,
                    "error": "Missing parameter",
                    "detail": "year is required for variance report"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            year = int(year)
        except ValueError:
            return Response(
                {
                    "success": False,
                    "error": "Invalid year",
                    "detail": "Year must be a valid number"
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        budgets = Budget.objects.filter(
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            year=year,
            period_type=period_type,
            is_deleted=False
        ).select_related('account')

        if not budgets.exists():
            return Response(
                {
                    "success": True,
                    "message": "No budgets found for the specified criteria",
                    "data": []
                },
                status=status.HTTP_200_OK
            )

        # Get actuals from journal lines
        actuals_by_account = {}
        lines = JournalLine.objects.filter(
            journal_entry__is_posted=True,
            journal_entry__date__year=year,
            company_id=request.user.company_id,
            branch_id=request.user.branch_id,
            account__account_type__in=['EXPENSE', 'INCOME']
        ).select_related('account')

        for line in lines:
            account = line.account
            period_key = None
            if period_type == 'MONTHLY':
                period_key = line.journal_entry.date.month
            elif period_type == 'QUARTERLY':
                quarter = (line.journal_entry.date.month - 1) // 3 + 1
                period_key = quarter
            else:
                period_key = year
            key = (account.id, period_key)
            # For income accounts, credit increases balance; for expense, debit increases
            if account.account_type == 'INCOME':
                actuals_by_account[key] = actuals_by_account.get(key, Decimal('0.00')) + line.credit
            else:
                actuals_by_account[key] = actuals_by_account.get(key, Decimal('0.00')) + line.debit
        
        result = []
        for budget in budgets:
            period_key = None
            if period_type == 'MONTHLY':
                period_key = budget.month
            elif period_type == 'QUARTERLY':
                period_key = budget.quarter
            else:
                period_key = year
            actual = actuals_by_account.get((budget.account.id, period_key), Decimal('0.00'))
            variance = actual - budget.amount
            result.append({
                'budget_id': budget._id,
                'account_id': budget.account.id,
                'account_code': budget.account.code,
                'account_name': budget.account.name,
                'period': period_key,
                'budget_amount': budget.amount,
                'actual_amount': actual,
                'variance': variance,
                'variance_percent': float(variance / budget.amount * 100) if budget.amount != 0 else 0,
            })
        
        return Response(
            {
                "success": True,
                "message": "Variance report generated successfully",
                "data": result,
                "summary": {
                    "total_budget": sum(r['budget_amount'] for r in result),
                    "total_actual": sum(r['actual_amount'] for r in result),
                    "total_variance": sum(r['variance'] for r in result)
                }
            },
            status=status.HTTP_200_OK
        )