from functools import partial

from .checks import check_permission, require_permission
from .services import PermissionService


class PermissionMiddleware:
    """
    Attach permission helpers to each authenticated request.
    Runs after AuthenticationMiddleware so request.user is available.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, 'user', None)
        if user is not None and user.is_authenticated:
            request.has_perm_code = partial(
                PermissionService.user_has_permission,
                user,
            )
            request.check_permission = partial(check_permission, user)
            request.require_permission = partial(require_permission, user)
            user.has_perm_code = request.has_perm_code
        return self.get_response(request)
