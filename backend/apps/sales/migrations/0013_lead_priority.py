from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0012_rename_sales_status_entity_idx_sales_statu_entity__3b60e7_idx_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='lead',
            name='priority',
            field=models.CharField(blank=True, choices=[('HOT', 'Hot'), ('WARM', 'Warm'), ('COLD', 'Cold')], default='', max_length=10),
        ),
        migrations.AddIndex(
            model_name='lead',
            index=models.Index(fields=['priority'], name='sales_leads_priority_idx'),
        ),
    ]
