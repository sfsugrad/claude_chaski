"""
Password validation utility for enhanced security.

This module provides comprehensive password validation including:
- Minimum length requirements (12+ characters)
- Complexity requirements (uppercase, lowercase, digits, special characters)
- Common password detection (protection against known weak passwords)
- Clear, actionable error messages

Security best practices:
- NIST SP 800-63B compliant
- OWASP password guidelines
- Protection against credential stuffing attacks
"""

import re
from typing import List, Tuple


# Common weak passwords to block (top 100 most common passwords)
# In production, consider using a larger list or an external service like HaveIBeenPwned API
COMMON_PASSWORDS = {
    "password", "123456", "123456789", "12345678", "12345", "1234567", "password1",
    "12345678910", "qwerty", "abc123", "111111", "1234567890", "123123", "000000",
    "iloveyou", "1q2w3e4r", "qwertyuiop", "123321", "monkey", "dragon", "654321",
    "666666", "welcome", "123qwe", "letmein", "master", "sunshine", "princess",
    "admin", "password123", "qwerty123", "welcome123", "admin123", "root",
    "changeme", "passw0rd", "p@ssw0rd", "p@ssword", "password!", "password@123",
    "123456a", "qwerty1", "welcome1", "abc123456", "password1234", "1234qwer",
    "12341234", "11111111", "00000000", "87654321", "qazwsx", "zxcvbnm",
    "asdfghjkl", "1q2w3e", "qwertyui", "1qaz2wsx", "password12", "trustno1",
    "login", "solo", "starwars", "whatever", "football", "baseball", "dragon1",
    "superman", "batman", "michael", "shadow", "master1", "jennifer", "jordan",
    "pepper", "charlie", "aa123456", "donald", "bailey", "harley", "passw0rd!",
    "qwerty12", "mustang", "access", "123abc", "ashley", "thunder", "nicole",
    "121212", "123654", "password2", "1234abcd", "computer", "tigger", "blessed",
    "qazwsxedc", "1q2w3e4r5t", "fuckyou", "asshole", "liverpool", "chelsea"
}


# Password validation configuration
MIN_LENGTH = 12
REQUIRE_UPPERCASE = True
REQUIRE_LOWERCASE = True
REQUIRE_DIGIT = True
REQUIRE_SPECIAL = True


