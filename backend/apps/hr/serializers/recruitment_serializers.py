# apps/hr/serializers/recruitment_serializers.py

from rest_framework import serializers
from apps.hr.models import RecruitmentCandidate, RecruitmentActivityLog, Employee
from datetime import date


class RecruitmentCandidateSerializer(serializers.ModelSerializer):
    """Serializer for Recruitment Candidate"""
    
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    assigned_to_id = serializers.IntegerField(source='assigned_to.id', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
    
    class Meta:
        model = RecruitmentCandidate
        fields = [
            'id', '_id', 'name', 'email', 'phone', 'position', 'department',
            'stage', 'status', 'apply_date', 'interview_date',
            'assigned_to_id', 'assigned_to_name', 'assigned_name',
            'resume_url', 'notes', 'source', 'expected_salary',
            'current_company', 'current_position', 'years_of_experience',
            'notice_period_days', 'interview_round', 'interview_notes',
            'interviewers', 'offer_sent_date', 'offer_accepted_date',
            'offer_amount', 'joining_date', 'rejection_reason', 'rejection_date',
            'created_at', 'updated_at', 'created_by_name', 'updated_by_name'
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at', 'created_by_name', 'updated_by_name']
    
    def validate_apply_date(self, value):
        if value and value > date.today():
            raise serializers.ValidationError("Apply date cannot be in the future")
        return value
    
    def validate_interview_date(self, value):
        if value and value < date.today():
            raise serializers.ValidationError("Interview date cannot be in the past")
        return value
    
    def validate(self, data):
        # If stage is Hired, joining_date should be provided
        if data.get('stage') == 'Hired' and not data.get('joining_date'):
            raise serializers.ValidationError({"joining_date": "Joining date is required when candidate is hired"})
        
        # If stage is Rejected, rejection_reason should be provided
        if data.get('stage') == 'Rejected' and not data.get('rejection_reason'):
            raise serializers.ValidationError({"rejection_reason": "Rejection reason is required when candidate is rejected"})
        
        # If offer is sent, offer_amount should be provided
        if data.get('stage') == 'Offer' and not data.get('offer_amount'):
            raise serializers.ValidationError({"offer_amount": "Offer amount is required when offer is sent"})
        
        return data


class RecruitmentActivityLogSerializer(serializers.ModelSerializer):
    """Serializer for Recruitment Activity Log"""
    
    performed_by_name = serializers.CharField(source='performed_by.username', read_only=True)
    candidate_name = serializers.CharField(source='candidate.name', read_only=True)
    
    class Meta:
        model = RecruitmentActivityLog
        fields = [
            'id', '_id', 'candidate', 'candidate_name', 'action',
            'old_value', 'new_value', 'metadata', 'ip_address',
            'user_agent', 'performed_by', 'performed_by_name',
            'created_at'
        ]
        read_only_fields = ['id', '_id', 'created_at']


class RecruitmentStatsSerializer(serializers.Serializer):
    """Serializer for Recruitment Statistics"""
    
    total_applicants = serializers.IntegerField()
    screening = serializers.IntegerField()
    interviewing = serializers.IntegerField()
    offer_sent = serializers.IntegerField()
    hired = serializers.IntegerField()
    rejected = serializers.IntegerField()
    by_department = serializers.DictField(child=serializers.IntegerField())
    by_source = serializers.DictField(child=serializers.IntegerField())
    by_month = serializers.ListField(child=serializers.DictField())