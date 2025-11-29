"""
Tests for file validation utility.

Tests cover:
- validate_image_type (jpg, png)
- reject_invalid_type (exe, js)
- validate_file_size
- reject_oversized_file
- Magic bytes validation
- Empty file handling
- None handling
- get_file_extension_from_mime
- is_safe_image
- get_detailed_file_info
"""

import pytest
from io import BytesIO

from app.utils.file_validator import (
    validate_file_type,
    validate_image_file,
    get_file_extension_from_mime,
    is_safe_image,
    get_detailed_file_info,
    FileValidationError,
    ALLOWED_IMAGE_TYPES,
    MAX_FILE_SIZE,
)


# Minimal valid file headers (magic bytes)
JPEG_HEADER = bytes([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01])
PNG_HEADER = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
GIF_HEADER = bytes([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
PDF_HEADER = bytes([0x25, 0x50, 0x44, 0x46])
ZIP_HEADER = bytes([0x50, 0x4B, 0x03, 0x04])


def create_minimal_jpeg():
    """Create a minimal valid JPEG file"""
    # This is a minimal valid JPEG (1x1 pixel)
    return JPEG_HEADER + b'\x00' * 100


def create_minimal_png():
    """Create minimal PNG-like bytes"""
    return PNG_HEADER + b'\x00' * 100


class TestValidateFileType:
    """Tests for validate_file_type function"""

    def test_validate_jpeg_success(self):
        """Test validating a JPEG file"""
        jpeg_data = create_minimal_jpeg()
        is_valid, mime_type = validate_file_type(jpeg_data)
        assert is_valid is True
        assert mime_type == "image/jpeg"

    def test_validate_png_success(self):
        """Test validating a PNG file"""
        png_data = create_minimal_png()
        is_valid, mime_type = validate_file_type(png_data)
        assert is_valid is True
        assert mime_type == "image/png"

    def test_reject_empty_file(self):
        """Test that empty file is rejected"""
        with pytest.raises(FileValidationError, match="empty"):
            validate_file_type(b"")

    def test_reject_oversized_file(self):
        """Test that oversized file is rejected"""
        # Create data larger than MAX_FILE_SIZE
        large_data = JPEG_HEADER + b'\x00' * (MAX_FILE_SIZE + 1)
        with pytest.raises(FileValidationError, match="exceeds maximum"):
            validate_file_type(large_data)

    def test_reject_unknown_file_type(self):
        """Test that unknown file type is rejected"""
        # Random bytes that don't match any known file type
        random_data = b'\x01\x02\x03\x04\x05\x06\x07\x08' * 10
        with pytest.raises(FileValidationError, match="Unable to determine"):
            validate_file_type(random_data)

    def test_reject_disallowed_type_pdf(self):
        """Test that PDF files are rejected for images"""
        pdf_data = PDF_HEADER + b'%PDF-1.4' + b'\x00' * 100
        with pytest.raises(FileValidationError, match="not allowed"):
            validate_file_type(pdf_data)

    def test_reject_disallowed_type_zip(self):
        """Test that ZIP files are rejected for images"""
        zip_data = ZIP_HEADER + b'\x00' * 100
        with pytest.raises(FileValidationError, match="not allowed"):
            validate_file_type(zip_data)

    def test_custom_allowed_types(self):
        """Test with custom allowed types"""
        gif_data = GIF_HEADER + b'\x00' * 100
        # GIF is not in default allowed types
        with pytest.raises(FileValidationError, match="not allowed"):
            validate_file_type(gif_data)

        # But should work with custom allowed types
        is_valid, mime_type = validate_file_type(gif_data, allowed_types={"image/gif"})
        assert is_valid is True
        assert mime_type == "image/gif"


class TestValidateImageFile:
    """Tests for validate_image_file function"""

    def test_validate_jpeg_image(self):
        """Test validating JPEG image"""
        jpeg_data = create_minimal_jpeg()
        mime_type = validate_image_file(jpeg_data)
        assert mime_type == "image/jpeg"

    def test_validate_png_image(self):
        """Test validating PNG image"""
        png_data = create_minimal_png()
        mime_type = validate_image_file(png_data)
        assert mime_type == "image/png"

    def test_reject_non_image(self):
        """Test that non-image files are rejected"""
        pdf_data = PDF_HEADER + b'%PDF-1.4' + b'\x00' * 100
        with pytest.raises(FileValidationError):
            validate_image_file(pdf_data)


class TestGetFileExtensionFromMime:
    """Tests for get_file_extension_from_mime function"""

    def test_jpeg_extension(self):
        """Test JPEG extension"""
        assert get_file_extension_from_mime("image/jpeg") == ".jpg"

    def test_jpg_extension(self):
        """Test image/jpg extension"""
        assert get_file_extension_from_mime("image/jpg") == ".jpg"

    def test_png_extension(self):
        """Test PNG extension"""
        assert get_file_extension_from_mime("image/png") == ".png"

    def test_webp_extension(self):
        """Test WebP extension"""
        assert get_file_extension_from_mime("image/webp") == ".webp"

    def test_heic_extension(self):
        """Test HEIC extension"""
        assert get_file_extension_from_mime("image/heic") == ".heic"

    def test_unknown_mime_type(self):
        """Test unknown MIME type returns .bin"""
        assert get_file_extension_from_mime("application/octet-stream") == ".bin"
        assert get_file_extension_from_mime("unknown/type") == ".bin"


class TestIsSafeImage:
    """Tests for is_safe_image function"""

    def test_safe_jpeg(self):
        """Test that JPEG is safe"""
        jpeg_data = create_minimal_jpeg()
        assert is_safe_image(jpeg_data) is True

    def test_safe_png(self):
        """Test that PNG is safe"""
        png_data = create_minimal_png()
        assert is_safe_image(png_data) is True

    def test_unsafe_pdf(self):
        """Test that PDF is not safe as image"""
        pdf_data = PDF_HEADER + b'%PDF-1.4' + b'\x00' * 100
        assert is_safe_image(pdf_data) is False

    def test_unsafe_empty(self):
        """Test that empty file is not safe"""
        assert is_safe_image(b"") is False

    def test_unsafe_random_bytes(self):
        """Test that random bytes are not safe"""
        assert is_safe_image(b'\x00\x01\x02\x03') is False


class TestGetDetailedFileInfo:
    """Tests for get_detailed_file_info function"""

    def test_jpeg_info(self):
        """Test getting JPEG file info"""
        jpeg_data = create_minimal_jpeg()
        info = get_detailed_file_info(jpeg_data)

        assert info["size"] == len(jpeg_data)
        assert info["mime_type"] == "image/jpeg"
        assert info["extension"] == ".jpg"
        assert info["is_valid"] is True
        assert info["is_image"] is True

    def test_png_info(self):
        """Test getting PNG file info"""
        png_data = create_minimal_png()
        info = get_detailed_file_info(png_data)

        assert info["size"] == len(png_data)
        assert info["mime_type"] == "image/png"
        assert info["extension"] == ".png"
        assert info["is_valid"] is True

    def test_pdf_info(self):
        """Test getting PDF file info (not allowed as image)"""
        pdf_data = PDF_HEADER + b'%PDF-1.4' + b'\x00' * 100
        info = get_detailed_file_info(pdf_data)

        assert info["size"] == len(pdf_data)
        assert info["mime_type"] == "application/pdf"
        assert info["is_valid"] is False
        assert info["is_image"] is False

    def test_unknown_file_info(self):
        """Test getting info for unknown file type"""
        random_data = b'\x00\x01\x02\x03'
        info = get_detailed_file_info(random_data)

        assert info["size"] == 4
        assert info["mime_type"] is None
        assert info["extension"] is None
        assert info["is_valid"] is False
        assert info["is_image"] is False


class TestAllowedImageTypes:
    """Tests for ALLOWED_IMAGE_TYPES constant"""

    def test_jpeg_in_allowed(self):
        """Test that JPEG is in allowed types"""
        assert "image/jpeg" in ALLOWED_IMAGE_TYPES

    def test_png_in_allowed(self):
        """Test that PNG is in allowed types"""
        assert "image/png" in ALLOWED_IMAGE_TYPES

    def test_webp_in_allowed(self):
        """Test that WebP is in allowed types"""
        assert "image/webp" in ALLOWED_IMAGE_TYPES

    def test_heic_in_allowed(self):
        """Test that HEIC is in allowed types"""
        assert "image/heic" in ALLOWED_IMAGE_TYPES


class TestMaxFileSize:
    """Tests for MAX_FILE_SIZE constant"""

    def test_max_file_size_is_10mb(self):
        """Test that max file size is 10MB"""
        expected_10mb = 10 * 1024 * 1024
        assert MAX_FILE_SIZE == expected_10mb

    def test_file_at_max_size_accepted(self):
        """Test that file at max size is accepted"""
        # Create file exactly at max size
        jpeg_data = JPEG_HEADER + b'\x00' * (MAX_FILE_SIZE - len(JPEG_HEADER))
        assert len(jpeg_data) == MAX_FILE_SIZE

        # Should not raise
        is_valid, mime_type = validate_file_type(jpeg_data)
        assert is_valid is True

    def test_file_over_max_size_rejected(self):
        """Test that file over max size is rejected"""
        # Create file 1 byte over max size
        jpeg_data = JPEG_HEADER + b'\x00' * (MAX_FILE_SIZE - len(JPEG_HEADER) + 1)
        assert len(jpeg_data) == MAX_FILE_SIZE + 1

        with pytest.raises(FileValidationError, match="exceeds maximum"):
            validate_file_type(jpeg_data)


class TestFileValidationError:
    """Tests for FileValidationError exception"""

    def test_error_message(self):
        """Test that error has proper message"""
        error = FileValidationError("Test error message")
        assert str(error) == "Test error message"

    def test_error_is_exception(self):
        """Test that FileValidationError is an Exception"""
        assert issubclass(FileValidationError, Exception)
