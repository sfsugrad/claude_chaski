from fastapi import Depends, HTTPException, status, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional
from app.database import get_db
from app.models.user import User
from app.utils.auth import verify_token
from app.services.jwt_blacklist import JWTBlacklistService
from app.services.session_tracker import SessionTracker

# Security scheme for JWT bearer token (kept for backward compatibility)
security = HTTPBearer(auto_error=False)

# Cookie name must match auth.py
COOKIE_NAME = "access_token"


def get_token_from_request(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> str:
    """
    Extract JWT token from httpOnly cookie or Authorization header.

    Priority: Cookie > Authorization header
    """
    # First, try to get token from httpOnly cookie
    token = request.cookies.get(COOKIE_NAME)
    if token:
        return token

    # Fallback to Authorization header for backward compatibility
    if credentials and credentials.credentials:
        return credentials.credentials

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    """
    Dependency to get the current authenticated user from JWT token.

    Reads token from httpOnly cookie or Authorization header.

    Security checks:
    - Token signature and expiration validation
    - Token blacklist check (logout/revoked tokens)
    - User-level token revocation (password changes)
    - User active status

    Raises:
        HTTPException: If token is invalid or user not found

    Returns:
        User: The authenticated user
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )

    # Extract token from cookie or header
    token = get_token_from_request(request, credentials)

    # Check if token is blacklisted (logout or explicit revocation)
    if await JWTBlacklistService.is_token_blacklisted(token):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify and decode token
    payload = verify_token(token)
    if payload is None:
        raise credentials_exception

    # Extract user email from token
    email: str = payload.get("sub")
    if email is None:
        raise credentials_exception

    # Get user from database
    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise credentials_exception

    # Check if token is valid for this user (not revoked globally for password change)
    if not await JWTBlacklistService.is_token_valid_for_user(token, user.id):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked due to password change",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active (admin-controlled deactivation)
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support."
        )

    # Note: Email and phone verification status is checked by frontend to show banners
    # Users can still login and access dashboard even if not fully verified

    # Update session last activity (if session tracking is enabled)
    session_id = payload.get("session_id")
    if session_id:
        # Update last activity timestamp (non-blocking, ignore errors)
        try:
            await SessionTracker.update_last_activity(session_id)
        except Exception:
            # Don't fail authentication if session update fails
            pass

    return user


def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to get the current active user.
    This is an alias for get_current_user since we already check is_active.
    """
    return current_user


def get_current_admin_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """
    Dependency to get the current admin user.
    Ensures the user has ADMIN role.

    Raises:
        HTTPException: If user is not an admin

    Returns:
        User: The authenticated admin user
    """
    from app.models.user import UserRole

    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )

    return current_user
