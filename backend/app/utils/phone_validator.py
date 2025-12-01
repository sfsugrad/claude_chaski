"""
Phone number validation utility for US phone numbers.

Enforces E.164 format for US numbers: +1XXXXXXXXXX
"""
import re
from fastapi import HTTPException, status


# US phone number pattern in E.164 format: +1 followed by 10 digits
US_PHONE_PATTERN = re.compile(r'^\+1[2-9]\d{9}$')


def validate_us_phone_number(phone_number: str | None) -> str | None:
    """
    Validate that a phone number is a valid US phone number in E.164 format.

    Args:
        phone_number: Phone number to validate (can be None)

    Returns:
        The validated phone number or None if input was None

    Raises:
        HTTPException: If phone number is not a valid US number

    Examples:
        Valid: +12125551234, +14155551234
        Invalid: +442071234567 (UK), 2125551234 (missing +1), +1125551234 (invalid area code)
    """
    if phone_number is None:
        return None

    # Remove any whitespace
    phone_number = phone_number.strip()

    if not phone_number:
        return None

    # Check if it matches US E.164 format
    if not US_PHONE_PATTERN.match(phone_number):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid phone number. Must be a valid US phone number in format +1XXXXXXXXXX (e.g., +12125551234)"
        )

    return phone_number


def is_valid_us_phone(phone_number: str | None) -> bool:
    """
    Check if a phone number is a valid US phone number without raising an exception.

    Args:
        phone_number: Phone number to check

    Returns:
        True if valid US phone number, False otherwise
    """
    if not phone_number:
        return False

    phone_number = phone_number.strip()
    return bool(US_PHONE_PATTERN.match(phone_number))
