from celery import shared_task
from .services import DemandForecaster, StockForecaster

@shared_task
def generate_sales_forecasts_for_all_companies():
    from apps.organization.models import Company  # adapt to your tenant model
    for company in Company.objects.filter(is_active=True):
        for branch in company.branches.filter(is_active=True):
            DemandForecaster.run_for_all_active_variants(company.id, branch.id)

@shared_task
def generate_stock_forecasts_for_all_companies():
    from apps.organization.models import Company
    for company in Company.objects.filter(is_active=True):
        for branch in company.branches.filter(is_active=True):
            StockForecaster.run_for_all(company.id, branch.id)