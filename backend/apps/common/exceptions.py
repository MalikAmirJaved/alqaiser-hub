# backend/apps/common/exceptions.py
"""
Custom DRF exception handler.

Wraps all APIException responses (including ValidationError from
serializer.is_valid(raise_exception=True)) to ensure a top-level
`detail` key is always present. The frontend apiFetch helper looks
for detail / message / error to display toast notifications.

Without this handler, DRF returns field-level errors like
  {"field_name": ["Error message"]}
which lack a top-level detail/message/error key, causing the frontend
to fall back to "Request failed with status {status}".
"""

from rest_framework.views import exception_handler


def custom_exception_handler(exc, context):
    """
    Custom DRF exception handler that guarantees a `detail` key
    in every error response.
    """
    response = exception_handler(exc, context)

    if response is not None:
        errors = response.data

        # If the response already has a top-level key the frontend
        # understands (detail, message, or error), leave it as-is.
        if isinstance(errors, dict) and any(
            k in errors for k in ("detail", "message", "error")
        ):
            return response

        # Otherwise, extract a meaningful detail message and wrap
        # the original errors under an `errors` key.
        detail = _extract_detail(errors)

        response.data = {
            "detail": detail,
            "errors": errors,
        }

    return response


def _extract_detail(errors):
    """Extract a single human-readable error message from DRF errors."""
    if errors is None:
        return "An unknown error occurred"

    if isinstance(errors, str):
        return errors

    if isinstance(errors, list):
        # Could be a list of strings or a list of nested dicts
        parts = []
        for e in errors:
            if isinstance(e, str):
                parts.append(e)
            elif isinstance(e, dict):
                parts.append(_extract_detail(e))
            elif isinstance(e, list):
                sub = _extract_detail(e)
                if sub:
                    parts.append(sub)
        return "; ".join(parts) if parts else "Validation error"

    if isinstance(errors, dict):
        # DRF often nests errors: {"field": ["msg"], "non_field_errors": ["msg"]}
        if "non_field_errors" in errors:
            msgs = errors["non_field_errors"]
            return _extract_detail(msgs)

        if "detail" in errors:
            return _extract_detail(errors["detail"])

        if "message" in errors:
            return _extract_detail(errors["message"])

        if "error" in errors:
            return _extract_detail(errors["error"])

        # Take the first field error
        for field, msgs in errors.items():
            extracted = _extract_detail(msgs)
            if extracted:
                return extracted

    return "Validation error"
