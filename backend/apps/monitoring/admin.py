from django.contrib import admin
from .models import Site, Nvr, Camera


@admin.register(Site)
class SiteAdmin(admin.ModelAdmin):
    list_display = ['name', 'location', 'created_at']
    search_fields = ['name', 'location']


@admin.register(Nvr)
class NvrAdmin(admin.ModelAdmin):
    list_display = ['nvr_name', 'site', 'ip', 'port', 'created_at']
    list_filter = ['site']
    search_fields = ['nvr_name', 'ip']


@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ['camera', 'nvr', 'channel', 'zone', 'purpose']
    list_filter = ['nvr__site']
    search_fields = ['camera', 'zone']
