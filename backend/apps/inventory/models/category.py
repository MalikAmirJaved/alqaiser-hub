from django.db import models

class Category(models.Model):
    company_id = models.IntegerField(db_index=True)
    branch_id = models.IntegerField(db_index=True)

    name = models.CharField(max_length=100)
    code = models.CharField(max_length=50)
    description = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "inventory_categories"
        ordering = ["-created_at"]
        unique_together = [["company_id", "branch_id", "code"]]

    def __str__(self):
        return f"{self.code} - {self.name}"