"""
CSRF (Cross-Site Request Forgery) Protection Utilities

Implements the double-submit cookie pattern for CSRF protection:
1. Server generates a random CSRF token
2. Token is sent both as a cookie AND in response body/header
3. Client includes token in X-CSRF-Token header for state-changing requests
4. Server validates that cookie value matches header value

This prevents CSRF attacks because malicious sites can't read cookies from other domains
due to Same-Origin Policy, so they can't include the correct CSRF token in their requests.
"""

import secrets
import logging
from typing import Optional
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)

# CSRF configuration
CSRF_TOKEN_LENGTH = 32  # bytes (256 bits)
CSRF_COOKIE_NAME = "csrf_token"
CSRF_HEADER_NAME = "X-CSRF-Token"


def generate_csrf_token() -> str:
    """
    Generate a cryptographically secure random CSRF token.

    Returns:
        str: A URL-safe random token (43 characters, base64-encoded)
    """
    return secrets.token_urlsafe(CSRF_TOKEN_LENGTH)


def validate_csrf_token(cookie_token: Optional[str], header_token: Optional[str]) -> bool:
    """
    Validate CSRF token using double-submit cookie pattern.

    Both the cookie token and header token must be present and must match.
    Uses constant-time comparison to prevent timing attacks.

    Args:
        cookie_token: CSRF token from cookie
        header_token: CSRF token from X-CSRF-Token header

    Returns:
        bool: True if tokens are valid and match, False otherwise
    """
    # Both tokens must be present
    if not cookie_token or not header_token:
        logger.warning("CSRF validation failed: Missing token (cookie=%s, header=%s)",
                      bool(cookie_token), bool(header_token))
        return False

    # Tokens must match (use constant-time comparison to prevent timing attacks)
    if not secrets.compare_digest(cookie_token, header_token):
        logger.warning("CSRF validation failed: Token mismatch")
        return False

    return True


def require_csrf_token(cookie_token: Optional[str], header_token: Optional[str]) -> None:
    """
    Require valid CSRF token or raise HTTPException.

    This is a convenience function that validates the token and raises
    an exception if validation fails.

    Args:
        cookie_token: CSRF token from cookie
        header_token: CSRF token from X-CSRF-Token header

    Raises:
        HTTPException: 403 Forbidden if CSRF validation fails
    """
    if not validate_csrf_token(cookie_token, header_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="CSRF token validation failed. This request appears to be a Cross-Site Request Forgery attack."
        )
