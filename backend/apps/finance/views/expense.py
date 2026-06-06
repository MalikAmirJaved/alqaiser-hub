from decimal import Decimal

from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from django.utils import timezone
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.models import Expense, BankAccount
from apps.finance.serializers import ExpenseSerializer
from apps.finance.services.payable import create_payment_for
from apps.permissions.mixins import PermissionRequiredMixin


class ExpenseViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet,
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

        pay_immediately = request.data.get('pay_immediately', request.data.get('paid', False))

        with transaction.atomic():
            expense = serializer.save(
                company_id=self.request.user.company_id,
                branch_id=self.request.user.branch_id,
                created_by=self.request.user,
            )

            if pay_immediately:
                self._record_expense_payment(
                    expense,
                    request,
                    payment_date=request.data.get('payment_date'),
                    payment_method=request.data.get('payment_method', 'BANK_TRANSFER'),
                    reference_number=request.data.get('reference_number', ''),
                    bank_account_uuid=request.data.get('bank_account_id'),
                )

        return Response(
            {
                'success': True,
                'message': 'Expense created successfully',
                'data': self.get_serializer(expense).data,
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        expense = self.get_object()
        if expense.payment_status == 'PAID':
            return Response(
                {'success': False, 'error': 'Expense already paid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            try:
                self._record_expense_payment(
                    expense,
                    request,
                    payment_date=request.data.get('payment_date'),
                    payment_method=request.data.get('payment_method', 'BANK_TRANSFER'),
                    reference_number=request.data.get('reference_number', ''),
                    bank_account_uuid=request.data.get('bank_account_id'),
                )
            except ValueError as exc:
                return Response(
                    {'success': False, 'error': str(exc)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        return Response(
            {
                'success': True,
                'message': 'Expense payment recorded',
                'data': self.get_serializer(expense).data,
            },
            status=status.HTTP_200_OK,
        )

    def _record_expense_payment(
        self,
        expense,
        request,
        *,
        payment_date=None,
        payment_method='BANK_TRANSFER',
        reference_number='',
        bank_account_uuid=None,
    ):
        bank_account = None
        if bank_account_uuid:
            try:
                bank_account = BankAccount.objects.get(
                    _id=bank_account_uuid,
                    company_id=expense.company_id,
                )
            except BankAccount.DoesNotExist:
                raise ValueError('Bank account not found')

        amount = expense.outstanding or expense.amount
        if amount <= 0:
            raise ValueError('Payment amount must be positive')

        create_payment_for(
            expense,
            amount=amount,
            payment_date=payment_date or expense.expense_date,
            payment_method=payment_method,
            reference_number=reference_number,
            bank_account=bank_account,
            user=request.user,
            auto_confirm=True,
        )
