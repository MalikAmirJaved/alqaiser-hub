"""
API views for employee profile picture validation.
"""
import os
import uuid
import logging

from django.conf import settings
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
    Validate a profile picture WITHOUT permanently saving it.
    
    POST: Save file to temp → run face detection → delete temp → return result.
    
    Returns ONLY status data (no file URLs):
        - valid (bool): whether the image passed validation
        - faces_detected (int): number of faces found
        - width/height (int): image dimensions (0 if detection fails)
        - message (str): human-readable result message
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
                {'valid': False, 'message': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ext = os.path.splitext(uploaded_file.name)[1].lower().lstrip('.')
        if ext not in self.ALLOWED_EXTS:
            return Response({
                'valid': False,
                'message': f'File type .{ext} is not allowed. Allowed: {", ".join(self.ALLOWED_EXTS)}',
            }, status=status.HTTP_400_BAD_REQUEST)

        # Save to TEMP directory
        temp_dir = os.path.join(settings.BASE_DIR, 'upload', 'temp', 'profile')
        os.makedirs(temp_dir, exist_ok=True)

        file_id = uuid.uuid4().hex
        filename = f'{file_id}.{ext}'
        filepath = os.path.join(temp_dir, filename)

        with open(filepath, 'wb+') as dest:
            for chunk in uploaded_file.chunks():
                dest.write(chunk)

        try:
            # Run face detection
            validation = validate_profile_picture(filepath)

            # Build response
            valid = validation.get('valid', False)
            faces = validation.get('faces_detected', 0)
            width = validation.get('width', 0)
            height = validation.get('height', 0)
            error = validation.get('error')

            if valid:
                message = f'Photo accepted — 1 human face detected (confidence: {validation.get("confidence", 0):.2f})'
            else:
                message = error or 'Face validation failed. Please upload a clear photo of a person\'s face.'

            return Response({
                'valid': valid,
                'faces_detected': faces,
                'width': width,
                'height': height,
                'message': message,
            })

        finally:
            # ALWAYS delete the temp file — no orphaned files
            try:
                if os.path.exists(filepath):
                    os.remove(filepath)
                # Also remove any thumbnails that might have been generated
                for suffix in ['_thumb', '_detail']:
                    thumb_path = os.path.join(temp_dir, f'{file_id}{suffix}.{ext}')
                    if os.path.exists(thumb_path):
                        os.remove(thumb_path)
            except Exception as e:
                logger.warning(f"Failed to clean up temp file {filepath}: {e}")
