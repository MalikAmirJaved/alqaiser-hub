# backend/apps/common/serializer_fields.py
from rest_framework import serializers
from django.apps import apps


class UUIDForeignRelatedField(serializers.RelatedField):
    """
    A read/write field that represents a foreign key relation using the related model's '_id' (UUID).
    Usage: variant = UUIDForeignRelatedField(queryset=ProductVariant.objects.all())
    """
    default_error_messages = {
        'does_not_exist': 'Object with _id={value} does not exist.',
        'invalid': 'Invalid value.',
    }

    def __init__(self, **kwargs):
        self.queryset = kwargs.pop('queryset', None)
        super().__init__(**kwargs)

    def to_representation(self, value):
        # Output the UUID (_id) of the related object
        return str(value._id)

    def to_internal_value(self, data):
        # Input is a UUID string – find the object by _id
        try:
            obj = self.queryset.get(_id=data)
        except self.queryset.model.DoesNotExist:
            self.fail('does_not_exist', value=data)
        except (TypeError, ValueError):
            self.fail('invalid')
        return obj