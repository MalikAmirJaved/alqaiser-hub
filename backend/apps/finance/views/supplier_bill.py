from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import SupplierBill, JournalEntry, JournalLine, Account
from apps.finance.serializers import SupplierBillSerializer
from apps.finance.mixins import CompanyBranchUserMixin

class SupplierBillViewSet(CompanyBranchUserMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    queryset = SupplierBill.objects.all()
    serializer_class = SupplierBillSerializer
    permission_module = 'FINANCE'
    permission_resource = 'supplierbill'

    @action(detail=True, methods=['post'])
    def post_bill(self, request, pk=None):
        bill = self.get_object()
        if bill.status != 'DRAFT':
            return Response({'error': 'Bill already posted'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            inventory_asset = Account.objects.get(code='INVENTORY', company_id=bill.company_id, branch_id=bill.branch_id)
            accounts_payable = Account.objects.get(code='AP', company_id=bill.company_id, branch_id=bill.branch_id)

            entry = JournalEntry.objects.create(
                entry_number=f"JE-BILL-{bill.bill_number}",
                date=bill.bill_date,
                description=f"Supplier bill {bill.bill_number} from {bill.supplier.name}",
                reference_type='SupplierBill',
                reference_id=bill._id,
                company_id=bill.company_id,
                branch_id=bill.branch_id,
                created_by=request.user,
                is_posted=True
            )
            JournalLine.objects.create(
                journal_entry=entry,
                account=inventory_asset,
                debit=bill.amount,
                credit=Decimal('0.00'),
                company_id=bill.company_id,
                branch_id=bill.branch_id
            )
            JournalLine.objects.create(
                journal_entry=entry,
                account=accounts_payable,
                debit=Decimal('0.00'),
                credit=bill.amount,
                company_id=bill.company_id,
                branch_id=bill.branch_id
            )
            bill.status = 'POSTED'
            bill.journal_entry = entry
            bill.save()
        return Response(self.get_serializer(bill).data)