def validate_password(password: str) -> Tuple[bool, List[str]]:
    """
    Validate password against security requirements.

    Args:
        password: The password to validate

    Returns:
        Tuple of (is_valid, list_of_error_messages)
        - is_valid: True if password meets all requirements
        - list_of_error_messages: List of specific requirement failures

    Example:
        >>> is_valid, errors = validate_password("weak")
        >>> print(is_valid)
        False
        >>> print(errors)
        ['Password must be at least 12 characters long', ...]
    """
    errors = []

    # Check minimum length
    if len(password) < MIN_LENGTH:
        errors.append(f"Password must be at least {MIN_LENGTH} characters long")

    # Check for uppercase letter
    if REQUIRE_UPPERCASE and not re.search(r'[A-Z]', password):
        errors.append("Password must contain at least one uppercase letter (A-Z)")

    # Check for lowercase letter
    if REQUIRE_LOWERCASE and not re.search(r'[a-z]', password):
        errors.append("Password must contain at least one lowercase letter (a-z)")

    # Check for digit
    if REQUIRE_DIGIT and not re.search(r'\d', password):
        errors.append("Password must contain at least one digit (0-9)")

    # Check for special character
    if REQUIRE_SPECIAL and not re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;`~]', password):
        errors.append("Password must contain at least one special character (!@#$%^&*...)")

    # Check against common passwords (case-insensitive)
    if password.lower() in COMMON_PASSWORDS:
        errors.append("This password is too common and easily guessable. Please choose a more unique password")

    # Check for sequential characters (e.g., "123", "abc")
    if has_sequential_characters(password):
        errors.append("Password should not contain obvious sequential characters (e.g., '123', 'abc')")

    # Check for repeating characters (e.g., "aaa", "111")
    if has_repeating_characters(password):
        errors.append("Password should not contain excessive repeating characters (e.g., 'aaa', '111')")

    is_valid = len(errors) == 0
    return is_valid, errors


def has_sequential_characters(password: str, min_length: int = 4) -> bool:
    """
    Check if password contains sequential characters (e.g., "1234", "abcd").

    Args:
        password: The password to check
        min_length: Minimum length of sequential characters to detect (default: 4)

    Returns:
        True if sequential characters found, False otherwise
    """
    password_lower = password.lower()

    # Check for numeric sequences (e.g., "1234", "4321")
    for i in range(len(password_lower) - min_length + 1):
        substring = password_lower[i:i + min_length]
        if substring.isdigit():
            # Check ascending sequence
            if all(ord(substring[j]) == ord(substring[j-1]) + 1 for j in range(1, len(substring))):
                return True
            # Check descending sequence
            if all(ord(substring[j]) == ord(substring[j-1]) - 1 for j in range(1, len(substring))):
                return True

    # Check for alphabetic sequences (e.g., "abcd", "dcba")
    for i in range(len(password_lower) - min_length + 1):
        substring = password_lower[i:i + min_length]
        if substring.isalpha():
            # Check ascending sequence
            if all(ord(substring[j]) == ord(substring[j-1]) + 1 for j in range(1, len(substring))):
                return True
            # Check descending sequence
            if all(ord(substring[j]) == ord(substring[j-1]) - 1 for j in range(1, len(substring))):
                return True

    # Check for keyboard sequences (qwerty, asdf, etc.)
    keyboard_sequences = [
        "qwertyuiop", "asdfghjkl", "zxcvbnm",
        "1qaz2wsx", "qweasd", "zxcasd"
    ]
    for seq in keyboard_sequences:
        for i in range(len(seq) - min_length + 1):
            pattern = seq[i:i + min_length]
            if pattern in password_lower or pattern[::-1] in password_lower:
                return True

    return False


def has_repeating_characters(password: str, max_repeats: int = 3) -> bool:
    """
    Check if password contains excessive repeating characters.

    Args:
        password: The password to check
        max_repeats: Maximum allowed consecutive repeating characters (default: 3)

    Returns:
        True if excessive repeating characters found, False otherwise

    Example:
        >>> has_repeating_characters("Pass1111word!")  # Returns True (4 repeating 1s)
        >>> has_repeating_characters("Pass111word!")   # Returns False (3 or less)
    """
    for i in range(len(password) - max_repeats):
        if password[i] == password[i + 1] == password[i + 2] == password[i + 3]:
            return True
    return False


def get_password_strength_score(password: str) -> int:
    """
    Calculate password strength score (0-100).

    This is a simple scoring algorithm that can be used for password strength meters.

    Args:
        password: The password to score

    Returns:
        Integer score from 0 to 100
    """
    score = 0

    # Length score (up to 40 points)
    length = len(password)
    if length >= 16:
        score += 40
    elif length >= 12:
        score += 30
    elif length >= 8:
        score += 20
    else:
        score += length * 2

    # Complexity score (up to 40 points)
    has_lower = bool(re.search(r'[a-z]', password))
    has_upper = bool(re.search(r'[A-Z]', password))
    has_digit = bool(re.search(r'\d', password))
    has_special = bool(re.search(r'[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/;`~]', password))

    complexity_count = sum([has_lower, has_upper, has_digit, has_special])
    score += complexity_count * 10

    # Diversity score (up to 20 points)
    unique_chars = len(set(password))
    if unique_chars >= length * 0.8:  # 80%+ unique characters
        score += 20
    elif unique_chars >= length * 0.6:  # 60%+ unique characters
        score += 10

    # Penalties
    if password.lower() in COMMON_PASSWORDS:
        score -= 50
    if has_sequential_characters(password, 3):
        score -= 20
    if has_repeating_characters(password, 2):
        score -= 10

    # Ensure score is between 0 and 100
    return max(0, min(100, score))


def get_password_strength_label(score: int) -> str:
    """
    Get human-readable password strength label.

    Args:
        score: Password strength score (0-100)

    Returns:
        String label: "Very Weak", "Weak", "Fair", "Strong", or "Very Strong"
    """
    if score >= 80:
        return "Very Strong"
    elif score >= 60:
        return "Strong"
    elif score >= 40:
        return "Fair"
    elif score >= 20:
        return "Weak"
    else:
        return "Very Weak"
