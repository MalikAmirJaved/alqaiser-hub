from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator
from apps.common.basemodel import BaseModel

class Product(BaseModel):
    UNIT_CHOICES = [
        ('PIECE', 'Piece'), ('KG', 'Kilogram'), ('GRAM', 'Gram'),
        ('LITER', 'Liter'), ('ML', 'Milliliter'), ('PACK', 'Pack'),
        ('DOZEN', 'Dozen'),
    ]
    STORAGE_CHOICES = [
        ('AMBIENT', 'Ambient'), ('REFRIGERATED', 'Refrigerated'), ('FROZEN', 'Frozen'),
    ]
    STATUS_CHOICES = [
        ('draft', 'Draft'), ('active', 'Active'), ('discontinued', 'Discontinued'), ('archived', 'Archived'),
    ]
    SOURCE_CHOICES = [
        ('manual', 'Manual'), ('excel', 'Excel'), ('csv', 'CSV'),
    ]

    product_name = models.CharField(max_length=200, null=True, blank=True)
    description = models.TextField(blank=True)

    category = models.ForeignKey('Category', on_delete=models.SET_NULL, null=True, blank=True)
    brand = models.ForeignKey('Brand', on_delete=models.SET_NULL, null=True, blank=True)

    unit = models.CharField(max_length=20, choices=UNIT_CHOICES, default='PIECE')
    storage_requirement = models.CharField(max_length=20, choices=STORAGE_CHOICES, default='AMBIENT')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, default=0.0, validators=[MinValueValidator(0), MaxValueValidator(100)])

    source = models.CharField(max_length=20, choices=SOURCE_CHOICES, default='manual')
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'inventory_products'
        indexes = [
            models.Index(fields=['product_name']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return self.product_name