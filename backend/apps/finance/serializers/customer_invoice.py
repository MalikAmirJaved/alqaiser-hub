import random
import time
from decimal import Decimal

from rest_framework import serializers

from apps.finance.models import CustomerInvoice, CustomerInvoiceLine, BankAccount
from apps.finance.services.invoice_supplier_bill import (
    create_supplier_bill_for_line,
    handle_removed_line,
    line_cost,
    sync_manual_line_bill,
)
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
    supplier_bill = serializers.SlugRelatedField(
        slug_field='_id',
        read_only=True,
        allow_null=True,
    )

    class Meta:
        model = CustomerInvoiceLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'is_manual_entry', 'manual_variant_name', 'manual_variant_sku',
            'vendor', 'vendor_name', 'cost_price', 'supplier_bill',
            'quantity', 'unit_price', 'tax_rate', 'discount_amount', 'description',
            'status', 'subtotal', 'line_total'
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
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    source_label = serializers.SerializerMethodField()
    created_by_label = serializers.SerializerMethodField()
    lines = CustomerInvoiceLineSerializer(many=True, required=False)
    payments = serializers.SerializerMethodField()
    
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
            'cancelled_by', 'cancelled_at',
        )

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None

    def get_customer_email(self, obj):
        return obj.customer.email if obj.customer else None

    def get_customer_phone(self, obj):
        return obj.customer.phone if obj.customer else None

    def get_created_by_name(self, obj):
        return obj.created_by.username if obj.created_by else None

    def get_updated_by_name(self, obj):
        return obj.updated_by.username if obj.updated_by else None

    def get_source_label(self, obj):
        if obj.source_quotes.exists():
            return "From Quote"
        return "New"

    def get_created_by_label(self, obj):
        name = obj.created_by.username if obj.created_by else None
        src = obj.source or 'new'
        return f"{name} ({src})" if name else None

    def get_payments(self, obj):
        from apps.finance.services.payable import get_payments_queryset
        payments = get_payments_queryset(obj)
        return [
            {
                'id': str(p._id),
                'amount': str(p.amount),
                'payment_date': str(p.payment_date),
                'payment_method': p.payment_method,
                'reference_number': p.reference_number or '',
                'status': p.status,
                'payment_type': p.payment_type,
            }
            for p in payments
        ]

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        rep['lines'] = CustomerInvoiceLineSerializer(
            instance.lines.filter(is_deleted=False), many=True,
            context=self.context
        ).data
        rep['cancelled_by_name'] = instance.cancelled_by.username if instance.cancelled_by else None
        return rep

    def _create_supplier_bills(self, invoice, lines_data, user):
        """Create SupplierBills for manual-entry lines and link them back."""
        line_bill_map = {}
        for i, line_item in enumerate(lines_data):
            if (
                line_item.get('is_manual_entry')
                and line_item.get('vendor')
                and line_item.get('cost_price') is not None
            ):
                cost = line_cost(line_item['quantity'], line_item['cost_price'])
                bill = create_supplier_bill_for_line(
                    invoice,
                    line_item['vendor'],
                    cost,
                    user,
                    notes=f"Auto-created from invoice {invoice.invoice_number} line {i + 1}",
                )
                line_bill_map[i] = bill
        return line_bill_map

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

        validated_data.setdefault('company_id', user.company_id)
        validated_data.setdefault('branch_id', user.branch_id)
        validated_data.setdefault('created_by', user)
        validated_data.setdefault('updated_by', user)

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

        line_bill_map = self._create_supplier_bills(invoice, lines_data, user)
        if line_bill_map:
            for idx, bill in line_bill_map.items():
                line = invoice.lines.filter(is_deleted=False).order_by('created_at')[idx]
                line.supplier_bill = bill
                line.save(update_fields=['supplier_bill'])

        return invoice

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            user = instance.updated_by or instance.created_by
            existing_lines = {
                str(l._id): l for l in instance.lines.filter(is_deleted=False)
            }
            incoming_ids = set()
            
            subtotal = Decimal('0')
            per_line_discounts = Decimal('0')
            self._reduction_conflicts = []
            created_lines = []

            raw_line_ids = self.context.get('raw_line_ids', {})
            for i, line_item in enumerate(lines_data):
                line_id = raw_line_ids.get(i)
                is_manual = line_item.get('is_manual_entry', False)

                if line_id and line_id in existing_lines:
                    old_line = existing_lines[line_id]
                    incoming_ids.add(line_id)

                    if is_manual and line_item.get('vendor') and line_item.get('cost_price') is not None:
                        conflict = sync_manual_line_bill(
                            invoice=instance,
                            old_line=old_line,
                            new_vendor=line_item['vendor'],
                            new_qty=line_item.get('quantity', old_line.quantity),
                            new_cost_price=line_item['cost_price'],
                            user=user,
                            line_index=i,
                            line_name=line_item.get('manual_variant_name', ''),
                        )
                        if conflict:
                            self._reduction_conflicts.append(conflict)

                    for attr, value in line_item.items():
                        if attr != 'supplier_bill':
                            setattr(old_line, attr, value)
                    old_line.save()
                    created_lines.append(old_line)
                else:
                    line_item.pop('supplier_bill', None)
                    line = CustomerInvoiceLine.objects.create(
                        customer_invoice=instance,
                        company_id=instance.company_id,
                        branch_id=instance.branch_id,
                        created_by=user,
                        updated_by=user,
                        **line_item
                    )
                    created_lines.append(line)

                    if (
                        is_manual
                        and line_item.get('vendor')
                        and line_item.get('cost_price') is not None
                    ):
                        cost = line_cost(line.quantity, line_item['cost_price'])
                        bill = create_supplier_bill_for_line(
                            instance,
                            line_item['vendor'],
                            cost,
                            user,
                            notes=f"Auto-created from invoice {instance.invoice_number}",
                        )
                        line.supplier_bill = bill
                        line.save(update_fields=['supplier_bill'])

                line = created_lines[-1]
                subtotal += line.quantity * line.unit_price
                per_line_discounts += Decimal(str(line.discount_amount or 0))

            for line_id, old_line in existing_lines.items():
                if line_id not in incoming_ids:
                    handle_removed_line(old_line, instance, user)
                    old_line.is_deleted = True
                    old_line.save(update_fields=['is_deleted'])

            overall_discount_percent = Decimal(str(
                validated_data.get('overall_discount_percent', instance.overall_discount_percent or 0)
            ))
            overall_tax_percent = Decimal(str(
                validated_data.get('overall_tax_percent', instance.overall_tax_percent or 0)
            ))
            overall_discount = subtotal * (overall_discount_percent / Decimal('100'))
            total_before_tax = subtotal - per_line_discounts - overall_discount
            overall_tax = total_before_tax * (overall_tax_percent / Decimal('100'))
            instance.amount = total_before_tax + overall_tax
            instance.save(update_fields=['amount'])

        return instance
