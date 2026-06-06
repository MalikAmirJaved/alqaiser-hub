from django.db import models, transaction
from django.core.exceptions import ValidationError
from apps.common.basemodel import BaseModel
from apps.inventory.models.customer import Customer

class Lead(BaseModel):
    QUALIFIED = 'QUALIFIED'
    WON = 'WON'
    LOST = 'LOST'

    STATUS_CHOICES = [
        ('NEW', 'New'),
        ('CONTACTED', 'Contacted'),
        ('QUALIFIED', 'Qualified'),
        ('WON', 'Won'),
        ('LOST', 'Lost'),
    ]
    SOURCE_CHOICES = [
        ('MANUAL', 'Manual'),
        ('FACEBOOK', 'Facebook'),
        ('WHATSAPP', 'WhatsApp'),
        ('INSTAGRAM', 'Instagram'),
        ('WEBSITE', 'Website'),
        ('REFERRAL', 'Referral'),
        ('OTHER', 'Other'),
    ]
    title = models.CharField(max_length=255, blank=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50, blank=True)
    company_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=20, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')
    customer = models.ForeignKey(
        'inventory.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='leads'
    )
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'sales_leads'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return full_name or self.company_name or f"Lead {self.id}"
    
    def create_customer_from_lead(self, created_by=None):
        """Create a customer from this lead data"""
        if self.customer:
            return self.customer
        
        # Check if customer with same email already exists
        if self.email:
            existing_customer = Customer.objects.filter(
                email=self.email,
                company_id=self.company_id,
                branch_id=self.branch_id,
                is_deleted=False
            ).first()
            if existing_customer:
                self.customer = existing_customer
                self.save(update_fields=['customer'])
                return existing_customer
        
        # Create new customer
        customer_data = {
            'name': self.company_name or f"{self.first_name} {self.last_name}".strip(),
            'contact_person': f"{self.first_name} {self.last_name}".strip(),
            'email': self.email,
            'phone': self.phone,
            'company_id': self.company_id,
            'branch_id': self.branch_id,
        }
        
        customer = Customer.objects.create(**customer_data, created_by=created_by, updated_by=created_by)
        self.customer = customer
        self.save(update_fields=['customer'])
        return customer
    
    def convert_to_won(self, create_customer=True, create_quote=False, created_by=None):
        """Convert lead to WON status and optionally create customer and quote"""
        if self.status == 'WON':
            raise ValidationError('Lead already converted to WON')
        
        with transaction.atomic():
            # Create customer if requested and not exists
            if create_customer:
                self.create_customer_from_lead(created_by)
            
            # Update lead status
            self.status = 'WON'
            self.save(update_fields=['status'])
            
            # Optionally create quote
            if create_quote and self.customer:
                from apps.sales.models.quote import Quote
                import time
                import random
                quote = Quote.objects.create(
                    quote_number=f"QT-{int(time.time())}-{random.randint(1000, 9999)}",
                    lead=self,
                    customer=self.customer,
                    status='DRAFT',
                    total_amount=0,
                    company_id=self.company_id,
                    branch_id=self.branch_id,
                    created_by=created_by,
                    updated_by=created_by,
                )
                return quote
        
        return self
