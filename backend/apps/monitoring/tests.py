from django.contrib.auth import get_user_model
from django.test import TestCase
from apps.monitoring.models import Site, Nvr, Camera

User = get_user_model()


class SiteModelTest(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username='u', email='u@t.com', password='p'
        )

    def test_create(self):
        site = Site.objects.create(
            name='Main Office', location='Lahore',
            company_id=1, branch_id=1, created_by=self.user
        )
        self.assertEqual(str(site), 'Main Office')

    def test_unique_together(self):
        Site.objects.create(name='A', company_id=1, branch_id=1)
        with self.assertRaises(Exception):
            Site.objects.create(name='A', company_id=1, branch_id=1)

    def test_description_blank(self):
        site = Site.objects.create(name='B', company_id=1, branch_id=1)
        self.assertEqual(site.description, '')
        self.assertEqual(site.location, '')


class NvrModelTest(TestCase):
    def setUp(self):
        self.site = Site.objects.create(name='S', company_id=1, branch_id=1)

    def test_create(self):
        nvr = Nvr.objects.create(
            site=self.site, nvr_name='NVR-01', nvr_username='admin',
            password='pass123', ip='192.168.1.100', port=554,
            company_id=1, branch_id=1
        )
        self.assertEqual(str(nvr), 'S - NVR-01')

    def test_unique_together(self):
        Nvr.objects.create(
            site=self.site, nvr_name='X', nvr_username='u', password='p',
            ip='1.1.1.1', port=554, company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            Nvr.objects.create(
                site=self.site, nvr_name='X', nvr_username='u', password='p',
                ip='1.1.1.1', port=554, company_id=1, branch_id=1
            )

    def test_different_site_same_name_ok(self):
        site2 = Site.objects.create(name='S2', company_id=1, branch_id=1)
        Nvr.objects.create(
            site=self.site, nvr_name='N', nvr_username='u', password='p',
            ip='1.1.1.1', port=554, company_id=1, branch_id=1
        )
        nvr2 = Nvr.objects.create(
            site=site2, nvr_name='N', nvr_username='u', password='p',
            ip='2.2.2.2', port=554, company_id=1, branch_id=1
        )
        self.assertIsNotNone(nvr2._id)


class CameraModelTest(TestCase):
    def setUp(self):
        self.site = Site.objects.create(name='S', company_id=1, branch_id=1)
        self.nvr = Nvr.objects.create(
            site=self.site, nvr_name='NVR', nvr_username='admin',
            password='pass', ip='1.1.1.1', port=554, company_id=1, branch_id=1
        )

    def test_create(self):
        cam = Camera.objects.create(
            nvr=self.nvr, camera='Cam-01', channel=1,
            zone='Lobby', purpose='Security',
            company_id=1, branch_id=1
        )
        self.assertEqual(str(cam), 'NVR - Cam-01')

    def test_unique_together(self):
        Camera.objects.create(
            nvr=self.nvr, camera='C1', channel=1, company_id=1, branch_id=1
        )
        with self.assertRaises(Exception):
            Camera.objects.create(
                nvr=self.nvr, camera='C2', channel=1, company_id=1, branch_id=1
            )

    def test_different_nvr_same_channel(self):
        nvr2 = Nvr.objects.create(
            site=self.site, nvr_name='NVR2', nvr_username='admin',
            password='pass', ip='2.2.2.2', port=554, company_id=1, branch_id=1
        )
        Camera.objects.create(
            nvr=self.nvr, camera='C1', channel=1, company_id=1, branch_id=1
        )
        cam = Camera.objects.create(
            nvr=nvr2, camera='C2', channel=1, company_id=1, branch_id=1
        )
        self.assertIsNotNone(cam._id)

    def test_defaults(self):
        cam = Camera.objects.create(
            nvr=self.nvr, camera='C', channel=5, company_id=1, branch_id=1
        )
        self.assertEqual(cam.zone, '')
        self.assertEqual(cam.purpose, '')
