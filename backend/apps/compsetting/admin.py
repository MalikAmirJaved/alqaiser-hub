from django.contrib import admin
from .models import CompanySettings


@admin.register(CompanySettings)
class CompanySettingsAdmin(admin.ModelAdmin):
    list_display = ('company', 'currency', 'timezone', 'is_setup_completed', 'updated_at')
    readonly_fields = ('_id', 'created_at', 'updated_at')