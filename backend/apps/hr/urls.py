# apps/hr/urls.py
from django.urls import path
from apps.hr.views.shift_template_views import ShiftTemplateView
# ... other imports

urlpatterns = [
    # Shift Templates
    path('shift-templates/', ShiftTemplateView.as_view(), name='shift-templates'),
    
    # ... other HR URLs
]