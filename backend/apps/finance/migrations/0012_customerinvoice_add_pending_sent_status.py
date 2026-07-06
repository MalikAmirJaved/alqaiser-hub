from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0011_invoicelineproductlink'),
    ]

    operations = [
        migrations.AlterField(
            model_name='customerinvoice',
            name='status',
            field=models.CharField(
                choices=[
                    ('PENDING', 'Pending'),
                    ('SENT', 'Sent'),
                    ('DRAFT', 'Draft'),
                    ('CANCELLED', 'Cancelled'),
                ],
                default='PENDING',
                max_length=20,
            ),
        ),
    ]
