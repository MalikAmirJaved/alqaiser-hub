from django.db import models
from apps.common.basemodel import BaseModel


class Lead(BaseModel):
    converted_customer = models.ForeignKey(
        'inventory.Customer',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='converted_from_leads',
    )
    STATUS_CHOICES = [
        ('NEW', 'New'),
        ('CONTACTED', 'Contacted'),
        ('QUALIFIED', 'Qualified'),
        ('FOLLOW_UP', 'Follow Up'),
        ('CONVERTED', 'Converted'),
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
    LOST_REASON_CHOICES = [
        ('TOO_EXPENSIVE', 'Too Expensive'),
        ('COMPETITOR_SELECTED', 'Competitor Selected'),
        ('NO_RESPONSE', 'No Response'),
        ('OTHER', 'Other'),
    ]
    title = models.CharField(max_length=255, blank=True)
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50, blank=True)
    company_name = models.CharField(max_length=100, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='MANUAL')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='NEW')
    notes = models.TextField(blank=True)
    address_line = models.TextField(blank=True)
    country = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    score = models.IntegerField(null=True, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    follow_up_notes = models.TextField(blank=True)
    lost_reason = models.CharField(max_length=30, choices=LOST_REASON_CHOICES, blank=True)

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
