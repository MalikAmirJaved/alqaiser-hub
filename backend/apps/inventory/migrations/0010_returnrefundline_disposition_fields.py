# Generated manually for return refund line disposition fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('inventory', '0009_returnrefund_returnrefundline_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='returnrefundline',
            name='damage_qty',
            field=models.PositiveIntegerField(default=0, help_text='Quantity marked as damaged (not restocked)'),
        ),
        migrations.AddField(
            model_name='returnrefundline',
            name='damage_reason',
            field=models.TextField(blank=True, help_text='Required when damage_qty > 0'),
        ),
        migrations.AddField(
            model_name='returnrefundline',
            name='disposition_action',
            field=models.CharField(
                blank=True,
                choices=[('GO_TO_PRODUCT', 'Go to Product'), ('RETURN_TO_SUPPLIER', 'Return to Supplier')],
                help_text='Manual line disposition (keeps stock vs return to vendor)',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='returnrefundline',
            name='product_qty',
            field=models.PositiveIntegerField(default=0, help_text='Quantity added back to product/inventory'),
        ),
    ]
