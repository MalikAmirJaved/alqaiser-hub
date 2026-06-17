"""
Generic filter mixin for DRF viewsets.

Provides a declarative way to add server-side filtering to any viewset
that inherits from `GenericFilterMixin`.

Usage:
    class ProductViewSet(GenericFilterMixin, CompanyBranchMixin, ...):
        filter_fields = {
            'search': ['product_name', 'variants__sku'],  # multi-field search
            'category': 'category___id',                    # FK UUID lookup (note: triple underscore = __ + _id)
            'brand': 'brand___id',
            'status': 'status',
            'is_active': 'is_active',                       # boolean - auto-converted
        }

Note on UUID lookups:
    Use triple underscore for UUID FK lookups: 'category___id'
    Django interprets this as: follow FK 'category' → filter on '_id' field (UUID)
"""

from django.db.models import Q


# List of filter_field keys that should be treated as boolean
_BOOLEAN_FILTER_KEYS = {
    'is_active', 'is_deleted', 'is_read', 'paid', 'is_posted',
    'is_paid', 'is_cancelled', 'is_approved',
}


class GenericFilterMixin:
    """
    Mixin that adds declarative filtering to DRF viewsets/get_queryset.

    Configure via `filter_fields` class attribute:
        dict mapping query param names to Django field lookups.

    Values can be:
        - A string: direct field lookup (e.g. 'status': 'status')
        - A list: multi-field search (e.g. 'search': ['name', 'code', 'email'])
          Each field defaults to __icontains if no explicit lookup suffix.
    """

    # Dict mapping query param name -> field lookup(s)
    # e.g. {'status': 'status', 'search': ['name', 'code'], 'category': 'category___id'}
    filter_fields = {}

    def get_queryset(self):
        qs = super().get_queryset()
        qs = self._apply_filters(qs)
        return qs

    def _apply_filters(self, qs):
        """Apply all declared filters from query params to the queryset."""
        for param, lookups in self.filter_fields.items():
            value = self.request.query_params.get(param)
            if value is None or value == '':
                continue

            # Convert boolean string values to Python booleans
            if param in _BOOLEAN_FILTER_KEYS or (
                isinstance(lookups, str) and lookups.split('__')[-1] in ('is_active', 'is_deleted', 'is_read')
            ):
                if value.lower() in ('true', '1', 'yes'):
                    value = True
                elif value.lower() in ('false', '0', 'no'):
                    value = False
                else:
                    continue  # skip invalid boolean values

            # List of fields -> OR search across multiple fields
            if isinstance(lookups, (list, tuple)):
                q = Q()
                for field in lookups:
                    # Default to icontains for search fields if no explicit lookup
                    if '__' not in field:
                        field = f'{field}__icontains'
                    q |= Q(**{field: value})
                qs = qs.filter(q)
            else:
                # Single field lookup
                qs = qs.filter(**{lookups: value})

        return qs
