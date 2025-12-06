"""
Tests for phone_validator.py - US phone number validation.

Tests the E.164 format validation for US phone numbers (+1XXXXXXXXXX).
"""
import pytest
from fastapi import HTTPException

from app.utils.phone_validator import validate_us_phone_number, is_valid_us_phone


class TestValidateUsPhoneNumber:
    """Tests for validate_us_phone_number function."""

    def test_valid_us_phone_number(self):
        """Valid US phone numbers should pass validation."""
        # Standard US numbers with valid area codes
        assert validate_us_phone_number("+12125551234") == "+12125551234"
        assert validate_us_phone_number("+14155551234") == "+14155551234"
        assert validate_us_phone_number("+13105551234") == "+13105551234"
        assert validate_us_phone_number("+19175551234") == "+19175551234"

    def test_valid_phone_with_whitespace(self):
        """Phone numbers with leading/trailing whitespace should be trimmed."""
        assert validate_us_phone_number("  +12125551234  ") == "+12125551234"
        assert validate_us_phone_number("\t+14155551234\n") == "+14155551234"

    def test_none_returns_none(self):
        """None input should return None."""
        assert validate_us_phone_number(None) is None

    def test_empty_string_returns_none(self):
        """Empty string should return None."""
        assert validate_us_phone_number("") is None

    def test_whitespace_only_returns_none(self):
        """Whitespace-only string should return None."""
        assert validate_us_phone_number("   ") is None
        assert validate_us_phone_number("\t\n") is None

    def test_invalid_uk_phone_number(self):
        """UK phone numbers should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+442071234567")
        assert exc_info.value.status_code == 400
        assert "Invalid phone number" in exc_info.value.detail

    def test_invalid_missing_plus_one(self):
        """Phone numbers without +1 prefix should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("2125551234")
        assert exc_info.value.status_code == 400

    def test_invalid_area_code_starts_with_zero(self):
        """Area codes starting with 0 are invalid."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+10125551234")
        assert exc_info.value.status_code == 400

    def test_invalid_area_code_starts_with_one(self):
        """Area codes starting with 1 are invalid."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+11125551234")
        assert exc_info.value.status_code == 400

    def test_invalid_too_short(self):
        """Phone numbers that are too short should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+1212555123")  # Only 9 digits after +1
        assert exc_info.value.status_code == 400

    def test_invalid_too_long(self):
        """Phone numbers that are too long should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+121255512345")  # 11 digits after +1
        assert exc_info.value.status_code == 400

    def test_invalid_with_letters(self):
        """Phone numbers with letters should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+1212555ABCD")
        assert exc_info.value.status_code == 400

    def test_invalid_with_special_characters(self):
        """Phone numbers with special characters should be rejected."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+1-212-555-1234")  # Dashes not allowed
        assert exc_info.value.status_code == 400

        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("+1 (212) 555-1234")  # Formatted not allowed
        assert exc_info.value.status_code == 400

    def test_invalid_canadian_number(self):
        """Canadian numbers (+1 but different area code patterns) should work if valid format."""
        # Canadian area codes starting with 2-9 are valid in E.164 format
        # This tests that we accept valid +1 numbers regardless of US vs Canada
        assert validate_us_phone_number("+14165551234") == "+14165551234"  # Toronto

    def test_error_message_includes_format_hint(self):
        """Error message should include format hint."""
        with pytest.raises(HTTPException) as exc_info:
            validate_us_phone_number("invalid")
        assert "+1XXXXXXXXXX" in exc_info.value.detail
        assert "+12125551234" in exc_info.value.detail


class TestIsValidUsPhone:
    """Tests for is_valid_us_phone function (non-throwing version)."""

    def test_valid_us_phone_returns_true(self):
        """Valid US phone numbers should return True."""
        assert is_valid_us_phone("+12125551234") is True
        assert is_valid_us_phone("+14155551234") is True
        assert is_valid_us_phone("+13105551234") is True

    def test_invalid_phone_returns_false(self):
        """Invalid phone numbers should return False without raising."""
        assert is_valid_us_phone("+442071234567") is False  # UK number
        assert is_valid_us_phone("2125551234") is False  # Missing +1
        assert is_valid_us_phone("+10125551234") is False  # Invalid area code
        assert is_valid_us_phone("+11125551234") is False  # Invalid area code
        assert is_valid_us_phone("invalid") is False

    def test_none_returns_false(self):
        """None input should return False."""
        assert is_valid_us_phone(None) is False

    def test_empty_string_returns_false(self):
        """Empty string should return False."""
        assert is_valid_us_phone("") is False

    def test_whitespace_handling(self):
        """Whitespace should be stripped before validation."""
        assert is_valid_us_phone("  +12125551234  ") is True
        assert is_valid_us_phone("   ") is False
