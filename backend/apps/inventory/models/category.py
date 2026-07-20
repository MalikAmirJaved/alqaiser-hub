from django.db import models
from apps.common.basemodel import BaseModel

class Category(BaseModel):
    SOURCE_CHOICES = [
        ('manual', 'Manual'), ('excel', 'Excel'), ('csv', 'CSV'),
    ]

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')

    class Meta:
        db_table = "inventory_categories"
        ordering = ["-created_at"]
        unique_together = [["company_id", "branch_id", "code"]]

    def __str__(self):
        return f"{self.code} - {self.name}"