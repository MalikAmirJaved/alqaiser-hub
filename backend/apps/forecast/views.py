from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import SalesForecast, StockForecast, ForecastConfiguration
from .serializers import SalesForecastSerializer, StockForecastSerializer, ForecastConfigSerializer
from .services import DemandForecaster, StockForecaster

class SalesForecastViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = SalesForecastSerializer
    filterset_fields = ['variant', 'forecast_date']

    def get_queryset(self):
        return SalesForecast.objects.filter(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        ).select_related('variant')

class StockForecastViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockForecastSerializer
    filterset_fields = ['variant', 'warehouse']

    def get_queryset(self):
        return StockForecast.objects.filter(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        ).select_related('variant', 'warehouse')

class ForecastConfigurationViewSet(viewsets.ModelViewSet):
    serializer_class = ForecastConfigSerializer

    def get_queryset(self):
        return ForecastConfiguration.objects.filter(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id
        )

    @action(detail=False, methods=['post'], url_path='generate-sales')
    def generate_sales_forecast(self, request):
        """Trigger sales forecast generation for all active variants"""
        DemandForecaster.run_for_all_active_variants(request.user.company_id, request.user.branch_id)
        return Response({'status': 'Sales forecast generation started'}, status=status.HTTP_202_ACCEPTED)

    @action(detail=False, methods=['post'], url_path='generate-stock')
    def generate_stock_forecast(self, request):
        StockForecaster.run_for_all(request.user.company_id, request.user.branch_id)
        return Response({'status': 'Stock forecast updated'})