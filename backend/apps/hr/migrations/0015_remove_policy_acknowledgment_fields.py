# Generated migration to remove acknowledgment fields from Policy and drop PolicyAcknowledgment table

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0014_restore_loan_approval_field'),
    ]

    operations = [
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
