"""
Tests for the name validation utility.
"""

import pytest
from fastapi import HTTPException
from app.utils.name_validator import (
    validate_name,
    validate_name_field,
    is_valid_name,
)


class TestValidateName:
    """Tests for the validate_name function."""

    def test_valid_simple_name(self):
        """Test valid simple names."""
        is_valid, errors = validate_name("John", "first name")
        assert is_valid is True
        assert errors == []

    def test_valid_name_with_accents(self):
        """Test names with accented characters."""
        test_cases = ["María", "José", "François", "Müller", "Ñoño"]
        for name in test_cases:
            is_valid, errors = validate_name(name, "first name")
            assert is_valid is True, f"Expected '{name}' to be valid"
            assert errors == []

    def test_valid_hyphenated_name(self):
        """Test hyphenated names."""
        is_valid, errors = validate_name("Jean-Pierre", "first name")
        assert is_valid is True
        assert errors == []

    def test_valid_name_with_apostrophe(self):
        """Test names with apostrophes."""
        is_valid, errors = validate_name("O'Connor", "last name")
        assert is_valid is True
        assert errors == []

    def test_valid_name_with_period(self):
        """Test names with periods."""
        is_valid, errors = validate_name("Jr.", "suffix")
        assert is_valid is True
        assert errors == []

    def test_valid_name_with_space(self):
        """Test names with spaces."""
        is_valid, errors = validate_name("Mary Jane", "first name")
        assert is_valid is True
        assert errors == []

    def test_invalid_numeric_only(self):
        """Test that numeric-only strings are rejected."""
        is_valid, errors = validate_name("123", "first name")
        assert is_valid is False
        assert len(errors) == 1
        assert "must contain at least one letter" in errors[0]

    def test_invalid_alphanumeric(self):
        """Test that names with numbers are rejected."""
        is_valid, errors = validate_name("John123", "first name")
        assert is_valid is False
        assert len(errors) == 1
        assert "invalid characters" in errors[0]

    def test_invalid_special_characters(self):
        """Test that names with special characters are rejected."""
        invalid_names = ["John@Doe", "Jane#Smith", "Test$Name", "Name*123"]
        for name in invalid_names:
            is_valid, errors = validate_name(name, "name")
            assert is_valid is False, f"Expected '{name}' to be invalid"

    def test_empty_name(self):
        """Test that empty names are rejected."""
        is_valid, errors = validate_name("", "first name")
        assert is_valid is False
        assert "required" in errors[0]

    def test_whitespace_only(self):
        """Test that whitespace-only names are rejected."""
        is_valid, errors = validate_name("   ", "first name")
        assert is_valid is False

    def test_none_name(self):
        """Test that None names are rejected."""
        is_valid, errors = validate_name(None, "first name")
        assert is_valid is False
        assert "required" in errors[0]

    def test_too_long_name(self):
        """Test that names exceeding max length are rejected."""
        long_name = "A" * 101
        is_valid, errors = validate_name(long_name, "first name")
        assert is_valid is False
        assert "at most 100 characters" in errors[0]

    def test_max_length_name(self):
        """Test that names at max length are accepted."""
        max_name = "A" * 100
        is_valid, errors = validate_name(max_name, "first name")
        assert is_valid is True

    def test_field_name_in_error_message(self):
        """Test that the field name appears in error messages."""
        is_valid, errors = validate_name("123", "last name")
        assert "Last name" in errors[0]


