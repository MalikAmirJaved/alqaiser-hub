import json
from django.core.management.base import BaseCommand
from django.db import transaction
from apps.permissions.models import Module, Resource, Action, Permission, Role, RolePermission

# ──────────────────────────────────────────────────────────────────────────────
# Data definitions – single source of truth
# ──────────────────────────────────────────────────────────────────────────────

MODULES = {
    'HR': {'name': 'Human Resources', 'ordering': 1},
    'INVENTORY': {'name': 'Inventory Management', 'ordering': 2},
    'FINANCE': {'name': 'Finance', 'ordering': 3},
    'AI_MONITORING': {'name': 'AI Monitoring', 'ordering': 4},
    'SETTINGS': {'name': 'System Settings', 'ordering': 5},
}

RESOURCES = {
    'HR': [
        'dashboard', 'employee', 'payroll', 'attendance','leave',  'shift_template', 'shift_override','emp_asset','asset_kit','asset_assignment',
        'performance','recruitment',  'exit', 'policy','compensation',
    ],
    'INVENTORY': [
        'dashboard','category', 'brand', 'product','stock','warehouse','purchase_order',  'supplier', 'vendor',
        'stock_transfer', 'barcode','report', 'alert', 'customer', 'sales_order',  'audit_log',
    ],
    'FINANCE': [
         'dashboard', 'account', 'customer_invoice', 'expense', 'budget',
        'bank_account', 'bank_transaction', 'supplier_bill', 'journal_entrie', 'finance_reports', 'payment',  'tax','audit_log',
    ],
    'AI_MONITORING': [
        'live_dashboard', 'workforce', 'inventory', 'alert', 'report', 'activity', 
    ],
    'SETTINGS': [
        'company', 'user', 'role', 'department', 'designation', 'preference', 'dashboard', 'permissions'
    ],
}

ACTIONS = [
    ('create', 'Create'),
    ('view', 'View'),
    ('update', 'Update'),
    ('delete', 'Delete'),
    ('export', 'Export'),
    ('approve', 'Approve'),
    ('reject', 'Reject'),
    ('assign', 'Assign'),
    ('publish', 'Publish'),
    ('archive', 'Archive'),
]

# Role permissions: role → { module: [resource:action patterns] }
# '*' means all actions for that module
ROLE_PERMISSIONS = {
    'COMPANY_ADMIN': {
        'HR': ['*'],
        'INVENTORY': ['*'],
        'FINANCE': ['*'],
        'AI_MONITORING': ['*'],
        'SETTINGS': ['*'],
    },
    'BRANCH_ADMIN': {},
    'STAFF': {},
}

class Command(BaseCommand):
    help = 'Seed modules, resources, actions, permissions, and role permissions (idempotent)'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write('Seeding permissions...')

        # 1. Create modules
        module_objs = {}
        for code, data in MODULES.items():
            obj, created = Module.objects.update_or_create(
                code=code,
                defaults={
                    'name': data['name'],
                    'ordering': data.get('ordering', 0),
                    'is_active': True
                }
            )
            module_objs[code] = obj
            self.stdout.write(f"  {'Created' if created else 'Updated'} module: {code}")

        # 2. Create actions
        action_objs = {}
        for code, name in ACTIONS:
            obj, created = Action.objects.update_or_create(
                code=code,
                defaults={'name': name}
            )
            action_objs[code] = obj

        # 3. Create resources and permissions
        permission_map = {}
        for module_code, resources_list in RESOURCES.items():
            module = module_objs[module_code]
            for resource_code in resources_list:
                resource_obj, _ = Resource.objects.update_or_create(
                    module=module,
                    code=resource_code,
                    defaults={'name': resource_code.replace('_', ' ').title(), 'is_active': True}
                )
                for action_code, action_name in ACTIONS:
                    perm_code = f"{module_code}:{resource_code}:{action_code}"
                    perm, created = Permission.objects.update_or_create(
                        resource=resource_obj,
                        action=action_objs[action_code],
                        defaults={'code': perm_code, 'description': f"{resource_code} {action_code}"}
                    )
                    permission_map[perm_code] = perm
                    if created:
                        self.stdout.write(f"    Created permission: {perm_code}")

        # 4. Create roles
        role_objs = {}
        for role_name in ROLE_PERMISSIONS.keys():
            role, created = Role.objects.update_or_create(
                name=role_name,
                defaults={'description': f'{role_name} role', 'is_system': True}
            )
            role_objs[role_name] = role
            self.stdout.write(f"  {'Created' if created else 'Updated'} role: {role_name}")

        # 5. Assign role permissions (idempotent: delete existing then recreate)
        RolePermission.objects.all().delete()
        count_total = 0
        for role_name, module_perms in ROLE_PERMISSIONS.items():
            role = role_objs[role_name]
            count = 0
            for module_code, patterns in module_perms.items():
                if patterns == ['*']:
                    perms = Permission.objects.filter(resource__module__code=module_code)
                    for perm in perms:
                        RolePermission.objects.create(role=role, permission=perm, granted=True)
                        count += 1
                else:
                    for pattern in patterns:
                        if ':' not in pattern:
                            self.stdout.write(self.style.WARNING(f"  Invalid pattern: {pattern} – skipped"))
                            continue
                        resource_code, action_code = pattern.split(':')
                        perm_code = f"{module_code}:{resource_code}:{action_code}"
                        perm = permission_map.get(perm_code)
                        if perm:
                            RolePermission.objects.create(role=role, permission=perm, granted=True)
                            count += 1
                        else:
                            self.stdout.write(self.style.WARNING(f"  Warning: Permission {perm_code} not found"))
            self.stdout.write(f"  Assigned {count} permissions to role {role_name}")
            count_total += count

        self.stdout.write(self.style.SUCCESS(
            f"Seeding complete: {Module.objects.count()} modules, {Resource.objects.count()} resources, "
            f"{Action.objects.count()} actions, {Permission.objects.count()} permissions, "
            f"{Role.objects.count()} roles, {count_total} role permissions"
        ))