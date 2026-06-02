# apps/hr/serializers/policy_serializers.py
from rest_framework import serializers
from django.utils import timezone
from apps.hr.models import Policy, PolicyAcknowledgment, PolicyVersion, PolicyCategory


class PolicyVersionSerializer(serializers.ModelSerializer):
    """Serializer for policy version history"""
    
    changed_by_name = serializers.SerializerMethodField()
    
    class Meta:
        model = PolicyVersion
        fields = [
            'id', 'version', 'content', 'document_url', 
            'change_summary', 'effective_date', 'changed_by_name',
            'created_at'
        ]
        read_only_fields = ['id', 'created_at', 'changed_by_name']
    
    def get_changed_by_name(self, obj):
        if obj.changed_by:
            return obj.changed_by.get_full_name() or obj.changed_by.username
        return None


class PolicyAcknowledgmentSerializer(serializers.ModelSerializer):
    """Serializer for policy acknowledgments"""
    
    employee_name = serializers.SerializerMethodField()
    employee_id = serializers.SerializerMethodField()
    
    class Meta:
        model = PolicyAcknowledgment
        fields = [
            'id', 'employee', 'employee_name', 'employee_id',
            'acknowledged_at', 'acknowledged_via', 'notes'
        ]
        read_only_fields = ['id', 'acknowledged_at']
    
    def get_employee_name(self, obj):
        return obj.employee.full_name if obj.employee else None
    
    def get_employee_id(self, obj):
        return obj.employee.employee_id if obj.employee else None


class PolicyListSerializer(serializers.ModelSerializer):
    """Compact serializer for policy lists"""
    
    acknowledgment_stats = serializers.SerializerMethodField()
    
    class Meta:
        model = Policy
        fields = [
            'id', 'code', 'title', 'category', 'department',
            'employee_type', 'version', 'status', 'effective_date',
            'review_date', 'expiry_date', 'requires_acknowledgment',
            'acknowledgment_deadline', 'document_url', 'created_at',
            'acknowledgment_stats'
        ]
    
    def get_acknowledgment_stats(self, obj):
        if not obj.requires_acknowledgment:
            return None
        
        total = obj.acknowledgments.count()
        return {
            'total_acknowledgments': total,
        }


class PolicyDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer for single policy view"""
    
    approved_by_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    updated_by_name = serializers.SerializerMethodField()
    acknowledgments = PolicyAcknowledgmentSerializer(many=True, read_only=True)
    versions = PolicyVersionSerializer(many=True, read_only=True)
    acknowledgment_stats = serializers.SerializerMethodField()
    
    class Meta:
        model = Policy
        fields = [
            'id', 'code', 'title', 'category', 'department',
            'employee_type', 'version', 'status',
            'effective_date', 'review_date', 'expiry_date',
            'approval_date', 'requires_acknowledgment',
            'acknowledgment_deadline', 'document_url', 'content',
            'change_summary', 'approved_by', 'approved_by_name',
            'created_by_name', 'updated_by_name',
            'created_at', 'updated_at',
            'acknowledgments', 'versions', 'acknowledgment_stats',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']
    
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
    
    def get_acknowledgment_stats(self, obj):
        if not obj.requires_acknowledgment:
            return None
        
        # Get total employees who should acknowledge
        from apps.hr.models import Employee
        total_employees = Employee.objects.filter(
            company=obj.company,
            is_deleted=False,
            employment_status='ACTIVE'
        ).count()
        
        acknowledged = obj.acknowledgments.count()
        pending = max(0, total_employees - acknowledged)
        
        return {
            'total_employees': total_employees,
            'acknowledged': acknowledged,
            'pending': pending,
            'completion_percentage': round((acknowledged / total_employees * 100) if total_employees > 0 else 0, 2)
        }


class PolicyCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating policies"""
    
    class Meta:
        model = Policy
        fields = [
            'code', 'title', 'category', 'department',
            'employee_type', 'version', 'status',
            'effective_date', 'review_date', 'expiry_date',
            'requires_acknowledgment', 'acknowledgment_deadline',
            'document_url', 'content', 'change_summary',
            'approved_by', 'approval_date'
        ]
    
    def validate_code(self, value):
        """Ensure policy code is unique within company"""
        company = self.context['request'].user.company_id
        instance = self.instance
        
        # Check for duplicates excluding current instance
        queryset = Policy.objects.filter(company_id=company, code=value)
        if instance:
            queryset = queryset.exclude(pk=instance.pk)
        
        if queryset.exists():
            raise serializers.ValidationError("A policy with this code already exists.")
        
        return value
    
    def validate(self, data):
        """Cross-field validation"""
        if data.get('status') == 'PUBLISHED' and not data.get('effective_date'):
            raise serializers.ValidationError({
                'effective_date': 'Effective date is required for published policies.'
            })
        
        if data.get('requires_acknowledgment') and not data.get('acknowledgment_deadline'):
            raise serializers.ValidationError({
                'acknowledgment_deadline': 'Acknowledgment deadline is required when acknowledgment is required.'
            })
        
        if data.get('expiry_date') and data.get('effective_date'):
            if data['expiry_date'] <= data['effective_date']:
                raise serializers.ValidationError({
                    'expiry_date': 'Expiry date must be after effective date.'
                })
        
        return data
    
    def create(self, validated_data):
        """Create policy with version tracking"""
        company_id = self.context['request'].user.company_id
        
        policy = Policy.objects.create(
            company_id=company_id,
            created_by=self.context['request'].user,
            updated_by=self.context['request'].user,
            **validated_data
        )
        
        # Create initial version - remove company_id, created_by, updated_by
        PolicyVersion.objects.create(
            policy=policy,
            version=policy.version,
            content=policy.content,
            document_url=policy.document_url,
            change_summary="Initial version created",
            effective_date=policy.effective_date,
            changed_by=self.context['request'].user,
        )
        
        return policy

    
    def update(self, instance, validated_data):
        """Update policy with version tracking"""
        old_version = instance.version
        
        # Update instance
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        
        instance.updated_by = self.context['request'].user
        
        # Create new version if version changed
        if 'version' in validated_data and validated_data['version'] != old_version:
            PolicyVersion.objects.create(
                company_id=instance.company_id,
                policy=instance,
                version=instance.version,
                content=instance.content,
                document_url=instance.document_url,
                change_summary=validated_data.get('change_summary', ''),
                effective_date=instance.effective_date,
                changed_by=self.context['request'].user,
                created_by=self.context['request'].user,
                updated_by=self.context['request'].user,
            )
        
        instance.save()
        return instance


class PolicyAcknowledgmentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating acknowledgments"""
    
    class Meta:
        model = PolicyAcknowledgment
        fields = ['policy', 'employee', 'notes']
    
    def validate(self, data):
        """Validate that acknowledgment doesn't already exist"""
        existing = PolicyAcknowledgment.objects.filter(
            policy=data['policy'],
            employee=data['employee'],
            company=self.context['request'].user.company_id
        ).exists()
        
        if existing:
            raise serializers.ValidationError("Employee has already acknowledged this policy.")
        
        return data
    
    def create(self, validated_data):
        company_id = self.context['request'].user.company_id
        
        acknowledgment = PolicyAcknowledgment.objects.create(
            company_id=company_id,
            acknowledged_via='WEB',
            ip_address=self.context['request'].META.get('REMOTE_ADDR'),
            created_by=self.context['request'].user,
            updated_by=self.context['request'].user,
            **validated_data
        )
        
        return acknowledgment


class PolicyCategorySerializer(serializers.ModelSerializer):
    """Serializer for policy categories"""
    
    class Meta:
        model = PolicyCategory
        fields = ['id', 'name', 'description', 'is_active', 'sorting_order', 'color_code', 'icon']


class BulkPolicyAcknowledgmentSerializer(serializers.Serializer):
    """Serializer for bulk acknowledgments"""
    
    policy_id = serializers.IntegerField()
    employee_ids = serializers.ListField(
        child=serializers.IntegerField(),
        min_length=1
    )
    notes = serializers.CharField(required=False, allow_blank=True)