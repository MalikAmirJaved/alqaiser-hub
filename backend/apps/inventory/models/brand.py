from django.db import models
from apps.common.basemodel import BaseModel

class Brand(BaseModel):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)
    country_of_origin = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = "inventory_brands"
        ordering = ["-created_at"]
        unique_together = [["company_id", "branch_id", "code"]]

    def __str__(self):
        return f"{self.code} - {self.name}"