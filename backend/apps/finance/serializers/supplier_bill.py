from rest_framework import serializers
from apps.finance.models import SupplierBill, Payment
from apps.inventory.models import Supplier, PurchaseOrder
from django.contrib.contenttypes.models import ContentType

class SupplierBillSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    paid_amount = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    payment_status = serializers.CharField(read_only=True)
    outstanding = serializers.DecimalField(max_digits=15, decimal_places=2, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    
    # Additional supplier details for the detail page
    supplier_code = serializers.CharField(source='supplier.code', read_only=True)
    supplier_contact_person = serializers.CharField(source='supplier.contact_person', read_only=True)
    supplier_email = serializers.CharField(source='supplier.email', read_only=True)
    supplier_phone = serializers.CharField(source='supplier.phone', read_only=True)
    supplier_address = serializers.CharField(source='supplier.address_line', read_only=True)
    supplier_city = serializers.CharField(source='supplier.city', read_only=True)
    supplier_state = serializers.CharField(source='supplier.state', read_only=True)
    supplier_country = serializers.CharField(source='supplier.country', read_only=True)
    supplier_postal_code = serializers.CharField(source='supplier.postal_code', read_only=True)

    # Purchase order enrichment
    purchase_order_number = serializers.CharField(source='purchase_order.order_number', read_only=True, allow_null=True)
    purchase_order_status = serializers.CharField(source='purchase_order.status', read_only=True, allow_null=True)
    purchase_order_total = serializers.DecimalField(source='purchase_order.total_amount', max_digits=15, decimal_places=2, read_only=True, allow_null=True)

    # Payment history (linked payments)
    payments = serializers.SerializerMethodField()

    # Foreign keys accept UUID
    supplier = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=Supplier.objects.all()
    )
    purchase_order = serializers.SlugRelatedField(
        slug_field='_id',
        queryset=PurchaseOrder.objects.all(),
        allow_null=True,
        required=False
    )

    def get_payments(self, obj):
        ct = ContentType.objects.get_for_model(SupplierBill)
        qs = Payment.objects.filter(
            content_type=ct,
            object_id=obj.pk,
            is_deleted=False,
        ).order_by('-payment_date', '-created_at')
        return [
            {
                'id': str(p._id),
                'amount': str(p.amount),
                'payment_date': p.payment_date.isoformat(),
                'payment_method': p.payment_method,
                'reference_number': p.reference_number,
                'status': p.status,
                'notes': p.notes,
            }
            for p in qs
        ]

    class Meta:
        model = SupplierBill
        fields = '__all__'
        read_only_fields = (
            'id', 'created_at', 'updated_at', 'company_id', 'branch_id',
            'paid_amount', 'payment_status', 'outstanding', 'status', 'journal_entry',
        )