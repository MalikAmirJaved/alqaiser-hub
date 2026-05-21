# apps/common/middleware.py
import threading
from contextvars import ContextVar

# Use ContextVar for async safety if you use ASGI/async signals
audit_context = ContextVar('audit_context', default={})

# Fallback for thread‑local (sync only)
_thread_local = threading.local()

class AuditRequestMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Build context
        context = {
            'user_id': request.user.id if request.user.is_authenticated else None,
            'ip_address': self.get_client_ip(request),
            'user_agent': request.META.get('HTTP_USER_AGENT', ''),
        }
        # Set in both contextvars and thread‑local (signals will try one then the other)
        audit_context.set(context)
        _thread_local.audit_context = context

        response = self.get_response(request)

        # Clear after request (optional)
        try:
            audit_context.set({})
            delattr(_thread_local, 'audit_context')
        except AttributeError:
            pass
        return response

    def get_client_ip(self, request):
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            ip = x_forwarded_for.split(',')[0]
        else:
            ip = request.META.get('REMOTE_ADDR')
        return ip