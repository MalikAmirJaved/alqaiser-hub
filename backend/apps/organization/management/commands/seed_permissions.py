from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model
from apps.organization.models import Module, Feature, RolePermission, UserPermission

User = get_user_model()


class Command(BaseCommand):
    help = 'Seed initial permissions data'
    
    def handle(self, *args, **options):
        self.stdout.write('Seeding permissions data...')
        
        # Create modules if not exist
        modules = {
            'HR': {'name': 'Human Resources', 'order': 1},
            'INVENTORY': {'name': 'Inventory', 'order': 2},
            'FINANCE': {'name': 'Finance', 'order': 3},
            'SETTINGS': {'name': 'Settings', 'order': 4},
            'MONITORING': {'name': 'AI Monitoring', 'order': 5},
        }
        
        created_modules = {}
        for code, data in modules.items():
            module, created = Module.objects.get_or_create(
                code=code,
                defaults={'name': data['name'], 'order': data['order']}
            )
            created_modules[code] = module
            if created:
                self.stdout.write(f'  Created module: {code}')
        
        # Create features
        features_data = {
            'HR': ['EMPLOYEES', 'PAYROLL', 'ATTENDANCE', 'LEAVE', 'SHIFTS', 'ASSETS' 'PERFORMANCE', 'RECRUITMENT', 'EXIT', 'HR', 'COMPENSATION'],
            'INVENTORY': ['PRODUCTS', 'BRANDS', 'CATEGORIES' 'STOCK', 'PURCHASES', 'WAREHOUSES', 'VENDOR', 'SALES', 'ASSETS', 'TRANSFERS', 'BARCODE', 'REPORT', 'ALERTS', 'POS', 'AUDIT'],
            'FINANCE': ['ACCOUNTS', 'INVOICES', 'EXPENSES', 'PAYABLES', 'RECEIVABLES', 'BUDGETS', 'BANK', 'PAYROLL', 'ASSETS', 'TAXES', 'REPORTS', 'FORECAST', 'AUDIT', 'SETTINGS'],
            'MONITORING': ['ACTIVITY', 'INVENTORY', 'WORKFORCE', 'ALERTS', 'REPORTS'],
            'SETTINGS': ['COMPANY', 'USERS', 'DEPARTMENTS', 'DESIGNATIONS', 'LEAVETYPE', 'PREFERENCE'],
        }
        
        for module_code, feature_codes in features_data.items():
            module = created_modules[module_code]
            for code in feature_codes:
                feature, created = Feature.objects.get_or_create(
                    module=module,
                    code=code,
                    defaults={'name': code.title().replace('_', ' ')}
                )
                if created:
                    self.stdout.write(f'  Created feature: {module_code}.{code}')
        
        # Create role permissions
        roles = ['COMPANY_ADMIN', 'BRANCH_ADMIN', 'STAFF']
        
        for role in roles:
            # Delete existing and recreate
            RolePermission.objects.filter(role=role).delete()
            
            features = Feature.objects.all()
            role_perms = []
            
            for feature in features:
                if role == 'COMPANY_ADMIN':
                    role_perms.append(RolePermission(
                        role=role, module=feature.module, feature=feature,
                        can_view=True, can_create=True, can_update=True, can_delete=True
                    ))
                elif role == 'BRANCH_ADMIN':
                    role_perms.append(RolePermission(
                        role=role, module=feature.module, feature=feature,
                        can_view=True, can_create=True, can_update=True, can_delete=True
                    ))
                else:  # STAFF
                    role_perms.append(RolePermission(
                        role=role, module=feature.module, feature=feature,
                        can_view=True, can_create=False, can_update=False, can_delete=False
                    ))
            
            RolePermission.objects.bulk_create(role_perms)
            self.stdout.write(f'  Created permissions for role: {role}')
        
        self.stdout.write(self.style.SUCCESS('Successfully seeded permissions data!'))