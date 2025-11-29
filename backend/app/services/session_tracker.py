"""
Active Session Tracking Service using Redis.

This service tracks all active user sessions across devices for:
- Session visibility (users can see where they're logged in)
- Session management (logout from specific devices)
- Security monitoring (detect suspicious login patterns)
- Force logout capability (logout from all devices)

Session data includes:
- Session ID (unique identifier)
- User ID
- IP address
- User agent (browser/device info)
- Login time
- Last activity time
"""

import secrets
import logging
from datetime import datetime, timezone
from typing import List, Dict, Optional
from user_agents import parse  # For parsing user agent strings

from app.services.redis_client import RedisClient

logger = logging.getLogger(__name__)

# Redis key prefixes
USER_SESSIONS_PREFIX = "user:sessions:"  # user:sessions:{user_id} → Set of session IDs
SESSION_DATA_PREFIX = "session:"  # session:{session_id} → Hash with session data


class SessionInfo:
    """Data class for session information."""

    def __init__(
        self,
        session_id: str,
        user_id: int,
        ip_address: str,
        user_agent: str,
        login_time: datetime,
        last_activity: datetime,
        is_current: bool = False
    ):
        self.session_id = session_id
        self.user_id = user_id
        self.ip_address = ip_address
        self.user_agent = user_agent
        self.login_time = login_time
        self.last_activity = last_activity
        self.is_current = is_current

    def to_dict(self) -> Dict:
        """Convert to dictionary for JSON serialization."""
        # Parse user agent for better display
        ua = parse(self.user_agent)
        device_info = f"{ua.browser.family} on {ua.os.family}"
        if ua.device.family and ua.device.family != "Other":
            device_info += f" ({ua.device.family})"

        return {
            "session_id": self.session_id,
            "ip_address": self.ip_address,
            "user_agent": self.user_agent,
            "device": device_info,
            "login_time": self.login_time.isoformat(),
            "last_activity": self.last_activity.isoformat(),
            "is_current": self.is_current
        }


