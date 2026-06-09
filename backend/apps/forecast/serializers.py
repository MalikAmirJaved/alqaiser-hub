from rest_framework import serializers
from .models import SalesForecast, StockForecast, ForecastConfiguration

class SalesForecastSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    class Meta:
        model = SalesForecast
        fields = ['id', 'variant', 'variant_sku', 'forecast_date', 'predicted_quantity', 'confidence', 'method_used']

class StockForecastSerializer(serializers.ModelSerializer):
    variant_sku = serializers.CharField(source='variant.sku', read_only=True)
    warehouse_name = serializers.CharField(source='warehouse.warehouse_name', read_only=True)
    class Meta:
        model = StockForecast
        fields = ['id', 'variant', 'variant_sku', 'warehouse', 'warehouse_name', 'forecast_date',
                  'projected_closing_stock', 'required_purchase_qty']

class ForecastConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = ForecastConfiguration
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'updated_at']