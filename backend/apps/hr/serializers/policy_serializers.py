# apps/hr/serializers/policy_serializers.py
from rest_framework import serializers
from django.utils import timezone
from apps.hr.models import Policy, PolicyVersion, PolicyCategory


class PolicyVersionSerializer(serializers.ModelSerializer):
    """Serializer for policy version history"""
    
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = PolicyVersion
        fields = [
            'id', 'version', 'content', 'document_url', 
            'change_summary', 'changed_by_name',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'changed_by_name']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return None


class PolicyListSerializer(serializers.ModelSerializer):
    """Compact serializer for policy lists"""
    
    id = serializers.UUIDField(source='_id', read_only=True)
    department_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Policy
        fields = [
            'id', 'code', 'title', 'category', 'department', 'department_name',
            'employee_type', 'version', 'status',
            'document_url', 'created_at',
        ]
    
    def get_department_name(self, obj):
        if obj.department:
            return obj.department.name
        return 'All'


class PolicyDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for single policy view"""
    
    id = serializers.UUIDField(source='_id', read_only=True)
    approved_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    versions = PolicyVersionSerializer(many=True, read_only=True)
    department_name = serializers.SerializerMethodField()
    
    class Meta:
        model = Policy
        fields = [
            'id', 'code', 'title', 'category', 'department', 'department_name',
            'employee_type', 'version', 'status',
            'approval_date', 'document_url', 'content',
            'change_summary', 'approved_by', 'approved_by_name',
            'created_by_name', 'updated_by_name',
            'created_at', 'updated_at',
            'versions',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
    def get_department_name(self, obj):
        if obj.department:
            return obj.department.name
        return 'All'
    
    def get_approved_by_name(self, obj):
        if obj.approved_by:
            return obj.approved_by.get_full_name() or obj.approved_by.username
        return None
    
    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return None
    
    def get_updated_by_name(self, obj):
        if obj.updated_by:
            return obj.updated_by.get_full_name() or obj.updated_by.username
        return None


class PolicyCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating policies"""
    
    class Meta:
        model = Policy
        fields = [
            'code', 'title', 'category', 'department',
            'employee_type', 'version', 'status',
            'document_url', 'content', 'change_summary',
            'approved_by', 'approval_date'
        ]
    
    def validate_code(self, value):
        """Ensure policy code is unique within company"""
        company = self.context['request'].user.company_id
        instance = self.instance
        
        queryset = Policy.objects.filter(company_id=company, code=value)
        if instance:
            queryset = queryset.exclude(pk=instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("A policy with this code already exists.")
        
        return value
    
    def create(self, validated_data):
        """Create policy with version tracking"""
        company_id = self.context['request'].user.company_id
        
        policy = Policy.objects.create(
            company_id=company_id,
            created_by=self.context['request'].user,
            updated_by=self.context['request'].user,
            **validated_data
        )
        
        PolicyVersion.objects.create(
            policy=policy,
            version=policy.version,
            content=policy.content,
            document_url=policy.document_url,
            change_summary="Initial version created",
            changed_by=self.context['request'].user,
        )
        
        return policy

    
    def update(self, instance, validated_data):
        """Update policy with version tracking"""
        old_version = instance.version
        
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.updated_by = self.context['request'].user
        
        if 'version' in validated_data and validated_data['version'] != old_version:
            PolicyVersion.objects.create(
                company_id=instance.company_id,
                policy=instance,
                version=instance.version,
                content=instance.content,
                document_url=instance.document_url,
                change_summary=validated_data.get('change_summary', ''),
                changed_by=self.context['request'].user,
                created_by=self.context['request'].user,
                updated_by=self.context['request'].user,
            )
        
        instance.save()
        return instance


class PolicyCategorySerializer(serializers.ModelSerializer):
    """Serializer for policy categories"""
    
    class Meta:
        model = PolicyCategory
        fields = ['id', 'name', 'description', 'is_active', 'sorting_order', 'color_code', 'icon']
