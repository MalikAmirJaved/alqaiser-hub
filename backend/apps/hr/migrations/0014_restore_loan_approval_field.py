from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('hr', '0013_policy_acknowledgment_deadline_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='employeeloan',
            name='approval',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('CONFIRM', 'Confirmed'),
                    ('REJECTED', 'Rejected'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
