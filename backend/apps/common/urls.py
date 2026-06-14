from django.urls import path
from .views import GenerateCodeView, ValidateCodeView

urlpatterns = [
    path('generate-code/', GenerateCodeView.as_view(), name='generate-code'),
    path('validate-code/', ValidateCodeView.as_view(), name='validate-code'),
]
