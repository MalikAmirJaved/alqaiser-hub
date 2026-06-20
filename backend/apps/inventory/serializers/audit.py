from rest_framework import serializers
from apps.inventory.models import AuditLog, AuditFieldChange
from apps.organization.models import User

class AuditFieldChangeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AuditFieldChange
        fields = ['id', 'field_name', 'old_value', 'new_value', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    field_changes = AuditFieldChangeSerializer(many=True, read_only=True)

    user_name = serializers.SerializerMethodField()
    user_email = serializers.SerializerMethodField()

    action_display = serializers.CharField(source='get_action_display', read_only=True)

    entity_name = serializers.SerializerMethodField()

    class Meta:
        model = AuditLog
        fields = [
            'id', 'user_id', 'user_name', 'user_email', 'action', 'action_display',
            'entity_type', 'entity_id', 'entity_name', 'source_module', 'reference_id',
            'ip_address', 'user_agent', 'company_id', 'branch_id',
            'field_changes', 'created_at', 'updated_at'
        ]

    def get_user_name(self, obj):
        if obj.user_id:
            try:
                user = User.objects.get(id=obj.user_id)
                return user.get_full_name() or user.username
            except User.DoesNotExist:
                return None
        return None

    def get_user_email(self, obj):
        if obj.user_id:
            try:
                return User.objects.get(id=obj.user_id).email
            except User.DoesNotExist:
                return None
        return None

    def get_entity_name(self, obj):
        entity_type = obj.entity_type
        entity_id = obj.entity_id
        if not entity_type or not entity_id:
            return None

        from apps.inventory.models import (
            Product, Category, Brand, Supplier, Customer, Warehouse,
            PurchaseOrder, SalesOrder, GoodsReceipt, SalesReturn,
            StockTransfer, Alert, ProductVariant, StockItem,
        )
        from apps.finance.models.account import Account
        from apps.finance.models.customer_invoice import CustomerInvoice
        from apps.finance.models.supplier_bill import SupplierBill
        from apps.finance.models.payment import Payment
        from apps.finance.models.journal import JournalEntry
        from apps.finance.models.expense import Expense
        from apps.finance.models.bank import BankAccount, BankTransaction
        from apps.finance.models.budget import Budget
        from apps.hr.models import Employee, EmployeeLoan, LeaveRequest, Asset, AssetCategory
        from apps.hr.models import ShiftTemplate, Policy
        from apps.sales.models import Lead, Quote
        from apps.organization.models import Branch, Department
        from apps.compsetting.models import Designation

        MODEL_MAP = {
            'product': (Product, 'product_name'),
            'category': (Category, 'name'),
            'brand': (Brand, 'name'),
            'supplier': (Supplier, 'name'),
            'customer': (Customer, 'name'),
            'warehouse': (Warehouse, 'warehouse_name'),
            'purchaseorder': (PurchaseOrder, 'order_number'),
            'purchaseord': (PurchaseOrder, 'order_number'),
            'goodsreceipt': (GoodsReceipt, 'receipt_number'),
            'salesorder': (SalesOrder, 'order_number'),
            'salesreturn': (SalesReturn, 'return_number'),
            'stocktransfer': (StockTransfer, 'transfer_number'),
            'alert': (Alert, 'title'),
            'variant': (ProductVariant, 'sku'),
            'productvariant': (ProductVariant, 'sku'),
            'stockitem': (StockItem, None),

            'account': (Account, 'name'),
            'customerinvoice': (CustomerInvoice, 'invoice_number'),
            'supplierbill': (SupplierBill, 'bill_number'),
            'payment': (Payment, 'reference_number'),
            'journalentry': (JournalEntry, 'entry_number'),
            'expense': (Expense, 'expense_number'),
            'bankaccount': (BankAccount, 'account_name'),
            'banktransaction': (BankTransaction, 'reference'),
            'budget': (Budget, None),

            'employee': (Employee, None),
            'employeeloan': (EmployeeLoan, 'transaction_number'),
            'leaverequest': (LeaveRequest, None),
            'asset': (Asset, 'name'),
            'assetcategor': (AssetCategory, 'name'),
            'shifttemplate': (ShiftTemplate, 'name'),
            'policy': (Policy, 'title'),

            'lead': (Lead, None),
            'quote': (Quote, 'quote_number'),

            'branch': (Branch, 'name'),
            'department': (Department, 'name'),
            'designation': (Designation, 'name'),
        }

        entry = MODEL_MAP.get(entity_type)
        if not entry:
            return None

        model_cls, name_field = entry
        try:
            if name_field:
                val = model_cls.objects.filter(_id=entity_id).values_list(name_field, flat=True).first()
                return str(val) if val is not None else None
            instance = model_cls.objects.filter(_id=entity_id).first()
            return str(instance) if instance else None
        except Exception:
            return None