class SessionTracker:
    """Service for tracking and managing user sessions."""

    @staticmethod
    def generate_session_id() -> str:
        """
        Generate a unique session ID.

        Returns:
            Cryptographically secure random session ID
        """
        return secrets.token_urlsafe(32)

    @staticmethod
    async def create_session(
        user_id: int,
        ip_address: str,
        user_agent: str,
        ttl_seconds: int
    ) -> str:
        """
        Create a new session for a user.

        Args:
            user_id: User ID
            ip_address: IP address of the login
            user_agent: User agent string
            ttl_seconds: Time-to-live in seconds (should match JWT expiration)

        Returns:
            Session ID
        """
        redis = await RedisClient.get_instance()

        # Generate unique session ID
        session_id = SessionTracker.generate_session_id()

        # Current timestamp
        now = datetime.now(timezone.utc)
        timestamp = int(now.timestamp())

        # Store session data as hash
        session_key = f"{SESSION_DATA_PREFIX}{session_id}"
        session_data = {
            "user_id": str(user_id),
            "ip_address": ip_address,
            "user_agent": user_agent,
            "login_time": str(timestamp),
            "last_activity": str(timestamp)
        }

        await redis.hset(session_key, session_data)
        await redis.expire(session_key, ttl_seconds)

        # Add session ID to user's session set
        user_sessions_key = f"{USER_SESSIONS_PREFIX}{user_id}"
        await redis.sadd(user_sessions_key, session_id)
        await redis.expire(user_sessions_key, ttl_seconds)

        logger.info(
            f"Session created: session_id={session_id}, user_id={user_id}, "
            f"ip={ip_address}, ttl={ttl_seconds}s"
        )

        return session_id

    @staticmethod
    async def update_last_activity(session_id: str) -> bool:
        """
        Update the last activity timestamp for a session.

        Args:
            session_id: Session ID

        Returns:
            True if updated successfully, False if session doesn't exist
        """
        redis = await RedisClient.get_instance()

        session_key = f"{SESSION_DATA_PREFIX}{session_id}"

        # Check if session exists
        if not await redis.exists(session_key):
            return False

        # Update last activity timestamp
        now = datetime.now(timezone.utc)
        timestamp = int(now.timestamp())

        await redis.hset(session_key, {"last_activity": str(timestamp)})

        return True

    @staticmethod
    async def get_session(session_id: str) -> Optional[SessionInfo]:
        """
        Get session information by session ID.

        Args:
            session_id: Session ID

        Returns:
            SessionInfo object or None if not found
        """
        redis = await RedisClient.get_instance()

        session_key = f"{SESSION_DATA_PREFIX}{session_id}"
        session_data = await redis.hgetall(session_key)

        if not session_data:
            return None

        # Parse session data
        user_id = int(session_data.get("user_id", 0))
        ip_address = session_data.get("ip_address", "")
        user_agent = session_data.get("user_agent", "")
        login_time = datetime.fromtimestamp(int(session_data.get("login_time", 0)), tz=timezone.utc)
        last_activity = datetime.fromtimestamp(int(session_data.get("last_activity", 0)), tz=timezone.utc)

        return SessionInfo(
            session_id=session_id,
            user_id=user_id,
            ip_address=ip_address,
            user_agent=user_agent,
            login_time=login_time,
            last_activity=last_activity
        )

    @staticmethod
    async def get_user_sessions(
        user_id: int,
        current_session_id: Optional[str] = None
    ) -> List[SessionInfo]:
        """
        Get all active sessions for a user.

        Args:
            user_id: User ID
            current_session_id: Current session ID (will be marked as current)

        Returns:
            List of SessionInfo objects
        """
        redis = await RedisClient.get_instance()

        user_sessions_key = f"{USER_SESSIONS_PREFIX}{user_id}"
        session_ids = await redis.smembers(user_sessions_key)

        if not session_ids:
            return []

        sessions = []
        for session_id in session_ids:
            session = await SessionTracker.get_session(session_id)
            if session:
                # Mark current session
                if current_session_id and session_id == current_session_id:
                    session.is_current = True
                sessions.append(session)
            else:
                # Clean up stale session ID from set
                await redis.srem(user_sessions_key, session_id)

        # Sort by last activity (most recent first)
        sessions.sort(key=lambda s: s.last_activity, reverse=True)

        return sessions

    @staticmethod
    async def delete_session(session_id: str, user_id: int) -> bool:
        """
        Delete a specific session.

        Args:
            session_id: Session ID to delete
            user_id: User ID (for verification)

        Returns:
            True if deleted successfully, False if session doesn't exist or doesn't belong to user
        """
        redis = await RedisClient.get_instance()

        # Verify session belongs to user
        session = await SessionTracker.get_session(session_id)
        if not session or session.user_id != user_id:
            return False

        # Delete session data
        session_key = f"{SESSION_DATA_PREFIX}{session_id}"
        await redis.delete(session_key)

        # Remove from user's session set
        user_sessions_key = f"{USER_SESSIONS_PREFIX}{user_id}"
        await redis.srem(user_sessions_key, session_id)

        logger.info(f"Session deleted: session_id={session_id}, user_id={user_id}")

        return True

    @staticmethod
    async def delete_all_sessions_except_current(
        user_id: int,
        current_session_id: str
    ) -> int:
        """
        Delete all sessions for a user except the current one.

        Useful for "logout from all other devices" functionality.

        Args:
            user_id: User ID
            current_session_id: Current session ID to keep

        Returns:
            Number of sessions deleted
        """
        redis = await RedisClient.get_instance()

        user_sessions_key = f"{USER_SESSIONS_PREFIX}{user_id}"
        session_ids = await redis.smembers(user_sessions_key)

        deleted_count = 0
        for session_id in session_ids:
            if session_id != current_session_id:
                session_key = f"{SESSION_DATA_PREFIX}{session_id}"
                await redis.delete(session_key)
                await redis.srem(user_sessions_key, session_id)
                deleted_count += 1

        logger.info(
            f"Deleted {deleted_count} sessions for user {user_id}, "
            f"kept current session {current_session_id}"
        )

        return deleted_count

    @staticmethod
    async def session_exists(session_id: str) -> bool:
        """
        Check if a session exists.

        Args:
            session_id: Session ID

        Returns:
            True if session exists, False otherwise
        """
        redis = await RedisClient.get_instance()

        session_key = f"{SESSION_DATA_PREFIX}{session_id}"
        return await redis.exists(session_key)
