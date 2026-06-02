import uuid
from django.db import models
from django.conf import settings
from apps.common.basemodel import BaseModel

class Customer(BaseModel):
    """Represents a customer (buyer) for sales orders."""
    customer_code = models.CharField(max_length=50, blank=True)
    name = models.CharField(max_length=255)
    contact_person = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    address_line = models.TextField(blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    country = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'inventory_customers'
        ordering = ['name']
        unique_together = [['company_id', 'branch_id', 'customer_code']]
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['email']),
        ]

    def __str__(self):
        return f"{self.customer_code} - {self.name}"