from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db import transaction
from django.core.exceptions import ObjectDoesNotExist
from decimal import Decimal
from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.finance.models import SupplierBill, JournalEntry, JournalLine, Account
from apps.finance.serializers import SupplierBillSerializer
from apps.finance.mixins import CompanyBranchUserMixin, SoftDeleteMixin


class SupplierBillViewSet(
    CompanyBranchUserMixin,
    CompanyBranchMixin,
    PermissionRequiredMixin,
    SoftDeleteMixin,
    viewsets.ModelViewSet
):
    queryset = SupplierBill.objects.all()
    serializer_class = SupplierBillSerializer
    permission_module = 'FINANCE'
    permission_resource = 'supplierbill'

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Supplier bill created successfully",
                "data": serializer.data
            },
            status=status.HTTP_201_CREATED
        )

    def update(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status != 'DRAFT':
            return Response(
                {
                    "success": False,
                    "error": "Cannot update bill that is already posted, paid, or cancelled",
                    "detail": f"Bill status is '{instance.status}'. Only DRAFT bills can be updated."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        partial = kwargs.pop('partial', False)
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Supplier bill updated successfully",
                "data": serializer.data
            },
            status=status.HTTP_200_OK
        )

    @action(detail=True, methods=['post'])
    def post_bill(self, request, pk=None):
        bill = self.get_object()
        
        if bill.status != 'DRAFT':
            return Response(
                {
                    "success": False,
                    "error": "Bill already processed",
                    "detail": f"Cannot post bill with status '{bill.status}'. Only DRAFT bills can be posted."
                },
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            with transaction.atomic():
                # Get accounts
                try:
                    inventory_asset = Account.objects.get(
                        code='INVENTORY',
                        company_id=bill.company_id,
                        branch_id=bill.branch_id,
                        is_deleted=False
                    )
                    accounts_payable = Account.objects.get(
                        code='AP',
                        company_id=bill.company_id,
                        branch_id=bill.branch_id,
                        is_deleted=False
                    )
                except ObjectDoesNotExist as e:
                    return Response(
                        {
                            "success": False,
                            "error": "Required accounts not found",
                            "detail": f"Missing account: {str(e)}. Please ensure INVENTORY and AP accounts exist."
                        },
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # Create journal entry
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
                
                # Create journal lines
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
                
                # Update bill
                bill.status = 'POSTED'
                bill.journal_entry = entry
                bill.save()
                
                return Response(
                    {
                        "success": True,
                        "message": f"Supplier bill '{bill.bill_number}' posted successfully",
                        "data": self.get_serializer(bill).data
                    },
                    status=status.HTTP_200_OK
                )
        except Exception as e:
            return Response(
                {
                    "success": False,
                    "error": "Failed to post bill",
                    "detail": str(e)
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )