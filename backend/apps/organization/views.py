from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db import transaction
from .models import (
    UserCompanyContext, Company, Branch
)
from .serializers import (UserProfileSerializer, BranchSerializer)
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from rest_framework.exceptions import NotFound

class UserContextView(APIView):
    """Get/Update current user's company and branch context"""
    permission_classes = [IsAuthenticated]
    
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
            
            # Verify user belongs to this company
            if request.user.company_id != company.id:
                return Response(
                    {'error': 'You do not belong to this company'},
                    status=status.HTTP_403_FORBIDDEN
                )
        
        if 'branchId' in request.data:
            if request.data['branchId']:
                branch = get_object_or_404(Branch, id=request.data['branchId'])
                # Verify branch belongs to user's company
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


class SwitchCompanyView(APIView):
    permission_classes = [IsAuthenticated]

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

        # ✅ FIXED (object not ID)
        context.current_company = company
        context.current_branch = None
        context.save()

        request.session['company_id'] = company.id

        return Response({'message': 'Company switched successfully'})


class BranchCreateView(APIView):
    permission_classes = [IsAuthenticated]

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

        # ✅ FIXED HQ LOGIC
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


class BranchDetailView(RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
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

        # IMPORTANT: use correct field (change if needed)
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


class UserProfileView(APIView):
    """Get and update current user's profile (including password)."""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

    def patch(self, request):
        user = request.user
        data = request.data.copy()

        # Handle password update if provided
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
                user.save()  # save the password change
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
