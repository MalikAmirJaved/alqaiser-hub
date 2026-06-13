# apps/inventory/models/warehouse.py
from django.db import models

class Warehouse(models.Model):
    company_id = models.IntegerField(db_index=True)
    branch_id = models.IntegerField(db_index=True)
    
    warehouse_name = models.CharField(max_length=200)
    code = models.CharField(max_length=50, unique=True)
    manager_name = models.CharField(max_length=150)
    phone = models.CharField(max_length=20)
    capacity = models.DecimalField(max_digits=12, decimal_places=2, help_text="Storage capacity in sq ft or cubic meters")
    current_occupancy = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    
    # Location fields
    country = models.CharField(max_length=100)
    state = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100)
    address_line = models.TextField(blank=True)
    postal_code = models.CharField(max_length=20, blank=True)
    
    # Additional fields
    email = models.EmailField(blank=True)
    is_active = models.BooleanField(default=True)
    description = models.TextField(blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "inventory_warehouses"
        ordering = ["-created_at"]
        unique_together = [["company_id", "branch_id", "code"]]
        indexes = [
            models.Index(fields=["company_id", "branch_id"]),
            models.Index(fields=["warehouse_name"]),
            models.Index(fields=["is_active"]),
        ]
    
    def __str__(self):
        return f"{self.code} - {self.warehouse_name}"
    
    @property
    def available_capacity(self):
        """Calculate available capacity"""
        return self.capacity - self.current_occupancy
    
    @property
    def occupancy_percentage(self):
        """Calculate occupancy percentage"""
        if self.capacity > 0:
            return (self.current_occupancy / self.capacity) * 100
        return 0