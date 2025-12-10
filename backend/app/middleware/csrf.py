"""
CSRF Protection Middleware

This middleware implements CSRF protection for all state-changing requests
using the double-submit cookie pattern.

How it works:
1. On any request, if no CSRF cookie exists, generate and set one
2. For state-changing requests (POST, PUT, DELETE, PATCH), validate CSRF token
3. WebSocket and certain public endpoints are exempt from CSRF validation
4. CSRF token is also included in response header for easy client access
"""

import logging
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp

from app.utils.csrf import (
    generate_csrf_token,
    validate_csrf_token,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME
)
from app.config import settings

logger = logging.getLogger(__name__)

# Methods that require CSRF protection
CSRF_PROTECTED_METHODS = {"POST", "PUT", "DELETE", "PATCH"}

# Paths exempt from CSRF validation
# These endpoints are either:
# - Using JWT authentication instead (WebSocket)
# - Public auth endpoints that don't yet have a CSRF token
# - Documentation endpoints
CSRF_EXEMPT_PATHS = {
    "/api/ws",  # WebSocket endpoint
    "/api/auth/login",  # Login endpoint - no CSRF token yet
    "/api/auth/login/mobile",  # Mobile login endpoint - uses Bearer token auth
    "/api/auth/register",  # Registration endpoint - no CSRF token yet
    "/api/auth/forgot-password",  # Password reset request
    "/api/auth/reset-password",  # Password reset confirmation
    "/api/auth/verify-email",  # Email verification
    "/api/auth/google",  # OAuth endpoints
    "/api/logs/frontend",  # Frontend error logging (may not have token)
    "/api/id-verification/webhook",  # Stripe Identity webhook - uses signature verification
    "/docs",    # Swagger UI
    "/redoc",   # ReDoc
    "/openapi.json",  # OpenAPI spec
}


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    Middleware to enforce CSRF protection on state-changing requests.

    This middleware:
    - Generates CSRF tokens for clients that don't have one
    - Validates CSRF tokens on POST/PUT/DELETE/PATCH requests
    - Exempts WebSocket and documentation endpoints
    - Includes CSRF token in response header for client convenience
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and validate CSRF token if needed.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain

        Returns:
            Response: HTTP response with CSRF token cookie and header
        """
        # Get existing CSRF token from cookie
        csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)

        # Check if this path is exempt from CSRF validation
        is_exempt = any(request.url.path.startswith(path) for path in CSRF_EXEMPT_PATHS)

        # Skip CSRF validation in test environment
        # Check os.environ directly to catch runtime changes (e.g., from conftest.py)
        import os
        is_test_env = os.getenv("ENVIRONMENT") == "test"

        # Check if request uses Bearer token authentication (mobile app)
        # Bearer token auth is stateless and doesn't need CSRF protection
        auth_header = request.headers.get("Authorization", "")
        uses_bearer_auth = auth_header.startswith("Bearer ")

        # Validate CSRF token for state-changing requests (unless exempt, test mode, or using Bearer auth)
        if request.method in CSRF_PROTECTED_METHODS and not is_exempt and not is_test_env and not uses_bearer_auth:
            csrf_header = request.headers.get(CSRF_HEADER_NAME)

            if not validate_csrf_token(csrf_cookie, csrf_header):
                # CSRF validation failed - return 403 Forbidden
                logger.warning(
                    "CSRF validation failed for %s %s from %s",
                    request.method,
                    request.url.path,
                    request.client.host if request.client else "unknown"
                )
                return Response(
                    content='{"detail":"CSRF token validation failed"}',
                    status_code=403,
                    media_type="application/json"
                )

        # Process the request
        response = await call_next(request)

        # Generate new CSRF token if one doesn't exist
        if not csrf_cookie:
            csrf_cookie = generate_csrf_token()

        # Set CSRF token in cookie (httpOnly=False so JavaScript can read it for headers)
        # Note: This is safe because the token itself is not a secret - the secret is
        # that only our JavaScript can read it due to Same-Origin Policy
        response.set_cookie(
            key=CSRF_COOKIE_NAME,
            value=csrf_cookie,
            httponly=False,  # Must be readable by JavaScript to include in headers
            secure=settings.ENVIRONMENT == "production",  # HTTPS only in production
            samesite="lax",  # Prevent CSRF by limiting cross-site cookie sending
            max_age=86400 * 7,  # 7 days
            path="/"
        )

        # Also include CSRF token in response header for convenience
        # This allows clients to easily get the token after login
        response.headers[CSRF_HEADER_NAME] = csrf_cookie

        return response
