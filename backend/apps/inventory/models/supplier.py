from django.db import models
from apps.common.basemodel import BaseModel

class Supplier(BaseModel):
    PARTNER_TYPES = [
        ('supplier', 'Supplier'),
        ('vendor', 'Vendor'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
        ('suspended', 'Suspended'),
    ]

    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address_line = models.TextField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    payment_terms = models.CharField(max_length=100, blank=True)
    credit_limit = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    rating = models.PositiveSmallIntegerField(default=3, help_text="1-5 stars")
    partner_type = models.CharField(max_length=20, choices=PARTNER_TYPES, default='supplier')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='active')

    class Meta:
        db_table = 'suppliers_partner'
        unique_together = [['company_id', 'branch_id', 'code']]
        ordering = ['name']
        indexes = [
            models.Index(fields=['code']),
            models.Index(fields=['partner_type']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"