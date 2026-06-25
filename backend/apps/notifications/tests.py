from datetime import timedelta
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from apps.notifications.models import Notification

User = get_user_model()


class NotificationModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='notif', email='n@t.com', password='pass'
        )

    def test_create_notification(self):
        n = Notification.objects.create(
            user=self.user, title='Test', message='Hello',
            notification_type='info', company_id=1, branch_id=1
        )
        self.assertEqual(n.title, 'Test')
        self.assertFalse(n.is_read)
        self.assertFalse(n.is_favourite)

    def test_mark_as_read(self):
        n = Notification.objects.create(
            user=self.user, title='T', message='M', company_id=1, branch_id=1
        )
        n.mark_as_read()
        n.refresh_from_db()
        self.assertTrue(n.is_read)
        self.assertIsNotNone(n.read_at)

    def test_mark_as_unread(self):
        n = Notification.objects.create(
            user=self.user, title='T', message='M', company_id=1, branch_id=1
        )
        n.mark_as_read()
        n.mark_as_unread()
        n.refresh_from_db()
        self.assertFalse(n.is_read)
        self.assertIsNone(n.read_at)

    def test_toggle_favourite(self):
        n = Notification.objects.create(
            user=self.user, title='T', message='M', company_id=1, branch_id=1
        )
        self.assertFalse(n.is_favourite)
        n.toggle_favourite()
        n.refresh_from_db()
        self.assertTrue(n.is_favourite)
        n.toggle_favourite()
        n.refresh_from_db()
        self.assertFalse(n.is_favourite)

    def test_is_expired_old(self):
        n = Notification.objects.create(
            user=self.user, title='T', message='M', company_id=1, branch_id=1
        )
        n.created_at = timezone.now() - timedelta(days=31)
        n.save(update_fields=['created_at'])
        self.assertTrue(n.is_expired)

    def test_is_expired_new(self):
        n = Notification.objects.create(
            user=self.user, title='T', message='M', company_id=1, branch_id=1
        )
        self.assertFalse(n.is_expired)

    def test_notification_type_choices(self):
        for ntype in ['info', 'success', 'warning', 'error']:
            n = Notification.objects.create(
                user=self.user, title='T', message='M',
                notification_type=ntype, company_id=1, branch_id=1
            )
            self.assertEqual(n.notification_type, ntype)

    def test_ordering(self):
        n1 = Notification.objects.create(
            user=self.user, title='First', message='M', company_id=1, branch_id=1
        )
        n2 = Notification.objects.create(
            user=self.user, title='Second', message='M', company_id=1, branch_id=1
        )
        notifs = list(Notification.objects.all())
        self.assertEqual(notifs[0].title, 'Second')
        self.assertEqual(notifs[1].title, 'First')
