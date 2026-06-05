from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import Expense, JournalEntry, JournalLine, Account, BankAccount, BankTransaction
from apps.finance.serializers import ExpenseSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin


def process_expense_deduction(expense, user):
    if not expense.paid:
        return
        
    if expense.bank_account:
        # Deduct book balance
        bank_account = expense.bank_account
        bank_account.book_balance -= expense.amount
        bank_account.save(update_fields=['book_balance'])
        
        # Create bank transaction
        BankTransaction.objects.create(
            company_id=expense.company_id,
            branch_id=expense.branch_id,
            bank_account=bank_account,
            transaction_date=expense.payment_date or expense.expense_date,
            amount=expense.amount,
            transaction_type='WITHDRAWAL',
            description=f"Expense Payment - {expense.expense_number} - {expense.category}",
            reference=expense.reference_number or '',
            reconciled=False,
            created_by=user,
            updated_by=user,
        )


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

    @transaction.atomic
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        with transaction.atomic():
            expense = serializer.save(
                company_id=self.request.user.company_id,
                branch_id=self.request.user.branch_id,
                created_by=self.request.user
            )
            
            # If created as paid, create JE and deduct bank account
            if expense.paid:
                # 1. Create JE
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
                cash_bank = Account.objects.get(
                    code='CASH',
                    company_id=expense.company_id,
                    branch_id=expense.branch_id,
                    is_deleted=False
                )
                entry = JournalEntry.objects.create(
                    entry_number=f"JE-EXP-{expense.expense_number}",
                    date=expense.payment_date or expense.expense_date,
                    description=f"Expense: {expense.category} - {expense.description[:50]}",
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
                expense.journal_entry = entry
                expense.save(update_fields=['journal_entry'])
                
                # 2. Deduct from bank account
                process_expense_deduction(expense, request.user)
                
        return Response(
            {
                "success": True,
                "message": "Expense created successfully",
                "data": self.get_serializer(expense).data
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
        bank_account_uuid = request.data.get('bank_account_id')

        with transaction.atomic():
            # If bank_account_id is provided, look it up and set it
            if bank_account_uuid:
                try:
                    bank_account = BankAccount.objects.get(_id=bank_account_uuid, company_id=expense.company_id)
                    expense.bank_account = bank_account
                except BankAccount.DoesNotExist:
                    return Response(
                        {"success": False, "error": "Bank account not found"},
                        status=status.HTTP_400_BAD_REQUEST
                    )

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
            
            # Deduct bank account
            process_expense_deduction(expense, request.user)

        return Response(
            {
                "success": True,
                "message": "Expense payment recorded",
                "data": self.get_serializer(expense).data
            },
            status=status.HTTP_200_OK
        )