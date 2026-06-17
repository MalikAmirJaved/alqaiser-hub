from django.apps import AppConfig


class MonitoringConfig(AppConfig):
    name = 'apps.monitoring'

    def ready(self):
        # Clean up stale stream directories on startup
        try:
            from .stream_manager import StreamManager
            StreamManager.cleanup_stale_dirs(max_age_minutes=1)
        except Exception:
            pass
