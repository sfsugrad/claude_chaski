"""
File validation utility using magic number detection.

This module provides secure file type validation by checking file signatures (magic numbers)
instead of relying on file extensions or MIME types provided by clients.

Security benefits:
- Prevents users from uploading malicious files by changing extensions
- Validates actual file content, not metadata
- Protects against file type confusion attacks
"""

import filetype
from typing import Tuple, List, Optional
from io import BytesIO


# Allowed MIME types for delivery proof uploads
ALLOWED_IMAGE_TYPES = {
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "image/heic",
    "image/heif"
}

# Maximum file size (10MB)
MAX_FILE_SIZE = 10 * 1024 * 1024


class FileValidationError(Exception):
    """Exception raised when file validation fails."""
    pass


def validate_file_type(file_data: bytes, allowed_types: Optional[set] = None) -> Tuple[bool, str]:
    """
    Validate file type by checking magic number (file signature).

    Args:
        file_data: File bytes to validate
        allowed_types: Set of allowed MIME types (defaults to ALLOWED_IMAGE_TYPES)

    Returns:
        Tuple of (is_valid, detected_mime_type or error_message)

    Raises:
        FileValidationError: If file is invalid or not allowed

    Example:
        >>> with open("photo.jpg", "rb") as f:
        >>>     is_valid, mime_type = validate_file_type(f.read())
        >>>     if not is_valid:
        >>>         raise HTTPException(400, detail=mime_type)
    """
    if allowed_types is None:
        allowed_types = ALLOWED_IMAGE_TYPES

    # Check file size
    if len(file_data) == 0:
        raise FileValidationError("File is empty")

    if len(file_data) > MAX_FILE_SIZE:
        raise FileValidationError(
            f"File size ({len(file_data)} bytes) exceeds maximum allowed size ({MAX_FILE_SIZE} bytes)"
        )

    # Detect file type by magic number
    kind = filetype.guess(file_data)

    if kind is None:
        raise FileValidationError(
            "Unable to determine file type. File may be corrupted or unsupported."
        )

    # Check if detected MIME type is allowed
    if kind.mime not in allowed_types:
        raise FileValidationError(
            f"File type '{kind.mime}' is not allowed. "
            f"Allowed types: {', '.join(sorted(allowed_types))}"
        )

    return True, kind.mime


def validate_image_file(file_data: bytes) -> str:
    """
    Validate that file is an allowed image type.

    Args:
        file_data: File bytes to validate

    Returns:
        Detected MIME type (e.g., "image/jpeg")

    Raises:
        FileValidationError: If file is not a valid image

    Example:
        >>> mime_type = validate_image_file(image_bytes)
        >>> print(f"Valid image: {mime_type}")
    """
    is_valid, mime_type = validate_file_type(file_data, ALLOWED_IMAGE_TYPES)
    return mime_type


def get_file_extension_from_mime(mime_type: str) -> str:
    """
    Get file extension from MIME type.

    Args:
        mime_type: MIME type (e.g., "image/jpeg")

    Returns:
        File extension with dot (e.g., ".jpg")

    Example:
        >>> ext = get_file_extension_from_mime("image/jpeg")
        >>> print(ext)  # ".jpg"
    """
    mime_to_ext = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "image/heic": ".heic",
        "image/heif": ".heif"
    }
    return mime_to_ext.get(mime_type, ".bin")


def is_safe_image(file_data: bytes) -> bool:
    """
    Quick check if file is a safe image type.

    Args:
        file_data: File bytes to check

    Returns:
        True if file is a safe image, False otherwise

    Example:
        >>> with open("upload.bin", "rb") as f:
        >>>     if not is_safe_image(f.read()):
        >>>         raise HTTPException(400, "Invalid image file")
    """
    try:
        validate_image_file(file_data)
        return True
    except FileValidationError:
        return False


def get_detailed_file_info(file_data: bytes) -> dict:
    """
    Get detailed information about a file.

    Args:
        file_data: File bytes to analyze

    Returns:
        Dictionary with file information

    Example:
        >>> info = get_detailed_file_info(file_bytes)
        >>> print(info)
        {
            'size': 12345,
            'mime_type': 'image/jpeg',
            'extension': '.jpg',
            'is_valid': True,
            'is_image': True
        }
    """
    size = len(file_data)
    kind = filetype.guess(file_data)

    if kind is None:
        return {
            'size': size,
            'mime_type': None,
            'extension': None,
            'is_valid': False,
            'is_image': False
        }

    is_image = kind.mime in ALLOWED_IMAGE_TYPES

    return {
        'size': size,
        'mime_type': kind.mime,
        'extension': get_file_extension_from_mime(kind.mime),
        'is_valid': is_image,
        'is_image': is_image
    }
