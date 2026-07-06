from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0012_customerinvoice_add_pending_sent_status'),
        ('organization', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerinvoiceline',
            name='status',
            field=models.CharField(
                choices=[
                    ('ACTIVE', 'Active'),
                    ('CANCELLED', 'Cancelled'),
                    ('RETURNED', 'Returned'),
                ],
                default='ACTIVE',
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name='customerinvoice',
            name='cancelled_by',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='cancelled_invoices',
                to='organization.user',
            ),
        ),
        migrations.AddField(
            model_name='customerinvoice',
            name='cancelled_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
