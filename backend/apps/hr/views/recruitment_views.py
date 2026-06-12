# apps/hr/views/recruitment_views.py

from django.db import models
from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from datetime import datetime, date, timedelta
import logging
from django.utils import timezone

from apps.hr.models import RecruitmentCandidate, RecruitmentActivityLog, Employee
from apps.hr.serializers.recruitment_serializers import (
    RecruitmentCandidateSerializer,
    RecruitmentActivityLogSerializer,
    RecruitmentStatsSerializer
)

logger = logging.getLogger(__name__)


class RecruitmentCandidateView(APIView):
    """CRUD operations for Recruitment Candidates"""
    permission_classes = [IsAuthenticated]
    
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
        
        # Filter by department
        department = request.query_params.get('department')
        if department:
            query = query.filter(department=department)
        
        # Filter by stage
        stage = request.query_params.get('stage')
        if stage:
            query = query.filter(stage=stage)
        
        # Filter by status
        status_filter = request.query_params.get('status')
        if status_filter:
            query = query.filter(status=status_filter)
        
        # Filter by source
        source = request.query_params.get('source')
        if source:
            query = query.filter(source=source)
        
        # Filter by assigned_to
        assigned_to = request.query_params.get('assigned_to')
        if assigned_to:
            query = query.filter(assigned_to_id=assigned_to)
        
        # Date range filters
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            query = query.filter(apply_date__gte=date_from)
        if date_to:
            query = query.filter(apply_date__lte=date_to)
        
        # Search
        search = request.query_params.get('search')
        if search:
            query = query.filter(
                Q(name__icontains=search) |
                Q(email__icontains=search) |
                Q(phone__icontains=search) |
                Q(position__icontains=search) |
                Q(current_company__icontains=search)
            )
        
        # Ordering
        ordering = request.query_params.get('ordering', '-apply_date')
        if ordering.lstrip('-') in ['name', 'position', 'department', 'stage', 'apply_date', 'interview_date', 'created_at']:
            query = query.order_by(ordering)
        else:
            query = query.order_by('-apply_date')
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = query.count()
        candidates = query[start:end]
        
        serializer = RecruitmentCandidateSerializer(candidates, many=True)
        
        return Response({
            'data': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })
    
    def post(self, request):
        """Create new candidate"""
        company_id = request.user.company_id
        branch_id = request.user.branch_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = RecruitmentCandidateSerializer(data=request.data)
        
        if serializer.is_valid():
            candidate = serializer.save(
                company_id=company_id,
                branch_id=branch_id,
                created_by=request.user,
                updated_by=request.user
            )
            
            # Log activity
            self._log_activity(
                candidate=candidate,
                action='CREATED',
                metadata={'ip': request.META.get('REMOTE_ADDR')},
                performed_by=request.user
            )
            
            return Response(
                RecruitmentCandidateSerializer(candidate).data,
                status=status.HTTP_201_CREATED
            )
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def patch(self, request):
        """Update candidate"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate_id = request.data.get('id')
        if not candidate_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        # Track changes for activity log
        old_stage = candidate.stage
        old_assigned_to = candidate.assigned_to_id
        
        serializer = RecruitmentCandidateSerializer(candidate, data=request.data, partial=True)
        
        if serializer.is_valid():
            updated_candidate = serializer.save(updated_by=request.user)
            
            # Log stage change
            if old_stage != updated_candidate.stage:
                self._log_activity(
                    candidate=updated_candidate,
                    action='STAGE_CHANGED',
                    old_value=old_stage,
                    new_value=updated_candidate.stage,
                    metadata={'ip': request.META.get('REMOTE_ADDR')},
                    performed_by=request.user
                )
                
                # Log specific actions based on new stage
                if updated_candidate.stage == 'Hired':
                    self._log_activity(
                        candidate=updated_candidate,
                        action='HIRED',
                        metadata={'joining_date': str(updated_candidate.joining_date) if updated_candidate.joining_date else None},
                        performed_by=request.user
                    )
                elif updated_candidate.stage == 'Rejected':
                    self._log_activity(
                        candidate=updated_candidate,
                        action='REJECTED',
                        old_value=old_stage,
                        new_value=updated_candidate.rejection_reason,
                        metadata={'ip': request.META.get('REMOTE_ADDR')},
                        performed_by=request.user
                    )
                elif updated_candidate.stage == 'Offer':
                    self._log_activity(
                        candidate=updated_candidate,
                        action='OFFER_SENT',
                        metadata={'offer_amount': str(updated_candidate.offer_amount) if updated_candidate.offer_amount else None},
                        performed_by=request.user
                    )
            
            # Log assignment change
            if old_assigned_to != updated_candidate.assigned_to_id:
                self._log_activity(
                    candidate=updated_candidate,
                    action='ASSIGNMENT_CHANGED',
                    old_value=str(old_assigned_to) if old_assigned_to else None,
                    new_value=str(updated_candidate.assigned_to_id) if updated_candidate.assigned_to_id else None,
                    metadata={'ip': request.META.get('REMOTE_ADDR')},
                    performed_by=request.user
                )
            
            return Response(RecruitmentCandidateSerializer(updated_candidate).data)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    def delete(self, request):
        """Soft delete candidate"""
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate_id = request.data.get('id')
        if not candidate_id:
            return Response(
                {'error': 'id is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidate = get_object_or_404(
            RecruitmentCandidate,
            id=candidate_id,
            company_id=company_id,
            is_deleted=False
        )
        
        candidate.is_deleted = True
        candidate.deleted_at = datetime.now()
        candidate.deleted_by = request.user
        candidate.save()
        
        self._log_activity(
            candidate=candidate,
            action='CREATED',  # Will add DELETE action
            metadata={'ip': request.META.get('REMOTE_ADDR')},
            performed_by=request.user
        )
        
        return Response({'message': 'Candidate deleted successfully'})
    
    def _log_activity(self, candidate, action, old_value=None, new_value=None, metadata=None, performed_by=None):
        """Helper method to log activities"""
        RecruitmentActivityLog.objects.create(
            company_id=candidate.company_id,
            candidate=candidate,
            action=action,
            old_value=old_value,
            new_value=new_value,
            metadata=metadata or {},
            performed_by=performed_by,
            ip_address=self.request.META.get('REMOTE_ADDR') if hasattr(self, 'request') else None,
            user_agent=self.request.META.get('HTTP_USER_AGENT') if hasattr(self, 'request') else None
        )


class RecruitmentStatsView(APIView):
    """Get recruitment statistics"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Base query for active candidates
        query = RecruitmentCandidate.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        # Filter by date range
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        
        if date_from:
            query = query.filter(apply_date__gte=date_from)
        if date_to:
            query = query.filter(apply_date__lte=date_to)
        
        # Calculate stats
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
        
        # Department breakdown
        dept_stats = query.filter(status='Active').values('department').annotate(
            count=Count('id')
        ).order_by('-count')
        
        for dept in dept_stats:
            stats['by_department'][dept['department']] = dept['count']
        
        # Source breakdown
        source_stats = query.filter(status='Active', source__isnull=False).values('source').annotate(
            count=Count('id')
        ).order_by('-count')
        
        for source in source_stats:
            stats['by_source'][source['source']] = source['count']
        
        # Monthly breakdown for last 12 months
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
        
        serializer = RecruitmentStatsSerializer(stats)
        return Response(serializer.data)


class RecruitmentActivityLogView(APIView):
    """Get recruitment activity logs"""
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
            query = query.filter(candidate_id=candidate_id)
        
        # Filter by action
        action = request.query_params.get('action')
        if action:
            query = query.filter(action=action)
        
        # Date range filter
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')
        if date_from:
            query = query.filter(created_at__date__gte=date_from)
        if date_to:
            query = query.filter(created_at__date__lte=date_to)
        
        # Ordering
        query = query.order_by('-created_at')
        
        # Pagination
        page = int(request.query_params.get('page', 1))
        page_size = int(request.query_params.get('page_size', 50))
        start = (page - 1) * page_size
        end = start + page_size
        
        total = query.count()
        logs = query[start:end]
        
        serializer = RecruitmentActivityLogSerializer(logs, many=True)
        
        return Response({
            'data': serializer.data,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total': total,
                'total_pages': (total + page_size - 1) // page_size
            }
        })


class RecruitmentBulkActionView(APIView):
    """Bulk actions for recruitment candidates"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        company_id = request.user.company_id
        action = request.data.get('action')
        candidate_ids = request.data.get('candidate_ids', [])
        
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not action or not candidate_ids:
            return Response(
                {'error': 'action and candidate_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        candidates = RecruitmentCandidate.objects.filter(
            id__in=candidate_ids,
            company_id=company_id,
            is_deleted=False
        )
        
        if action == 'delete':
            # Bulk soft delete
            count = candidates.update(
                is_deleted=True,
                deleted_at=datetime.now(),
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
            
            # Log activities for each candidate
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
            assigned_to_id = request.data.get('assigned_to_id')
            if not assigned_to_id:
                return Response(
                    {'error': 'assigned_to_id is required for assign_to action'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            assigned_employee = get_object_or_404(Employee, id=assigned_to_id, company_id=company_id)
            
            count = candidates.update(
                assigned_to_id=assigned_to_id,
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