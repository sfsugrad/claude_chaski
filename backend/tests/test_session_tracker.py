"""
Tests for session tracking service.

Tests cover:
- create_session
- get_user_sessions
- delete_session
- delete_all_sessions_except_current
- session_exists
- update_last_activity
- Session with device info
- Session with IP address
- Session expiration
- SessionInfo.to_dict()
"""

import pytest
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.session_tracker import (
    SessionTracker,
    SessionInfo,
    USER_SESSIONS_PREFIX,
    SESSION_DATA_PREFIX,
)


class MockRedisClient:
    """Mock Redis client for testing"""

    def __init__(self):
        self.store = {}
        self.sets = {}
        self.ttls = {}

    async def hset(self, key: str, mapping: dict) -> int:
        if key not in self.store:
            self.store[key] = {}
        self.store[key].update(mapping)
        return len(mapping)

    async def hgetall(self, key: str) -> dict:
        return self.store.get(key, {})

    async def exists(self, key: str) -> bool:
        return key in self.store

    async def delete(self, key: str) -> int:
        if key in self.store:
            del self.store[key]
            return 1
        return 0

    async def expire(self, key: str, ttl: int) -> bool:
        self.ttls[key] = ttl
        return True

    async def sadd(self, key: str, *values) -> int:
        if key not in self.sets:
            self.sets[key] = set()
        for v in values:
            self.sets[key].add(v)
        return len(values)

    async def smembers(self, key: str) -> set:
        # Return a copy to avoid RuntimeError when modifying during iteration
        return set(self.sets.get(key, set()))

    async def srem(self, key: str, *values) -> int:
        if key in self.sets:
            count = 0
            for v in values:
                if v in self.sets[key]:
                    self.sets[key].discard(v)
                    count += 1
            return count
        return 0


@pytest.fixture
def mock_redis():
    """Create a mock Redis client"""
    return MockRedisClient()


class TestGenerateSessionId:
    """Tests for session ID generation"""

    def test_generates_unique_ids(self):
        """Test that session IDs are unique"""
        ids = [SessionTracker.generate_session_id() for _ in range(100)]
        assert len(set(ids)) == 100

    def test_session_id_is_string(self):
        """Test that session ID is a string"""
        session_id = SessionTracker.generate_session_id()
        assert isinstance(session_id, str)

    def test_session_id_length(self):
        """Test that session ID has appropriate length"""
        session_id = SessionTracker.generate_session_id()
        # 32 bytes base64 encoded = ~43 chars
        assert len(session_id) >= 40


class TestCreateSession:
    """Tests for creating sessions"""

    @pytest.mark.asyncio
    async def test_create_session_success(self, mock_redis):
        """Test successfully creating a session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(
                user_id=1,
                ip_address="192.168.1.1",
                user_agent="Mozilla/5.0",
                ttl_seconds=3600
            )

            assert session_id is not None
            assert isinstance(session_id, str)

            # Verify session was stored
            session_key = f"{SESSION_DATA_PREFIX}{session_id}"
            assert session_key in mock_redis.store
            assert mock_redis.store[session_key]["user_id"] == "1"
            assert mock_redis.store[session_key]["ip_address"] == "192.168.1.1"

    @pytest.mark.asyncio
    async def test_create_session_adds_to_user_set(self, mock_redis):
        """Test that session is added to user's session set"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(
                user_id=42,
                ip_address="10.0.0.1",
                user_agent="Chrome",
                ttl_seconds=3600
            )

            user_sessions_key = f"{USER_SESSIONS_PREFIX}42"
            assert session_id in mock_redis.sets.get(user_sessions_key, set())

    @pytest.mark.asyncio
    async def test_create_session_sets_ttl(self, mock_redis):
        """Test that TTL is set for session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(
                user_id=1,
                ip_address="192.168.1.1",
                user_agent="Firefox",
                ttl_seconds=7200
            )

            session_key = f"{SESSION_DATA_PREFIX}{session_id}"
            assert mock_redis.ttls.get(session_key) == 7200


class TestGetSession:
    """Tests for retrieving sessions"""

    @pytest.mark.asyncio
    async def test_get_session_success(self, mock_redis):
        """Test getting an existing session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            # Create a session first
            session_id = await SessionTracker.create_session(
                user_id=1,
                ip_address="192.168.1.1",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0",
                ttl_seconds=3600
            )

            # Get the session
            session = await SessionTracker.get_session(session_id)

            assert session is not None
            assert session.session_id == session_id
            assert session.user_id == 1
            assert session.ip_address == "192.168.1.1"

    @pytest.mark.asyncio
    async def test_get_session_not_found(self, mock_redis):
        """Test getting a non-existent session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session = await SessionTracker.get_session("nonexistent-session-id")

            assert session is None


class TestGetUserSessions:
    """Tests for getting all user sessions"""

    @pytest.mark.asyncio
    async def test_get_user_sessions_empty(self, mock_redis):
        """Test getting sessions for user with no sessions"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            sessions = await SessionTracker.get_user_sessions(user_id=999)

            assert sessions == []

    @pytest.mark.asyncio
    async def test_get_user_sessions_multiple(self, mock_redis):
        """Test getting multiple sessions for a user"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            # Create multiple sessions
            session1 = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)
            session2 = await SessionTracker.create_session(1, "192.168.1.2", "Firefox", 3600)
            session3 = await SessionTracker.create_session(1, "192.168.1.3", "Safari", 3600)

            sessions = await SessionTracker.get_user_sessions(user_id=1)

            assert len(sessions) == 3

    @pytest.mark.asyncio
    async def test_get_user_sessions_marks_current(self, mock_redis):
        """Test that current session is marked"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session1 = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)
            session2 = await SessionTracker.create_session(1, "192.168.1.2", "Firefox", 3600)

            sessions = await SessionTracker.get_user_sessions(user_id=1, current_session_id=session1)

            current_sessions = [s for s in sessions if s.is_current]
            assert len(current_sessions) == 1
            assert current_sessions[0].session_id == session1


