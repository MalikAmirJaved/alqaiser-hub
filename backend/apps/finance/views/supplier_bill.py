# ============================================================
# File: backend/apps/finance/views/supplier_bill.py
# ============================================================
from rest_framework import viewsets, status, serializers
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
from apps.finance.services.payable import create_payment_for


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
    permission_resource = 'supplier_bill'
    lookup_field = '_id'
    lookup_url_kwarg = '_id'
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
                    "error": "Cannot update bill that is already posted or cancelled",
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
    def post_bill(self, request, _id=None):
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
                    
                    bill.status = 'POSTED'
                    bill.journal_entry = entry
                    bill.save(update_fields=['status', 'journal_entry'])

                    bank_account = None
                    bank_account_uuid = request.data.get('bank_account_id')
                    payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
                    pay_amount = Decimal(str(request.data.get('amount', bill.amount)))
                    from apps.finance.models import BankAccount
                    if bank_account_uuid:
                        try:
                            bank_account = BankAccount.objects.get(
                                _id=bank_account_uuid,
                                company_id=bill.company_id,
                            )
                        except BankAccount.DoesNotExist:
                            pass
                    if not bank_account:
                        bank_account = BankAccount.objects.filter(
                            company_id=bill.company_id,
                            is_active=True,
                        ).first()

                    if pay_amount > 0:
                        create_payment_for(
                            bill,
                            amount=pay_amount,
                            payment_date=bill.bill_date,
                            payment_method=payment_method,
                            bank_account=bank_account,
                            user=request.user,
                            auto_confirm=True,
                        )
                    
                    return Response(
                        {
                            "success": True,
                            "message": f"Supplier bill '{bill.bill_number}' posted and paid successfully",
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

    @action(detail=True, methods=['post'])
    def record_payment(self, request, _id=None):
        bill = self.get_object()
        if bill.status != 'POSTED':
            return Response(
                {
                    'success': False,
                    'error': f"Cannot record payment for bill with status '{bill.status}'",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        if bill.payment_status == 'PAID':
            return Response(
                {'success': False, 'error': 'Bill is already fully paid'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = Decimal(str(request.data.get('amount', bill.outstanding)))
        if amount <= 0:
            return Response(
                {'success': False, 'error': 'Payment amount must be positive'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if amount > bill.outstanding:
            return Response(
                {
                    'success': False,
                    'error': f'Amount {amount} exceeds outstanding {bill.outstanding}',
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        bank_account = None
        bank_account_uuid = request.data.get('bank_account_id')
        payment_method = request.data.get('payment_method', 'BANK_TRANSFER')
        from apps.finance.models import BankAccount
        if bank_account_uuid:
            try:
                bank_account = BankAccount.objects.get(
                    _id=bank_account_uuid,
                    company_id=bill.company_id,
                )
            except BankAccount.DoesNotExist:
                return Response(
                    {'success': False, 'error': 'Bank account not found'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        try:
            create_payment_for(
                bill,
                amount=amount,
                payment_date=bill.bill_date,
                payment_method=payment_method,
                bank_account=bank_account,
                user=request.user,
                auto_confirm=True,
            )
        except ValueError as exc:
            return Response(
                {'success': False, 'error': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        return Response(
            {
                'success': True,
                'message': 'Payment recorded and confirmed',
                'data': self.get_serializer(bill).data,
            },
            status=status.HTTP_200_OK,
        )
