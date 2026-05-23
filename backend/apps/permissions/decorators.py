from functools import wraps
from django.http import JsonResponse

def require_permission(perm_code):
    """Decorator for function-based views or class-based views' methods."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            if not request.user.has_perm(perm_code):
                return JsonResponse({'error': 'Forbidden', 'permission': perm_code}, status=403)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator