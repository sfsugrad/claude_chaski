"""
Tests for JWT token blacklist service.

Tests cover:
- Token blacklisting for logout
- Checking if token is blacklisted
- User-wide token revocation
- Token expiration and TTL
- Redis integration (mocked)
"""

import pytest
import hashlib
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, patch, MagicMock

from app.services.jwt_blacklist import (
    JWTBlacklistService,
    BLACKLIST_PREFIX,
    USER_REVOKE_PREFIX,
)
from app.utils.auth import create_access_token


class MockRedisClient:
    """Mock Redis client for testing"""

    def __init__(self):
        self.store = {}

    async def set(self, key: str, value: str, ttl: int = None) -> bool:
        self.store[key] = {"value": value, "ttl": ttl}
        return True

    async def get(self, key: str) -> str | None:
        data = self.store.get(key)
        return data["value"] if data else None

    async def exists(self, key: str) -> bool:
        return key in self.store

    async def delete(self, key: str) -> int:
        if key in self.store:
            del self.store[key]
            return 1
        return 0


@pytest.fixture
def mock_redis():
    """Create a mock Redis client"""
    return MockRedisClient()


@pytest.fixture
def sample_token():
    """Create a sample JWT token for testing"""
    return create_access_token(data={"sub": "test@example.com"})


class TestHashToken:
    """Tests for token hashing"""

    def test_hash_token_produces_hex_string(self, sample_token):
        """Test that token hash is a hex string"""
        token_hash = JWTBlacklistService._hash_token(sample_token)
        # SHA256 produces 64 hex characters
        assert len(token_hash) == 64
        assert all(c in "0123456789abcdef" for c in token_hash)

    def test_hash_token_consistency(self, sample_token):
        """Test that same token produces same hash"""
        hash1 = JWTBlacklistService._hash_token(sample_token)
        hash2 = JWTBlacklistService._hash_token(sample_token)
        assert hash1 == hash2

    def test_different_tokens_produce_different_hashes(self):
        """Test that different tokens produce different hashes"""
        token1 = create_access_token(data={"sub": "user1@example.com"})
        token2 = create_access_token(data={"sub": "user2@example.com"})

        hash1 = JWTBlacklistService._hash_token(token1)
        hash2 = JWTBlacklistService._hash_token(token2)

        assert hash1 != hash2


class TestGetTokenExp:
    """Tests for extracting token expiration"""

    def test_get_token_exp_returns_timestamp(self, sample_token):
        """Test extracting expiration from valid token"""
        exp = JWTBlacklistService._get_token_exp(sample_token)
        assert exp is not None
        assert isinstance(exp, int)
        # Expiration should be in the future
        assert exp > int(datetime.now(timezone.utc).timestamp())

    def test_get_token_exp_invalid_token(self):
        """Test that invalid token returns None"""
        exp = JWTBlacklistService._get_token_exp("invalid-token")
        assert exp is None


