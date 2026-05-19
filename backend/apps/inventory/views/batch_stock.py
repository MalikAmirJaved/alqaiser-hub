from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import F
from django.core.cache import cache
from apps.common.baseauthentication import CompanyBranchMixin


class BatchStockMixin:
    @action(detail=False, methods=['post'], url_path='batch-stock')
    def batch_stock(self, request):
        """
        Fetch stock for multiple variants in one request.
        Body: {"variant_ids": ["uuid1", "uuid2"], "warehouse_id": "uuid"}
        Returns: {"results": {"variant_uuid": {"available": 10, "reserved": 2}}}
        """
        variant_ids = request.data.get('variant_ids', [])
        warehouse_uuid = request.data.get('warehouse_id')
        
        if not variant_ids or not warehouse_uuid:
            return Response({'error': 'variant_ids and warehouse_id required'}, status=400)
        
        user = request.user
        company_id = user.company_id
        
        # Build cache key
        cache_key = f"batch_stock_{company_id}_{warehouse_uuid}_{'_'.join(sorted(variant_ids))}"
        cached_data = cache.get(cache_key)
        if cached_data:
            return Response({'results': cached_data})
        
        # Resolve warehouse
        from apps.inventory.models import Warehouse
        try:
            warehouse = Warehouse.objects.get(_id=warehouse_uuid, company_id=company_id)
        except Warehouse.DoesNotExist:
            return Response({'error': 'Warehouse not found'}, status=404)
        
        # Fetch stock items in one query
        from apps.inventory.models import StockItem, ProductVariant
        variants = ProductVariant.objects.filter(_id__in=variant_ids, company_id=company_id)
        stock_items = StockItem.objects.filter(
            variant__in=variants,
            warehouse=warehouse,
            company_id=company_id
        ).select_related('variant')
        
        # Build response map
        result = {}
        for stock in stock_items:
            variant_uuid = str(stock.variant._id)
            result[variant_uuid] = {
                'available': stock.quantity_on_hand - stock.quantity_reserved,
                'reserved': stock.quantity_reserved,
                'on_hand': stock.quantity_on_hand
            }
        
        # Fill missing variants with zero stock
        for vid in variant_ids:
            if vid not in result:
                result[vid] = {'available': 0, 'reserved': 0, 'on_hand': 0}
        
        # Cache for 2 seconds (stock changes frequently)
        cache.set(cache_key, result, 2)
        
        return Response({'results': result})