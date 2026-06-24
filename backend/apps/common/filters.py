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

from apps.common.pagination import StandardPagination


# List of filter_field keys that should be treated as boolean
_BOOLEAN_FILTER_KEYS = {
    'is_active', 'is_deleted', 'is_read', 'paid', 'is_posted',
    'is_paid', 'is_cancelled', 'is_approved',
}


class FilterPaginationMixin:
    """
    Mixin for APIViews (NOT ModelViewSets) to add:
      - django-filter FilterSet integration
      - Text search across multiple fields
      - Field-whitelisted ordering
      - StandardPagination

    Usage:
        class EmployeeView(CompanyBranchMixin, PermissionRequiredMixin, FilterPaginationMixin, APIView):
            filterset_class = EmployeeFilter
            search_fields = ['first_name', 'last_name', 'email']
            ordering_fields = ['first_name', 'joining_date']
            ordering = ['-created_at']
    """
    filterset_class = None
    search_fields = []
    ordering_fields = []
    ordering = []

    def filter_queryset(self, queryset):
        if self.filterset_class:
            filterset = self.filterset_class(
                self.request.query_params,
                queryset=queryset,
                request=self.request,
            )
            if filterset.is_valid():
                return filterset.qs
        return queryset

    def search_queryset(self, queryset):
        search = self.request.query_params.get('search', '').strip()
        if search and self.search_fields:
            terms = search.split()
            combined_q = Q()
            for term in terms:
                term_q = Q()
                for field in self.search_fields:
                    term_q |= Q(**{f'{field}__icontains': term})
                combined_q &= term_q
            queryset = queryset.filter(combined_q)
        return queryset

    def order_queryset(self, queryset):
        ordering_param = self.request.query_params.get('ordering', '').strip()
        if ordering_param:
            fields = [f.strip() for f in ordering_param.split(',')]
            valid = set(self.ordering_fields) | {f'-{f}' for f in self.ordering_fields}
            cleaned = [f for f in fields if f in valid]
            if cleaned:
                return queryset.order_by(*cleaned)
        if self.ordering:
            return queryset.order_by(*self.ordering)
        return queryset

    def paginate_queryset(self, queryset):
        self.paginator = StandardPagination()
        self.paginator.page_size = self.request.query_params.get('page_size', 20)
        return self.paginator.paginate_queryset(queryset, self.request)

    def get_paginated_response(self, data):
        return self.paginator.get_paginated_response(data)


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

            # List of fields -> multi-term search across multiple fields
            if isinstance(lookups, (list, tuple)):
                terms = str(value).split()
                combined_q = Q()
                for term in terms:
                    term_q = Q()
                    for field in lookups:
                        # Default to icontains for search fields if no explicit lookup
                        if '__' not in field:
                            field = f'{field}__icontains'
                        term_q |= Q(**{field: term})
                    combined_q &= term_q
                qs = qs.filter(combined_q)
            else:
                # Single field lookup
                qs = qs.filter(**{lookups: value})

        return qs
