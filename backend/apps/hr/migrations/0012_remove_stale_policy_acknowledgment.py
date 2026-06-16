from django.db import migrations


def remove_stale_acknowledgment(apps, schema_editor):
    Policy = apps.get_model('hr', 'Policy')
    for field_name in ['requires_acknowledgment', 'acknowledgment_deadline']:
        if hasattr(Policy, field_name):
            pass
    try:
        PolicyAcknowledgment = apps.get_model('hr', 'PolicyAcknowledgment')
        PolicyAcknowledgment.objects.all().delete()
    except Exception:
        pass


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0011_compensation_status_workflow'),
    ]

    operations = [
        migrations.RunPython(remove_stale_acknowledgment, migrations.RunPython.noop),
        migrations.RemoveField(
            model_name='policy',
            name='requires_acknowledgment',
        ),
        migrations.RemoveField(
            model_name='policy',
            name='acknowledgment_deadline',
        ),
        migrations.DeleteModel(
            name='PolicyAcknowledgment',
        ),
    ]
