from django.db import models
from apps.common.basemodel import BaseModel

class Alert(BaseModel):
    TYPES = [
        ('LOW_STOCK', 'Low Stock'),
        ('STOCK_MOVEMENT', 'Stock Movement'),
        ('ORDER_CREATED', 'Order Created'),
        ('ORDER_COMPLETED', 'Order Completed'),
        ('ORDER_CANCELLED', 'Order Cancelled'),
        ('TRANSFER_CONFIRMED', 'Transfer Confirmed'),
        ('PRICE_CHANGE', 'Price Change'),
        ('SYSTEM', 'System'),
    ]
    SEVERITY = [
        ('info', 'Info'),
        ('warning', 'Warning'),
        ('critical', 'Critical'),
    ]

    # Alert data
    type = models.CharField(max_length=30, choices=TYPES, db_index=True)
    severity = models.CharField(max_length=10, choices=SEVERITY, default='info')
    title = models.CharField(max_length=200)
    message = models.TextField()

    # Target entity (optional)
    entity_type = models.CharField(max_length=50, blank=True)  # e.g., 'productvariant'
    entity_id = models.UUIDField(null=True, blank=True)

    # Who is this alert for? Null = broadcast to all users in company
    target_user_id = models.IntegerField(null=True, blank=True, db_index=True)

    # Read status
    is_read = models.BooleanField(default=False, db_index=True)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'inventory_alerts'
        indexes = [
            models.Index(fields=['company_id', 'branch_id', '-created_at']),
            models.Index(fields=['target_user_id', 'is_read']),
            models.Index(fields=['type', 'severity']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.get_type_display()}: {self.title}"