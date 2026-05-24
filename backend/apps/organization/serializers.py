from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Branch

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    branch_id = serializers.UUIDField(source='branch._id', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)
    password = serializers.CharField(write_only=True, required=False, min_length=6)

    class Meta:
        model = User
        fields = [
            'id', '_id', 'username', 'email', 'first_name', 'last_name',
            'department', 'designation', 'phone_number', 'is_active',
            'branch_id', 'branch_name', 'created_at', 'updated_at', 'password'
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at', 'branch_id', 'branch_name']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        
        # Set default values for new users
        validated_data['role'] = 'STAFF'
        validated_data['is_staff'] = True
        validated_data['is_superuser'] = False
        validated_data['is_active'] = True
        
        user = User(**validated_data)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        
        # Only allow updating specific fields
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.email = validated_data.get('email', instance.email)
        instance.department = validated_data.get('department', instance.department)
        instance.designation = validated_data.get('designation', instance.designation)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.is_active = validated_data.get('is_active', instance.is_active)
        
        if password:
            instance.set_password(password)
        
        instance.save()
        return instance


class BranchSerializer(serializers.ModelSerializer):
    class Meta:
        model = Branch
        fields = [
            'id', '_id',
            'name', 'code',
            'address', 'city', 'state', 'country',
            'phone', 'email',
            'is_hq', 'currency_code', 'tax_id',
            'created_by', 'updated_by'
        ]
        read_only_fields = [
            'id', '_id',
            'created_by', 'updated_by'
        ]

    def validate_code(self, value):
        company = self.context.get('company')
        if company and Branch.objects.filter(company=company, code=value).exists():
            raise serializers.ValidationError("Branch code already exists for this company")
        return value

    def validate_name(self, value):
        company = self.context.get('company')
        if company and Branch.objects.filter(company=company, name=value).exists():
            raise serializers.ValidationError("Branch name already exists for this company")
        return value

    def create(self, validated_data):
        validated_data.pop("created_by", None)
        validated_data.pop("updated_by", None)
        return super().create(validated_data)