import time
import random
from decimal import Decimal

from rest_framework import serializers

from apps.finance.models import CustomerInvoice, CustomerInvoiceLine, BankAccount, SupplierBill
from apps.inventory.models import Customer, SalesOrder, ProductVariant, Supplier
from apps.inventory.serializers.customer import CustomerSerializer

class CustomerInvoiceLineSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    variant = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=ProductVariant.objects.all(),
        allow_null=True,
        required=False,
    )
    variant_sku = serializers.SerializerMethodField()
    variant_name = serializers.SerializerMethodField()
    vendor = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Supplier.objects.all(),
        allow_null=True,
        required=False,
    )
    vendor_name = serializers.CharField(source='vendor.name', read_only=True, allow_null=True)
    subtotal = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    quantity = serializers.IntegerField(min_value=1)

    class Meta:
        model = CustomerInvoiceLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'is_manual_entry', 'manual_variant_name', 'manual_variant_sku',
            'vendor', 'vendor_name', 'cost_price',
            'quantity', 'unit_price', 'tax_rate', 'discount_amount', 'description',
            'subtotal', 'line_total'
        ]

    def get_variant_sku(self, obj):
        if obj.is_manual_entry:
            return obj.manual_variant_sku or ''
        return obj.variant.sku if obj.variant else ''

    def get_variant_name(self, obj):
        if obj.is_manual_entry:
            return obj.manual_variant_name or ''
        return obj.variant.product.product_name if obj.variant else ''

    def validate(self, data):
        is_manual = data.get('is_manual_entry', False)
        if is_manual:
            if not data.get('manual_variant_name'):
                raise serializers.ValidationError({
                    'manual_variant_name': 'Variant name is required for manual entry items.'
                })
            if not data.get('vendor'):
                raise serializers.ValidationError({
                    'vendor': 'Vendor is required for manual entry items.'
                })
            if data.get('cost_price') is None:
                raise serializers.ValidationError({
                    'cost_price': 'Cost price is required for manual entry items.'
                })
            data.pop('variant', None)
        else:
            if not data.get('variant'):
                raise serializers.ValidationError({
                    'variant': 'Product variant is required for non-manual items.'
                })
            data.pop('vendor', None)
            data.pop('cost_price', None)
            data.pop('manual_variant_name', None)
            data.pop('manual_variant_sku', None)
        return data


class CustomerInvoiceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(read_only=True)
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    lines = CustomerInvoiceLineSerializer(many=True, required=False)
    
    customer = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Customer.objects.all(),
        required=False,
        allow_null=True
    )
    new_customer = CustomerSerializer(required=False, write_only=True)
    sales_order = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=SalesOrder.objects.all(),
        allow_null=True,
        required=False
    )
    bank_account = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=BankAccount.objects.all(),
        allow_null=True,
        required=False
    )
    
    class Meta:
        model = CustomerInvoice
        fields = '__all__'
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'company_id', 'branch_id',
            'paid_amount', 'payment_status', 'outstanding', 'status', 'journal_entry', 'amount',
        )

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None

    def get_customer_email(self, obj):
        return obj.customer.email if obj.customer else None

    def get_customer_phone(self, obj):
        return obj.customer.phone if obj.customer else None

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        new_customer_data = validated_data.pop('new_customer', None)
        user = self.context['request'].user
        
        if new_customer_data:
            new_customer_data['company_id'] = user.company_id
            new_customer_data['branch_id'] = user.branch_id
            new_customer_data['created_by'] = user
            new_customer_data['updated_by'] = user
            customer = Customer.objects.create(**new_customer_data)
            validated_data['customer'] = customer

        # Ensure tenant fields are set even if not provided in validated_data
        validated_data.setdefault('company_id', user.company_id)
        validated_data.setdefault('branch_id', user.branch_id)
        validated_data.setdefault('created_by', user)
        validated_data.setdefault('updated_by', user)

        # amount is read_only so it gets stripped from validated_data.
        # Pass a placeholder since the real amount is calculated below.
        invoice = CustomerInvoice.objects.create(**validated_data, amount=Decimal('0'))
        
        subtotal = Decimal('0')
        per_line_discounts = Decimal('0')
        for line_item in lines_data:
            line = CustomerInvoiceLine.objects.create(
                customer_invoice=invoice,
                company_id=invoice.company_id,
                branch_id=invoice.branch_id,
                created_by=invoice.created_by,
                updated_by=invoice.updated_by,
                **line_item
            )
            subtotal += line.quantity * line.unit_price
            per_line_discounts += Decimal(str(line.discount_amount or 0))
        
        overall_discount_percent = Decimal(str(validated_data.get('overall_discount_percent', 0) or 0))
        overall_tax_percent = Decimal(str(validated_data.get('overall_tax_percent', 0) or 0))
        overall_discount = subtotal * (overall_discount_percent / Decimal('100'))
        total_before_tax = subtotal - per_line_discounts - overall_discount
        overall_tax = total_before_tax * (overall_tax_percent / Decimal('100'))
        invoice.amount = total_before_tax + overall_tax
        invoice.save(update_fields=['amount'])

        # ── Auto-create unpaid SupplierBill for manual-entry lines with vendor + cost_price ──
        vendor_bills: dict[str, dict] = {}
        for line_item in lines_data:
            if line_item.get('is_manual_entry') and line_item.get('vendor') and line_item.get('cost_price') is not None:
                vendor_id = str(line_item['vendor']._id)
                cost = Decimal(str(line_item['quantity'])) * Decimal(str(line_item['cost_price']))
                if vendor_id in vendor_bills:
                    vendor_bills[vendor_id]['amount'] += cost
                else:
                    vendor_bills[vendor_id] = {
                        'vendor': line_item['vendor'],
                        'amount': cost,
                    }

        for vdata in vendor_bills.values():
            bill_number = f"BILL-INV-{int(time.time())}-{random.randint(1000, 9999)}"
            bill_date = invoice.invoice_date
            due_date = invoice.due_date or bill_date
            SupplierBill.objects.create(
                bill_number=bill_number,
                supplier=vdata['vendor'],
                bill_date=bill_date,
                due_date=due_date,
                amount=vdata['amount'],
                status='DRAFT',
                notes=f"Auto-created from invoice {invoice.invoice_number}",
                company_id=invoice.company_id,
                branch_id=invoice.branch_id,
                created_by=user,
                updated_by=user,
            )

        return invoice

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            instance.lines.all().update(is_deleted=True)
            subtotal = Decimal('0')
            per_line_discounts = Decimal('0')
            for line_item in lines_data:
                line = CustomerInvoiceLine.objects.create(
                    customer_invoice=instance,
                    company_id=instance.company_id,
                    branch_id=instance.branch_id,
                    created_by=instance.updated_by or instance.created_by,
                    updated_by=instance.updated_by or instance.created_by,
                    **line_item
                )
                subtotal += line.quantity * line.unit_price
                per_line_discounts += Decimal(str(line.discount_amount or 0))
            overall_discount_percent = Decimal(str(validated_data.get('overall_discount_percent', instance.overall_discount_percent or 0)))
            overall_tax_percent = Decimal(str(validated_data.get('overall_tax_percent', instance.overall_tax_percent or 0)))
            overall_discount = subtotal * (overall_discount_percent / Decimal('100'))
            total_before_tax = subtotal - per_line_discounts - overall_discount
            overall_tax = total_before_tax * (overall_tax_percent / Decimal('100'))
            instance.amount = total_before_tax + overall_tax
            instance.save(update_fields=['amount'])
        return instance