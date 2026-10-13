from django.db import migrations, models
import apps.common.document_appearance


class Migration(migrations.Migration):

    dependencies = [
        ('sales', '0016_backfill_deleted_at'),
    ]

    operations = [
        migrations.AddField(
            model_name='quote',
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
            model_name='quote',
            name='accent_color',
            field=models.CharField(blank=True, default='', max_length=7),
        ),
        migrations.AddField(
            model_name='quote',
            name='typography',
            field=models.JSONField(default=apps.common.document_appearance.default_document_typography),
        ),
    ]