class TestDeleteSession:
    """Tests for deleting sessions"""

    @pytest.mark.asyncio
    async def test_delete_session_success(self, mock_redis):
        """Test successfully deleting a session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)

            result = await SessionTracker.delete_session(session_id, user_id=1)

            assert result is True

            # Verify session is deleted
            session = await SessionTracker.get_session(session_id)
            assert session is None

    @pytest.mark.asyncio
    async def test_delete_session_wrong_user(self, mock_redis):
        """Test that session cannot be deleted by wrong user"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)

            # Try to delete with wrong user_id
            result = await SessionTracker.delete_session(session_id, user_id=999)

            assert result is False

    @pytest.mark.asyncio
    async def test_delete_nonexistent_session(self, mock_redis):
        """Test deleting a session that doesn't exist"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result = await SessionTracker.delete_session("fake-session", user_id=1)

            assert result is False


class TestDeleteAllSessionsExceptCurrent:
    """Tests for deleting all sessions except current"""

    @pytest.mark.asyncio
    async def test_delete_other_sessions(self, mock_redis):
        """Test deleting all other sessions"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            # Create multiple sessions
            session1 = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)
            session2 = await SessionTracker.create_session(1, "192.168.1.2", "Firefox", 3600)
            session3 = await SessionTracker.create_session(1, "192.168.1.3", "Safari", 3600)

            # Keep session1, delete others
            deleted = await SessionTracker.delete_all_sessions_except_current(
                user_id=1,
                current_session_id=session1
            )

            assert deleted == 2

            # Verify only session1 remains
            sessions = await SessionTracker.get_user_sessions(user_id=1)
            assert len(sessions) == 1
            assert sessions[0].session_id == session1


class TestSessionExists:
    """Tests for checking session existence"""

    @pytest.mark.asyncio
    async def test_session_exists_true(self, mock_redis):
        """Test checking existing session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)

            exists = await SessionTracker.session_exists(session_id)

            assert exists is True

    @pytest.mark.asyncio
    async def test_session_exists_false(self, mock_redis):
        """Test checking non-existent session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            exists = await SessionTracker.session_exists("fake-session-id")

            assert exists is False


class TestUpdateLastActivity:
    """Tests for updating session activity"""

    @pytest.mark.asyncio
    async def test_update_last_activity_success(self, mock_redis):
        """Test updating last activity timestamp"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            session_id = await SessionTracker.create_session(1, "192.168.1.1", "Chrome", 3600)

            result = await SessionTracker.update_last_activity(session_id)

            assert result is True

    @pytest.mark.asyncio
    async def test_update_last_activity_not_found(self, mock_redis):
        """Test updating activity for non-existent session"""
        with patch("app.services.session_tracker.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result = await SessionTracker.update_last_activity("fake-session")

            assert result is False


class TestSessionInfo:
    """Tests for SessionInfo class"""

    def test_to_dict_basic(self):
        """Test SessionInfo.to_dict() with basic info"""
        now = datetime.now(timezone.utc)
        session = SessionInfo(
            session_id="test-session-123",
            user_id=42,
            ip_address="192.168.1.100",
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0",
            login_time=now,
            last_activity=now,
            is_current=True
        )

        data = session.to_dict()

        assert data["session_id"] == "test-session-123"
        assert data["ip_address"] == "192.168.1.100"
        assert data["is_current"] is True
        assert "device" in data
        assert "Chrome" in data["device"]

    def test_to_dict_mobile_device(self):
        """Test SessionInfo.to_dict() with mobile user agent"""
        now = datetime.now(timezone.utc)
        session = SessionInfo(
            session_id="mobile-session",
            user_id=1,
            ip_address="10.0.0.1",
            user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) Safari/605.1.15",
            login_time=now,
            last_activity=now,
            is_current=False
        )

        data = session.to_dict()

        assert "Safari" in data["device"] or "iOS" in data["device"]
        assert data["is_current"] is False
