from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Expense, JournalEntry, JournalLine, Account
from apps.finance.serializers import ExpenseSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin

class ExpenseViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = Expense.objects.all()
    serializer_class = ExpenseSerializer
    permission_module = 'FINANCE'
    permission_resource = 'expense'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Expense created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        expense = self.get_object()
        if expense.paid:
            return Response(
                {"success": False, "error": "Expense already paid"},
                status=status.HTTP_400_BAD_REQUEST
            )

        payment_date = request.data.get('payment_date')
        payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
        reference_number = request.data.get('reference_number', '')

        with transaction.atomic():
            # Get or create a general expense account
            expense_account, _ = Account.objects.get_or_create(
                code='EXPENSE',
                company_id=expense.company_id,
                branch_id=expense.branch_id,
                defaults={
                    'name': 'General Expenses',
                    'account_type': 'EXPENSE',
                    'is_active': True
                }
            )
            # Cash/Bank account (must exist from seed)
            cash_bank = Account.objects.get(
                code='CASH',
                company_id=expense.company_id,
                branch_id=expense.branch_id,
                is_deleted=False
            )

            # Create journal entry
            entry = JournalEntry.objects.create(
                entry_number=f"JE-EXP-{expense.expense_number}",
                date=payment_date or expense.expense_date,
                description=f"Expense payment: {expense.category} - {expense.description[:50]}",
                reference_type='Expense',
                reference_id=expense._id,
                company_id=expense.company_id,
                branch_id=expense.branch_id,
                created_by=request.user,
                is_posted=True
            )
            JournalLine.objects.create(
                journal_entry=entry,
                account=expense_account,
                debit=expense.amount,
                credit=Decimal('0.00'),
                company_id=expense.company_id,
                branch_id=expense.branch_id
            )
            JournalLine.objects.create(
                journal_entry=entry,
                account=cash_bank,
                debit=Decimal('0.00'),
                credit=expense.amount,
                company_id=expense.company_id,
                branch_id=expense.branch_id
            )

            expense.paid = True
            expense.payment_date = payment_date or expense.expense_date
            expense.payment_method = payment_method
            expense.reference_number = reference_number
            expense.journal_entry = entry
            expense.save()

        return Response(
            {
                "success": True,
                "message": "Expense payment recorded",
                "data": self.get_serializer(expense).data
            },
            status=status.HTTP_200_OK
        )