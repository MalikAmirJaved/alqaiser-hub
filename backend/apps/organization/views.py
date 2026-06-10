from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics, status
from django.db import transaction
from .models import (
    UserCompanyContext, Company, Branch, User,Department
)
from rest_framework import viewsets
from .serializers import (UserProfileSerializer, BranchSerializer, DepartmentSerializer)
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from rest_framework.exceptions import NotFound
from apps.permissions.mixins import PermissionRequiredMixin
from apps.common.baseauthentication import CompanyBranchMixin
from rest_framework.decorators import action
from django.db.models import Q
from apps.hr.models import Employee

class UserContextView(PermissionRequiredMixin, APIView):
    """Get/Update current user's company and branch context"""
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'user'
    
    def get(self, request):
        context, created = UserCompanyContext.objects.get_or_create(
            user=request.user,
            defaults={
                'current_company': request.user.company,
                'current_branch': request.user.branch
            }
        )
        
        return Response({
            'companyId': context.current_company.id if context.current_company else None,
            'companyName': context.current_company.name if context.current_company else None,
            'branchId': context.current_branch.id if context.current_branch else None,
            'branchName': context.current_branch.name if context.current_branch else None,
        })
    
    def patch(self, request):
        context, _ = UserCompanyContext.objects.get_or_create(user=request.user)
        
        if 'companyId' in request.data:
            company = get_object_or_404(Company, id=request.data['companyId'])
            context.current_company = company
            
            if request.user.company_id != company.id:
                return Response(
                    {'error': 'You do not belong to this company'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        if 'branchId' in request.data:
            if request.data['branchId']:
                branch = get_object_or_404(Branch, id=request.data['branchId'])
                if branch.company_id != (context.current_company.id if context.current_company else request.user.company_id):
                    return Response(
                        {'error': 'Branch does not belong to your company'},
                        status=status.HTTP_403_FORBIDDEN
                    )
                context.current_branch = branch
            else:
                context.current_branch = None
        
        context.save()
        
        return Response({
            'companyId': context.current_company.id if context.current_company else None,
            'companyName': context.current_company.name if context.current_company else None,
            'branchId': context.current_branch.id if context.current_branch else None,
            'branchName': context.current_branch.name if context.current_branch else None,
        })


class SwitchCompanyView(PermissionRequiredMixin, APIView):
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'user'

    def post(self, request):
        company_id = request.data.get('companyId')

        if not company_id:
            return Response({'error': 'companyId required'}, status=400)

        company = get_object_or_404(Company, id=company_id)

        if request.user.company_id != company.id:
            return Response(
                {'error': 'You do not belong to this company'},
                status=403
            )

        context, _ = UserCompanyContext.objects.get_or_create(user=request.user)

        context.current_company = company
        context.current_branch = None
        context.save()

        request.session['company_id'] = company.id

        return Response({'message': 'Company switched successfully'})


class BranchCreateView(PermissionRequiredMixin, APIView):
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'branch'

    @transaction.atomic
    def post(self, request):
        user = request.user

        if not user.company:
            return Response(
                {'error': 'User is not associated with any company'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = BranchSerializer(
            data=request.data,
            context={'company': user.company}
        )

        serializer.is_valid(raise_exception=True)

        is_first = not Branch.objects.filter(company=user.company).exists()

        branch = serializer.save(
            company=user.company,
            created_by=user,
            updated_by=user,
            is_hq=is_first
        )

        return Response({
            'id': branch.id,
            '_id': str(branch._id),
            'name': branch.name,
            'code': branch.code,
            'is_hq': branch.is_hq,
            'message': 'Branch created successfully'
        }, status=status.HTTP_201_CREATED)


class BranchDetailView(PermissionRequiredMixin, RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'branch'
    serializer_class = BranchSerializer

    def get_queryset(self):
        user = self.request.user
        if not user.company_id:
            return Branch.objects.none()
        return Branch.objects.filter(company_id=user.company_id)

    def get_object(self):
        user = self.request.user
        branch_id = getattr(user, "branch_id", None)
        if not branch_id:
            raise NotFound("User does not have a branch assigned.")
        try:
            obj = self.get_queryset().get(pk=branch_id)
        except Branch.DoesNotExist:
            raise NotFound("Branch not found for this user.")
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_update(self, serializer):
        serializer.save(
            company=self.request.user.company,
            updated_by=self.request.user
        )

    def destroy(self, request, *args, **kwargs):
        branch = self.get_object()
        branch.delete()
        return Response(status=204)


class UserProfileView(PermissionRequiredMixin, APIView):
    """Get and update current user's profile (including password)."""
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'user'

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        data = request.data.copy()

        password = data.pop('password', None)
        if password:
            confirm_password = data.pop('confirm_password', None)
            if password != confirm_password:
                return Response(
                    {'password': 'Passwords do not match'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            if len(password) < 6:
                return Response(
                    {'password': 'Password must be at least 6 characters'},
                    status=status.HTTP_400_BAD_REQUEST
                )
            user.set_password(password)

        serializer = UserProfileSerializer(user, data=data, partial=True)
        if serializer.is_valid():
            serializer.save()
            if password:
                user.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class UserListView(PermissionRequiredMixin, generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'user'
    serializer_class = UserProfileSerializer
    
    def get_queryset(self):
        # Get users for the current user's company only, exclude deleted
        return User.objects.filter(
            company=self.request.user.company,
            is_deleted=False
        )#.exclude(id=self.request.user.id)  # Exclude current user from list

    def perform_create(self, serializer):
        # Set company, branch, and other required fields
        serializer.save(
            company=self.request.user.company,
            branch=self.request.user.branch,  # Assign to current user's branch
            created_by=self.request.user,
            updated_by=self.request.user
        )


class UserDetailView(PermissionRequiredMixin, generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    permission_module = 'SETTINGS'
    permission_resource = 'user'
    serializer_class = UserProfileSerializer

    def get_queryset(self):
        return User.objects.filter(
            company=self.request.user.company,
            is_deleted=False
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def perform_destroy(self, instance):
        # Prevent deleting yourself
        if instance.id == self.request.user.id:
            raise NotFound("You cannot delete your own account")
        instance.is_deleted = True
        instance.deleted_by = self.request.user
        instance.is_active = False
        instance.save()


class DepartmentViewSet(CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'SETTINGS'
    permission_resource = 'department'
    queryset = Department.objects.all()
    serializer_class = DepartmentSerializer
    lookup_field = '_id'
    lookup_url_kwarg = '_id'

    def get_queryset(self):
        qs = super().get_queryset()
        qs = qs.filter(is_deleted=False)
        search = self.request.query_params.get('search')
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(code__icontains=search))
        return qs

    def perform_create(self, serializer):
        serializer.save(
            company_id=self.request.user.company_id,
            branch_id=self.request.user.branch_id,
            created_by=self.request.user,
            updated_by=self.request.user,
        )

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=True, methods=['get'])
    def designations(self, request, _id=None):
        """Get all designations belonging to this department"""
        department = self.get_object()
        from apps.compsetting.models import Designation
        designations = Designation.objects.filter(
            company_id=request.user.company_id,
            department=department.name,
            is_deleted=False
        ).values('_id', 'name', 'department', 'pay_grade', 'is_active')
        return Response(list(designations))

    @action(detail=True, methods=['get'])
    def employees(self, request, _id=None):
        """Get all employees belonging to this department"""
        department = self.get_object()
        employees = Employee.objects.filter(
            company_id=request.user.company_id,
            department=department.name,
            is_deleted=False,
            employment_status='ACTIVE'
        ).values('_id', 'first_name', 'last_name', 'employee_id', 'designation')
        return Response(list(employees))
    
    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.is_deleted = True
        instance.deleted_by = request.user
        instance.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
