from rest_framework import serializers
from apps.sales.models.quote import Quote, QuoteLine
from apps.sales.models.lead import Lead
from apps.inventory.models import Customer, ProductVariant
from apps.inventory.serializers.customer import CustomerSerializer

class QuoteLineSerializer(serializers.ModelSerializer):
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
        model = QuoteLine
        fields = [
            'id', 'variant', 'variant_sku', 'variant_name',
            'quantity', 'unit_price', 'tax_rate', 'discount_amount',
            'subtotal', 'line_total'
        ]


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
    new_customer = CustomerSerializer(required=False, write_only=True)

    class Meta:
        model = Quote
        fields = [
            'id', 'quote_number', 'lead', 'customer', 'new_customer',
            'date', 'expiration_date', 'total_amount', 'status', 'source',
            'notes', 'lines', 'created_at', 'updated_at'
        ]
        read_only_fields = ('id', 'quote_number', 'created_at', 'updated_at', 'company_id', 'branch_id', 'total_amount')

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
        
        total_amount = 0
        for line_item in lines_data:
            line = QuoteLine.objects.create(
                quote=quote,
                company_id=quote.company_id,
                branch_id=quote.branch_id,
                created_by=quote.created_by,
                updated_by=quote.updated_by,
                **line_item
            )
            total_amount += line.line_total
            
        quote.total_amount = total_amount
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
            total_amount = 0
            for line_item in lines_data:
                line = QuoteLine.objects.create(
                    quote=instance,
                    company_id=instance.company_id,
                    branch_id=instance.branch_id,
                    created_by=instance.updated_by or instance.created_by,
                    updated_by=instance.updated_by or instance.created_by,
                    **line_item
                )
                total_amount += line.line_total
            instance.total_amount = total_amount
            instance.save(update_fields=['total_amount'])
            
        return instance
