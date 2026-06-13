# apps/inventory/models/brand.py
from django.db import models

class Brand(models.Model):
    company_id = models.IntegerField(db_index=True)
    branch_id = models.IntegerField(db_index=True)
    
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    country_of_origin = models.CharField(max_length=100, blank=True)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "inventory_brands"
        ordering = ["-created_at"]
        unique_together = [["company_id", "branch_id", "code"]]
    
    def __str__(self):
        return f"{self.code} - {self.name}"