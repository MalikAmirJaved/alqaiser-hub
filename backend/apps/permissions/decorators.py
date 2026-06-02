from functools import wraps

from django.http import JsonResponse

from .services import PermissionService


def require_permission_code(perm_code):
    """Decorator for function-based views using a full permission code."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            checker = getattr(request, 'has_perm_code', None)
            if checker is None:
                checker = lambda code: PermissionService.user_has_permission(request.user, code)
            if not checker(perm_code):
                return JsonResponse(
                    {'error': 'You do not have permission to perform this action.', 'permission': perm_code},
                    status=403,
                )
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator


def require_permission(module, resource, action):
    """Decorator using module/resource/action, e.g. require_permission('HR', 'employee', 'create')."""
    def decorator(view_func):
        @wraps(view_func)
        def wrapper(request, *args, **kwargs):
            require = getattr(request, 'require_permission', None)
            if require is None:
                from .checks import require_permission as _require
                _require(request.user, module, resource, action)
            else:
                require(module, resource, action)
            return view_func(request, *args, **kwargs)
        return wrapper
    return decorator