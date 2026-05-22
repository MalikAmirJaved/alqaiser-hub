from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Branch, Company

User = get_user_model()

class UserProfileSerializer(serializers.ModelSerializer):
    branch_id = serializers.UUIDField(source='branch._id', read_only=True)
    branch_name = serializers.CharField(source='branch.name', read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'email', 'full_name', 'first_name', 'last_name',
            'role', 'employee_id', 'department', 'designation', 'phone_number',
            'branch_id', 'branch_name'
        ]
        read_only_fields = ['id', 'username', 'role', 'branch_id', 'branch_name']

    def update(self, instance, validated_data):
        instance.full_name = validated_data.get('full_name', instance.full_name)
        instance.email = validated_data.get('email', instance.email)
        instance.phone_number = validated_data.get('phone_number', instance.phone_number)
        instance.department = validated_data.get('department', instance.department)
        instance.designation = validated_data.get('designation', instance.designation)
        # NEW
        instance.first_name = validated_data.get('first_name', instance.first_name)
        instance.last_name = validated_data.get('last_name', instance.last_name)
        instance.username = validated_data.get('username', instance.last_name)

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
        # safety fallback (prevents crashes)
        validated_data.pop("created_by", None)
        validated_data.pop("updated_by", None)
        return super().create(validated_data)