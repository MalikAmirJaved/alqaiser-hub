from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
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
                grouped[key] = {}
            grouped[key][attr['attribute_value']] = {
                'value': attr['attribute_value'],
                'label': attr['attribute_value'],
            }

        result = [{'key': k, 'values': list(v.values())} for k, v in grouped.items()]
        return Response(result)

    def create(self, request):
        user = request.user
        attribute_key = request.data.get('attribute_key', '').strip()
        attribute_value = request.data.get('attribute_value', '').strip()

        if not attribute_key or not attribute_value:
            return Response(
                {'error': 'Both attribute_key and attribute_value are required'},
                status=status.HTTP_400_BAD_REQUEST
            )

        obj, created = VariantAttribute.objects.get_or_create(
            company_id=user.company_id,
            branch_id=user.branch_id,
            attribute_key=attribute_key,
            attribute_value=attribute_value,
            variant=None,
            defaults={
                'created_by': user,
                'updated_by': user,
            }
        )

        return Response({
            'id': str(obj._id),
            'attribute_key': obj.attribute_key,
            'attribute_value': obj.attribute_value,
        }, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
