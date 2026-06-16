from decimal import Decimal
from datetime import timedelta

from django.db import transaction
from rest_framework import viewsets, status, serializers as rest_serializers
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin
from apps.finance.models import Expense, SupplierBill, BankAccount
from apps.finance.serializers import ExpenseSerializer
from apps.finance.services.payable import create_payment_for
from apps.finance.services.invoice_payment import pay_supplier_bill
from apps.permissions.mixins import PermissionRequiredMixin

import logging
logger = logging.getLogger(__name__)


class ExpenseViewSet(
    GenericFilterMixin,
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
    filter_fields = {
        'search': ['expense_number', 'description', 'notes'],
        'category': 'category',
        'paid': 'is_paid',
        'start_date': 'expense_date__gte',
        'end_date': 'expense_date__lte',
    }

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        # Extract extra fields that are not part of the Expense model
        validated_data = serializer.validated_data
        pay_immediately = validated_data.pop('pay_immediately', False)
        supplier = validated_data.pop('supplier', None)   # Supplier instance or None

        # Create the expense (supplier FK will be set automatically by the serializer)
        expense = serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
            supplier=supplier,          # ✅ Pass the Supplier instance (not UUID string)
        )

        # If a supplier was selected, create a linked SupplierBill
        if supplier:
            bill_number = f"BILL-MANUAL-{expense.expense_number}"
            due_date = expense.expense_date + timedelta(days=30)

            supplier_bill = SupplierBill.objects.create(
                bill_number=bill_number,
                supplier=supplier,
                purchase_order=None,
                bill_date=expense.expense_date,
                due_date=due_date,
                amount=expense.amount,
                status='DRAFT',
                company_id=expense.company_id,
                branch_id=expense.branch_id,
                created_by=request.user,
                updated_by=request.user,
                notes=f"Auto-created from manual expense {expense.expense_number}"
            )

            # Link the expense to this bill
            expense.supplier_bill = supplier_bill
            expense.save(update_fields=['supplier_bill'])

            logger.info(
                f"Created supplier bill {supplier_bill.bill_number} (ID: {supplier_bill._id}) "
                f"for manual expense {expense.expense_number}"
            )

            # Pay immediately if requested
            if pay_immediately:
                success, message = pay_supplier_bill(supplier_bill, request)
                if not success:
                    raise rest_serializers.ValidationError(f"Payment failed: {message}")
                logger.info(f"Paid supplier bill {supplier_bill.bill_number} immediately")

        return Response(
            {
                'success': True,
                'message': 'Expense created successfully',
                'data': self.get_serializer(expense).data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        # Prevent editing if already linked to a supplier bill
        if instance.supplier_bill_id:
            return Response(
                {'success': False, 'error': 'Cannot edit expense linked to a supplier bill'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        return Response(
            {
                'success': True,
                'message': 'Expense updated successfully',
                'data': serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        expense = self.get_object()
        if expense.payment_status == 'PAID':
            return Response(
                {'success': False, 'error': 'Expense already paid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # If expense is linked to a supplier bill, paying the bill is the only way
        if expense.supplier_bill_id:
            return Response(
                {'success': False, 'error': 'This expense is linked to a supplier bill. Pay the bill instead.'},
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
        """Record a direct payment for a manual expense (no linked bill)."""
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