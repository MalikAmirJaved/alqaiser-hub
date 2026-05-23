from .services import PermissionService

class PermissionMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.user.is_authenticated:
            # Attach a has_perm method to the user object
            request.user.has_perm = lambda perm: PermissionService.user_has_permission(request.user, perm)
        return self.get_response(request)