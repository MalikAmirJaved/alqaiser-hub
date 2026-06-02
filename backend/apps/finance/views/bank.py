from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import BankAccount, BankTransaction, Payment
from apps.finance.serializers import BankAccountSerializer, BankTransactionSerializer
from apps.finance.mixins import CompanyBranchUserMixin

class BankAccountViewSet(CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = BankAccount.objects.all()
    serializer_class = BankAccountSerializer
    permission_module = 'FINANCE'
    permission_resource = 'bankaccount'

class BankTransactionViewSet(CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = BankTransaction.objects.all()
    serializer_class = BankTransactionSerializer
    permission_module = 'FINANCE'
    permission_resource = 'banktransaction'

    @action(detail=True, methods=['post'])
    def reconcile(self, request, pk=None):
        bank_txn = self.get_object()
        payment_id = request.data.get('payment_id')
        if not payment_id:
            return Response({'error': 'payment_id required'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            payment = Payment.objects.get(id=payment_id, company_id=bank_txn.company_id, branch_id=bank_txn.branch_id)
        except Payment.DoesNotExist:
            return Response({'error': 'Payment not found'}, status=status.HTTP_404_NOT_FOUND)
        bank_txn.reconciled = True
        bank_txn.reconciled_with_payment = payment
        bank_txn.save()
        return Response({'status': 'reconciled'})