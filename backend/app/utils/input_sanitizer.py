"""
Input sanitization utility using bleach for XSS protection.

This module provides HTML sanitization to prevent Cross-Site Scripting (XSS) attacks.
All user-provided text that might be displayed in the frontend should be sanitized.

Security approach:
- Strip all HTML tags by default (plain text only)
- For rich text fields, allow only safe tags with strict attributes
- Remove JavaScript, event handlers, and dangerous protocols
- Normalize whitespace and strip control characters
"""

import bleach
from typing import Optional
import re


# Allowed HTML tags for rich text (very restrictive)
# Only formatting tags, no scripts, forms, or interactive elements
ALLOWED_TAGS_RICH = [
    'p', 'br', 'strong', 'em', 'u', 's', 'b', 'i',
    'ul', 'ol', 'li',
    'blockquote',
    'code', 'pre',
]

# Allowed attributes for rich text
ALLOWED_ATTRIBUTES_RICH = {
    # No attributes allowed for maximum security
    # Even 'class' and 'id' can be attack vectors
}

# Allowed protocols for links (none for now - no links allowed)
ALLOWED_PROTOCOLS = []


def sanitize_text(text: Optional[str], allow_html: bool = False) -> str:
    """
    Sanitize user-provided text to prevent XSS attacks.

    By default, strips ALL HTML and returns plain text.

    Args:
        text: Input text from user
        allow_html: If True, allows safe HTML tags (very restrictive)

    Returns:
        Sanitized text safe for display

    Example:
        >>> sanitize_text("<script>alert('xss')</script>Hello")
        "Hello"
        >>> sanitize_text("<strong>Bold</strong>", allow_html=True)
        "<strong>Bold</strong>"
        >>> sanitize_text("<div onclick='alert()'>Text</div>", allow_html=True)
        "Text"
    """
    if text is None:
        return ""

    # Convert to string if not already
    text = str(text)

    # Normalize whitespace
    text = normalize_whitespace(text)

    if allow_html:
        # Allow only safe HTML tags with strict attribute filtering
        cleaned = bleach.clean(
            text,
            tags=ALLOWED_TAGS_RICH,
            attributes=ALLOWED_ATTRIBUTES_RICH,
            protocols=ALLOWED_PROTOCOLS,
            strip=True  # Strip disallowed tags instead of escaping
        )
    else:
        # Strip ALL HTML tags - return plain text only
        cleaned = bleach.clean(
            text,
            tags=[],  # No tags allowed
            attributes={},
            strip=True
        )

    # Additional security: remove any remaining control characters
    cleaned = remove_control_characters(cleaned)

    return cleaned.strip()


def sanitize_plain_text(text: Optional[str]) -> str:
    """
    Sanitize text as plain text only (no HTML allowed).

    This is the most secure option and should be used for:
    - Names, addresses, phone numbers
    - Notes, comments, descriptions
    - Any text that doesn't need formatting

    Args:
        text: Input text from user

    Returns:
        Plain text with all HTML stripped

    Example:
        >>> sanitize_plain_text("<b>Name</b>")
        "Name"
    """
    return sanitize_text(text, allow_html=False)


def sanitize_rich_text(text: Optional[str]) -> str:
    """
    Sanitize rich text with very limited HTML allowed.

    Only use this for fields where basic formatting is needed.
    Allowed tags: p, br, strong, em, u, s, b, i, ul, ol, li, blockquote, code, pre

    Args:
        text: Input text from user

    Returns:
        Sanitized HTML with only safe tags

    Example:
        >>> sanitize_rich_text("<strong>Bold</strong> <script>alert()</script>")
        "<strong>Bold</strong> "
    """
    return sanitize_text(text, allow_html=True)


def normalize_whitespace(text: str) -> str:
    """
    Normalize whitespace in text.

    - Replaces multiple spaces with single space
    - Replaces tabs with spaces
    - Preserves intentional line breaks

    Args:
        text: Input text

    Returns:
        Text with normalized whitespace
    """
    # Replace tabs with spaces
    text = text.replace('\t', ' ')

    # Replace multiple spaces with single space (but preserve newlines)
    lines = text.split('\n')
    lines = [re.sub(r' +', ' ', line) for line in lines]
    text = '\n'.join(lines)

    # Remove excessive blank lines (more than 2 consecutive)
    text = re.sub(r'\n{3,}', '\n\n', text)

    return text


def remove_control_characters(text: str) -> str:
    """
    Remove control characters that could be used in attacks.

    Keeps only printable characters, spaces, tabs, and newlines.

    Args:
        text: Input text

    Returns:
        Text with control characters removed
    """
    # Allow: printable chars, space, tab, newline, carriage return
    # Remove: all other control characters
    return ''.join(
        char for char in text
        if char.isprintable() or char in [' ', '\t', '\n', '\r']
    )


def sanitize_email(email: Optional[str]) -> str:
    """
    Sanitize email address.

    Converts to lowercase and removes whitespace.
    Does NOT validate email format - use Pydantic for that.

    Args:
        email: Email address

    Returns:
        Sanitized email
    """
    if not email:
        return ""

    email = str(email).strip().lower()
    # Remove any HTML that might have snuck in
    email = bleach.clean(email, tags=[], strip=True)
    return email


def sanitize_phone(phone: Optional[str]) -> str:
    """
    Sanitize phone number.

    Removes all non-digit characters except + and spaces.
    Does NOT validate phone format.

    Args:
        phone: Phone number

    Returns:
        Sanitized phone number
    """
    if not phone:
        return ""

    phone = str(phone).strip()
    # Remove any HTML
    phone = bleach.clean(phone, tags=[], strip=True)
    # Keep only digits, +, spaces, dashes, and parentheses
    phone = re.sub(r'[^0-9+\s\-\(\)]', '', phone)
    return phone


def truncate_text(text: str, max_length: int, suffix: str = "...") -> str:
    """
    Truncate text to maximum length.

    Args:
        text: Input text
        max_length: Maximum length
        suffix: Suffix to add if truncated (default: "...")

    Returns:
        Truncated text
    """
    if len(text) <= max_length:
        return text

    return text[:max_length - len(suffix)] + suffix


class InputSanitizer:
    """
    Helper class for batch sanitization operations.

    Example:
        >>> sanitizer = InputSanitizer()
        >>> data = {"name": "<script>", "note": "<b>text</b>"}
        >>> sanitized = sanitizer.sanitize_dict(data, {
        ...     "name": "plain",
        ...     "note": "rich"
        ... })
    """

    @staticmethod
    def sanitize_dict(data: dict, field_types: dict) -> dict:
        """
        Sanitize multiple fields in a dictionary.

        Args:
            data: Dictionary with user input
            field_types: Dict mapping field names to types ("plain" or "rich")

        Returns:
            Dictionary with sanitized values
        """
        result = data.copy()

        for field, field_type in field_types.items():
            if field in result and result[field] is not None:
                if field_type == "plain":
                    result[field] = sanitize_plain_text(result[field])
                elif field_type == "rich":
                    result[field] = sanitize_rich_text(result[field])

        return result
