# Generated manual migration to safely convert Designation.department from CharField to FK
from django.db import migrations, models
import django.db.models.deletion


def forwards_func(apps, schema_editor):
    Designation = apps.get_model('compsetting', 'Designation')
    Department = apps.get_model('organization', 'Department')
    # Iterate using values to avoid loading related fields into memory
    for des in Designation.objects.all():
        old_val = getattr(des, 'department', None)
        if not old_val:
            # leave null
            continue
        # If old value was the sentinel "ALL" or empty, treat as null
        try:
            if str(old_val).upper() == 'ALL':
                continue
        except Exception:
            pass
        # Attempt to resolve by UUID stored in string form (previous implementation)
        try:
            dept = Department.objects.get(_id=old_val)
            # set the temporary FK field (department_tmp will be added by migration)
            des.department_tmp = dept
            des.save()
        except Department.DoesNotExist:
            # no matching department; leave null
            continue


def reverse_func(apps, schema_editor):
    # best-effort reverse: copy FK back to string representation (_id) where possible
    Designation = apps.get_model('compsetting', 'Designation')
    for des in Designation.objects.all():
        dept_obj = getattr(des, 'department', None)
        if dept_obj:
            try:
                setattr(des, 'department', str(dept_obj._id))
                des.save()
            except Exception:
                continue


class Migration(migrations.Migration):

    dependencies = [
        ('compsetting', '0004_rename_compsetting_departm_390207_idx_compsetting_departm_159b50_idx_and_more'),
        ('organization', '0003_user_isfrom_employee'),
    ]

    operations = [
        # 1) Add a temporary FK field to hold Department relation
        migrations.AddField(
            model_name='designation',
            name='department_tmp',
            field=models.ForeignKey(on_delete=django.db.models.deletion.SET_NULL, related_name='designations_tmp', blank=True, null=True, to='organization.department'),
        ),

        # 2) Populate department_tmp from existing department string values
        migrations.RunPython(forwards_func, reverse_func),

        # 3) Remove old char-based department field
        migrations.RemoveField(
            model_name='designation',
            name='department',
        ),

        # 4) Rename department_tmp -> department
        migrations.RenameField(
            model_name='designation',
            old_name='department_tmp',
            new_name='department',
        ),

        # 5) Ensure indexes (Django will create appropriate indexes via model state)
    ]
