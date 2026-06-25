from django.test.runner import DiscoverRunner


class AppTestRunner(DiscoverRunner):
    """Test runner that maps short app labels (e.g. 'hr') to their full
    dotted paths (e.g. 'apps.hr') so you can run:
        python manage.py test hr
        python manage.py test hr inventory finance
        python manage.py test  (runs all)
    """

    APP_LABEL_MAP = {
        'accounts': 'apps.accounts',
        'audit': 'apps.audit',
        'common': 'apps.common',
        'compsetting': 'apps.compsetting',
        'finance': 'apps.finance',
        'forecast': 'apps.forecast',
        'hr': 'apps.hr',
        'inventory': 'apps.inventory',
        'monitoring': 'apps.monitoring',
        'notifications': 'apps.notifications',
        'organization': 'apps.organization',
        'overall_dashboard': 'apps.overall_dashboard',
        'permissions': 'apps.permissions',
        'sales': 'apps.sales',
    }

    def build_suite(self, test_labels=None, **kwargs):
        if test_labels:
            resolved = []
            for label in test_labels:
                resolved.append(self.APP_LABEL_MAP.get(label, label))
            test_labels = resolved
        return super().build_suite(test_labels, **kwargs)
