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
    inflow = serializers.IntegerField(required=False)
    outflow = serializers.IntegerField(required=False)
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
    available_stock = serializers.IntegerField(required=False)

class SupplierPerformanceSerializer(serializers.Serializer):
    supplier_name = serializers.CharField()
    supplier_code = serializers.CharField()
    fulfillment_rate = serializers.FloatField() # % of ordered units fully received
    average_lead_time_days = serializers.FloatField()
    total_purchase_amount = serializers.DecimalField(max_digits=15, decimal_places=2)
    orders_count = serializers.IntegerField()
    performance_score = serializers.FloatField() # e.g. 0 to 100

# ─── Comprehensive Analytics Serializers ───

class AnalyticsProductSummarySerializer(serializers.Serializer):
    product_name = serializers.CharField()
    variant_sku = serializers.CharField()
    total_stock_value = serializers.FloatField()
    total_sales_qty = serializers.IntegerField()
    total_sales_revenue = serializers.FloatField()
    total_purchase_qty = serializers.IntegerField()
    total_purchase_cost = serializers.FloatField()
    margin = serializers.FloatField()
    margin_percent = serializers.FloatField()
    category_name = serializers.CharField()
    brand_name = serializers.CharField()

class AnalyticsBrandSerializer(serializers.Serializer):
    brand_name = serializers.CharField()
    product_count = serializers.IntegerField()
    total_stock_value = serializers.FloatField()
    total_sales_revenue = serializers.FloatField()
    total_sales_qty = serializers.IntegerField()
    total_purchase_cost = serializers.FloatField()

class AnalyticsCategorySerializer(serializers.Serializer):
    category_name = serializers.CharField()
    product_count = serializers.IntegerField()
    total_stock_value = serializers.FloatField()
    total_sales_revenue = serializers.FloatField()
    total_sales_qty = serializers.IntegerField()

class AnalyticsCustomerSerializer(serializers.Serializer):
    customer_name = serializers.CharField()
    total_orders = serializers.IntegerField()
    total_revenue = serializers.FloatField()
    total_products = serializers.IntegerField()
    last_order_date = serializers.CharField(allow_null=True)

class AnalyticsWarehouseSerializer(serializers.Serializer):
    warehouse_name = serializers.CharField()
    total_stock_value = serializers.FloatField()
    total_on_hand = serializers.IntegerField()
    unique_variants = serializers.IntegerField()
    total_sales = serializers.FloatField()
    total_transfers_out = serializers.IntegerField()
    total_transfers_in = serializers.IntegerField()

class AnalyticsMovementSerializer(serializers.Serializer):
    transaction_type = serializers.CharField()
    total_qty = serializers.IntegerField()
    total_count = serializers.IntegerField()

class AnalyticsTransferSerializer(serializers.Serializer):
    status = serializers.CharField()
    total_count = serializers.IntegerField()
    total_quantity = serializers.IntegerField()

class AnalyticsAlertSerializer(serializers.Serializer):
    type = serializers.CharField()
    severity = serializers.CharField()
    count = serializers.IntegerField()

class AnalyticsPosSerializer(serializers.Serializer):
    source = serializers.CharField()
    total_orders = serializers.IntegerField()
    total_revenue = serializers.FloatField()

class InventoryAnalyticsSerializer(serializers.Serializer):
    top_products_by_value = AnalyticsProductSummarySerializer(many=True)
    top_products_by_sales = AnalyticsProductSummarySerializer(many=True)
    top_products_by_purchase = AnalyticsProductSummarySerializer(many=True)
    low_stock_products = AnalyticsProductSummarySerializer(many=True)
    products_summary = serializers.DictField(child=serializers.IntegerField())
    brands = AnalyticsBrandSerializer(many=True)
    categories = AnalyticsCategorySerializer(many=True)
    top_customers = AnalyticsCustomerSerializer(many=True)
    top_suppliers = SupplierPerformanceSerializer(many=True)
    warehouses = AnalyticsWarehouseSerializer(many=True)
    movement_by_type = AnalyticsMovementSerializer(many=True)
    transfers = AnalyticsTransferSerializer(many=True)
    alerts = AnalyticsAlertSerializer(many=True)
    pos_summary = AnalyticsPosSerializer(many=True)