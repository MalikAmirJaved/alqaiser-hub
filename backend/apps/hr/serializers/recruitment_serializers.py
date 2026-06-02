# apps/hr/serializers/recruitment_serializers.py

from rest_framework import serializers


class RoundBulkCreateSerializer(serializers.Serializer):
    """Serializer for bulk creating interview rounds"""
    # id = serializers.UUIDField(source='_id', read_only=True)
    rounds = serializers.ListField(
        child=serializers.DictField(),
        min_length=1
    )
    
    def validate_rounds(self, value):
        for i, round_data in enumerate(value, 1):
            if not round_data.get('round_title'):
                raise serializers.ValidationError(f"Round {i} requires a title")
            if round_data.get('round_number') != i:
                round_data['round_number'] = i
        return value