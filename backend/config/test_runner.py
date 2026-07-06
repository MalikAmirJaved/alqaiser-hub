import sys
import os
import time
import traceback
import unittest
from io import StringIO
from django.test.runner import DiscoverRunner
from django.conf import settings


class Colors:
    """ANSI color codes for terminal output."""
    HEADER = '\033[95m'
    BLUE = '\033[94m'
    CYAN = '\033[96m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BOLD = '\033[1m'
    DIM = '\033[2m'
    UNDERLINE = '\033[4m'
    RESET = '\033[0m'

    BG_GREEN = '\033[42m'
    BG_RED = '\033[41m'


def supports_color():
    """Check if the terminal supports color."""
    if not hasattr(sys.stdout, 'isatty'):
        return False
    return sys.stdout.isatty()


USE_COLOR = supports_color()


def c(code, text):
    """Wrap text with color code if colors are supported."""
    if USE_COLOR:
        return f"{code}{text}{Colors.RESET}"
    return text


class HierarchicalTestResult(unittest.TextTestResult):
    """Custom result class that feeds into the hierarchical collector."""

    def __init__(self, stream, descriptions, verbosity):
        super().__init__(stream, descriptions, verbosity)
        self._test_start_times = {}
        self._all_results = []

    def startTest(self, test):
        self._test_start_times[test.id()] = time.time()
        super().startTest(test)

    def addSuccess(self, test):
        super().addSuccess(test)
        duration = time.time() - self._test_start_times.get(test.id(), 0)
        self._all_results.append({
            'test_id': test.id(),
            'status': 'PASS',
            'duration': duration,
            'error_info': None,
        })

    def addFailure(self, test, err):
        super().addFailure(test, err)
        duration = time.time() - self._test_start_times.get(test.id(), 0)
        error_info = self._get_error_info(err)
        self._all_results.append({
            'test_id': test.id(),
            'status': 'FAIL',
            'duration': duration,
            'error_info': error_info,
        })

    def addError(self, test, err):
        super().addError(test, err)
        duration = time.time() - self._test_start_times.get(test.id(), 0)
        error_info = self._get_error_info(err)
        self._all_results.append({
            'test_id': test.id(),
            'status': 'ERROR',
            'duration': duration,
            'error_info': error_info,
        })

    def addSkip(self, test, reason):
        super().addSkip(test, reason)
        self._all_results.append({
            'test_id': test.id(),
            'status': 'SKIP',
            'duration': 0,
            'error_info': reason,
        })

    def _get_error_info(self, err):
        """Extract a concise error message."""
        exc_type, exc_value, exc_tb = err
        tb_lines = traceback.format_exception(exc_type, exc_value, exc_tb)
        for line in reversed(tb_lines):
            line = line.strip()
            if line and not line.startswith('Traceback'):
                return line[:300]
        return str(exc_value)[:300]


class HierarchicalTestResultPrinter:
    """Organizes and prints test results hierarchically."""

    def __init__(self, test_result, elapsed):
        self.results = test_result._all_results
        self.elapsed = elapsed
        self.total = len(self.results)
        self.passed = sum(1 for r in self.results if r['status'] == 'PASS')
        self.failed = sum(1 for r in self.results if r['status'] == 'FAIL')
        self.errors = sum(1 for r in self.results if r['status'] == 'ERROR')
        self.skipped = sum(1 for r in self.results if r['status'] == 'SKIP')

    def _resolve_hierarchy(self, test_id):
        """Parse test ID into (app_label, class_name, method_name)."""
        parts = test_id.split('.')
        try:
            tests_idx = parts.index('tests')
        except ValueError:
            return ('unknown', 'unknown', test_id)

        app_label = parts[tests_idx - 1] if tests_idx > 0 else 'unknown'
        class_name = parts[tests_idx + 1] if len(parts) > tests_idx + 1 else 'unknown'
        method_name = parts[tests_idx + 2] if len(parts) > tests_idx + 2 else 'unknown'

        return (app_label, class_name, method_name)

    def print_results(self):
        """Print the hierarchical results."""
        print()
        print(c(Colors.BOLD + Colors.CYAN, '═' * 72))
        print(c(Colors.BOLD + Colors.CYAN, '  AL QAISER ERP — TEST SUITE'))
        print(c(Colors.BOLD + Colors.CYAN, '═' * 72))
        print()

        # Organize into hierarchy
        apps = {}
        for result in self.results:
            app_label, class_name, method_name = self._resolve_hierarchy(result['test_id'])
            if app_label not in apps:
                apps[app_label] = {}
            if class_name not in apps[app_label]:
                apps[app_label][class_name] = []
            apps[app_label][class_name].append({
                'method': method_name,
                'status': result['status'],
                'duration': result['duration'],
                'error_info': result['error_info'],
            })

        sorted_apps = sorted(apps.items(), key=lambda x: x[0])
        app_num = 0

        for app_label, classes in sorted_apps:
            app_num += 1
            app_tests = sum(len(methods) for methods in classes.values())
            app_failed = sum(
                1 for methods in classes.values()
                for m in methods if m['status'] in ('FAIL', 'ERROR')
            )

            if app_failed == 0:
                status_icon = c(Colors.GREEN, '✓')
            else:
                status_icon = c(Colors.RED, '✗')

            print(c(Colors.BOLD, f'  {app_num}. {app_label.upper()}') +
                  f'  [{app_tests} tests] {status_icon}')

            class_num = 0
            for class_name, methods in sorted(classes.items()):
                class_num += 1
                class_passed = sum(1 for m in methods if m['status'] == 'PASS')
                class_failed = sum(1 for m in methods if m['status'] in ('FAIL', 'ERROR'))

                display_name = class_name
                if display_name.endswith('Test'):
                    display_name = display_name[:-4]
                elif display_name.endswith('TestCase'):
                    display_name = display_name[:-8]

                if class_failed == 0:
                    cls_icon = c(Colors.GREEN, '●')
                else:
                    cls_icon = c(Colors.RED, '●')

                print(f'      {app_num}.{class_num}  {cls_icon} {display_name}  '
                      f'{c(Colors.DIM, f"({class_passed}/{len(methods)} passed)")}')

                for method in methods:
                    method_name = method['method']
                    if method_name.startswith('test_'):
                        method_name = method_name[5:]

                    if method['status'] == 'PASS':
                        icon = c(Colors.GREEN, '  ✓')
                        dur = c(Colors.DIM, f' {method["duration"]:.3f}s') if method['duration'] > 0.1 else ''
                    elif method['status'] == 'FAIL':
                        icon = c(Colors.RED, '  ✗')
                        dur = c(Colors.DIM, f' {method["duration"]:.3f}s')
                    elif method['status'] == 'ERROR':
                        icon = c(Colors.RED + Colors.BOLD, '  ✗')
                        dur = c(Colors.DIM, f' {method["duration"]:.3f}s')
                    elif method['status'] == 'SKIP':
                        icon = c(Colors.YELLOW, '  ○')
                        dur = c(Colors.DIM, ' skip')
                    else:
                        icon = '  ?'
                        dur = ''

                    print(f'          {icon} {method_name}{dur}')

            print()

        # Print failure details
        failures = [r for r in self.results if r['status'] in ('FAIL', 'ERROR')]
        if failures:
            print(c(Colors.BOLD + Colors.RED, '═' * 72))
            print(c(Colors.BOLD + Colors.RED, '  FAILURES & ERRORS'))
            print(c(Colors.BOLD + Colors.RED, '═' * 72))
            print()

            for i, result in enumerate(failures, 1):
                print(c(Colors.BOLD + Colors.RED, f'  {i}. {result["test_id"]}'))
                if result['error_info']:
                    print(c(Colors.RED, f'     {result["error_info"]}'))
                print()

        # Summary
        print(c(Colors.BOLD + Colors.CYAN, '─' * 72))
        print(c(Colors.BOLD, '  SUMMARY'))
        print(c(Colors.BOLD + Colors.CYAN, '─' * 72))

        passed_pct = (self.passed / self.total * 100) if self.total > 0 else 0

        bar_width = 40
        filled = int(bar_width * self.passed / self.total) if self.total > 0 else 0
        bar = c(Colors.GREEN, '█' * filled) + c(Colors.DIM, '░' * (bar_width - filled))

        print(f'    Progress  [{bar}] {passed_pct:.0f}%')
        print()
        print(f'    {c(Colors.GREEN, f"Passed:    {self.passed}")}')
        if self.failed > 0:
            print(f'    {c(Colors.RED, f"Failed:    {self.failed}")}')
        if self.errors > 0:
            print(f'    {c(Colors.RED + Colors.BOLD, f"Errors:    {self.errors}")}')
        if self.skipped > 0:
            print(f'    {c(Colors.YELLOW, f"Skipped:   {self.skipped}")}')
        print(f'    Total:    {self.total}')
        print(f'    Time:     {self.elapsed:.2f}s')
        print()

        if self.failed == 0 and self.errors == 0:
            print(c(Colors.BOLD + Colors.BG_GREEN + Colors.GREEN, '  ✓ ALL TESTS PASSED  '))
        else:
            print(c(Colors.BOLD + Colors.BG_RED + Colors.RED, f'  ✗ {self.failed + self.errors} TEST(S) FAILED  '))
        print()


# Ordered list of all apps to discover tests from
ALL_APPS = [
    'apps.accounts',
    'apps.audit',
    'apps.common',
    'apps.compsetting',
    'apps.finance',
    'apps.forecast',
    'apps.hr',
    'apps.inventory',
    'apps.monitoring',
    'apps.notifications',
    'apps.organization',
    'apps.overall_dashboard',
    'apps.permissions',
    'apps.sales',
]

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


class HierarchicalTestRunner(DiscoverRunner):
    """
    Professional test runner with hierarchical output.

    Displays results in a tree structure:
        1. ORGANIZATION
          ● Company
            ✓ create
            ✓ unique_short_name
          ● Branch
            ✓ create_branch
        2. HR
          ● Employee
            ✓ create
            ✓ defaults

    Usage:
        python manage.py test              # Run all tests
        python manage.py test hr           # Run HR tests only
        python manage.py test hr inventory # Run multiple apps
    """

    def build_suite(self, test_labels=None, **kwargs):
        if test_labels:
            resolved = []
            for label in test_labels:
                resolved.append(APP_LABEL_MAP.get(label, label))
            test_labels = resolved
        else:
            # When no labels, explicitly discover from each app
            test_labels = ALL_APPS
        return super().build_suite(test_labels, **kwargs)

    def run_tests(self, test_labels, extra_tests=None):
        """Override to capture and display results hierarchically."""
        self.setup_test_environment()
        suite = self.build_suite(test_labels)
        if extra_tests:
            suite.addTests(extra_tests)

        databases = self.get_databases(suite)
        suite.serialized_aliases = set(
            alias for alias, serialize in databases.items() if serialize
        )
        suite.used_aliases = set(databases)

        old_config = self.setup_databases(
            aliases=databases,
            serialized_aliases=suite.serialized_aliases,
        )

        start_time = time.time()

        resultclass = HierarchicalTestResult
        stream = StringIO()
        runner = unittest.TextTestRunner(
            stream=stream,
            verbosity=0,
            resultclass=resultclass,
        )

        try:
            test_result = runner.run(suite)
        finally:
            elapsed = time.time() - start_time
            self.teardown_databases(old_config)
            self.teardown_test_environment()

        # Print our hierarchical output
        printer = HierarchicalTestResultPrinter(test_result, elapsed)
        printer.print_results()

        if test_result.failures or test_result.errors:
            return 1
        return 0
