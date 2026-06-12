# apps/hr/serializers/recruitment_serializers.py

from rest_framework import serializers
from apps.hr.models import RecruitmentCandidate, RecruitmentActivityLog, InterviewRound
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



class InterviewRoundSerializer(serializers.ModelSerializer):
    """Serializer for Interview Rounds"""
    
    interviewer_name_display = serializers.CharField(source='interviewer.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    interview_type_display = serializers.CharField(source='get_interview_type_display', read_only=True)
    
    class Meta:
        model = InterviewRound
        fields = [
            'id', '_id', 'round_number', 'round_title', 'interview_type',
            'interview_type_display', 'status', 'status_display', 'interview_date',
            'interviewer', 'interviewer_name', 'interviewer_name_display',
            'feedback', 'rating', 'notes', 'meeting_link', 'duration_minutes',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at']


class RecruitmentCandidateDetailSerializer(serializers.ModelSerializer):
    """Detailed serializer with interview rounds"""
    
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    assigned_to_id = serializers.IntegerField(source='assigned_to.id', read_only=True)
    created_by_name = serializers.CharField(source='created_by.username', read_only=True)
    updated_by_name = serializers.CharField(source='updated_by.username', read_only=True)
    interview_rounds = InterviewRoundSerializer(many=True, read_only=True)
    current_round = serializers.IntegerField(read_only=True)
    highest_round = serializers.IntegerField(read_only=True)
    overall_status = serializers.CharField(read_only=True)
    
    class Meta:
        model = RecruitmentCandidate
        fields = [
            'id', '_id', 'name', 'email', 'phone', 'position', 'department',
            'stage', 'status', 'apply_date', 'interview_date',
            'assigned_to_id', 'assigned_to_name', 'assigned_name',
            'resume_url', 'notes', 'source', 'expected_salary',
            'current_company', 'current_position', 'years_of_experience',
            'notice_period_days', 'offer_sent_date', 'offer_accepted_date',
            'offer_amount', 'joining_date', 'rejection_reason', 'rejection_date',
            'created_at', 'updated_at', 'created_by_name', 'updated_by_name',
            'interview_rounds', 'current_round', 'highest_round', 'overall_status'
        ]
        read_only_fields = ['id', '_id', 'created_at', 'updated_at', 'created_by_name', 'updated_by_name']


class RecruitmentCandidateListSerializer(serializers.ModelSerializer):
    """List serializer (lighter)"""
    
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    interview_round_count = serializers.IntegerField(read_only=True)
    passed_rounds = serializers.IntegerField(read_only=True)
    current_round_status = serializers.CharField(read_only=True)
    
    class Meta:
        model = RecruitmentCandidate
        fields = [
            'id', '_id', 'name', 'email', 'phone', 'position', 'department',
            'stage', 'status', 'apply_date', 'interview_date',
            'assigned_to_name', 'assigned_name', 'source',
            'years_of_experience', 'interview_round_count', 
            'passed_rounds', 'current_round_status', 'created_at'
        ]


class InterviewRoundUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating individual rounds"""
    
    class Meta:
        model = InterviewRound
        fields = [
            'status', 'interview_date', 'feedback', 'rating', 
            'notes', 'meeting_link', 'duration_minutes'
        ]
    
    def update(self, instance, validated_data):
        old_status = instance.status
        new_status = validated_data.get('status', old_status)
        
        instance = super().update(instance, validated_data)
        
        # If round is failed, cascade reject to next rounds
        if new_status == 'FAILED' and old_status != 'FAILED':
            next_rounds = InterviewRound.objects.filter(
                candidate=instance.candidate,
                round_number__gt=instance.round_number,
                status__in=['PENDING', 'SCHEDULED']
            )
            for next_round in next_rounds:
                next_round.status = 'FAILED'
                next_round.feedback = f"Auto-rejected due to failure in Round {instance.round_number}"
                next_round.save()
        
        # If round is passed and previous was failed, check cascade logic
        elif new_status == 'PASSED' and instance.round_number > 1:
            # Check if any previous round is failed
            prev_failed = InterviewRound.objects.filter(
                candidate=instance.candidate,
                round_number__lt=instance.round_number,
                status='FAILED'
            ).exists()
            
            if prev_failed:
                raise serializers.ValidationError(
                    "Cannot pass this round because a previous round is failed. "
                    "Please fix the previous round first."
                )
        
        return instance


class RoundBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating interview rounds"""
    
    rounds = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )
    
    def validate_rounds(self, value):
        for i, round_data in enumerate(value, 1):
            if not round_data.get('round_title'):
                raise serializers.ValidationError(f"Round {i} requires a title")
            if round_data.get('round_number') != i:
                round_data['round_number'] = i
        return value