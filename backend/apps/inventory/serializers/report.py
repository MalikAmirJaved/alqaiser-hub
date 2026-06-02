from rest_framework import serializers

class OverallSummarySerializer(serializers.Serializer):
    total_stock_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_variants = serializers.IntegerField()
    low_stock_count = serializers.IntegerField()
    total_purchase_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_sales_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    total_warehouses = serializers.IntegerField()
    stock_turnover_rate = serializers.FloatField(required=False)

class StockItemReportSerializer(serializers.Serializer):
    variant_sku = serializers.CharField()
    variant_name = serializers.CharField()
    warehouse_name = serializers.CharField()
    quantity_on_hand = serializers.IntegerField()
    quantity_reserved = serializers.IntegerField()
    quantity_available = serializers.IntegerField()
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=4)
    total_value = serializers.DecimalField(max_digits=15, decimal_places=2)

class StockSummarySerializer(serializers.Serializer):
    product_name = serializers.CharField()
    category_name = serializers.CharField()
    warehouse_name = serializers.CharField()
    variant_sku = serializers.CharField()
    quantity_on_hand = serializers.IntegerField()
    quantity_reserved = serializers.IntegerField()
    quantity_available = serializers.IntegerField()
    unit_cost = serializers.DecimalField(max_digits=12, decimal_places=4)
    total_value = serializers.DecimalField(max_digits=15, decimal_places=2)

class ValuationReportSerializer(serializers.Serializer):
    methodology = serializers.CharField()
    total_quantity = serializers.IntegerField()
    total_value = serializers.DecimalField(max_digits=15, decimal_places=2)
    average_unit_cost = serializers.DecimalField(max_digits=12, decimal_places=4)

class StockMovementSerializer(serializers.Serializer):
    period = serializers.CharField() # e.g. YYYY-MM-DD
    transaction_type = serializers.CharField()
    total_quantity = serializers.IntegerField()
    transaction_count = serializers.IntegerField()

class SalesVsPurchaseSerializer(serializers.Serializer):
    period = serializers.CharField() # YYYY-MM-DD
    sales_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    purchase_amount = serializers.DecimalField(max_digits=15, decimal_places=2)

class ProfitLossSerializer(serializers.Serializer):
    product_name = serializers.CharField()
    variant_sku = serializers.CharField()
    sales_quantity = serializers.IntegerField()
    sales_revenue = serializers.DecimalField(max_digits=15, decimal_places=2)
    cogs = serializers.DecimalField(max_digits=15, decimal_places=2)
    gross_profit = serializers.DecimalField(max_digits=15, decimal_places=2)
    margin_percent = serializers.FloatField()

class SlowMovingSerializer(serializers.Serializer):
    product_name = serializers.CharField()
    variant_sku = serializers.CharField()
    warehouse_name = serializers.CharField()
    quantity_on_hand = serializers.IntegerField()
    days_since_last_sale = serializers.IntegerField()
    status = serializers.CharField() # e.g. SLOW_MOVING, OBSOLETE, HEALTHY

class ReorderPlanningSerializer(serializers.Serializer):
    product_name = serializers.CharField()
    variant_sku = serializers.CharField()
    quantity_on_hand = serializers.IntegerField()
    min_stock_level = serializers.IntegerField()
    max_stock_level = serializers.IntegerField()
    recommended_reorder_qty = serializers.IntegerField()
    urgency_score = serializers.FloatField() # e.g. 0 to 100
    suggested_supplier_name = serializers.CharField()

class SupplierPerformanceSerializer(serializers.Serializer):
    supplier_name = serializers.CharField()
    supplier_code = serializers.CharField()
    fulfillment_rate = serializers.FloatField() # % of ordered units fully received
    average_lead_time_days = serializers.FloatField()
    total_purchase_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    orders_count = serializers.IntegerField()
    performance_score = serializers.FloatField() # e.g. 0 to 100