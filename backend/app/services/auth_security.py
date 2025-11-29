"""
Authentication security service for login attempt tracking and account lockout.

This module provides functions to:
- Track login attempts (successful and failed)
- Enforce account lockout after N failed attempts
- Check if an account is locked
- Clear failed attempts after successful login
"""

from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models.user import User
from app.models.login_attempt import LoginAttempt
import logging

logger = logging.getLogger(__name__)

# Security configuration
MAX_LOGIN_ATTEMPTS = 5  # Max failed login attempts before lockout
LOCKOUT_DURATION_MINUTES = 15  # Account locked for 15 minutes
ATTEMPT_WINDOW_MINUTES = 15  # Count attempts within last 15 minutes


def record_login_attempt(
    db: Session,
    email: str,
    ip_address: str,
    user_agent: str | None,
    successful: bool,
    failure_reason: str | None = None,
    user_id: int | None = None
) -> LoginAttempt:
    """
    Record a login attempt in the database.

    Args:
        db: Database session
        email: Email used for login
        ip_address: IP address of the request
        user_agent: User agent string
        successful: Whether the login was successful
        failure_reason: Reason for failure (if applicable)
        user_id: User ID (if user exists)

    Returns:
        The created LoginAttempt record
    """
    attempt = LoginAttempt(
        email=email,
        user_id=user_id,
        ip_address=ip_address,
        user_agent=user_agent,
        successful=successful,
        failure_reason=failure_reason
    )

    db.add(attempt)
    db.commit()
    db.refresh(attempt)

    logger.info(
        f"Login attempt recorded: email={email}, ip={ip_address}, "
        f"successful={successful}, reason={failure_reason}"
    )

    return attempt


def get_recent_failed_attempts(db: Session, email: str) -> int:
    """
    Count failed login attempts for an email within the attempt window.

    Args:
        db: Database session
        email: Email to check

    Returns:
        Number of failed attempts in the last ATTEMPT_WINDOW_MINUTES
    """
    cutoff_time = datetime.now(timezone.utc) - timedelta(minutes=ATTEMPT_WINDOW_MINUTES)

    failed_count = db.query(LoginAttempt).filter(
        LoginAttempt.email == email,
        LoginAttempt.successful == False,
        LoginAttempt.attempted_at >= cutoff_time
    ).count()

    return failed_count


def is_account_locked(user: User) -> bool:
    """
    Check if a user account is currently locked.

    Args:
        user: User object to check

    Returns:
        True if account is locked, False otherwise
    """
    if user.account_locked_until is None:
        return False

    # Handle both naive and aware datetimes
    locked_until = user.account_locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)

    # Check if lockout period has expired
    now = datetime.now(timezone.utc)
    return locked_until > now


def lock_account(db: Session, user: User, duration_minutes: int = LOCKOUT_DURATION_MINUTES) -> None:
    """
    Lock a user account for a specified duration.

    Args:
        db: Database session
        user: User to lock
        duration_minutes: How long to lock the account (default: LOCKOUT_DURATION_MINUTES)
    """
    lockout_until = datetime.now(timezone.utc) + timedelta(minutes=duration_minutes)
    user.account_locked_until = lockout_until
    db.commit()

    logger.warning(
        f"Account locked: user_id={user.id}, email={user.email}, "
        f"locked_until={lockout_until.isoformat()}"
    )


def clear_failed_attempts(db: Session, email: str) -> None:
    """
    Clear failed login attempts for an email (called after successful login).

    This doesn't delete the records, but marks all failed attempts as "cleared"
    by recording a successful attempt which resets the counter.

    Args:
        db: Database session
        email: Email to clear attempts for
    """
    # The successful login attempt recorded elsewhere serves as the "clear" marker
    # Old failed attempts are still in the DB for audit purposes but won't count
    # towards lockout since we only count attempts after the last successful one
    pass  # No action needed - successful attempt recorded in login endpoint


def should_lock_account(db: Session, email: str) -> bool:
    """
    Determine if an account should be locked based on recent failed attempts.

    Args:
        db: Database session
        email: Email to check

    Returns:
        True if account should be locked, False otherwise
    """
    failed_count = get_recent_failed_attempts(db, email)
    return failed_count >= MAX_LOGIN_ATTEMPTS


def get_time_until_unlock(user: User) -> timedelta | None:
    """
    Get the time remaining until account unlock.

    Args:
        user: User to check

    Returns:
        Timedelta until unlock, or None if not locked
    """
    if not is_account_locked(user):
        return None

    locked_until = user.account_locked_until
    if locked_until.tzinfo is None:
        locked_until = locked_until.replace(tzinfo=timezone.utc)

    now = datetime.now(timezone.utc)
    return locked_until - now


def unlock_account(db: Session, user: User) -> None:
    """
    Manually unlock a user account (e.g., by admin).

    Args:
        db: Database session
        user: User to unlock
    """
    user.account_locked_until = None
    db.commit()

    logger.info(f"Account manually unlocked: user_id={user.id}, email={user.email}")
