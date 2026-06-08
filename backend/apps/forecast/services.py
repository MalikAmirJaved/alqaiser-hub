import pandas as pd
import numpy as np
from datetime import timedelta
from django.utils import timezone
from django.db.models import Sum, Q
from apps.inventory.models import SalesOrderLine, ProductVariant, Warehouse
from .models import ForecastConfiguration, SalesForecast, StockForecast

class DemandForecaster:
    def __init__(self, variant, company_id, branch_id):
        self.variant = variant
        self.company_id = company_id
        self.branch_id = branch_id
        self.config = self._get_config()

    def _get_config(self):
        # Try variant‑specific, then global defaults
        config = ForecastConfiguration.objects.filter(
            company_id=self.company_id,
            branch_id=self.branch_id,
            scope_type='VARIANT',
            scope_id=self.variant.id,
            is_active=True
        ).first()
        if not config:
            config = ForecastConfiguration.objects.filter(
                company_id=self.company_id,
                branch_id=self.branch_id,
                scope_type='GLOBAL',
                is_active=True
            ).first()
        return config or ForecastConfiguration.objects.create(
            company_id=self.company_id,
            branch_id=self.branch_id,
            scope_type='GLOBAL',
            method='MOVING_AVERAGE',
            window_days=30,
            forecast_horizon_days=30
        )

    def fetch_historical_daily_sales(self):
        """Aggregate daily sales quantities for the variant"""
        end_date = timezone.now().date()
        start_date = end_date - timedelta(days=self.config.window_days)
        # Query SalesOrderLine that are part of completed sales orders
        qs = SalesOrderLine.objects.filter(
            variant=self.variant,
            sales_order__status='COMPLETE',
            sales_order__order_date__gte=start_date,
            sales_order__order_date__lte=end_date,
            company_id=self.company_id,
            branch_id=self.branch_id,
            is_deleted=False
        ).values('sales_order__order_date').annotate(
            daily_qty=Sum('quantity_ordered')
        )
        df = pd.DataFrame(list(qs))
        if df.empty:
            return pd.Series(dtype=float)
        df['date'] = pd.to_datetime(df['sales_order__order_date']).dt.date
        df.set_index('date', inplace=True)
        # fill missing days with 0
        all_dates = pd.date_range(start=start_date, end=end_date, freq='D')
        df = df.reindex(all_dates, fill_value=0)
        return df['daily_qty']

    def moving_average(self, series, window=7):
        return series.rolling(window=window, min_periods=1).mean().iloc[-1]

    def exponential_smoothing(self, series, alpha):
        result = [series.iloc[0]]
        for val in series.iloc[1:]:
            result.append(alpha * val + (1 - alpha) * result[-1])
        return result[-1]

    def generate_forecast(self):
        hist = self.fetch_historical_daily_sales()
        if hist.empty:
            return None

        method = self.config.method
        if method == 'MOVING_AVERAGE':
            pred = self.moving_average(hist, window=7)
        elif method == 'EXPONENTIAL_SMOOTHING':
            pred = self.exponential_smoothing(hist, self.config.smoothing_factor)
        else:  # LINEAR_REGRESSION – simple fallback
            x = np.arange(len(hist)).reshape(-1, 1)
            y = hist.values
            slope, intercept = np.polyfit(x.flatten(), y, 1)
            pred = slope * len(hist) + intercept
            pred = max(0, pred)

        # Generate forecasts for each future day
        forecasts = []
        today = timezone.now().date()
        for offset in range(1, self.config.forecast_horizon_days + 1):
            forecast_date = today + timedelta(days=offset)
            # simple repeat – you can add seasonality or noise
            forecasts.append(SalesForecast(
                company_id=self.company_id,
                branch_id=self.branch_id,
                variant=self.variant,
                forecast_date=forecast_date,
                predicted_quantity=pred,
                method_used=method,
            ))
        return forecasts

    @classmethod
    def run_for_all_active_variants(cls, company_id, branch_id):
        variants = ProductVariant.objects.filter(
            company_id=company_id,
            branch_id=branch_id,
            is_deleted=False,
            product__status='active'
        )
        for variant in variants:
            forecaster = cls(variant, company_id, branch_id)
            forecasts = forecaster.generate_forecast()
            if forecasts:
                # Replace old forecasts for this variant
                SalesForecast.objects.filter(
                    variant=variant,
                    forecast_date__gte=timezone.now().date(),
                    company_id=company_id,
                    branch_id=branch_id
                ).delete()
                SalesForecast.objects.bulk_create(forecasts)

class StockForecaster:
    @staticmethod
    def run_for_all(company_id, branch_id):
        # Get all active variants and warehouses
        warehouses = Warehouse.objects.filter(company_id=company_id, branch_id=branch_id, is_active=True)
        variants = ProductVariant.objects.filter(company_id=company_id, branch_id=branch_id, is_deleted=False)
        today = timezone.now().date()

        for variant in variants:
            for wh in warehouses:
                # current stock quantity (from StockItem)
                from apps.inventory.models import StockItem
                stock_item = StockItem.objects.filter(variant=variant, warehouse=wh).first()
                current_qty = stock_item.quantity_on_hand if stock_item else 0

                # cumulative predicted demand from sales forecast
                demand_forecasts = SalesForecast.objects.filter(
                    variant=variant,
                    forecast_date__gte=today,
                    company_id=company_id,
                    branch_id=branch_id
                ).order_by('forecast_date')
                cumulative_demand = sum(f.predicted_quantity for f in demand_forecasts)

                # simple rule: reorder when projected stock < 0
                reorder_qty = max(0, cumulative_demand - current_qty)

                # create/update stock forecast for each future date (simplified: single entry per variant/warehouse)
                StockForecast.objects.update_or_create(
                    variant=variant,
                    warehouse=wh,
                    forecast_date=today + timedelta(days=1),
                    defaults={
                        'company_id': company_id,
                        'branch_id': branch_id,
                        'projected_closing_stock': current_qty - cumulative_demand,
                        'required_purchase_qty': reorder_qty,
                    }
                )