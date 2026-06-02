from django.db import models
from apps.common.basemodel import BaseModel

class StockReservation(BaseModel):
    STATUS_CHOICES = [
        ('ACTIVE', 'Active'),
        ('FULFILLED', 'Fulfilled'),
        ('CANCELLED', 'Cancelled'),
        ('EXPIRED', 'Expired'),
    ]

    variant = models.ForeignKey('ProductVariant', on_delete=models.CASCADE)
    warehouse = models.ForeignKey('Warehouse', on_delete=models.CASCADE)
    quantity = models.PositiveIntegerField()
    reservation_type = models.CharField(max_length=20)
    reference_id = models.UUIDField(db_index=True)
    reference_line_id = models.UUIDField(null=True)
    reserved_until = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='ACTIVE')

    class Meta:
        db_table = 'inventory_reservations'
        indexes = [
            models.Index(fields=['variant', 'warehouse', 'status']),
            models.Index(fields=['reference_id']),
        ]