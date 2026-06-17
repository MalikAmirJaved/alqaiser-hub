from rest_framework import serializers
from apps.hr.models import AssetPurchaseRequest, Asset
from apps.common.serializer_fields import UUIDForeignRelatedField


class AssetPurchaseRequestSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    asset = UUIDForeignRelatedField(queryset=Asset.objects.all())
    asset_name = serializers.CharField(source='asset.name', read_only=True)
    asset_brand = serializers.CharField(source='asset.brand', read_only=True)
    asset_serial = serializers.CharField(source='asset.serial_number', read_only=True)
    requested_by_name = serializers.CharField(source='requested_by.username', read_only=True, default=None)
    purchase_order_id = serializers.UUIDField(source='purchase_order._id', read_only=True, default=None)
    purchase_order_number = serializers.CharField(source='purchase_order.order_number', read_only=True, default=None)

    class Meta:
        model = AssetPurchaseRequest
        fields = [
            'id', 'asset', 'asset_name', 'asset_brand', 'asset_serial',
            'requested_by', 'requested_by_name',
            'employee', 'quantity', 'reason', 'under_date',
            'status', 'purchase_order', 'purchase_order_id', 'purchase_order_number',
            'notes', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at', 'status', 'purchase_order']

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['company_id'] = user.company_id
        validated_data['branch_id'] = user.branch_id
        validated_data['requested_by'] = user
        validated_data['created_by'] = user
        validated_data['updated_by'] = user
        return super().create(validated_data)
