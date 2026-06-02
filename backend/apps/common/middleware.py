import threading

_thread_locals = threading.local()

def get_current_request():
    """Retrieve the current request from thread-local storage."""
    return getattr(_thread_locals, 'request', None)

class CurrentRequestMiddleware:
    """
    Middleware to store the current request in thread-local storage.
    This allows signals and other non-view code to access the request.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        _thread_locals.request = request
        response = self.get_response(request)
        # Clean up to avoid memory leaks
        if hasattr(_thread_locals, 'request'):
            del _thread_locals.request
        return response