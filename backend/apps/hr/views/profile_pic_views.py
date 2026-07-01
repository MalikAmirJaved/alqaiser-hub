"""
API views for employee profile picture validation and management.
"""
import os
import uuid
import logging

from django.conf import settings
from django.utils.text import get_valid_filename
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser

from apps.common.baseauthentication import CompanyBranchMixin
from apps.permissions.mixins import PermissionRequiredMixin
from apps.hr.services.face_detection import validate_profile_picture

logger = logging.getLogger(__name__)


class EmployeeProfilePicUploadView(CompanyBranchMixin, PermissionRequiredMixin, APIView):
    """
    Upload a profile picture, generate thumbnails, and run face detection validation.
    
    POST: Upload a file, validate it (face detection + resolution), return result.
    Expects multipart form with:
        - file: the image file (jpg, jpeg, png, gif, webp)
    
    Returns:
        - valid (bool): whether all validation checks passed
        - faces_detected (int): number of faces found
        - width/height (int): image dimensions
        - error (str, optional): error message if validation fails
        - url/url_thumb/url_detail: file URLs
    """
    permission_module = 'HR'
    permission_resource = 'employee'
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    ALLOWED_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp']

    def post(self, request):
        uploaded_file = request.FILES.get('file')
        if not uploaded_file:
            return Response(
                {'error': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ext = os.path.splitext(uploaded_file.name)[1].lower().lstrip('.')
        if ext not in self.ALLOWED_EXTS:
            return Response({
                'valid': False,
                'error': f'File type .{ext} not allowed. Allowed: {", ".join(self.ALLOWED_EXTS)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save file to upload directory
        upload_dir = os.path.join(settings.BASE_DIR, 'upload', 'employee', 'profile')
        os.makedirs(upload_dir, exist_ok=True)

        file_id = uuid.uuid4().hex
        filename = f'{file_id}.{ext}'
        filepath = os.path.join(upload_dir, filename)

        with open(filepath, 'wb+') as dest:
            for chunk in uploaded_file.chunks():
                dest.write(chunk)

        relative_url = f'/upload/employee/profile/{filename}'

        # Generate thumbnails
        thumb_url = ''
        detail_url = ''
        try:
            from PIL import Image as PILImage
            img = PILImage.open(filepath)

            # Convert RGBA to RGB for JPEG compatibility
            if img.mode in ('RGBA', 'P') and ext in ('jpg', 'jpeg'):
                img = img.convert('RGB')

            # Thumbnail (150x150)
            thumb_img = img.copy()
            thumb_img.thumbnail((150, 150), PILImage.LANCZOS)
            thumb_filename = f'{file_id}_thumb.{ext}'
            thumb_path = os.path.join(upload_dir, thumb_filename)
            thumb_img.save(thumb_path, quality=80, optimize=True)
            thumb_url = f'/upload/employee/profile/{thumb_filename}'

            # Detail (600x600)
            detail_img = img.copy()
            detail_img.thumbnail((600, 600), PILImage.LANCZOS)
            detail_filename = f'{file_id}_detail.{ext}'
            detail_path = os.path.join(upload_dir, detail_filename)
            detail_img.save(detail_path, quality=85, optimize=True)
            detail_url = f'/upload/employee/profile/{detail_filename}'
        except Exception as e:
            logger.warning(f"Thumbnail generation failed: {e}")

        # Run face detection validation
        validation = validate_profile_picture(filepath)

        return Response({
            'valid': validation.get('valid', False),
            'faces_detected': validation.get('faces_detected', 0),
            'width': validation.get('width', 0),
            'height': validation.get('height', 0),
            'error': validation.get('error'),
            'url': relative_url,
            'url_thumb': thumb_url,
            'url_detail': detail_url,
            'filename': uploaded_file.name,
            'size': uploaded_file.size,
            'mime_type': uploaded_file.content_type or 'image/jpeg',
        })
