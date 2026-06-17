from django.db import models
from apps.common.basemodel import BaseModel


class Site(BaseModel):
    name = models.CharField(max_length=200)
    location = models.CharField(max_length=500, blank=True)
    description = models.TextField(blank=True)

    class Meta:
        db_table = 'monitoring_sites'
        ordering = ['name']
        unique_together = [['company_id', 'branch_id', 'name']]

    def __str__(self):
        return self.name


class Nvr(BaseModel):
    site = models.ForeignKey(
        Site, on_delete=models.CASCADE, related_name='nvrs'
    )
    nvr_name = models.CharField(max_length=200)
    nvr_username = models.CharField(max_length=100)
    password = models.CharField(max_length=500)
    ip = models.CharField(max_length=100)
    port = models.IntegerField()

    class Meta:
        db_table = 'monitoring_nvrs'
        ordering = ['-created_at']
        unique_together = [['site', 'nvr_name']]

    def __str__(self):
        return f"{self.site.name} - {self.nvr_name}"


class Camera(BaseModel):
    nvr = models.ForeignKey(
        Nvr, on_delete=models.CASCADE, related_name='cameras'
    )
    camera = models.CharField(max_length=200)
    channel = models.IntegerField()
    zone = models.CharField(max_length=200, blank=True)
    purpose = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'monitoring_cameras'
        ordering = ['nvr', 'channel']
        unique_together = [['nvr', 'channel']]

    def __str__(self):
        return f"{self.nvr.nvr_name} - {self.camera}"
