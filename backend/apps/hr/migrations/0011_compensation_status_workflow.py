from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0010_policy_acknowledgment_deadline_and_more'),
    ]

    operations = [
        migrations.AlterField(
            model_name='compensation',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('CONFIRM', 'Confirmed'),
                    ('REJECT', 'Rejected'),
                    ('FULLYPAID', 'Fully Paid'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
