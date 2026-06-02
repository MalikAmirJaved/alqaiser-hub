from django.contrib.auth.backends import ModelBackend
from django.contrib.auth import get_user_model
from django.db.models import Q

UserModel = get_user_model()

class EmailOrUsernameBackend(ModelBackend):
    """
    Allows authentication with either username or email.
    """
    def authenticate(self, request, username=None, password=None, **kwargs):
        if username is None:
            username = kwargs.get(UserModel.USERNAME_FIELD)
        
        if username is None or password is None:
            return None
        
        # Try to find user by username OR email (case-insensitive)
        try:
            user = UserModel.objects.get(
                Q(username__iexact=username) | Q(email__iexact=username)
            )
        except UserModel.DoesNotExist:
            # Run the default password hasher to prevent user enumeration
            UserModel().set_password(password)
            return None
        
        if user.check_password(password) and self.user_can_authenticate(user):
            return user
        return None