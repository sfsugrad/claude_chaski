"""
LoginAttempt model for tracking login attempts and enforcing account lockouts.

This model is separate from AuditLog to provide efficient querying for
rate limiting and lockout enforcement without the overhead of the full audit system.
"""

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey
from sqlalchemy.sql import func
from app.models.base import Base
from datetime import datetime, timezone


class LoginAttempt(Base):
    """
    Tracks login attempts for rate limiting and account lockout.

    Security features:
    - Track failed attempts per email and IP address
    - Enforce account lockouts after N failed attempts
    - Automatic cleanup of old attempts (via background job)
    """
    __tablename__ = "login_attempts"

    id = Column(Integer, primary_key=True, index=True)

    # User identification (email used for login attempt)
    email = Column(String, nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Request context
    ip_address = Column(String, nullable=False, index=True)
    user_agent = Column(String, nullable=True)

    # Attempt result
    successful = Column(Boolean, default=False, nullable=False)
    failure_reason = Column(String, nullable=True)  # e.g., "invalid_password", "account_locked", "user_not_found"

    # Timestamp
    attempted_at = Column(DateTime(timezone=True), server_default=func.now(), index=True, nullable=False)

    def __repr__(self):
        status = "success" if self.successful else "failed"
        return f"<LoginAttempt {self.email} from {self.ip_address} - {status} at {self.attempted_at}>"
