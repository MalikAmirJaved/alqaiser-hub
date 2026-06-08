from rest_framework.routers import DefaultRouter
from .views import SalesForecastViewSet, StockForecastViewSet, ForecastConfigurationViewSet

router = DefaultRouter()
router.register(r'sales-forecast', SalesForecastViewSet, basename='sales-forecast')
router.register(r'stock-forecast', StockForecastViewSet, basename='stock-forecast')
router.register(r'forecast-config', ForecastConfigurationViewSet, basename='forecast-config')

urlpatterns = router.urls