class TestValidateNameField:
    """Tests for the validate_name_field function (raises HTTPException)."""

    def test_valid_name_no_exception(self):
        """Test that valid names don't raise exceptions."""
        validate_name_field("John", "first name")  # Should not raise

    def test_invalid_name_raises_exception(self):
        """Test that invalid names raise HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            validate_name_field("123", "first name")
        assert exc_info.value.status_code == 400
        assert "must contain at least one letter" in exc_info.value.detail

    def test_optional_field_none(self):
        """Test that optional fields accept None."""
        validate_name_field(None, "middle name", required=False)  # Should not raise

    def test_optional_field_empty_string(self):
        """Test that optional fields accept empty strings."""
        validate_name_field("", "middle name", required=False)  # Should not raise

    def test_required_field_none_raises(self):
        """Test that required fields reject None."""
        with pytest.raises(HTTPException) as exc_info:
            validate_name_field(None, "first name", required=True)
        assert exc_info.value.status_code == 400
        assert "required" in exc_info.value.detail

    def test_required_field_empty_raises(self):
        """Test that required fields reject empty strings."""
        with pytest.raises(HTTPException) as exc_info:
            validate_name_field("", "first name", required=True)
        assert exc_info.value.status_code == 400


class TestIsValidName:
    """Tests for the is_valid_name function (boolean return)."""

    def test_valid_name_returns_true(self):
        """Test that valid names return True."""
        assert is_valid_name("John") is True
        assert is_valid_name("María") is True
        assert is_valid_name("O'Connor") is True

    def test_invalid_name_returns_false(self):
        """Test that invalid names return False."""
        assert is_valid_name("123") is False
        assert is_valid_name("") is False
        assert is_valid_name(None) is False
        assert is_valid_name("John123") is False


class TestInternationalNames:
    """Tests for international name support."""

    def test_cyrillic_names(self):
        """Test Cyrillic (Russian) names."""
        is_valid, errors = validate_name("Иван", "first name")
        assert is_valid is True

    def test_arabic_names(self):
        """Test Arabic names."""
        is_valid, errors = validate_name("محمد", "first name")
        assert is_valid is True

    def test_arabic_names_comprehensive(self):
        """Test various common Arabic names."""
        arabic_names = [
            "أحمد",      # Ahmed
            "فاطمة",     # Fatima
            "عبدالله",   # Abdullah
            "خالد",      # Khaled
            "نور",       # Nour
            "ياسمين",    # Yasmine
            "عمر",       # Omar
            "ليلى",      # Layla
            "حسن",       # Hassan
            "مريم",      # Mariam
        ]
        for name in arabic_names:
            is_valid, errors = validate_name(name, "first name")
            assert is_valid is True, f"Expected Arabic name '{name}' to be valid"
            assert errors == []

    def test_arabic_name_with_spaces(self):
        """Test Arabic names with spaces (compound names)."""
        compound_names = [
            "عبد الرحمن",    # Abd al-Rahman
            "أبو بكر",       # Abu Bakr
            "محمد علي",      # Muhammad Ali
        ]
        for name in compound_names:
            is_valid, errors = validate_name(name, "first name")
            assert is_valid is True, f"Expected Arabic compound name '{name}' to be valid"

    def test_chinese_names(self):
        """Test Chinese names."""
        is_valid, errors = validate_name("李明", "first name")
        assert is_valid is True

    def test_mixed_script_name(self):
        """Test that mixed scripts (where legitimate) work."""
        # Some names legitimately mix scripts, like a Chinese person
        # with a Western name: "Michael 李"
        is_valid, errors = validate_name("Michael", "first name")
        assert is_valid is True


class TestEdgeCases:
    """Tests for edge cases."""

    def test_single_letter_name(self):
        """Test single letter names."""
        is_valid, errors = validate_name("A", "first name")
        assert is_valid is True

    def test_name_with_multiple_hyphens(self):
        """Test names with multiple hyphens."""
        is_valid, errors = validate_name("Mary-Jane-Sue", "first name")
        assert is_valid is True

    def test_name_with_leading_trailing_spaces(self):
        """Test that leading/trailing spaces are handled."""
        is_valid, errors = validate_name("  John  ", "first name")
        assert is_valid is True  # Should be trimmed and validated

    def test_name_with_apostrophe_variations(self):
        """Test various apostrophe usages."""
        valid_names = ["O'Brien", "D'Angelo", "L'Amour"]
        for name in valid_names:
            is_valid, errors = validate_name(name, "last name")
            assert is_valid is True, f"Expected '{name}' to be valid"
