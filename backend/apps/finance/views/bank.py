# apps/finance/views/bank.py
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.core.exceptions import ObjectDoesNotExist
from django.db import transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import BankAccount, BankTransaction, Payment
from apps.finance.serializers import BankAccountSerializer, BankTransactionSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin


class BankAccountViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_module = 'FINANCE'
    permission_resource = 'bankaccount'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Bank account created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )


class BankTransactionViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = BankTransaction.objects.all()
    serializer_class = BankTransactionSerializer
    permission_module = 'FINANCE'
    permission_resource = 'banktransaction'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    @action(detail=True, methods=['post'])
    def reconcile(self, request, _id=None):
        bank_txn = self.get_object()
        payment_id = request.data.get('payment_id')

        if not payment_id:
            return Response(
                {
                    "success": False,
                    "error": "Missing payment_id",
                    "detail": "payment_id is required to reconcile this transaction"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            payment = Payment.objects.get(
                _id=payment_id,
                company_id=bank_txn.company_id,
                branch_id=bank_txn.branch_id,
                is_deleted=False
            )
        except ObjectDoesNotExist:
            return Response(
                {
                    "success": False,
                    "error": "Payment not found",
                    "detail": f"No payment found with id {payment_id}"
                },
                status=status.HTTP_404_NOT_FOUND
            )

        if bank_txn.reconciled:
            return Response(
                {
                    "success": False,
                    "error": "Already reconciled",
                    "detail": "This bank transaction has already been reconciled"
                },
                status=status.HTTP_400_BAD_REQUEST
            )

        with transaction.atomic():
            # Update CLEARED balance based on transaction type
            bank_account = bank_txn.bank_account
            if bank_txn.transaction_type in ['DEPOSIT', 'INTEREST']:
                bank_account.cleared_balance += bank_txn.amount
            elif bank_txn.transaction_type in ['WITHDRAWAL', 'FEE']:
                bank_account.cleared_balance -= bank_txn.amount
            bank_account.save(update_fields=['cleared_balance'])

            # Mark transaction as reconciled
            bank_txn.reconciled = True
            bank_txn.reconciled_with_payment = payment
            bank_txn.save()

        return Response(
            {
                "success": True,
                "message": f"Bank transaction reconciled with payment {payment.id}",
                "data": self.get_serializer(bank_txn).data
            },
            status=status.HTTP_200_OK
        )