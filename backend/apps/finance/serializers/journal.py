from rest_framework import serializers
from decimal import Decimal
from apps.finance.models import JournalEntry, JournalLine

class JournalLineSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='_id', read_only=True)
    class Meta:
        model = JournalLine
        fields = '__all__'
        read_only_fields = ('id', 'created_at', 'updated_at')

    def validate(self, data):
        debit = data.get('debit', Decimal('0.00'))
        credit = data.get('credit', Decimal('0.00'))
        if debit and credit:
            raise serializers.ValidationError("A line cannot have both debit and credit.")
        if debit == Decimal('0.00') and credit == Decimal('0.00'):
            raise serializers.ValidationError("A line must have either debit or credit > 0.")
        return data

class JournalEntrySerializer(serializers.ModelSerializer):
    lines = JournalLineSerializer(many=True, required=False)
    id = serializers.UUIDField(source='_id', read_only=True)
    class Meta:
        model = JournalEntry
        fields = '__all__'
        read_only_fields = ('id','created_at', 'updated_at', 'company_id', 'branch_id')

    def create(self, validated_data):
        lines_data = validated_data.pop('lines', [])
        entry = JournalEntry.objects.create(**validated_data)
        for line_data in lines_data:
            JournalLine.objects.create(journal_entry=entry, **line_data)
        # Validate balance
        total_debit = sum(line.debit for line in entry.lines.all())
        total_credit = sum(line.credit for line in entry.lines.all())
        if total_debit != total_credit:
            entry.delete()
            raise serializers.ValidationError("Total debits must equal total credits.")
        return entry

    def update(self, instance, validated_data):
        lines_data = validated_data.pop('lines', None)
        instance = super().update(instance, validated_data)
        if lines_data is not None:
            instance.lines.all().update(is_deleted=True)
            for line_data in lines_data:
                JournalLine.objects.create(journal_entry=instance, **line_data)
        total_debit = sum(line.debit for line in instance.lines.all())
        total_credit = sum(line.credit for line in instance.lines.all())
        if total_debit != total_credit:
            raise serializers.ValidationError("Total debits must equal total credits.")
        return instance