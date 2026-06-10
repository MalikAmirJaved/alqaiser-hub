from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin

from .models import SalesForecast, StockForecast, ForecastConfiguration
from .serializers import SalesForecastSerializer, StockForecastSerializer, ForecastConfigSerializer
from .services import DemandForecaster, StockForecaster
from .analytics import build_sales_analytics, build_stock_summary


def _scoped_forecast_qs(model, request):
    """Return the forecast queryset scoped to the caller's tenant."""
    return model.objects.filter(
        company_id=request.user.company_id,
        branch_id=request.user.branch_id,
    )


def _parse_granularity(value):
    value = (value or "daily").lower()
    if value in ("daily", "weekly", "monthly"):
        return value
    return "daily"


class SalesForecastViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'FINANCE'
    permission_resource = 'forecast'
    serializer_class = SalesForecastSerializer
    filterset_fields = ["variant", "forecast_date"]

    def get_queryset(self):
        return (
            SalesForecast.objects.filter(
                company_id=self.request.user.company_id,
                branch_id=self.request.user.branch_id,
            )
            .select_related("variant")
        )

    @action(detail=False, methods=["get"], url_path="analytics")
    def analytics(self, request):
        """Aggregated analytics powering the forecast dashboard charts."""
        granularity = _parse_granularity(request.query_params.get("granularity"))
        try:
            top_n = int(request.query_params.get("top_n", 8))
        except (TypeError, ValueError):
            top_n = 8
        top_n = max(1, min(top_n, 25))

        qs = self.get_queryset()
        variant = request.query_params.get("variant")
        if variant:
            qs = qs.filter(variant=variant)
        forecast_date = request.query_params.get("forecast_date")
        if forecast_date:
            qs = qs.filter(forecast_date=forecast_date)

        payload = build_sales_analytics(qs, granularity=granularity, top_n=top_n)
        return Response(payload)

    @action(detail=False, methods=["post"], url_path="regenerate")
    def regenerate(self, request):
        """Trigger a fresh sales forecast run for the caller's tenant."""
        DemandForecaster.run_for_all_active_variants(
            request.user.company_id,
            request.user.branch_id,
        )
        return Response(
            {"status": "Sales forecast regeneration completed"},
            status=status.HTTP_202_ACCEPTED,
        )


class StockForecastViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ReadOnlyModelViewSet):
    permission_module = 'FINANCE'
    permission_resource = 'forecast'
    serializer_class = StockForecastSerializer
    filterset_fields = ["variant", "warehouse"]

    def get_queryset(self):
        return (
            StockForecast.objects.filter(
                company_id=self.request.user.company_id,
                branch_id=self.request.user.branch_id,
            )
            .select_related("variant", "warehouse")
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """Aggregated stock-forecast analytics for the projection panels."""
        qs = self.get_queryset()
        variant = request.query_params.get("variant")
        if variant:
            qs = qs.filter(variant=variant)
        warehouse = request.query_params.get("warehouse")
        if warehouse:
            qs = qs.filter(warehouse=warehouse)

        payload = build_stock_summary(qs)
        return Response(payload)

    @action(detail=False, methods=["post"], url_path="regenerate")
    def regenerate(self, request):
        StockForecaster.run_for_all(
            request.user.company_id,
            request.user.branch_id,
        )
        return Response(
            {"status": "Stock forecast refresh completed"},
            status=status.HTTP_202_ACCEPTED,
        )


class ForecastConfigurationViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'FINANCE'
    permission_resource = 'forecast'
    serializer_class = ForecastConfigSerializer

    def get_queryset(self):
        return ForecastConfiguration.objects.filter(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
        )

    @action(detail=False, methods=["post"], url_path="generate-sales")
    def generate_sales_forecast(self, request):
        """Trigger sales forecast generation for all active variants."""
        DemandForecaster.run_for_all_active_variants(
            request.user.company_id, request.user.branch_id
        )
        return Response(
            {"status": "Sales forecast generation started"},
            status=status.HTTP_202_ACCEPTED,
        )

    @action(detail=False, methods=["post"], url_path="generate-stock")
    def generate_stock_forecast(self, request):
        StockForecaster.run_for_all(request.user.company_id, request.user.branch_id)
        return Response({"status": "Stock forecast updated"})
