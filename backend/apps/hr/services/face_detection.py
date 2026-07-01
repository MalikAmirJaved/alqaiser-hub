"""
Face detection service for employee profile picture validation.
Uses OpenCV DNN face detector (SSD + ResNet-10) trained on the WIDER FACE dataset.
This model was trained on HUMAN faces only, so it correctly rejects animal faces.

Advantages over Haar Cascade:
  - Trained specifically on human face dataset (WIDER FACE)
  - Much higher accuracy, fewer false positives
  - Works reliably on faces of all sizes
  - Rejects cat/dog/animal faces
"""
import os
import cv2
import logging
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

MIN_WIDTH = 300
MIN_HEIGHT = 300
MAX_WIDTH = 5000
MAX_HEIGHT = 7000

# Path to DNN model files
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', '..', 'face_model')
PROTOTXT = os.path.join(MODEL_DIR, 'deploy.prototxt')
CAFFEMODEL = os.path.join(MODEL_DIR, 'res10_300x300_ssd_iter_140000.caffemodel')

# Confidence threshold — only keep detections above this score
CONFIDENCE_THRESHOLD = 0.5

_face_net = None


def _get_face_net():
    """Lazy-load the DNN face detection network."""
    global _face_net
    if _face_net is None:
        if not os.path.exists(PROTOTXT) or not os.path.exists(CAFFEMODEL):
            raise RuntimeError(
                f"DNN face model not found at {MODEL_DIR}. "
                "Expected deploy.prototxt and res10_300x300_ssd_iter_140000.caffemodel."
            )
        _face_net = cv2.dnn.readNetFromCaffe(PROTOTXT, CAFFEMODEL)
        logger.info("DNN face detection model loaded successfully")
    return _face_net


def _nms(boxes, overlap_thresh=0.3):
    """Non-Maximum Suppression — merge overlapping detections."""
    if len(boxes) == 0:
        return []
    rects = np.zeros((len(boxes), 4), dtype=np.float32)
    rects[:, 0] = boxes[:, 0]
    rects[:, 1] = boxes[:, 1]
    rects[:, 2] = boxes[:, 0] + boxes[:, 2]
    rects[:, 3] = boxes[:, 1] + boxes[:, 3]
    areas = (rects[:, 2] - rects[:, 0]) * (rects[:, 3] - rects[:, 1])
    order = areas.argsort()[::-1]
    keep = []
    while len(order) > 0:
        i = order[0]
        keep.append(i)
        if len(order) == 1:
            break
        xx1 = np.maximum(rects[i, 0], rects[order[1:], 0])
        yy1 = np.maximum(rects[i, 1], rects[order[1:], 1])
        xx2 = np.minimum(rects[i, 2], rects[order[1:], 2])
        yy2 = np.minimum(rects[i, 3], rects[order[1:], 3])
        w = np.maximum(0, xx2 - xx1)
        h = np.maximum(0, yy2 - yy1)
        overlap = (w * h) / (areas[order[1:]] + areas[i] - w * h + 1e-10)
        order = order[1:][overlap < overlap_thresh]
    return boxes[keep]


