from django.test import SimpleTestCase
from rest_framework.serializers import ValidationError

from apps.common.document_appearance import (
    DEFAULT_DOCUMENT_TYPOGRAPHY,
    DOCUMENT_TEMPLATE_SLUGS,
    validate_document_typography,
)
from apps.finance.serializers.customer_invoice import CustomerInvoiceSerializer
from apps.sales.serializers.quote import QuoteSerializer


class DocumentAppearanceValidationTests(SimpleTestCase):
    def test_default_typography_is_supported(self):
        self.assertEqual(
            validate_document_typography(DEFAULT_DOCUMENT_TYPOGRAPHY),
            DEFAULT_DOCUMENT_TYPOGRAPHY,
        )

    def test_partial_typography_is_completed_with_defaults(self):
        self.assertEqual(
            validate_document_typography({'fontFamily': 'serif'}),
            {**DEFAULT_DOCUMENT_TYPOGRAPHY, 'fontFamily': 'serif'},
        )

    def test_branding_options_are_validated_and_persisted(self):
        values = {
            'useCompanyLogo': False,
            'watermarkEnabled': True,
            'watermarkText': 'COPY',
            'watermarkOpacity': 0.3,
            'watermarkLogo': True,
        }
        self.assertEqual(
            validate_document_typography(values),
            {**DEFAULT_DOCUMENT_TYPOGRAPHY, **values},
        )
        with self.assertRaises(ValidationError):
            validate_document_typography({'watermarkOpacity': 0.8})
        with self.assertRaises(ValidationError):
            validate_document_typography({'watermarkEnabled': 'yes'})

    def test_unknown_typography_fields_are_rejected(self):
        with self.assertRaises(ValidationError):
            validate_document_typography({'unexpected': True})

    def test_unsupported_font_family_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_document_typography({'fontFamily': 'comic'})

    def test_font_size_outside_supported_range_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_document_typography({'baseSize': 20})

    def test_boolean_font_size_is_rejected(self):
        with self.assertRaises(ValidationError):
            validate_document_typography({'baseSize': True})

    def test_all_generator_templates_have_stable_slugs(self):
        self.assertEqual(len(DOCUMENT_TEMPLATE_SLUGS), 18)
        self.assertEqual(len(set(DOCUMENT_TEMPLATE_SLUGS)), 18)

    def test_quote_and_invoice_serializers_expose_and_validate_design_fields(self):
        for serializer_type in (QuoteSerializer, CustomerInvoiceSerializer):
            serializer = serializer_type()
            self.assertEqual(
                serializer.fields['template_slug'].run_validation('modern'),
                'modern',
            )
            with self.assertRaises(ValidationError):
                serializer.fields['template_slug'].run_validation('not-a-template')
            self.assertEqual(
                serializer.validate_typography({'fontFamily': 'serif'})['fontFamily'],
                'serif',
            )
            with self.assertRaises(ValidationError):
                serializer.validate_accent_color('#12345g')
