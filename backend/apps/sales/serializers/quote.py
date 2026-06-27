from decimal import Decimal
from rest_framework import serializers
from apps.sales.models.quote import Quote, QuoteLine
from apps.sales.models.lead import Lead
from apps.inventory.models import Customer, ProductVariant, Supplier
from apps.inventory.serializers.customer import CustomerSerializer

class QuoteLineSerializer(serializers.ModelSerializer):
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
        model = QuoteLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'is_manual_entry', 'manual_variant_name', 'manual_variant_sku',
            'vendor', 'vendor_name',
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

    def validate_unit_price(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Unit price must be greater than 0.')
        return value


class QuoteSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    lines = QuoteLineSerializer(many=True, required=False)
    lead = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Lead.objects.all(),
        allow_null=True,
        required=False
    )
    customer = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Customer.objects.all(),
        allow_null=True,
        required=False
    )
    customer_name = serializers.SerializerMethodField()
    customer_email = serializers.SerializerMethodField()
    customer_phone = serializers.SerializerMethodField()
    new_customer = CustomerSerializer(required=False, write_only=True)
    converted_invoice = serializers.UUIDField(source='converted_invoice._id', read_only=True, allow_null=True)
    converted_invoice_number = serializers.CharField(source='converted_invoice.invoice_number', read_only=True, allow_null=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'lead', 'customer', 'customer_name', 'customer_email', 'customer_phone', 'new_customer',
            'date', 'expiration_date', 'total_amount', 'overall_discount_percent', 'overall_tax_percent', 'status', 'source',
            'notes', 'lines', 'created_at', 'updated_at',
            'converted_invoice', 'converted_invoice_number',
        ]
        read_only_fields = ('id', 'quote_number', 'created_at', 'updated_at', 'company_id', 'branch_id', 'total_amount', 'status')

    def get_customer_name(self, obj):
        return obj.customer.name if obj.customer else None

    def get_customer_email(self, obj):
        return obj.customer.email if obj.customer else None

    def get_customer_phone(self, obj):
        return obj.customer.phone if obj.customer else None

    def to_representation(self, instance):
        rep = super().to_representation(instance)
        # Filter out soft-deleted lines to prevent line duplication on each edit cycle
        rep['lines'] = QuoteLineSerializer(
            instance.lines.filter(is_deleted=False), many=True,
            context=self.context
        ).data
        return rep

    def create(self, validated_data):
        import time, random
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

        validated_data['quote_number'] = f"QT-{int(time.time())}-{random.randint(1000, 9999)}"
        validated_data['company_id'] = user.company_id
        validated_data['branch_id'] = user.branch_id
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        
        # Ensure date is present
        if 'date' not in validated_data:
            from django.utils import timezone
            validated_data['date'] = timezone.now().date()

        quote = Quote.objects.create(**validated_data)
        
        subtotal = Decimal('0')
        per_line_discounts = Decimal('0')
        for line_item in lines_data:
            line = QuoteLine.objects.create(
                quote=quote,
                company_id=quote.company_id,
                branch_id=quote.branch_id,
                created_by=quote.created_by,
                updated_by=quote.updated_by,
                **line_item
            )
            subtotal += line.quantity * line.unit_price
            per_line_discounts += Decimal(str(line.discount_amount or 0))
            
        overall_discount_percent = Decimal(str(validated_data.get('overall_discount_percent', 0) or 0))
        overall_tax_percent = Decimal(str(validated_data.get('overall_tax_percent', 0) or 0))
        overall_discount = subtotal * (overall_discount_percent / Decimal('100'))
        total_before_tax = subtotal - per_line_discounts - overall_discount
        overall_tax = total_before_tax * (overall_tax_percent / Decimal('100'))
        quote.total_amount = total_before_tax + overall_tax
        quote.save(update_fields=['total_amount'])
        return quote

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        user = self.context['request'].user
        validated_data['updated_by'] = user
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            instance.lines.all().update(is_deleted=True)
            subtotal = Decimal('0')
            per_line_discounts = Decimal('0')
            for line_item in lines_data:
                line = QuoteLine.objects.create(
                    quote=instance,
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
            instance.total_amount = total_before_tax + overall_tax
            instance.save(update_fields=['total_amount'])
            
        return instance
