# apps/hr/views/recruitment_views.py

from django.db import models
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from datetime import datetime, date, timedelta
import logging
from django.db import models, transaction
from apps.common.baseauthentication import CompanyBranchMixin
from apps.hr.models import RecruitmentCandidate, RecruitmentActivityLog, Employee, InterviewRound
from apps.hr.serializers.recruitment_serializers import (
    RoundBulkCreateSerializer,
)

logger = logging.getLogger(__name__)

def safe_date(value):
    if not value:
        return None
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value

class RecruitmentCandidateView(CompanyBranchMixin, APIView):
    """CRUD operations for Recruitment Candidates with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def _serialize_candidate(self, candidate):
        """Serialize candidate with UUIDs"""
        return {
            "id": str(candidate._id),
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "position": candidate.position,
            "department": candidate.department,
            "stage": candidate.stage,
            "status": candidate.status,
            "apply_date": safe_date(candidate.apply_date),
            "interview_date": safe_date(candidate.interview_date),
            "assigned_to_id": str(candidate.assigned_to._id) if candidate.assigned_to else None,
            "assigned_to_name": candidate.assigned_to.full_name if candidate.assigned_to else None,
            "assigned_name": candidate.assigned_name,
            "resume_url": candidate.resume_url,
            "notes": candidate.notes,
            "source": candidate.source,
            "expected_salary": str(candidate.expected_salary) if candidate.expected_salary else None,
            "current_company": candidate.current_company,
            "current_position": candidate.current_position,
            "years_of_experience": float(candidate.years_of_experience) if candidate.years_of_experience else None,
            "notice_period_days": candidate.notice_period_days,
            "offer_sent_date": safe_date(candidate.offer_sent_date),
            "offer_accepted_date": safe_date(candidate.offer_accepted_date),
            "offer_amount": str(candidate.offer_amount) if candidate.offer_amount else None,
            "joining_date": safe_date(candidate.joining_date),
            "rejection_reason": candidate.rejection_reason,
            "rejection_date": safe_date(candidate.rejection_date),
            "created_at": safe_date(candidate.created_at),
            "updated_at": safe_date(candidate.updated_at),
        }
    
    def get(self, request):
        """Get all candidates with filtering"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = RecruitmentCandidate.objects.filter(
            company_id=company_id,
            is_deleted=False
        ).select_related('assigned_to', 'created_by', 'updated_by')
        
        department = request.query_params.get('department')
        if department:
            query = query.filter(department=department)
        
        stage = request.query_params.get('stage')
        if stage:
            query = query.filter(stage=stage)
        
        status_filter = request.query_params.get('status')
        if status_filter:
            query = query.filter(status=status_filter)
        
        source = request.query_params.get('source')
        if source:
            query = query.filter(source=source)
        
        assigned_to_uuid = request.query_params.get('assigned_to')
        if assigned_to_uuid:
            assigned_to = get_object_or_404(Employee, _id=assigned_to_uuid, company_id=company_id, is_deleted=False)
            query = query.filter(assigned_to=assigned_to)
        
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            query = query.filter(apply_date__gte=date_from)
        if date_to:
            query = query.filter(apply_date__lte=date_to)
        
        search = request.query_params.get('search')
        if search:
            query = query.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(position__icontains=search) |
                Q(current_company__icontains=search)
            )
        
        ordering = request.query_params.get('ordering', '-apply_date')
        if ordering.lstrip('-') in ['name', 'position', 'department', 'stage', 'apply_date', 'interview_date', 'created_at']:
            query = query.order_by(ordering)
        else:
            query = query.order_by('-apply_date')
        
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = query.count()
        candidates = query[start:end]
        
        return Response({
            'data': [self._serialize_candidate(c) for c in candidates],
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })
    
    @transaction.atomic
    def post(self, request):
        """Create new candidate"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Convert UUIDs to IDs if provided
        assigned_to_uuid = request.data.get('assigned_to_id')
        assigned_to = None
        if assigned_to_uuid:
            assigned_to = get_object_or_404(Employee, _id=assigned_to_uuid, company_id=company_id, is_deleted=False)
        
        candidate = RecruitmentCandidate.objects.create(
            company_id=company_id,
            branch_id=branch_id,
            name=request.data.get('name'),
            email=request.data.get('email'),
            phone=request.data.get('phone'),
            position=request.data.get('position'),
            department=request.data.get('department'),
            stage=request.data.get('stage', 'Applied'),
            status=request.data.get('status', 'Active'),
            apply_date=request.data.get('apply_date', date.today()),
            interview_date=request.data.get('interview_date'),
            assigned_to=assigned_to,
            assigned_name=assigned_to.full_name if assigned_to else request.data.get('assigned_name'),
            resume_url=request.data.get('resume_url'),
            notes=request.data.get('notes'),
            source=request.data.get('source'),
            expected_salary=request.data.get('expected_salary'),
            current_company=request.data.get('current_company'),
            current_position=request.data.get('current_position'),
            years_of_experience=request.data.get('years_of_experience'),
            notice_period_days=request.data.get('notice_period_days'),
            created_by=request.user,
            updated_by=request.user,
        )
        
        RecruitmentActivityLog.objects.create(
            company_id=company_id,
            candidate=candidate,
            action='CREATED',
            metadata={'ip': request.META.get('REMOTE_ADDR')},
            performed_by=request.user,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return Response(self._serialize_candidate(candidate), status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """Update candidate using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate_uuid = request.data.get('id')
        if not candidate_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        old_stage = candidate.stage
        old_assigned_to = candidate.assigned_to_id
        
        updatable_fields = [
            'name', 'email', 'phone', 'position', 'department',
            'stage', 'status', 'apply_date', 'interview_date',
            'resume_url', 'notes', 'source', 'expected_salary',
            'current_company', 'current_position', 'years_of_experience',
            'notice_period_days', 'offer_sent_date', 'offer_accepted_date',
            'offer_amount', 'joining_date', 'rejection_reason'
        ]
        
        for field in updatable_fields:
            if field in request.data:
                setattr(candidate, field, request.data[field])
        
        assigned_to_uuid = request.data.get('assigned_to_id')
        if assigned_to_uuid is not None:
            if assigned_to_uuid:
                assigned_to = get_object_or_404(Employee, _id=assigned_to_uuid, company_id=company_id, is_deleted=False)
                candidate.assigned_to = assigned_to
                candidate.assigned_name = assigned_to.full_name
            else:
                candidate.assigned_to = None
                candidate.assigned_name = None
        
        candidate.updated_by = request.user
        candidate.save()
        
        if old_stage != candidate.stage:
            RecruitmentActivityLog.objects.create(
                company_id=company_id,
                candidate=candidate,
                action='STAGE_CHANGED',
                old_value=old_stage,
                new_value=candidate.stage,
                performed_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
        
        if old_assigned_to != candidate.assigned_to_id:
            RecruitmentActivityLog.objects.create(
                company_id=company_id,
                candidate=candidate,
                action='ASSIGNMENT_CHANGED',
                old_value=str(old_assigned_to) if old_assigned_to else None,
                new_value=str(candidate.assigned_to_id) if candidate.assigned_to_id else None,
                performed_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
        
        return Response(self._serialize_candidate(candidate))
    
    @transaction.atomic
    def delete(self, request):
        """Soft delete candidate using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate_uuid = request.data.get('id')
        if not candidate_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_uuid,
            company_id=company_id,
            is_deleted=False
        )
        
        candidate.is_deleted = True
        candidate.deleted_at = timezone.now()
        candidate.deleted_by = request.user
        candidate.save()
        
        return Response({'message': 'Candidate deleted successfully'})


class RecruitmentStatsView(CompanyBranchMixin, APIView):
    """Get recruitment statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = RecruitmentCandidate.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if date_from:
            query = query.filter(apply_date__gte=date_from)
        if date_to:
            query = query.filter(apply_date__lte=date_to)
        
        stats = {
            'total_applicants': query.filter(status='Active').count(),
            'screening': query.filter(stage='Screening', status='Active').count(),
            'interviewing': query.filter(stage='Interview', status='Active').count(),
            'offer_sent': query.filter(stage='Offer', status='Active').count(),
            'hired': query.filter(stage='Hired').count(),
            'rejected': query.filter(stage='Rejected').count(),
            'by_department': {},
            'by_source': {},
            'by_month': []
        }
        
        dept_stats = query.filter(status='Active').values('department').annotate(
            count=Count('id')
        ).order_by('-count')
        
        for dept in dept_stats:
            stats['by_department'][dept['department']] = dept['count']
        
        source_stats = query.filter(status='Active', source__isnull=False).values('source').annotate(
            count=Count('id')
        ).order_by('-count')
        
        for source in source_stats:
            stats['by_source'][source['source']] = source['count']
        
        today = date.today()
        for i in range(11, -1, -1):
            month_date = today.replace(day=1) - timedelta(days=30 * i)
            month_start = month_date.replace(day=1)
            if month_date.month == 12:
                month_end = month_date.replace(year=month_date.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                month_end = month_date.replace(month=month_date.month + 1, day=1) - timedelta(days=1)
            
            month_stats = query.filter(
                apply_date__gte=month_start,
                apply_date__lte=month_end
            )
            
            stats['by_month'].append({
                'month': month_start.strftime('%Y-%m'),
                'applications': month_stats.count(),
                'hired': month_stats.filter(stage='Hired').count()
            })
        
        return Response(stats)


class RecruitmentActivityLogView(CompanyBranchMixin, APIView):
    """Get recruitment activity logs with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, candidate_id=None):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        query = RecruitmentActivityLog.objects.filter(
            company_id=company_id
        ).select_related('candidate', 'performed_by')
        
        if candidate_id:
            candidate = get_object_or_404(
                RecruitmentCandidate,
                _id=candidate_id,
                company_id=company_id,
                is_deleted=False
            )
            query = query.filter(candidate=candidate)
        
        action = request.query_params.get('action')
        if action:
            query = query.filter(action=action)
        
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            query = query.filter(created_at__date__gte=date_from)
        if date_to:
            query = query.filter(created_at__date__lte=date_to)
        
        query = query.order_by('-created_at')
        
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = query.count()
        logs = query[start:end]
        
        return Response({
            'data': [
                {
                    "id": str(l._id),
                    "candidate_id": str(l.candidate._id) if l.candidate else None,
                    "candidate_name": l.candidate.name if l.candidate else None,
                    "action": l.action,
                    "old_value": l.old_value,
                    "new_value": l.new_value,
                    "metadata": l.metadata,
                    "ip_address": l.ip_address,
                    "performed_by": l.performed_by.email if l.performed_by else None,
                    "created_at": l.created_at.isoformat() if l.created_at else None,
                }
                for l in logs
            ],
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })


class RecruitmentBulkActionView(CompanyBranchMixin, APIView):
    """Bulk actions for recruitment candidates with UUID support"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        company_id = request.user.company_id
        action = request.data.get('action')
        candidate_uuids = request.data.get('candidate_ids', [])
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not action or not candidate_uuids:
            return Response(
                {'error': 'action and candidate_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidates = RecruitmentCandidate.objects.filter(
            _id__in=candidate_uuids,
            company_id=company_id,
            is_deleted=False
        )
        
        if action == 'delete':
            count = candidates.update(
                is_deleted=True,
                deleted_at=timezone.now(),
                deleted_by=request.user
            )
            return Response({'message': f'{count} candidates deleted successfully'})
        
        elif action == 'change_stage':
            new_stage = request.data.get('new_stage')
            if not new_stage:
                return Response(
                    {'error': 'new_stage is required for change_stage action'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            count = candidates.update(stage=new_stage, updated_by=request.user)
            
            for candidate in candidates:
                RecruitmentActivityLog.objects.create(
                    company_id=company_id,
                    candidate=candidate,
                    action='STAGE_CHANGED',
                    new_value=new_stage,
                    performed_by=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT')
                )
            
            return Response({'message': f'{count} candidates updated to {new_stage}'})
        
        elif action == 'assign_to':
            assigned_to_uuid = request.data.get('assigned_to_id')
            if not assigned_to_uuid:
                return Response(
                    {'error': 'assigned_to_id is required for assign_to action'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            assigned_employee = get_object_or_404(Employee, _id=assigned_to_uuid, company_id=company_id, is_deleted=False)
            
            count = candidates.update(
                assigned_to=assigned_employee,
                assigned_name=assigned_employee.full_name,
                updated_by=request.user
            )
            
            for candidate in candidates:
                RecruitmentActivityLog.objects.create(
                    company_id=company_id,
                    candidate=candidate,
                    action='ASSIGNMENT_CHANGED',
                    new_value=assigned_employee.full_name,
                    performed_by=request.user,
                    ip_address=request.META.get('REMOTE_ADDR'),
                    user_agent=request.META.get('HTTP_USER_AGENT')
                )
            
            return Response({'message': f'{count} candidates assigned to {assigned_employee.full_name}'})
        
        else:
            return Response(
                {'error': f'Invalid action: {action}'},
                status=status.HTTP_400_BAD_REQUEST
            )


class InterviewRoundView(CompanyBranchMixin, APIView):
    """CRUD operations for Interview Rounds with UUID support"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, candidate_id):
        """Get all rounds for a candidate"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        rounds = candidate.interview_rounds.all().order_by('round_number')
        
        return Response([
            {
                "id": str(r._id),
                "round_number": r.round_number,
                "round_title": r.round_title,
                "interview_type": r.interview_type,
                "interview_type_display": r.get_interview_type_display(),
                "status": r.status,
                "status_display": r.get_status_display(),
                "interview_date": safe_date(r.interview_date),
                "interviewer_id": str(r.interviewer._id) if r.interviewer else None,
                "interviewer_name": r.interviewer_name,
                "feedback": r.feedback,
                "rating": r.rating,
                "notes": r.notes,
                "meeting_link": r.meeting_link,
                "duration_minutes": r.duration_minutes,
                "created_at": r.created_at.isoformat() if r.created_at else None,
                "updated_at": r.updated_at.isoformat() if r.updated_at else None,
            }
            for r in rounds
        ])
    
    @transaction.atomic
    def post(self, request, candidate_id):
        """Create a new interview round"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        round_number = request.data.get('round_number')
        if InterviewRound.objects.filter(candidate=candidate, round_number=round_number).exists():
            return Response(
                {'error': f'Round {round_number} already exists'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        interviewer_uuid = request.data.get('interviewer_id')
        interviewer = None
        if interviewer_uuid:
            interviewer = get_object_or_404(Employee, _id=interviewer_uuid, company_id=company_id, is_deleted=False)
        
        interview_round = InterviewRound.objects.create(
            candidate=candidate,
            round_number=round_number,
            round_title=request.data.get('round_title'),
            interview_type=request.data.get('interview_type', 'TECHNICAL'),
            status=request.data.get('status', 'PENDING'),
            interview_date=request.data.get('interview_date'),
            interviewer=interviewer,
            interviewer_name=interviewer.full_name if interviewer else request.data.get('interviewer_name'),
            feedback=request.data.get('feedback'),
            rating=request.data.get('rating'),
            notes=request.data.get('notes'),
            meeting_link=request.data.get('meeting_link'),
            duration_minutes=request.data.get('duration_minutes'),
        )
        
        RecruitmentActivityLog.objects.create(
            company_id=company_id,
            candidate=candidate,
            action='INTERVIEW_SCHEDULED',
            new_value=f"Round {round_number}: {interview_round.round_title}",
            metadata={'round_number': round_number},
            performed_by=request.user,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return Response({
            "id": str(interview_round._id),
            "round_number": interview_round.round_number,
            "round_title": interview_round.round_title,
            "status": interview_round.status,
        }, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request, candidate_id, round_id):
        """Update a specific round using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        interview_round = get_object_or_404(
            InterviewRound,
            _id=round_id,
            candidate=candidate
        )
        
        old_status = interview_round.status
        
        updatable_fields = ['status', 'interview_date', 'feedback', 'rating', 'notes', 'meeting_link', 'duration_minutes']
        for field in updatable_fields:
            if field in request.data:
                setattr(interview_round, field, request.data[field])
        
        interviewer_uuid = request.data.get('interviewer_id')
        if interviewer_uuid is not None:
            if interviewer_uuid:
                interviewer = get_object_or_404(Employee, _id=interviewer_uuid, company_id=company_id, is_deleted=False)
                interview_round.interviewer = interviewer
                interview_round.interviewer_name = interviewer.full_name
            else:
                interview_round.interviewer = None
                interview_round.interviewer_name = None
        
        interview_round.save()
        
        if old_status != interview_round.status:
            RecruitmentActivityLog.objects.create(
                company_id=company_id,
                candidate=candidate,
                action='STAGE_CHANGED',
                old_value=f"Round {interview_round.round_number}: {old_status}",
                new_value=f"Round {interview_round.round_number}: {interview_round.status}",
                metadata={'round_number': interview_round.round_number, 'status': interview_round.status},
                performed_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
        
        return Response({
            "id": str(interview_round._id),
            "status": interview_round.status,
        })
    
    @transaction.atomic
    def delete(self, request, candidate_id, round_id):
        """Delete a round using UUID"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        interview_round = get_object_or_404(
            InterviewRound,
            _id=round_id,
            candidate=candidate
        )
        
        interview_round.delete()
        return Response({'message': 'Round deleted successfully'})


class RoundBulkCreateView(CompanyBranchMixin, APIView):
    """Bulk create interview rounds for a candidate"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, candidate_id):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        candidate.interview_rounds.all().delete()
        
        serializer = RoundBulkCreateSerializer(data=request.data)
        
        if serializer.is_valid():
            rounds_data = serializer.validated_data['rounds']
            created_rounds = []
            
            for round_data in rounds_data:
                interviewer_uuid = round_data.get('interviewer_id')
                interviewer = None
                if interviewer_uuid:
                    interviewer = get_object_or_404(Employee, _id=interviewer_uuid, company_id=company_id, is_deleted=False)
                
                interview_round = InterviewRound.objects.create(
                    candidate=candidate,
                    round_number=round_data['round_number'],
                    round_title=round_data['round_title'],
                    interview_type=round_data.get('interview_type', 'TECHNICAL'),
                    status='PENDING',
                    interviewer=interviewer,
                    interviewer_name=interviewer.full_name if interviewer else None,
                    duration_minutes=round_data.get('duration_minutes'),
                    notes=round_data.get('notes', '')
                )
                created_rounds.append(interview_round)
            
            if candidate.stage != 'Interview':
                candidate.stage = 'Interview'
                candidate.save()
            
            RecruitmentActivityLog.objects.create(
                company_id=company_id,
                candidate=candidate,
                action='INTERVIEW_SCHEDULED',
                new_value=f"Created {len(created_rounds)} interview rounds",
                metadata={'rounds_count': len(created_rounds)},
                performed_by=request.user,
                ip_address=request.META.get('REMOTE_ADDR'),
                user_agent=request.META.get('HTTP_USER_AGENT')
            )
            
            return Response({
                'message': f'Successfully created {len(created_rounds)} rounds',
                'rounds': [
                    {
                        "id": str(r._id),
                        "round_number": r.round_number,
                        "round_title": r.round_title,
                    }
                    for r in created_rounds
                ]
            }, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class RoundStatusBulkUpdateView(CompanyBranchMixin, APIView):
    """Bulk update round statuses with cascade logic"""
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request, candidate_id):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        updates = request.data.get('updates', [])
        updated_rounds = []
        
        for update in updates:
            round_uuid = update.get('round_id')
            new_status = update.get('status')
            
            interview_round = get_object_or_404(InterviewRound, _id=round_uuid, candidate=candidate)
            old_status = interview_round.status
            
            interview_round.status = new_status
            interview_round.feedback = update.get('feedback', interview_round.feedback)
            interview_round.rating = update.get('rating', interview_round.rating)
            
            if update.get('interview_date'):
                interview_round.interview_date = update.get('interview_date')
            
            interview_round.save()
            
            if new_status == 'FAILED' and old_status != 'FAILED':
                next_rounds = candidate.interview_rounds.filter(
                    round_number__gt=interview_round.round_number,
                    status__in=['PENDING', 'SCHEDULED']
                )
                for nr in next_rounds:
                    nr.status = 'FAILED'
                    nr.feedback = f"Auto-rejected due to failure in Round {interview_round.round_number}"
                    nr.save()
                    updated_rounds.append(str(nr._id))
            
            updated_rounds.append(str(round_uuid))
        
        all_rounds = candidate.interview_rounds.all().order_by('round_number')
        
        if all_rounds.filter(status='FAILED').exists():
            candidate.stage = 'Rejected'
            candidate.status = 'Closed'
            candidate.rejection_date = date.today()
            if not candidate.rejection_reason:
                failed_round = all_rounds.filter(status='FAILED').first()
                candidate.rejection_reason = f"Failed in Round {failed_round.round_number}: {failed_round.round_title}"
        elif all_rounds.count() > 0 and all_rounds.filter(status='PASSED').count() == all_rounds.count():
            candidate.stage = 'Offer'
        elif all_rounds.filter(status__in=['PENDING', 'SCHEDULED']).exists():
            candidate.stage = 'Interview'
        
        candidate.save()
        
        RecruitmentActivityLog.objects.create(
            company_id=company_id,
            candidate=candidate,
            action='STAGE_CHANGED',
            new_value=f"Bulk updated {len(updates)} rounds",
            metadata={'updated_rounds': updated_rounds},
            performed_by=request.user,
            ip_address=request.META.get('REMOTE_ADDR'),
            user_agent=request.META.get('HTTP_USER_AGENT')
        )
        
        return Response({
            'message': f'Successfully updated {len(updates)} rounds',
            'candidate_status': candidate.stage
        })


class RecruitmentCandidateDetailView(CompanyBranchMixin, APIView):
    """Get detailed candidate information with rounds using UUID"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request, candidate_id):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            _id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        result = {
            "id": str(candidate._id),
            "name": candidate.name,
            "email": candidate.email,
            "phone": candidate.phone,
            "position": candidate.position,
            "department": candidate.department,
            "stage": candidate.stage,
            "status": candidate.status,
            "apply_date": safe_date(candidate.apply_date),
            "interview_date": safe_date(candidate.interview_date),
            "assigned_to_id": str(candidate.assigned_to._id) if candidate.assigned_to else None,
            "assigned_to_name": candidate.assigned_to.full_name if candidate.assigned_to else None,
            "resume_url": candidate.resume_url,
            "notes": candidate.notes,
            "source": candidate.source,
            "expected_salary": str(candidate.expected_salary) if candidate.expected_salary else None,
            "current_company": candidate.current_company,
            "current_position": candidate.current_position,
            "years_of_experience": float(candidate.years_of_experience) if candidate.years_of_experience else None,
            "notice_period_days": candidate.notice_period_days,
            "offer_sent_date": safe_date(candidate.offer_sent_date),
            "offer_accepted_date": safe_date(candidate.offer_accepted_date),
            "offer_amount": str(candidate.offer_amount) if candidate.offer_amount else None,
            "joining_date": safe_date(candidate.joining_date),
            "rejection_reason": candidate.rejection_reason,
            "interview_rounds": [
                {
                    "id": str(r._id),
                    "round_number": r.round_number,
                    "round_title": r.round_title,
                    "interview_type": r.interview_type,
                    "status": r.status,
                    "interview_date": r.interview_date.isoformat() if r.interview_date else None,
                    "interviewer_name": r.interviewer_name,
                    "feedback": r.feedback,
                    "rating": r.rating,
                    "notes": r.notes,
                }
                for r in candidate.interview_rounds.all().order_by('round_number')
            ],
            "current_round": candidate.current_round,
            "highest_round": candidate.highest_round,
            "overall_status": candidate.overall_status,
            "created_at": candidate.created_at.isoformat() if candidate.created_at else None,
            "updated_at": candidate.updated_at.isoformat() if candidate.updated_at else None,
        }
        
        return Response(result)