from django.shortcuts import get_object_or_404
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from django.db import transaction
from .models import (
    UserCompanyContext, Module, Feature, 
    RolePermission, UserPermission, Company, Branch
)
from apps.accounts.serializers import UserSerializer


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


class ModulesView(APIView):
    """Get all modules and features"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        modules = Module.objects.filter(is_active=True).prefetch_related('features')
        
        data = []
        for module in modules:
            features = module.features.filter(is_active=True)
            data.append({
                'id': module.id,
                'name': module.name,
                'code': module.code,
                'description': module.description,
                'icon': module.icon,
                'features': [
                    {
                        'id': f.id,
                        'name': f.name,
                        'code': f.code,
                        'routePath': f.route_path,
                    } for f in features
                ]
            })
        
        return Response(data)


class UserPermissionsView(APIView):
    """Get current user's permissions based on role and custom overrides"""
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        user = request.user
        context = UserCompanyContext.objects.filter(user=user).first()
        current_company = context.current_company if context else user.company
        
        # Super admin has all permissions
        if user.is_superuser or user.role == 'COMPANY_ADMIN':
            permissions = []
            modules = Module.objects.filter(is_active=True)
            for module in modules:
                features = Feature.objects.filter(module=module, is_active=True)
                for feature in features:
                    permissions.append({
                        'moduleName': module.name,
                        'moduleCode': module.code,
                        'featureName': feature.name,
                        'featureCode': feature.code,
                        'isViewAccess': 'true',
                        'isCreateAccess': 'true',
                        'isUpdateAccess': 'true',
                        'isDeleteAccess': 'true',
                    })
            return Response(permissions)
        
        # Get role-based permissions
        role_perms = RolePermission.objects.filter(role=user.role).select_related('module', 'feature')
        
        # Get custom user permissions that override role
        custom_perms = UserPermission.objects.filter(user=user).select_related('module', 'feature')
        custom_map = {(p.module_id, p.feature_id): p for p in custom_perms}
        
        # Build permission list
        permissions = []
        for rp in role_perms:
            custom = custom_map.get((rp.module_id, rp.feature_id))
            
            permissions.append({
                'moduleName': rp.module.name,
                'moduleCode': rp.module.code,
                'featureName': rp.feature.name,
                'featureCode': rp.feature.code,
                'isViewAccess': 'true' if (custom.can_view if custom else rp.can_view) else 'false',
                'isCreateAccess': 'true' if (custom.can_create if custom else rp.can_create) else 'false',
                'isUpdateAccess': 'true' if (custom.can_update if custom else rp.can_update) else 'false',
                'isDeleteAccess': 'true' if (custom.can_delete if custom else rp.can_delete) else 'false',
            })
        
        return Response(permissions)


class SwitchCompanyView(APIView):
    """Allow user to switch between companies they belong to"""
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        company_id = request.data.get('companyId')
        if not company_id:
            return Response({'error': 'companyId required'}, status=status.HTTP_400_BAD_REQUEST)
        
        # Verify user belongs to this company
        if request.user.company_id != company_id:
            return Response(
                {'error': 'You do not belong to this company'},
                status=status.HTTP_403_FORBIDDEN
            )
        
        context, _ = UserCompanyContext.objects.get_or_create(user=request.user)
        context.current_company_id = company_id
        
        # Reset branch when switching companies
        context.current_branch = None
        context.save()
        
        # Update session/context
        request.session['company_id'] = company_id
        
        return Response({'message': 'Company switched successfully'})


# Add to apps/organization/serializers.py (create if doesn't exist)