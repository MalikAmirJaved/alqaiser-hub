from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0008_remove_policy_acknowledgment'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='compensation',
            name='bonus_percentage',
        ),
        migrations.RemoveField(
            model_name='compensation',
            name='employer_eobi',
        ),
        migrations.RemoveField(
            model_name='compensation',
            name='employer_pf',
        ),
    ]
