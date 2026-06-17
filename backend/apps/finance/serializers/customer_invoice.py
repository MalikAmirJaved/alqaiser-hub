from rest_framework import serializers
from apps.finance.models import CustomerInvoice, CustomerInvoiceLine, BankAccount
from apps.inventory.models import Customer, SalesOrder, ProductVariant
from apps.inventory.serializers.customer import CustomerSerializer

class CustomerInvoiceLineSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    variant = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=ProductVariant.objects.all()
    )
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    variant_name = serializers.CharField(source='variant.product.product_name', read_only=True)
    subtotal = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    line_total = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)

    class Meta:
        model = CustomerInvoiceLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'quantity', 'unit_price', 'tax_rate', 'discount_amount',
            'subtotal', 'line_total'
        ]


class CustomerInvoiceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(read_only=True)
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
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
            'paid_amount', 'payment_status', 'outstanding', 'status', 'journal_entry',
        )

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

        invoice = CustomerInvoice.objects.create(**validated_data)
        
        for line_item in lines_data:
            CustomerInvoiceLine.objects.create(
                customer_invoice=invoice,
                company_id=invoice.company_id,
                branch_id=invoice.branch_id,
                created_by=invoice.created_by,
                updated_by=invoice.updated_by,
                **line_item
            )
        return invoice

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if lines_data is not None:
            instance.lines.all().update(is_deleted=True)
            for line_item in lines_data:
                CustomerInvoiceLine.objects.create(
                    customer_invoice=instance,
                    company_id=instance.company_id,
                    branch_id=instance.branch_id,
                    created_by=instance.updated_by or instance.created_by,
                    updated_by=instance.updated_by or instance.created_by,
                    **line_item
                )
        return instance