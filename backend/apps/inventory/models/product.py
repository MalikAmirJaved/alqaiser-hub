# apps/inventory/models/product.py
from django.db import models
from django.core.validators import MinValueValidator, MaxValueValidator

class Product(models.Model):
    PRODUCT_TYPES = [
        ('simple', 'Simple Product'),
        ('variable', 'Variable Product'),
        ('bundle', 'Bundle Product'),
        ('digital', 'Digital Product'),
        ('service', 'Service'),
    ]
    UNIT_CHOICES = [
        ('PCS', 'Pieces'), ('KG', 'Kilograms'), ('LTR', 'Liters'),
        ('MTR', 'Meters'), ('BOX', 'Box'), ('SET', 'Set'),
        ('PAIR', 'Pair'), ('DOZEN', 'Dozen'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'), ('draft', 'Draft'), ('archived', 'Archived'),
    ]
    TAX_CLASS_CHOICES = [
        ('standard', 'Standard Rate'),
        ('reduced', 'Reduced Rate'),
        ('zero', 'Zero Rate'),
        ('exempt', 'Exempt'),
    ]

    company_id = models.IntegerField(db_index=True)
    branch_id = models.IntegerField(db_index=True)

    sku = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, blank=True)
    name = models.CharField(max_length=255)
    short_description = models.TextField(blank=True)
    description = models.TextField(blank=True)

    category_id = models.CharField(max_length=50, db_index=True, blank=True, null=True)
    brand_id = models.CharField(max_length=50, db_index=True, blank=True, null=True)

    product_type = models.CharField(max_length=20, choices=PRODUCT_TYPES, default='simple')
    unit_of_measure = models.CharField(max_length=10, choices=UNIT_CHOICES, default='PCS')

    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    special_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    special_price_from = models.DateField(blank=True, null=True)
    special_price_to = models.DateField(blank=True, null=True)
    msrp = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)

    tax_class = models.CharField(max_length=20, choices=TAX_CLASS_CHOICES, default='standard')
    tax_rate = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True)

    main_image = models.URLField(blank=True)
    gallery_images = models.JSONField(default=list)  # list of image URLs
    video_url = models.URLField(blank=True)

    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_products'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['company_id', 'branch_id']),
            models.Index(fields=['sku']),
            models.Index(fields=['category_id']),
            models.Index(fields=['brand_id']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.sku} - {self.name}"

class ProductVariant(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='variants')
    sku = models.CharField(max_length=100, unique=True)
    barcode = models.CharField(max_length=100, blank=True)
    attribute_combination = models.JSONField(default=dict)  # e.g., {"Color": "Red", "Size": "M"}
    cost_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    selling_price = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    special_price = models.DecimalField(max_digits=12, decimal_places=2, blank=True, null=True)
    main_image = models.URLField(blank=True)
    status = models.CharField(max_length=20, choices=Product.STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_product_variants'
        indexes = [models.Index(fields=['sku'])]

class ProductAttribute(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='attributes')
    attribute_name = models.CharField(max_length=100)
    attribute_value = models.CharField(max_length=255)
    attribute_group = models.CharField(max_length=100, blank=True)
    is_filterable = models.BooleanField(default=False)
    display_order = models.PositiveIntegerField(default=0)

    class Meta:
        db_table = 'inventory_product_attributes'
        ordering = ['display_order']

class Tag(models.Model):
    company_id = models.IntegerField(db_index=True)
    branch_id = models.IntegerField(db_index=True)
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(unique=True)
    color = models.CharField(max_length=7, blank=True)  # hex color
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_tags'
        indexes = [models.Index(fields=['company_id', 'branch_id'])]

    def __str__(self):
        return self.name

class ProductTag(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE)
    tag = models.ForeignKey(Tag, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'inventory_product_tags'
        unique_together = [['product', 'tag']]

class Inventory(models.Model):
    product = models.ForeignKey(Product, on_delete=models.CASCADE, related_name='inventory_records')
    variant = models.ForeignKey(ProductVariant, on_delete=models.CASCADE, blank=True, null=True, related_name='inventory_records')
    warehouse = models.ForeignKey('inventory.Warehouse', on_delete=models.CASCADE)
    stock_quantity = models.PositiveIntegerField(default=0)
    reserved_quantity = models.PositiveIntegerField(default=0)
    reorder_point = models.PositiveIntegerField(blank=True, null=True)
    reorder_quantity = models.PositiveIntegerField(blank=True, null=True)
    max_stock_level = models.PositiveIntegerField(blank=True, null=True)
    lead_time_days = models.PositiveIntegerField(blank=True, null=True)
    shelf_life_days = models.PositiveIntegerField(blank=True, null=True)
    location_bin = models.CharField(max_length=50, blank=True)
    last_counted_at = models.DateTimeField(blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'inventory_stocks'
        unique_together = [['product', 'variant', 'warehouse']]

    @property
    def available_quantity(self):
        return self.stock_quantity - self.reserved_quantity