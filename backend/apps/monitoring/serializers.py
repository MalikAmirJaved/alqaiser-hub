from rest_framework import serializers
from .models import Site, Nvr, Camera


class SiteSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    nvr_count = serializers.SerializerMethodField()

    class Meta:
        model = Site
        fields = [
            'id', 'name', 'location', 'description',
            'nvr_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'nvr_count', 'created_at', 'updated_at']

    def get_nvr_count(self, obj):
        return obj.nvrs.filter(is_deleted=False).count()


class NvrSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    site_id = serializers.UUIDField(source='site._id', read_only=True)
    site_name = serializers.CharField(source='site.name', read_only=True)
    site = serializers.UUIDField(write_only=True)
    camera_count = serializers.SerializerMethodField()

    class Meta:
        model = Nvr
        fields = [
            'id', 'site', 'site_id', 'site_name',
            'nvr_name', 'nvr_username', 'password', 'ip', 'port',
            'camera_count', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'site_id', 'site_name', 'camera_count', 'created_at', 'updated_at']

    def get_camera_count(self, obj):
        return obj.cameras.filter(is_deleted=False).count()

    def validate_site(self, value):
        import uuid
        if isinstance(value, str):
            value = uuid.UUID(value)
        try:
            return Site.objects.get(_id=value, is_deleted=False)
        except Site.DoesNotExist:
            raise serializers.ValidationError("Site not found")


class CameraSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    nvr_id = serializers.UUIDField(source='nvr._id', read_only=True)
    nvr_name = serializers.CharField(source='nvr.nvr_name', read_only=True)
    nvr = serializers.UUIDField(write_only=True)

    class Meta:
        model = Camera
        fields = [
            'id', 'nvr', 'nvr_id', 'nvr_name',
            'camera', 'channel', 'zone', 'purpose',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'nvr_id', 'nvr_name', 'created_at', 'updated_at']

    def validate_nvr(self, value):
        import uuid
        if isinstance(value, str):
            value = uuid.UUID(value)
        try:
            return Nvr.objects.get(_id=value, is_deleted=False)
        except Nvr.DoesNotExist:
            raise serializers.ValidationError("NVR not found")
