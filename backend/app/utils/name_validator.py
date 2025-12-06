"""
Name validation utility for user names (first, middle, last).

This module provides validation for human names to ensure they contain
actual alphabetic characters and not just numbers or special characters.

Validation rules:
- Must contain at least one letter (any Unicode letter)
- May contain letters, spaces, hyphens, apostrophes, and periods
- Common name characters like accented letters are allowed
- Numbers are not allowed as the sole content
- Minimum 1 character, maximum 100 characters
"""

import re
from typing import Tuple, List, Optional
from fastapi import HTTPException, status


# Regex pattern for valid name characters
# Allows letters (including accented), spaces, hyphens, apostrophes, periods
# Covers: Latin, Latin Extended, Cyrillic, Arabic, CJK
# Examples: "María", "O'Connor", "Jean-Pierre", "Jr.", "José María", "李明", "محمد"
VALID_NAME_CHARS = re.compile(r"^[a-zA-ZÀ-ÿĀ-žА-яЁё\u0600-\u06FF\u4e00-\u9fff\s\-'.]+$")

# Pattern to check if name contains at least one letter
HAS_LETTER = re.compile(r"[a-zA-ZÀ-ÿĀ-žА-яЁё\u0600-\u06FF\u4e00-\u9fff]")

# Maximum name length
MAX_NAME_LENGTH = 100

# Minimum name length
MIN_NAME_LENGTH = 1


def validate_name(name: str, field_name: str = "name") -> Tuple[bool, List[str]]:
    """
    Validate a name field.

    Args:
        name: The name string to validate
        field_name: The field name for error messages (e.g., "first name", "last name")

    Returns:
        Tuple of (is_valid, list_of_error_messages)

    Example:
        >>> validate_name("John", "first name")
        (True, [])
        >>> validate_name("123", "first name")
        (False, ["First name must contain at least one letter"])
        >>> validate_name("John123", "first name")
        (False, ["First name contains invalid characters"])
    """
    errors = []

    if not name:
        errors.append(f"{field_name.capitalize()} is required")
        return False, errors

    # Strip whitespace for validation
    name = name.strip()

    # Check length
    if len(name) < MIN_NAME_LENGTH:
        errors.append(f"{field_name.capitalize()} must be at least {MIN_NAME_LENGTH} character")
        return False, errors

    if len(name) > MAX_NAME_LENGTH:
        errors.append(f"{field_name.capitalize()} must be at most {MAX_NAME_LENGTH} characters")
        return False, errors

    # Check if contains at least one letter
    if not HAS_LETTER.search(name):
        errors.append(f"{field_name.capitalize()} must contain at least one letter")
        return False, errors

    # Check for invalid characters (numbers, special chars except allowed ones)
    if not VALID_NAME_CHARS.match(name):
        errors.append(f"{field_name.capitalize()} contains invalid characters. Only letters, spaces, hyphens, apostrophes, and periods are allowed")
        return False, errors

    return True, []


def validate_name_field(name: Optional[str], field_name: str = "name", required: bool = True) -> None:
    """
    Validate a name field and raise HTTPException if invalid.

    This is the preferred function to use in FastAPI route handlers.

    Args:
        name: The name string to validate
        field_name: The field name for error messages
        required: Whether the field is required (default True)

    Raises:
        HTTPException: 400 Bad Request if validation fails

    Example:
        >>> validate_name_field("John", "first name")  # OK
        >>> validate_name_field("123", "first name")   # Raises HTTPException
        >>> validate_name_field(None, "middle name", required=False)  # OK
    """
    # Handle optional fields
    if name is None or (isinstance(name, str) and not name.strip()):
        if required:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"{field_name.capitalize()} is required"
            )
        return  # Optional field, not provided - OK

    is_valid, errors = validate_name(name, field_name)

    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=errors[0] if len(errors) == 1 else {"message": f"Invalid {field_name}", "errors": errors}
        )


def is_valid_name(name: Optional[str]) -> bool:
    """
    Check if a name is valid without raising exceptions.

    Useful for conditional logic or pre-validation checks.

    Args:
        name: The name string to check

    Returns:
        True if valid, False otherwise

    Example:
        >>> is_valid_name("María")
        True
        >>> is_valid_name("123")
        False
    """
    if not name:
        return False

    is_valid, _ = validate_name(name)
    return is_valid
