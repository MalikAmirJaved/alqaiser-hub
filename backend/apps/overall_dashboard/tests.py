from django.contrib.auth import get_user_model
from django.test import TestCase

User = get_user_model()


class OverallDashboardImportTest(TestCase):
    def test_import_views(self):
        from apps.overall_dashboard.views import OverallDashboardViewSet
        self.assertTrue(hasattr(OverallDashboardViewSet, 'summary'))

    def test_import_urls(self):
        from apps.overall_dashboard.urls import urlpatterns
        self.assertTrue(len(urlpatterns) > 0)