def validate_profile_picture(file_path: str) -> dict:
    """
    Validate a profile picture using DNN-based human face detection.
    
    Returns:
        dict with keys:
            - valid (bool): whether the image passes all checks
            - faces_detected (int): number of human faces found
            - width (int): image width
            - height (int): image height
            - confidence (float): detection confidence of the best face
            - error (str, optional): error message if validation fails
    """
    result = {
        'valid': False,
        'faces_detected': 0,
        'width': 0,
        'height': 0,
        'confidence': 0.0,
        'error': None,
    }

    if not os.path.exists(file_path):
        result['error'] = 'File not found'
        return result

    try:
        with Image.open(file_path) as pil_img:
            width, height = pil_img.size
            result['width'] = width
            result['height'] = height

            # Resolution validation
            if width < MIN_WIDTH or height < MIN_HEIGHT:
                result['error'] = (
                    f'Image resolution too low: {width}x{height}. '
                    f'Minimum required: {MIN_WIDTH}x{MIN_HEIGHT} pixels.'
                )
                return result
            if width > MAX_WIDTH or height > MAX_HEIGHT:
                result['error'] = (
                    f'Image resolution too high: {width}x{height}. '
                    f'Maximum allowed: {MAX_WIDTH}x{MAX_HEIGHT} pixels.'
                )
                return result

            # Convert PIL to OpenCV BGR format
            if pil_img.mode != 'RGB':
                pil_img = pil_img.convert('RGB')
            img_array = np.array(pil_img)
            # OpenCV uses BGR
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            img_h, img_w = img_bgr.shape[:2]

            net = _get_face_net()

            # ── DNN forward pass ─────────────────────────────────────────
            # Create a 300x300 blob (the model's expected input size)
            blob = cv2.dnn.blobFromImage(
                img_bgr, 1.0, (300, 300),
                (104.0, 177.0, 123.0),  # mean subtraction values
                swapRB=False, crop=False
            )
            net.setInput(blob)
            detections = net.forward()

            # ── Parse detections ─────────────────────────────────────────
            # detections shape: (1, 1, N, 7) where each detection is:
            #   [batch_id, class_id, confidence, x1, y1, x2, y2]
            # Coordinates are normalized [0, 1]
            all_boxes = []
            for i in range(detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence < CONFIDENCE_THRESHOLD:
                    continue

                # Convert normalized coords to pixel coords
                box = detections[0, 0, i, 3:7] * np.array([img_w, img_h, img_w, img_h])
                (x1, y1, x2, y2) = box.astype(int)

                # Clamp to image boundaries
                x1 = max(0, x1)
                y1 = max(0, y1)
                x2 = min(img_w - 1, x2)
                y2 = min(img_h - 1, y2)

                w = x2 - x1
                h = y2 - y1
                if w > 0 and h > 0:
                    all_boxes.append((x1, y1, w, h, confidence))

            if not all_boxes:
                result['error'] = (
                    'No human face detected in the image. '
                    'Please upload a clear photo of a person\'s face.'
                )
                return result

            # ── Apply Non-Maximum Suppression ────────────────────────────
            boxes_array = np.array([(x, y, w, h) for (x, y, w, h, c) in all_boxes])
            confidences = [c for (_, _, _, _, c) in all_boxes]
            merged = _nms(boxes_array, overlap_thresh=0.3)

            if len(merged) == 0:
                result['error'] = (
                    'No human face detected in the image. '
                    'Please upload a clear photo of a person\'s face.'
                )
                return result

            # ── Filter by position (faces should be in upper portion) ────
            candidates = []
            for (x, y, w, h) in merged:
                center_y_pct = ((y + h / 2) / img_h) * 100
                aspect = max(w, h) / max(min(w, h), 1)
                area_pct = (w * h) / (img_w * img_h) * 100

                if area_pct > 35:
                    continue  # body/background false positive
                if aspect > 3.0:
                    continue  # too elongated
                if center_y_pct > 85:
                    continue  # too low in frame
                if area_pct < 0.01:
                    continue  # too tiny

                candidates.append((x, y, w, h))

            if not candidates:
                result['error'] = (
                    'No human face detected in the image. '
                    'Please upload a clear photo of a person\'s face.'
                )
                return result

            # ── Count distinct faces ─────────────────────────────────────
            if len(candidates) == 1:
                result['faces_detected'] = 1
                result['valid'] = True
                result['confidence'] = float(max(confidences))
                return result

            # Check if remaining candidates are distinct or overlapping
            distinct = 1
            bx1, by1, bw, bh = candidates[0]
            for (cx1, cy1, cw, ch) in candidates[1:]:
                ox = max(0, min(bx1 + bw, cx1 + cw) - max(bx1, cx1))
                oy = max(0, min(by1 + bh, cy1 + ch) - max(by1, cy1))
                min_area = min(bw * bh, cw * ch)
                if min_area > 0 and (ox * oy / min_area) < 0.1:
                    distinct += 1

            if distinct == 1:
                result['faces_detected'] = 1
                result['valid'] = True
                result['confidence'] = float(max(confidences))
                return result
            else:
                result['faces_detected'] = distinct
                result['error'] = (
                    f'Multiple faces detected ({distinct} faces). '
                    'Please upload a photo with only one person.'
                )
                return result

    except Exception as e:
        logger.error(f"Face detection error for {file_path}: {str(e)}")
        result['error'] = f'Error processing image: {str(e)}'
        return result
