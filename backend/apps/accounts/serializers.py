from rest_framework import serializers
from apps.organization.models import User


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(source='get_full_name', read_only=True)
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'role', 'company_id', 'branch_id', 
                  'full_name', 'is_active', 'is_staff', 'is_superuser']