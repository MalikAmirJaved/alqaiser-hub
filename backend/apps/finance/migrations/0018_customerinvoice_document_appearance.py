from django.db import migrations, models
import apps.common.document_appearance


class Migration(migrations.Migration):

    dependencies = [
        ('finance', '0017_payment_receipt_image_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='customerinvoice',
            name='template_slug',
            field=models.CharField(
                choices=[
                    ('modern', 'Modern'), ('minimal', 'Minimal'),
                    ('corporate', 'Corporate'), ('elegant', 'Elegant'),
                    ('blue', 'Blue'), ('dark', 'Dark'), ('startup', 'Startup'),
                    ('agency', 'Agency'), ('creative', 'Creative'),
                    ('classic', 'Classic'), ('nordic', 'Nordic'),
                    ('emerald', 'Emerald'), ('sunset', 'Sunset'),
                    ('slate', 'Slate'), ('bold', 'Bold'),
                    ('lavender', 'Lavender'), ('ocean', 'Ocean'), ('mono', 'Mono'),
                ],
                default='modern',
                max_length=30,
            ),
        ),
        migrations.AddField(
            model_name='customerinvoice',
            name='accent_color',
            field=models.CharField(blank=True, default='', max_length=7),
        ),
        migrations.AddField(
            model_name='customerinvoice',
            name='typography',
            field=models.JSONField(default=apps.common.document_appearance.default_document_typography),
        ),
    ]
