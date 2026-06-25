import uuid
from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.audit.models import AuditLog, AuditLogChange

User = get_user_model()


class AuditLogModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='auditor', email='a@t.com', password='pass'
        )

    def test_create_audit_log(self):
        log = AuditLog.objects.create(
            user=self.user, action='CREATE', model_name='Product',
            record_id=uuid.uuid4(), module='inventory',
            company_id=1, branch_id=1
        )
        self.assertEqual(log.action, 'CREATE')
        self.assertIsNotNone(log._id)

    def test_action_choices(self):
        for action in ['CREATE', 'UPDATE', 'DELETE']:
            log = AuditLog.objects.create(
                user=self.user, action=action, model_name='Test',
                record_id=uuid.uuid4(), module='test'
            )
            self.assertEqual(log.action, action)

    def test_ordering(self):
        AuditLog.objects.all().delete()
        l1 = AuditLog.objects.create(
            user=self.user, action='CREATE', model_name='A',
            record_id=uuid.uuid4(), module='m'
        )
        l2 = AuditLog.objects.create(
            user=self.user, action='UPDATE', model_name='B',
            record_id=uuid.uuid4(), module='m'
        )
        logs = list(AuditLog.objects.filter(module='m'))
        self.assertEqual(logs[0].model_name, 'B')
        self.assertEqual(logs[1].model_name, 'A')

    def test_ip_address_nullable(self):
        log = AuditLog.objects.create(
            user=self.user, action='CREATE', model_name='M',
            record_id=uuid.uuid4(), module='m'
        )
        self.assertIsNone(log.ip_address)


class AuditLogChangeModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='chger', email='c@t.com', password='pass'
        )
        self.log = AuditLog.objects.create(
            user=self.user, action='UPDATE', model_name='Product',
            record_id=uuid.uuid4(), module='inventory'
        )

    def test_create_change(self):
        change = AuditLogChange.objects.create(
            audit_log=self.log, field_name='name',
            old_value='Old Product', new_value='New Product'
        )
        self.assertEqual(change.field_name, 'name')
        self.assertEqual(change.old_value, 'Old Product')
        self.assertEqual(change.new_value, 'New Product')

    def test_related_name(self):
        AuditLogChange.objects.create(
            audit_log=self.log, field_name='price', old_value='10', new_value='20'
        )
        AuditLogChange.objects.create(
            audit_log=self.log, field_name='stock', old_value='5', new_value='3'
        )
        self.assertEqual(self.log.field_changes.count(), 2)
