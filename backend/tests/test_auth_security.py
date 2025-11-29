"""
Tests for authentication security service.

Tests cover:
- Login attempt tracking (success and failure)
- Account lockout after failed attempts
- Lockout duration and expiration
- Time window for counting attempts
- Account unlock functionality
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.services.auth_security import (
    record_login_attempt,
    get_recent_failed_attempts,
    is_account_locked,
    lock_account,
    should_lock_account,
    get_time_until_unlock,
    unlock_account,
    MAX_LOGIN_ATTEMPTS,
    LOCKOUT_DURATION_MINUTES,
    ATTEMPT_WINDOW_MINUTES,
)
from app.models.user import User, UserRole
from app.models.login_attempt import LoginAttempt
from app.utils.auth import get_password_hash


class TestRecordLoginAttempt:
    """Tests for recording login attempts"""

    def test_record_successful_attempt(self, db_session):
        """Test recording a successful login attempt"""
        attempt = record_login_attempt(
            db=db_session,
            email="user@example.com",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            successful=True,
            user_id=1
        )

        assert attempt.id is not None
        assert attempt.email == "user@example.com"
        assert attempt.ip_address == "192.168.1.1"
        assert attempt.successful is True
        assert attempt.failure_reason is None

    def test_record_failed_attempt(self, db_session):
        """Test recording a failed login attempt"""
        attempt = record_login_attempt(
            db=db_session,
            email="user@example.com",
            ip_address="192.168.1.1",
            user_agent="Mozilla/5.0",
            successful=False,
            failure_reason="Invalid password"
        )

        assert attempt.successful is False
        assert attempt.failure_reason == "Invalid password"

    def test_record_attempt_without_user_agent(self, db_session):
        """Test recording attempt without user agent"""
        attempt = record_login_attempt(
            db=db_session,
            email="user@example.com",
            ip_address="192.168.1.1",
            user_agent=None,
            successful=False
        )

        assert attempt.user_agent is None


class TestGetRecentFailedAttempts:
    """Tests for counting recent failed login attempts"""

    def test_count_failed_attempts(self, db_session):
        """Test counting failed attempts within window"""
        email = "test@example.com"

        # Create 3 failed attempts
        for _ in range(3):
            record_login_attempt(
                db=db_session,
                email=email,
                ip_address="192.168.1.1",
                user_agent=None,
                successful=False
            )

        count = get_recent_failed_attempts(db_session, email)
        assert count == 3

    def test_excludes_successful_attempts(self, db_session):
        """Test that successful attempts are not counted"""
        email = "test@example.com"

        # Create mix of attempts
        record_login_attempt(db_session, email, "192.168.1.1", None, False)
        record_login_attempt(db_session, email, "192.168.1.1", None, True)  # Success
        record_login_attempt(db_session, email, "192.168.1.1", None, False)

        count = get_recent_failed_attempts(db_session, email)
        assert count == 2  # Only failed attempts

    def test_excludes_other_users(self, db_session):
        """Test that attempts for other users are not counted"""
        record_login_attempt(db_session, "user1@example.com", "192.168.1.1", None, False)
        record_login_attempt(db_session, "user2@example.com", "192.168.1.1", None, False)
        record_login_attempt(db_session, "user1@example.com", "192.168.1.1", None, False)

        count = get_recent_failed_attempts(db_session, "user1@example.com")
        assert count == 2

    def test_returns_zero_for_no_attempts(self, db_session):
        """Test zero returned when no attempts exist"""
        count = get_recent_failed_attempts(db_session, "noattempts@example.com")
        assert count == 0


class TestIsAccountLocked:
    """Tests for checking if account is locked"""

    def test_account_not_locked(self, db_session):
        """Test account without lockout is not locked"""
        user = User(
            email="test@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Test User",
            role=UserRole.SENDER,
            account_locked_until=None
        )
        db_session.add(user)
        db_session.commit()

        assert is_account_locked(user) is False

    def test_account_locked_future(self, db_session):
        """Test account with future lockout time is locked"""
        future_time = datetime.now(timezone.utc) + timedelta(minutes=10)
        user = User(
            email="locked@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Locked User",
            role=UserRole.SENDER,
            account_locked_until=future_time
        )
        db_session.add(user)
        db_session.commit()

        assert is_account_locked(user) is True

    def test_account_lock_expired(self, db_session):
        """Test account with past lockout time is not locked"""
        past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        user = User(
            email="expired@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Expired Lock User",
            role=UserRole.SENDER,
            account_locked_until=past_time
        )
        db_session.add(user)
        db_session.commit()

        assert is_account_locked(user) is False


class TestLockAccount:
    """Tests for locking user accounts"""

    def test_lock_account_default_duration(self, db_session):
        """Test locking account with default duration"""
        user = User(
            email="tolock@example.com",
            hashed_password=get_password_hash("password"),
            full_name="To Lock User",
            role=UserRole.SENDER
        )
        db_session.add(user)
        db_session.commit()

        lock_account(db_session, user)

        assert user.account_locked_until is not None
        assert is_account_locked(user) is True

    def test_lock_account_custom_duration(self, db_session):
        """Test locking account with custom duration"""
        user = User(
            email="custom@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Custom Lock User",
            role=UserRole.SENDER
        )
        db_session.add(user)
        db_session.commit()

        lock_account(db_session, user, duration_minutes=30)

        # Check lock is set for approximately 30 minutes
        expected_unlock = datetime.now(timezone.utc) + timedelta(minutes=30)
        assert user.account_locked_until is not None
        # Allow 5 second tolerance
        locked_until = user.account_locked_until.replace(tzinfo=timezone.utc) if user.account_locked_until.tzinfo is None else user.account_locked_until
        assert abs((locked_until - expected_unlock).total_seconds()) < 5


class TestShouldLockAccount:
    """Tests for determining if account should be locked"""

    def test_should_lock_at_threshold(self, db_session):
        """Test account should be locked at max attempts threshold"""
        email = "threshold@example.com"

        # Create MAX_LOGIN_ATTEMPTS failed attempts
        for _ in range(MAX_LOGIN_ATTEMPTS):
            record_login_attempt(db_session, email, "192.168.1.1", None, False)

        assert should_lock_account(db_session, email) is True

    def test_should_not_lock_under_threshold(self, db_session):
        """Test account should not be locked under threshold"""
        email = "under@example.com"

        # Create fewer than MAX_LOGIN_ATTEMPTS
        for _ in range(MAX_LOGIN_ATTEMPTS - 1):
            record_login_attempt(db_session, email, "192.168.1.1", None, False)

        assert should_lock_account(db_session, email) is False

    def test_should_lock_over_threshold(self, db_session):
        """Test account should be locked over threshold"""
        email = "over@example.com"

        # Create more than MAX_LOGIN_ATTEMPTS
        for _ in range(MAX_LOGIN_ATTEMPTS + 2):
            record_login_attempt(db_session, email, "192.168.1.1", None, False)

        assert should_lock_account(db_session, email) is True


class TestGetTimeUntilUnlock:
    """Tests for getting time until account unlock"""

    def test_time_until_unlock_locked(self, db_session):
        """Test getting remaining lockout time"""
        future_time = datetime.now(timezone.utc) + timedelta(minutes=10)
        user = User(
            email="timed@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Timed User",
            role=UserRole.SENDER,
            account_locked_until=future_time
        )
        db_session.add(user)
        db_session.commit()

        remaining = get_time_until_unlock(user)
        assert remaining is not None
        # Should be close to 10 minutes
        assert 9 * 60 < remaining.total_seconds() < 11 * 60

    def test_time_until_unlock_not_locked(self, db_session):
        """Test None returned for unlocked account"""
        user = User(
            email="unlocked@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Unlocked User",
            role=UserRole.SENDER,
            account_locked_until=None
        )
        db_session.add(user)
        db_session.commit()

        remaining = get_time_until_unlock(user)
        assert remaining is None

    def test_time_until_unlock_expired(self, db_session):
        """Test None returned for expired lock"""
        past_time = datetime.now(timezone.utc) - timedelta(minutes=10)
        user = User(
            email="expired2@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Expired User",
            role=UserRole.SENDER,
            account_locked_until=past_time
        )
        db_session.add(user)
        db_session.commit()

        remaining = get_time_until_unlock(user)
        assert remaining is None


class TestUnlockAccount:
    """Tests for manually unlocking accounts"""

    def test_unlock_locked_account(self, db_session):
        """Test unlocking a locked account"""
        future_time = datetime.now(timezone.utc) + timedelta(minutes=10)
        user = User(
            email="tounlock@example.com",
            hashed_password=get_password_hash("password"),
            full_name="To Unlock User",
            role=UserRole.SENDER,
            account_locked_until=future_time
        )
        db_session.add(user)
        db_session.commit()

        assert is_account_locked(user) is True

        unlock_account(db_session, user)

        assert user.account_locked_until is None
        assert is_account_locked(user) is False

    def test_unlock_already_unlocked(self, db_session):
        """Test unlocking already unlocked account (no-op)"""
        user = User(
            email="alreadyunlocked@example.com",
            hashed_password=get_password_hash("password"),
            full_name="Already Unlocked User",
            role=UserRole.SENDER,
            account_locked_until=None
        )
        db_session.add(user)
        db_session.commit()

        unlock_account(db_session, user)

        assert user.account_locked_until is None


class TestSecurityConstants:
    """Tests for security configuration constants"""

    def test_max_login_attempts(self):
        """Test max login attempts is reasonable"""
        assert MAX_LOGIN_ATTEMPTS == 5

    def test_lockout_duration(self):
        """Test lockout duration is reasonable"""
        assert LOCKOUT_DURATION_MINUTES == 15

    def test_attempt_window(self):
        """Test attempt window is reasonable"""
        assert ATTEMPT_WINDOW_MINUTES == 15
