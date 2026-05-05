from django.contrib.auth import get_user_model
from django.db.models.signals import post_migrate
from django.dispatch import receiver

@receiver(post_migrate)
def create_super_admin(sender, **kwargs):
    User = get_user_model()

    if not User.objects.filter(is_superuser=True).exists():
        User.objects.create_superuser(
            username="superAdmin",
            email="superadmin123@gmail.com",
            password="123",
        )
        print("✅ SuperAdmin created successfully")