class TestBlacklistToken:
    """Tests for blacklisting tokens"""

    @pytest.mark.asyncio
    async def test_blacklist_token_success(self, mock_redis, sample_token):
        """Test successfully blacklisting a token"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result = await JWTBlacklistService.blacklist_token(sample_token, reason="logout")

            assert result is True

            # Verify token was stored
            token_hash = JWTBlacklistService._hash_token(sample_token)
            key = f"{BLACKLIST_PREFIX}{token_hash}"
            assert key in mock_redis.store
            assert mock_redis.store[key]["value"] == "logout"

    @pytest.mark.asyncio
    async def test_blacklist_token_stores_reason(self, mock_redis, sample_token):
        """Test that blacklist reason is stored"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            await JWTBlacklistService.blacklist_token(sample_token, reason="password_change")

            token_hash = JWTBlacklistService._hash_token(sample_token)
            key = f"{BLACKLIST_PREFIX}{token_hash}"
            assert mock_redis.store[key]["value"] == "password_change"

    @pytest.mark.asyncio
    async def test_blacklist_token_sets_ttl(self, mock_redis, sample_token):
        """Test that TTL is set based on token expiration"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            await JWTBlacklistService.blacklist_token(sample_token)

            token_hash = JWTBlacklistService._hash_token(sample_token)
            key = f"{BLACKLIST_PREFIX}{token_hash}"
            ttl = mock_redis.store[key]["ttl"]

            # TTL should be positive and less than token expiration time
            assert ttl > 0


class TestIsTokenBlacklisted:
    """Tests for checking if token is blacklisted"""

    @pytest.mark.asyncio
    async def test_blacklisted_token_returns_true(self, mock_redis, sample_token):
        """Test that blacklisted token returns True"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            # First blacklist the token
            await JWTBlacklistService.blacklist_token(sample_token)

            # Then check if blacklisted
            result = await JWTBlacklistService.is_token_blacklisted(sample_token)

            assert result is True

    @pytest.mark.asyncio
    async def test_non_blacklisted_token_returns_false(self, mock_redis, sample_token):
        """Test that non-blacklisted token returns False"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result = await JWTBlacklistService.is_token_blacklisted(sample_token)

            assert result is False


class TestRevokeAllUserTokens:
    """Tests for user-wide token revocation"""

    @pytest.mark.asyncio
    async def test_revoke_all_user_tokens(self, mock_redis):
        """Test revoking all tokens for a user"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            user_id = 123
            result = await JWTBlacklistService.revoke_all_user_tokens(user_id)

            assert result is True

            # Check revocation timestamp was stored
            key = f"{USER_REVOKE_PREFIX}{user_id}"
            assert key in mock_redis.store

    @pytest.mark.asyncio
    async def test_revoke_with_custom_time(self, mock_redis):
        """Test revoking with custom revocation time"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            user_id = 456
            custom_time = datetime.now(timezone.utc) - timedelta(hours=1)

            await JWTBlacklistService.revoke_all_user_tokens(user_id, revoke_before=custom_time)

            key = f"{USER_REVOKE_PREFIX}{user_id}"
            stored_timestamp = int(mock_redis.store[key]["value"])
            expected_timestamp = int(custom_time.timestamp())

            assert stored_timestamp == expected_timestamp


class TestIsTokenValidForUser:
    """Tests for checking token validity per user"""

    @pytest.mark.asyncio
    async def test_valid_token_for_user_no_revocation(self, mock_redis, sample_token):
        """Test token is valid when no revocation exists"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result = await JWTBlacklistService.is_token_valid_for_user(sample_token, user_id=1)

            assert result is True

    @pytest.mark.asyncio
    async def test_token_invalid_after_revocation(self, mock_redis):
        """Test token issued before revocation is invalid"""
        import jwt
        from app.config import settings

        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            user_id = 789

            # Create token with iat claim (issued 10 seconds ago)
            past_time = datetime.now(timezone.utc) - timedelta(seconds=10)
            token_data = {
                "sub": "user@example.com",
                "iat": int(past_time.timestamp()),
                "exp": datetime.now(timezone.utc) + timedelta(hours=1)
            }
            token = jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

            # Revoke all tokens issued before now (after the token was issued)
            await JWTBlacklistService.revoke_all_user_tokens(user_id)

            # Token should be invalid (issued before revocation time)
            result = await JWTBlacklistService.is_token_valid_for_user(token, user_id)

            assert result is False


class TestClearUserRevocation:
    """Tests for clearing user revocation"""

    @pytest.mark.asyncio
    async def test_clear_revocation(self, mock_redis):
        """Test clearing user revocation"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            user_id = 999

            # First set revocation
            await JWTBlacklistService.revoke_all_user_tokens(user_id)

            # Verify it exists
            key = f"{USER_REVOKE_PREFIX}{user_id}"
            assert key in mock_redis.store

            # Clear it
            result = await JWTBlacklistService.clear_user_revocation(user_id)

            assert result is True
            assert key not in mock_redis.store

    @pytest.mark.asyncio
    async def test_clear_nonexistent_revocation(self, mock_redis):
        """Test clearing revocation that doesn't exist"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result = await JWTBlacklistService.clear_user_revocation(user_id=9999)

            # Should return False (nothing was deleted)
            assert result is False


class TestMultipleTokens:
    """Tests for handling multiple tokens"""

    @pytest.mark.asyncio
    async def test_blacklist_multiple_tokens(self, mock_redis):
        """Test blacklisting multiple different tokens"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            tokens = [
                create_access_token(data={"sub": f"user{i}@example.com"})
                for i in range(5)
            ]

            for token in tokens:
                await JWTBlacklistService.blacklist_token(token)

            # All should be blacklisted
            for token in tokens:
                result = await JWTBlacklistService.is_token_blacklisted(token)
                assert result is True

    @pytest.mark.asyncio
    async def test_blacklist_same_token_twice(self, mock_redis, sample_token):
        """Test blacklisting same token twice (idempotent)"""
        with patch("app.services.jwt_blacklist.RedisClient.get_instance", new_callable=AsyncMock) as mock_get:
            mock_get.return_value = mock_redis

            result1 = await JWTBlacklistService.blacklist_token(sample_token)
            result2 = await JWTBlacklistService.blacklist_token(sample_token)

            assert result1 is True
            assert result2 is True

            # Should still be blacklisted
            is_blacklisted = await JWTBlacklistService.is_token_blacklisted(sample_token)
            assert is_blacklisted is True
