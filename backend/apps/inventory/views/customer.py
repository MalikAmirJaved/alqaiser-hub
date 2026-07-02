from decimal import Decimal
from django.contrib.contenttypes.models import ContentType
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.common.baseauthentication import CompanyBranchMixin
from apps.common.filters import GenericFilterMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.inventory.models.customer import Customer
from apps.inventory.models.sales import SalesOrder
from apps.inventory.serializers.customer import CustomerSerializer
from apps.sales.models.lead import Lead
from apps.sales.models.quote import Quote
from apps.finance.models import CustomerInvoice, Payment
from apps.finance.services.payable import get_total_paid, get_outstanding
import uuid

class CustomerViewSet(GenericFilterMixin, CompanyBranchMixin, PermissionRequiredMixin, viewsets.ModelViewSet):
    permission_module = 'INVENTORY'
    permission_resource = 'customer'
    action_permission_any_of = {
        "": [("SALES", "sales_customer"), ("FINANCE", "customer_invoice")],
    }
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    lookup_field = '_id'
    filter_fields = {
        'search': ['name', 'customer_code', 'email', 'phone', 'contact_person'],
        'is_active': 'is_active',
        'country': 'country__icontains',
        'city': 'city__icontains',
    }

    @action(detail=True, methods=['get'])
    def detail_summary(self, request, _id=None):
        customer = self.get_object()
        company_id = customer.company_id

        # ---- Related Leads ----
        leads_qs = Lead.objects.filter(
            converted_customer=customer, is_deleted=False
        )

        leads_data = []
        for l in leads_qs:
            leads_data.append({
                'id': str(l._id),
                'first_name': l.first_name,
                'last_name': l.last_name,
                'company_name': l.company_name,
                'email': l.email,
                'phone': l.phone,
                'source': l.source,
                'status': l.status,
                'created_at': l.created_at.isoformat() if l.created_at else None,
                'updated_at': l.updated_at.isoformat() if l.updated_at else None,
            })

        # ---- Related Quotes ----
        quotes_qs = Quote.objects.filter(
            customer=customer, is_deleted=False
        ).select_related('lead', 'converted_invoice')

        quotes_data = []
        for q in quotes_qs:
            quotes_data.append({
                'id': str(q._id),
                'quote_number': q.quote_number,
                'date': q.date.isoformat() if q.date else None,
                'expiration_date': q.expiration_date.isoformat() if q.expiration_date else None,
                'total_amount': str(q.total_amount),
                'overall_discount_percent': str(q.overall_discount_percent),
                'overall_tax_percent': str(q.overall_tax_percent),
                'status': q.status,
                'source': q.source,
                'lead_id': str(q.lead._id) if q.lead else None,
                'converted_invoice_id': str(q.converted_invoice._id) if q.converted_invoice else None,
                'converted_invoice_number': q.converted_invoice.invoice_number if q.converted_invoice else None,
                'notes': q.notes,
                'created_at': q.created_at.isoformat() if q.created_at else None,
                'updated_at': q.updated_at.isoformat() if q.updated_at else None,
            })

        # ---- Related Sales Orders ----
        sales_orders_qs = SalesOrder.objects.filter(
            customer=customer, is_deleted=False
        ).order_by('-created_at')

        sales_orders_data = []
        for so in sales_orders_qs:
            sales_orders_data.append({
                'id': str(so._id),
                'order_number': so.order_number,
                'order_date': so.order_date.isoformat() if so.order_date else None,
                'total_amount': str(so.total_amount),
                'status': so.status,
                'source': so.source,
                'payment_method': so.payment_method,
                'notes': so.notes,
                'created_at': so.created_at.isoformat() if so.created_at else None,
                'updated_at': so.updated_at.isoformat() if so.updated_at else None,
            })

        # ---- Related Invoices + Payments ----
        invoices_qs = CustomerInvoice.objects.filter(
            customer=customer, is_deleted=False
        ).exclude(status='CANCELLED').order_by('-created_at')

        invoices_data = []
        total_invoice_amount = Decimal('0.00')
        total_paid_amount = Decimal('0.00')
        total_outstanding_amount = Decimal('0.00')
        total_discount_amount = Decimal('0.00')
        total_tax_amount = Decimal('0.00')

        for inv in invoices_qs:
            paid = get_total_paid(inv)
            outstanding = get_outstanding(inv)

            # Calculate overall discount value
            disc_pct = Decimal(str(inv.overall_discount_percent or 0))
            disc_value = Decimal(str(inv.amount)) * (disc_pct / Decimal('100'))

            # Calculate overall tax value (post-discount)
            tax_pct = Decimal(str(inv.overall_tax_percent or 0))
            tax_value = Decimal(str(inv.amount)) * (tax_pct / Decimal('100'))

            total_invoice_amount += Decimal(str(inv.amount))
            total_paid_amount += paid
            total_outstanding_amount += outstanding
            total_discount_amount += disc_value
            total_tax_amount += tax_value

            invoices_data.append({
                'id': str(inv._id),
                'invoice_number': inv.invoice_number,
                'invoice_date': inv.invoice_date.isoformat() if inv.invoice_date else None,
                'due_date': inv.due_date.isoformat() if inv.due_date else None,
                'amount': str(inv.amount),
                'paid_amount': str(paid),
                'outstanding': str(outstanding),
                'overall_discount_percent': str(inv.overall_discount_percent),
                'overall_tax_percent': str(inv.overall_tax_percent),
                'status': inv.status,
                'payment_status': inv.payment_status,
                'source': inv.source,
                'payment_method': inv.payment_method,
                'created_at': inv.created_at.isoformat() if inv.created_at else None,
                'updated_at': inv.updated_at.isoformat() if inv.updated_at else None,
            })

        # ---- Direct Payments (via GFK to SalesOrder) ----
        so_ct = ContentType.objects.get_for_model(SalesOrder)
        payments_qs = Payment.objects.filter(
            content_type=so_ct,
            object_id__in=[so.pk for so in sales_orders_qs],
            is_deleted=False,
            status='CONFIRMED',
        )

        total_order_payments = sum(
            (Decimal(str(p.amount)) for p in payments_qs),
            Decimal('0.00'),
        )

        # ---- Activity Timeline ----
        activity = []

        if customer.created_at:
            activity.append({
                'type': 'customer_created',
                'description': 'Customer created',
                'date': customer.created_at.isoformat(),
                'user': customer.created_by.username if customer.created_by else None,
            })

        if customer.updated_at and customer.updated_at != customer.created_at:
            activity.append({
                'type': 'customer_updated',
                'description': 'Customer information updated',
                'date': customer.updated_at.isoformat(),
                'user': customer.updated_by.username if customer.updated_by else None,
            })

        for l in leads_qs:
            activity.append({
                'type': 'lead_converted',
                'description': f"Lead '{l.first_name} {l.last_name}' converted to customer",
                'date': l.created_at.isoformat() if l.created_at else None,
                'user': None,
            })

        for q in quotes_qs:
            activity.append({
                'type': 'quote_created',
                'description': f"Quote {q.quote_number} created ({q.status})",
                'date': q.created_at.isoformat() if q.created_at else None,
                'user': q.created_by.username if q.created_by else None,
            })

        for so in sales_orders_qs:
            activity.append({
                'type': 'order_created',
                'description': f"Sales Order {so.order_number} created ({so.status})",
                'date': so.created_at.isoformat() if so.created_at else None,
                'user': so.created_by.username if so.created_by else None,
            })

        for inv in invoices_qs:
            activity.append({
                'type': 'invoice_created',
                'description': f"Invoice {inv.invoice_number} created ({inv.status})",
                'date': inv.created_at.isoformat() if inv.created_at else None,
                'user': inv.created_by.username if inv.created_by else None,
            })

        # Sort activity by date (newest first)
        activity.sort(key=lambda a: a['date'] or '', reverse=True)

        # ---- Source Detection ----
        source = 'Manual'
        source_detail = None
        if leads_qs.exists():
            source = 'Through Lead'
            source_detail = leads_qs.first().source
        elif sales_orders_qs.filter(source='POS').exists():
            source = 'Through POS'
        elif sales_orders_qs.filter(source='SALES_AGENT').exists():
            source = 'Through Sales Agent'
        elif sales_orders_qs.exists():
            source = 'Through Inventory'

        # ---- Response ----
        return Response({
            'customer': {
                'id': str(customer._id),
                'customer_code': customer.customer_code,
                'name': customer.name,
                'contact_person': customer.contact_person,
                'email': customer.email,
                'phone': customer.phone,
                'address_line': customer.address_line,
                'city': customer.city,
                'state': customer.state,
                'postal_code': customer.postal_code,
                'country': customer.country,
                'is_active': customer.is_active,
                'created_at': customer.created_at.isoformat() if customer.created_at else None,
                'updated_at': customer.updated_at.isoformat() if customer.updated_at else None,
                'created_by': customer.created_by.username if customer.created_by else None,
                'updated_by': customer.updated_by.username if customer.updated_by else None,
            },
            'related': {
                'leads': leads_data,
                'quotes': quotes_data,
                'sales_orders': sales_orders_data,
                'invoices': invoices_data,
            },
            'financial_summary': {
                'total_invoice_amount': str(total_invoice_amount),
                'total_paid': str(total_paid_amount),
                'total_outstanding': str(total_outstanding_amount),
                'total_discount': str(total_discount_amount),
                'total_tax': str(total_tax_amount),
                'total_orders': len(sales_orders_data),
                'total_quotes': len(quotes_data),
                'total_invoices': len(invoices_data),
                'total_leads': len(leads_data),
                'total_order_payments': str(total_order_payments),
            },
            'source': {
                'label': source,
                'detail': source_detail,
                'created_by': customer.created_by.username if customer.created_by else None,
                'created_at': customer.created_at.isoformat() if customer.created_at else None,
                'updated_by': customer.updated_by.username if customer.updated_by else None,
                'updated_at': customer.updated_at.isoformat() if customer.updated_at else None,
            },
            'activity': activity,
        })

    def generate_customer_code(self, company_id, branch_id):
        """
        Generates a unique customer code like:
        CUST-7F3A91K2
        """
        while True:
            code = f"CUST-{uuid.uuid4().hex[:8].upper()}"

            exists = Customer.objects.filter(
                company_id=company_id,
                branch_id=branch_id,
                customer_code=code
            ).exists()

            if not exists:
                return code

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        company_id = request.user.company_id
        branch_id = request.user.branch_id

        customer_code = self.generate_customer_code(company_id, branch_id)

        serializer.save(
            company_id=company_id,
            branch_id=branch_id,
            created_by=request.user,
            updated_by=request.user,
            customer_code=customer_code,  
        )

        return Response({
            'status': 'success',
            'message': f'Customer "{serializer.instance.name}" created.',
            'data': serializer.data
        }, status=status.HTTP_201_CREATED)
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response({
            'status': 'success',
            'message': f'Customer "{serializer.instance.name}" updated.',
            'data': serializer.data
        })

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()

        instance.is_deleted = True
        instance.save(update_fields=["is_deleted"])

        return Response({
            'status': 'success',
            'message': f'Customer "{instance.name}" deleted (soft).'
        }, status=status.HTTP_200_OK)