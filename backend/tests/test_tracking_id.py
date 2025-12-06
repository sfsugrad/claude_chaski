"""
Tests for tracking_id.py - Tracking ID generation and validation.

Tests the tracking ID format: xxxx-xxxx-xxxx-xxxx (lowercase alphanumeric).
"""
import pytest
import string

from app.utils.tracking_id import generate_tracking_id, is_valid_tracking_id


class TestGenerateTrackingId:
    """Tests for generate_tracking_id function."""

    def test_correct_format(self):
        """Generated ID should match xxxx-xxxx-xxxx-xxxx format."""
        tracking_id = generate_tracking_id()
        parts = tracking_id.split('-')

        assert len(parts) == 4
        for part in parts:
            assert len(part) == 4

    def test_correct_length(self):
        """Generated ID should be exactly 19 characters."""
        tracking_id = generate_tracking_id()
        assert len(tracking_id) == 19

    def test_lowercase_alphanumeric_only(self):
        """Generated ID should only contain lowercase letters and digits."""
        valid_chars = set(string.ascii_lowercase + string.digits)

        # Generate multiple IDs to ensure consistency
        for _ in range(100):
            tracking_id = generate_tracking_id()
            # Remove dashes and check remaining characters
            chars_only = tracking_id.replace('-', '')
            assert all(c in valid_chars for c in chars_only)

    def test_no_uppercase(self):
        """Generated ID should not contain uppercase letters."""
        # Generate multiple IDs to ensure no uppercase
        for _ in range(100):
            tracking_id = generate_tracking_id()
            assert tracking_id == tracking_id.lower()

    def test_uniqueness(self):
        """Multiple calls should produce different IDs."""
        ids = set()
        for _ in range(1000):
            tracking_id = generate_tracking_id()
            ids.add(tracking_id)

        # All 1000 IDs should be unique
        assert len(ids) == 1000

    def test_is_valid_format(self):
        """Generated IDs should pass the validation function."""
        for _ in range(100):
            tracking_id = generate_tracking_id()
            assert is_valid_tracking_id(tracking_id) is True


class TestIsValidTrackingId:
    """Tests for is_valid_tracking_id function."""

    def test_valid_tracking_id(self):
        """Valid tracking IDs should return True."""
        assert is_valid_tracking_id("a1b2-c3d4-e5f6-g7h8") is True
        assert is_valid_tracking_id("0000-0000-0000-0000") is True
        assert is_valid_tracking_id("zzzz-zzzz-zzzz-zzzz") is True
        assert is_valid_tracking_id("abcd-1234-efgh-5678") is True

    def test_invalid_none(self):
        """None should return False."""
        assert is_valid_tracking_id(None) is False

    def test_invalid_empty_string(self):
        """Empty string should return False."""
        assert is_valid_tracking_id("") is False

    def test_invalid_wrong_length(self):
        """IDs with wrong length should return False."""
        assert is_valid_tracking_id("a1b2-c3d4-e5f6-g7h") is False  # Too short
        assert is_valid_tracking_id("a1b2-c3d4-e5f6-g7h89") is False  # Too long
        assert is_valid_tracking_id("a1b2c3d4e5f6g7h8") is False  # No dashes

    def test_invalid_wrong_segment_count(self):
        """IDs with wrong number of segments should return False."""
        assert is_valid_tracking_id("a1b2-c3d4-e5f6") is False  # Only 3 segments
        assert is_valid_tracking_id("a1b2-c3d4-e5f6-g7h8-i9j0") is False  # 5 segments

    def test_invalid_wrong_segment_length(self):
        """IDs with wrong segment lengths should return False."""
        assert is_valid_tracking_id("a1b-c3d4-e5f6-g7h8") is False  # First segment too short
        assert is_valid_tracking_id("a1b2c-c3d4-e5f6-g7h8") is False  # First segment too long
        assert is_valid_tracking_id("a1b2-c3d-e5f6-g7h8") is False  # Second segment too short

    def test_invalid_uppercase(self):
        """IDs with uppercase letters should return False."""
        assert is_valid_tracking_id("A1b2-c3d4-e5f6-g7h8") is False
        assert is_valid_tracking_id("a1b2-C3D4-e5f6-g7h8") is False
        assert is_valid_tracking_id("ABCD-1234-EFGH-5678") is False

    def test_invalid_special_characters(self):
        """IDs with special characters should return False."""
        assert is_valid_tracking_id("a1b!-c3d4-e5f6-g7h8") is False
        assert is_valid_tracking_id("a1b2-c3d@-e5f6-g7h8") is False
        assert is_valid_tracking_id("a1b2_c3d4_e5f6_g7h8") is False  # Underscores instead of dashes

    def test_invalid_spaces(self):
        """IDs with spaces should return False."""
        assert is_valid_tracking_id("a1b2 c3d4 e5f6 g7h8") is False
        assert is_valid_tracking_id(" a1b2-c3d4-e5f6-g7h8") is False
        assert is_valid_tracking_id("a1b2-c3d4-e5f6-g7h8 ") is False

    def test_valid_all_digits(self):
        """IDs with all digits should be valid."""
        assert is_valid_tracking_id("1234-5678-9012-3456") is True

    def test_valid_all_letters(self):
        """IDs with all lowercase letters should be valid."""
        assert is_valid_tracking_id("abcd-efgh-ijkl-mnop") is True
