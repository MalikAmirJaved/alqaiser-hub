from django.urls import path
from .views import GenerateCodeView, ValidateCodeView, FileUploadView

urlpatterns = [
    path('generate-code/', GenerateCodeView.as_view(), name='generate-code'),
    path('validate-code/', ValidateCodeView.as_view(), name='validate-code'),
    path('upload/', FileUploadView.as_view(), name='file-upload'),
]
