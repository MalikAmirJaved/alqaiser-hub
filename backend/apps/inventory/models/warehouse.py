from django.db import models
from apps.common.basemodel import BaseModel

class Warehouse(BaseModel):
    warehouse_name = models.CharField(max_length=200)
    code = models.CharField(max_length=50)
    
    # New fields
    employee = models.ForeignKey(
        'hr.Employee',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='warehouses'
    )
    landline_number = models.CharField(max_length=20, blank=True, null=True)
    
    # Existing fields that remain
    country = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100)
    address_line = models.TextField(blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = "inventory_warehouses"
        ordering = ["-created_at"]
        unique_together = [["company_id", "branch_id", "code"]]
        indexes = [
            models.Index(fields=["warehouse_name"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self):
        return f"{self.code} - {self.warehouse_name}"