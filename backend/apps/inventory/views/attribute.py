from rest_framework import viewsets, status
from rest_framework.response import Response
from django.db.models import Count
from apps.common.baseauthentication import CompanyBranchMixin
from apps.inventory.models import VariantAttribute


class AttributeViewSet(CompanyBranchMixin, viewsets.ViewSet):
    def list(self, request):
        user = request.user
        attrs = (
            VariantAttribute.objects
            .filter(company_id=user.company_id, is_deleted=False)
            .values('attribute_key', 'attribute_value')
            .annotate(count=Count('id'))
            .order_by('attribute_key', 'attribute_value')
        )

        grouped = {}
        for attr in attrs:
            key = attr['attribute_key']
            if key not in grouped:
                grouped[key] = []
            grouped[key].append({
                'value': attr['attribute_value'],
                'label': attr['attribute_value'],
            })

        result = [{'key': k, 'values': v} for k, v in grouped.items()]
        return Response(result)
