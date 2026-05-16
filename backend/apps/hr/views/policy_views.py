# apps/hr/views/policy_views.py
from datetime import date, datetime
from django.db import models, transaction
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
import logging

from apps.common.baseauthentication import CompanyBranchMixin
from apps.hr.models import (
    Policy, PolicyAcknowledgment, PolicyVersion, PolicyCategory, Employee
)
from apps.hr.serializers.policy_serializers import (
    PolicyListSerializer,
    PolicyDetailSerializer,
    PolicyCreateUpdateSerializer,
    PolicyAcknowledgmentSerializer,
    PolicyAcknowledgmentCreateSerializer,
    PolicyCategorySerializer,
)

logger = logging.getLogger(__name__)


class StandardResultsSetPagination(PageNumberPagination):
    """Standard pagination for policy endpoints"""
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


class PolicyView(CompanyBranchMixin, APIView):
    """
    CRUD operations for HR Policies with UUID support.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = StandardResultsSetPagination
    
    def _get_company_policies(self, user):
        """Base queryset with company filtering"""
        return Policy.objects.filter(
            company_id=user.company_id,
            is_deleted=False
        ).select_related('approved_by', 'created_by', 'updated_by')
    
    def _apply_filters(self, queryset, request):
        """Apply query parameter filters"""
        search = request.query_params.get('search')
        if search:
            queryset = queryset.filter(
                models.Q(title__icontains=search) |
                models.Q(code__icontains=search) |
                models.Q(content__icontains=search)
            )
        
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter.upper())
        
        category = request.query_params.get('category')
        if category:
            queryset = queryset.filter(category=category)
        
        department = request.query_params.get('department')
        if department:
            queryset = queryset.filter(
                models.Q(department=department) | models.Q(department='ALL')
            )
        
        employee_type = request.query_params.get('employeeType')
        if employee_type:
            queryset = queryset.filter(
                models.Q(employee_type=employee_type) | models.Q(employee_type='ALL')
            )
        
        requires_ack = request.query_params.get('requiresAcknowledgment')
        if requires_ack is not None:
            queryset = queryset.filter(
                requires_acknowledgment=requires_ack.lower() == 'true'
            )
        
        date_from = request.query_params.get('dateFrom')
        if date_from:
            queryset = queryset.filter(effective_date__gte=date_from)
        
        date_to = request.query_params.get('dateTo')
        if date_to:
            queryset = queryset.filter(effective_date__lte=date_to)
        
        return queryset
    
    def get(self, request, pk=None):
        """
        GET /api/hr/policies/ - List all policies
        GET /api/hr/policies/{uuid}/ - Get single policy detail
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if pk:
            policy = get_object_or_404(
                Policy,
                _id=pk,
                company_id=company_id,
                is_deleted=False
            )
            serializer = PolicyDetailSerializer(policy)
            return Response(serializer.data)
        
        queryset = self._get_company_policies(request.user)
        queryset = self._apply_filters(queryset, request)
        
        sort_by = request.query_params.get('sortBy', '-created_at')
        valid_sort_fields = ['code', 'title', 'version', 'status', 
                           'effective_date', 'created_at', 'updated_at']
        
        if sort_by.lstrip('-') in valid_sort_fields:
            queryset = queryset.order_by(sort_by)
        else:
            queryset = queryset.order_by('-created_at')
        
        paginator = self.pagination_class()
        paginated_queryset = paginator.paginate_queryset(queryset, request)
        
        serializer = PolicyListSerializer(paginated_queryset, many=True)
        return paginator.get_paginated_response(serializer.data)
    
    @transaction.atomic
    def post(self, request):
        """
        POST /api/hr/policies/ - Create new policy
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = PolicyCreateUpdateSerializer(
            data=request.data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        policy = serializer.save()
        detail_serializer = PolicyDetailSerializer(policy)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request, pk=None):
        """
        PATCH /api/hr/policies/{uuid}/ - Update existing policy
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policy = get_object_or_404(
            Policy,
            _id=pk,
            company_id=company_id,
            is_deleted=False
        )
        
        serializer = PolicyCreateUpdateSerializer(
            policy,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        updated_policy = serializer.save()
        detail_serializer = PolicyDetailSerializer(updated_policy)
        return Response(detail_serializer.data)
    
    @transaction.atomic
    def delete(self, request, pk=None):
        """
        DELETE /api/hr/policies/{uuid}/ - Soft delete policy
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policy = get_object_or_404(
            Policy,
            _id=pk,
            company_id=company_id,
            is_deleted=False
        )
        
        policy.is_deleted = True
        policy.deleted_at = timezone.now()
        policy.deleted_by = request.user
        policy.status = Policy.PolicyStatus.ARCHIVED
        policy.save()
        
        return Response(
            {'message': 'Policy deleted successfully'},
            status=status.HTTP_200_OK
        )


class PolicyStatsView(CompanyBranchMixin, APIView):
    """
    GET /api/hr/policies/stats/ - Get policy statistics
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policies = Policy.objects.filter(
            company_id=company_id,
            is_deleted=False
        )
        
        total_policies = policies.count()
        
        status_stats = {}
        for status_choice in Policy.PolicyStatus.values:
            status_stats[status_choice] = policies.filter(status=status_choice).count()
        
        category_stats = list(
            policies.values('category')
            .annotate(count=models.Count('id'))
            .order_by('-count')
        )
        
        department_stats = list(
            policies.values('department')
            .annotate(count=models.Count('id'))
            .order_by('-count')
        )
        
        published_policies_with_ack = policies.filter(
            status='PUBLISHED',
            requires_acknowledgment=True
        )
        
        total_acknowledgments = PolicyAcknowledgment.objects.filter(
            policy__company_id=company_id,
            policy__in=policies.filter(status='PUBLISHED')
        ).count()
        
        today = date.today()
        thirty_days = today + timezone.timedelta(days=30)
        expiring_soon = policies.filter(
            expiry_date__isnull=False,
            expiry_date__gte=today,
            expiry_date__lte=thirty_days
        ).count()
        
        overdue_review = policies.filter(
            review_date__isnull=False,
            review_date__lt=today,
            status__in=['PUBLISHED', 'APPROVED']
        ).count()
        
        return Response({
            'totalPolicies': total_policies,
            'statusDistribution': status_stats,
            'categoryDistribution': category_stats,
            'departmentDistribution': department_stats,
            'publishedPolicies': status_stats.get('PUBLISHED', 0),
            'draftPolicies': status_stats.get('DRAFT', 0),
            'pendingReview': status_stats.get('PENDING_REVIEW', 0),
            'approvedPolicies': status_stats.get('APPROVED', 0),
            'archivedPolicies': status_stats.get('ARCHIVED', 0),
            'policiesRequiringAck': published_policies_with_ack.count(),
            'totalAcknowledgments': total_acknowledgments,
            'expiringSoon': expiring_soon,
            'overdueReview': overdue_review,
            'updatedAt': timezone.now().isoformat(),
        })


class PolicyAcknowledgmentView(CompanyBranchMixin, APIView):
    """
    Manage policy acknowledgments with UUID support.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, policy_id=None):
        """
        GET /api/hr/policies/{uuid}/acknowledgments/ - List acknowledgments
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not policy_id:
            return Response(
                {'error': 'Policy ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policy = get_object_or_404(
            Policy,
            _id=policy_id,
            company_id=company_id,
            is_deleted=False
        )
        
        acknowledgments = PolicyAcknowledgment.objects.filter(
            company_id=company_id,
            policy=policy
        ).select_related('employee', 'policy').order_by('-acknowledged_at')
        
        serializer = PolicyAcknowledgmentSerializer(acknowledgments, many=True)
        return Response(serializer.data)
    
    @transaction.atomic
    def post(self, request, policy_id=None):
        """
        POST /api/hr/policies/{uuid}/acknowledge/ - Acknowledge a policy
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not policy_id:
            return Response(
                {'error': 'Policy ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policy = get_object_or_404(
            Policy,
            _id=policy_id,
            company_id=company_id,
            is_deleted=False
        )
        
        data = request.data.copy()
        data['policy'] = policy.id
        
        serializer = PolicyAcknowledgmentCreateSerializer(
            data=data,
            context={'request': request}
        )
        
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        acknowledgment = serializer.save()
        
        response_data = PolicyAcknowledgmentSerializer(acknowledgment).data
        response_data['id'] = str(acknowledgment._id)
        
        return Response(response_data, status=status.HTTP_201_CREATED)


class PolicyBulkActionView(CompanyBranchMixin, APIView):
    """
    Bulk actions for policies with UUID support.
    """
    permission_classes = [IsAuthenticated]
    
    @transaction.atomic
    def post(self, request):
        """
        POST /api/hr/policies/bulk-action/
        {
            "action": "publish|archive|delete",
            "policy_ids": ["uuid1", "uuid2", "uuid3"],
            "notes": "Optional notes"
        }
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        action = request.data.get('action')
        policy_uuids = request.data.get('policy_ids', [])
        notes = request.data.get('notes', '')
        
        if not action or not policy_uuids:
            return Response(
                {'error': 'Action and policy_ids are required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        valid_actions = ['publish', 'archive', 'delete', 'approve', 'submit_for_review']
        if action not in valid_actions:
            return Response(
                {'error': f'Invalid action. Must be one of: {", ".join(valid_actions)}'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policies = Policy.objects.filter(
            _id__in=policy_uuids,
            company_id=company_id,
            is_deleted=False
        )
        
        if not policies.exists():
            return Response(
                {'error': 'No valid policies found'},
                status=status.HTTP_404_NOT_FOUND
            )
        
        updated_count = 0
        errors = []
        
        for policy in policies:
            try:
                if action == 'publish':
                    if policy.status == 'APPROVED':
                        policy.status = 'PUBLISHED'
                        policy.updated_by = request.user
                        policy.save()
                        updated_count += 1
                    else:
                        errors.append(f"Policy {policy.code} must be approved before publishing")
                
                elif action == 'archive':
                    policy.status = 'ARCHIVED'
                    policy.updated_by = request.user
                    policy.save()
                    updated_count += 1
                
                elif action == 'delete':
                    policy.is_deleted = True
                    policy.deleted_at = timezone.now()
                    policy.deleted_by = request.user
                    policy.status = 'ARCHIVED'
                    policy.save()
                    updated_count += 1
                
                elif action == 'approve':
                    if policy.status in ['DRAFT', 'PENDING_REVIEW']:
                        policy.status = 'APPROVED'
                        policy.approved_by = request.user
                        policy.approval_date = date.today()
                        policy.updated_by = request.user
                        policy.change_summary = notes or policy.change_summary
                        policy.save()
                        updated_count += 1
                    else:
                        errors.append(f"Policy {policy.code} cannot be approved in its current status")
                
                elif action == 'submit_for_review':
                    if policy.status == 'DRAFT':
                        policy.status = 'PENDING_REVIEW'
                        policy.updated_by = request.user
                        policy.save()
                        updated_count += 1
                    else:
                        errors.append(f"Policy {policy.code} is not in draft status")
                
            except Exception as e:
                errors.append(f"Error processing policy {policy.code}: {str(e)}")
                logger.error(f"Bulk action error for policy {policy.id}: {str(e)}")
        
        return Response({
            'message': f'Successfully {action}ed {updated_count} policies',
            'updatedCount': updated_count,
            'totalProcessed': len(policies),
            'errors': errors if errors else None
        })


class PolicyVersionView(CompanyBranchMixin, APIView):
    """
    View policy version history with UUID support.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, policy_id=None):
        """
        GET /api/hr/policies/{uuid}/versions/ - Get version history
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not policy_id:
            return Response(
                {'error': 'Policy ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        policy = get_object_or_404(
            Policy,
            _id=policy_id,
            company_id=company_id,
            is_deleted=False
        )
        
        versions = PolicyVersion.objects.filter(
            policy=policy
        ).order_by('-created_at')
        
        from apps.hr.serializers.policy_serializers import PolicyVersionSerializer
        serializer = PolicyVersionSerializer(versions, many=True)
        
        # Convert UUIDs in response
        response_data = serializer.data
        for item in response_data:
            if 'id' in item:
                item['id'] = str(item['id'])
        
        return Response(response_data)


class PolicyCategoryView(CompanyBranchMixin, APIView):
    """
    CRUD for custom policy categories with UUID support.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """
        GET /api/hr/policies/categories/ - List all active categories
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        categories = PolicyCategory.objects.filter(
            company_id=company_id,
            is_active=True
        ).order_by('sorting_order', 'name')
        
        serializer = PolicyCategorySerializer(categories, many=True)
        return Response(serializer.data)
    
    @transaction.atomic
    def post(self, request):
        """
        POST /api/hr/policies/categories/ - Create new category
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = PolicyCategorySerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        category = serializer.save(
            company_id=company_id,
            created_by=request.user,
            updated_by=request.user
        )
        
        response_data = serializer.data
        response_data['id'] = str(category._id)
        
        return Response(response_data, status=status.HTTP_201_CREATED)
    
    @transaction.atomic
    def patch(self, request):
        """
        PATCH /api/hr/policies/categories/ - Update category using UUID
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category_uuid = request.data.get('id')
        if not category_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = get_object_or_404(
            PolicyCategory,
            _id=category_uuid,
            company_id=company_id
        )
        
        serializer = PolicyCategorySerializer(category, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        
        updated_category = serializer.save(updated_by=request.user)
        response_data = serializer.data
        response_data['id'] = str(updated_category._id)
        
        return Response(response_data)
    
    @transaction.atomic
    def delete(self, request):
        """
        DELETE /api/hr/policies/categories/ - Soft delete category using UUID
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category_uuid = request.data.get('id')
        if not category_uuid:
            return Response(
                {'error': 'id (UUID) is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        category = get_object_or_404(
            PolicyCategory,
            _id=category_uuid,
            company_id=company_id
        )
        
        category.is_active = False
        category.updated_by = request.user
        category.save()
        
        return Response({'message': 'Category deleted successfully'})


class EmployeePendingAcknowledgmentsView(CompanyBranchMixin, APIView):
    """
    Get pending acknowledgments for an employee with UUID support.
    """
    permission_classes = [IsAuthenticated]
    
    def get(self, request, employee_id=None):
        """
        GET /api/hr/employees/{uuid}/pending-acknowledgments/
        """
        company_id = request.user.company_id
        if not company_id:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not employee_id:
            return Response(
                {'error': 'Employee ID is required'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        employee = get_object_or_404(
            Employee,
            _id=employee_id,
            company_id=company_id,
            is_deleted=False
        )
        
        published_policies = Policy.objects.filter(
            company_id=company_id,
            status='PUBLISHED',
            requires_acknowledgment=True,
            is_deleted=False
        ).exclude(
            acknowledgments__employee=employee
        )
        
        published_policies = published_policies.filter(
            models.Q(employee_type='ALL') | models.Q(employee_type=employee.employment_type)
        )
        
        published_policies = published_policies.filter(
            models.Q(department='ALL') | models.Q(department=employee.department)
        )
        
        serializer = PolicyListSerializer(published_policies, many=True)
        return Response({
            'employee_id': str(employee._id),
            'employee_name': employee.full_name,
            'pending_count': published_policies.count(),
            'policies': serializer.data
        })