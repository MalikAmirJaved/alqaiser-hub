from rest_framework import serializers


DOCUMENT_TEMPLATE_SLUGS = (
    'modern',
    'minimal',
    'corporate',
    'elegant',
    'blue',
    'dark',
    'startup',
    'agency',
    'creative',
    'classic',
    'nordic',
    'emerald',
    'sunset',
    'slate',
    'bold',
    'lavender',
    'ocean',
    'mono',
)

DOCUMENT_TEMPLATE_CHOICES = tuple((slug, slug.title()) for slug in DOCUMENT_TEMPLATE_SLUGS)

DEFAULT_DOCUMENT_TYPOGRAPHY = {
    'enabled': False,
    'fontFamily': 'default',
    'baseSize': 13,
    'titleLevel': 'h2',
    'boldTitles': True,
    'boldBody': False,
    'italicBody': False,
    'italicNotes': False,
    'useCompanyLogo': True,
    'watermarkEnabled': False,
    'watermarkText': 'PAID',
    'watermarkOpacity': 0.14,
    'watermarkLogo': False,
}

FONT_FAMILIES = {'default', 'sans', 'serif', 'mono', 'classic', 'rounded'}
TITLE_LEVELS = {'h1', 'h2', 'h3'}
TYPOGRAPHY_BOOLEAN_FIELDS = (
    'enabled',
    'boldTitles',
    'boldBody',
    'italicBody',
    'italicNotes',
    'useCompanyLogo',
    'watermarkEnabled',
    'watermarkLogo',
)


def default_document_typography():
    return DEFAULT_DOCUMENT_TYPOGRAPHY.copy()


def validate_document_typography(value):
    if not isinstance(value, dict):
        raise serializers.ValidationError('Typography settings must be an object.')

    unknown_fields = set(value) - set(DEFAULT_DOCUMENT_TYPOGRAPHY)
    if unknown_fields:
        raise serializers.ValidationError(
            f'Unknown typography settings: {", ".join(sorted(unknown_fields))}.'
        )

    normalized = default_document_typography()
    normalized.update(value)

    if not isinstance(normalized['enabled'], bool):
        raise serializers.ValidationError({'enabled': 'Must be a boolean.'})
    if (
        not isinstance(normalized['fontFamily'], str)
        or normalized['fontFamily'] not in FONT_FAMILIES
    ):
        raise serializers.ValidationError({'fontFamily': 'Unsupported font family.'})
    if (
        isinstance(normalized['baseSize'], bool)
        or not isinstance(normalized['baseSize'], (int, float))
        or not 11 <= normalized['baseSize'] <= 18
    ):
        raise serializers.ValidationError({'baseSize': 'Must be a number from 11 to 18.'})
    if (
        not isinstance(normalized['titleLevel'], str)
        or normalized['titleLevel'] not in TITLE_LEVELS
    ):
        raise serializers.ValidationError({'titleLevel': 'Unsupported title level.'})

    for field in TYPOGRAPHY_BOOLEAN_FIELDS[1:]:
        if not isinstance(normalized[field], bool):
            raise serializers.ValidationError({field: 'Must be a boolean.'})

    if not isinstance(normalized['watermarkText'], str):
        raise serializers.ValidationError({'watermarkText': 'Must be a string.'})
    if (
        isinstance(normalized['watermarkOpacity'], bool)
        or not isinstance(normalized['watermarkOpacity'], (int, float))
        or not 0.04 <= normalized['watermarkOpacity'] <= 0.45
    ):
        raise serializers.ValidationError(
            {'watermarkOpacity': 'Must be a number from 0.04 to 0.45.'}
        )

    return normalized
