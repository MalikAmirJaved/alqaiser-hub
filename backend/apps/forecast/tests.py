from datetime import date
from decimal import Decimal
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.forecast.models import (
    ForecastConfiguration, SalesForecast, StockForecast,
)

User = get_user_model()


class ForecastConfigurationTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='u', email='u@t.com', password='p'
        )

    def test_create(self):
        fc = ForecastConfiguration.objects.create(
            scope_type='GLOBAL', method='MOVING_AVERAGE',
            company_id=1, branch_id=1, created_by=self.user
        )
        self.assertTrue(fc.is_active)

    def test_defaults(self):
        fc = ForecastConfiguration.objects.create(
            scope_type='GLOBAL', company_id=1, branch_id=1
        )
        self.assertEqual(fc.window_days, 30)
        self.assertEqual(fc.forecast_horizon_days, 30)
        self.assertEqual(fc.smoothing_factor, 0.3)

    def test_scope_type_choices(self):
        for st in ['GLOBAL', 'VARIANT', 'CATEGORY']:
            fc = ForecastConfiguration.objects.create(
                scope_type=st, company_id=1, branch_id=1
            )
            self.assertEqual(fc.scope_type, st)

    def test_method_choices(self):
        for m in ['MOVING_AVERAGE', 'EXPONENTIAL_SMOOTHING', 'LINEAR_REGRESSION']:
            fc = ForecastConfiguration.objects.create(
                scope_type='GLOBAL', method=m, company_id=1, branch_id=1
            )
            self.assertEqual(fc.method, m)


class SalesForecastTest(TestCase):
    def setUp(self):
        from apps.inventory.models import Product, ProductVariant
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='SF1', company_id=1, branch_id=1
        )

    def test_create(self):
        sf = SalesForecast.objects.create(
            variant=self.variant, forecast_date=date(2025, 7, 1),
            predicted_quantity=Decimal('150.00'),
            method_used='MOVING_AVERAGE',
            company_id=1, branch_id=1
        )
        self.assertEqual(sf.confidence, 0.95)

    def test_ordering(self):
        from apps.inventory.models import Product, ProductVariant
        p2 = Product.objects.create(product_name='P2', company_id=1, branch_id=1)
        v2 = ProductVariant.objects.create(product=p2, sku='SF2', company_id=1, branch_id=1)
        sf1 = SalesForecast.objects.create(
            variant=self.variant, forecast_date=date(2025, 7, 1),
            predicted_quantity=Decimal('100'), method_used='MA', company_id=1, branch_id=1
        )
        sf2 = SalesForecast.objects.create(
            variant=v2, forecast_date=date(2025, 7, 5),
            predicted_quantity=Decimal('200'), method_used='MA', company_id=1, branch_id=1
        )
        forecasts = list(SalesForecast.objects.all())
        self.assertEqual(forecasts[0].forecast_date, date(2025, 7, 5))


class StockForecastTest(TestCase):
    def setUp(self):
        from apps.inventory.models import Product, ProductVariant, Warehouse
        self.product = Product.objects.create(product_name='P', company_id=1, branch_id=1)
        self.variant = ProductVariant.objects.create(
            product=self.product, sku='STKF1', company_id=1, branch_id=1
        )
        self.warehouse = Warehouse.objects.create(
            warehouse_name='WH', code='WH1', country='C', city='C',
            company_id=1, branch_id=1
        )

    def test_create(self):
        sf = StockForecast.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            forecast_date=date(2025, 7, 1),
            projected_closing_stock=Decimal('50.00'),
            company_id=1, branch_id=1
        )
        self.assertEqual(sf.required_purchase_qty, Decimal('0'))

    def test_unique_together(self):
        StockForecast.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            forecast_date=date(2025, 7, 1),
            projected_closing_stock=Decimal('50'), company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            StockForecast.objects.create(
                variant=self.variant, warehouse=self.warehouse,
                forecast_date=date(2025, 7, 1),
                projected_closing_stock=Decimal('60'), company_id=1, branch_id=1
            )

    def test_different_date_ok(self):
        StockForecast.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            forecast_date=date(2025, 7, 1),
            projected_closing_stock=Decimal('50'), company_id=1, branch_id=1
        )
        sf = StockForecast.objects.create(
            variant=self.variant, warehouse=self.warehouse,
            forecast_date=date(2025, 7, 2),
            projected_closing_stock=Decimal('40'), company_id=1, branch_id=1
        )
        self.assertIsNotNone(sf._id)
