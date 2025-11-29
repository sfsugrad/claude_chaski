"""
Tests for Redis client service.

Tests cover:
- RedisClient singleton pattern
- Basic cache operations (get, set, delete, exists)
- JSON operations
- Pub/Sub operations
- Location caching
- Analytics caching
"""

import pytest
import json
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.redis_client import RedisClient


class MockRedisConnection:
    """Mock Redis client for testing."""

    def __init__(self):
        self.store = {}
        self.pubsub_instance = MagicMock()

    async def get(self, key: str):
        return self.store.get(key)

    async def set(self, key: str, value: str):
        self.store[key] = value
        return True

    async def setex(self, key: str, ttl: int, value: str):
        self.store[key] = value
        return True

    async def delete(self, key: str):
        if key in self.store:
            del self.store[key]
            return 1
        return 0

    async def exists(self, key: str):
        return 1 if key in self.store else 0

    async def publish(self, channel: str, message: str):
        return 1

    def pubsub(self):
        return self.pubsub_instance

    async def close(self):
        pass


@pytest.fixture
def mock_redis():
    """Create a mock Redis connection."""
    return MockRedisConnection()


@pytest.fixture
def redis_client(mock_redis):
    """Create a RedisClient with mock connection."""
    client = RedisClient()
    client._client = mock_redis
    return client


class TestRedisClientBasicOperations:
    """Tests for basic cache operations."""

    @pytest.mark.asyncio
    async def test_set_and_get(self, redis_client, mock_redis):
        """Test setting and getting a value."""
        result = await redis_client.set("test_key", "test_value")
        assert result is True

        value = await redis_client.get("test_key")
        assert value == "test_value"

    @pytest.mark.asyncio
    async def test_set_with_ttl(self, redis_client, mock_redis):
        """Test setting a value with TTL."""
        result = await redis_client.set("ttl_key", "ttl_value", ttl=3600)
        assert result is True

        value = await redis_client.get("ttl_key")
        assert value == "ttl_value"

    @pytest.mark.asyncio
    async def test_get_nonexistent_key(self, redis_client, mock_redis):
        """Test getting a non-existent key returns None."""
        value = await redis_client.get("nonexistent")
        assert value is None

    @pytest.mark.asyncio
    async def test_delete_key(self, redis_client, mock_redis):
        """Test deleting a key."""
        await redis_client.set("delete_me", "value")
        result = await redis_client.delete("delete_me")
        assert result == 1

        value = await redis_client.get("delete_me")
        assert value is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_key(self, redis_client, mock_redis):
        """Test deleting a non-existent key."""
        result = await redis_client.delete("nonexistent")
        assert result == 0

    @pytest.mark.asyncio
    async def test_exists_true(self, redis_client, mock_redis):
        """Test exists returns True for existing key."""
        await redis_client.set("exists_key", "value")
        result = await redis_client.exists("exists_key")
        assert result is True

    @pytest.mark.asyncio
    async def test_exists_false(self, redis_client, mock_redis):
        """Test exists returns False for non-existing key."""
        result = await redis_client.exists("nonexistent")
        assert result is False


class TestRedisClientJSONOperations:
    """Tests for JSON operations."""

    @pytest.mark.asyncio
    async def test_set_and_get_json(self, redis_client, mock_redis):
        """Test setting and getting JSON data."""
        data = {"name": "test", "count": 42, "active": True}
        result = await redis_client.set_json("json_key", data)
        assert result is True

        retrieved = await redis_client.get_json("json_key")
        assert retrieved == data

    @pytest.mark.asyncio
    async def test_set_json_with_ttl(self, redis_client, mock_redis):
        """Test setting JSON data with TTL."""
        data = {"items": [1, 2, 3]}
        result = await redis_client.set_json("json_ttl_key", data, ttl=300)
        assert result is True

    @pytest.mark.asyncio
    async def test_get_json_nonexistent(self, redis_client, mock_redis):
        """Test getting non-existent JSON returns None."""
        result = await redis_client.get_json("nonexistent_json")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_json_complex_structure(self, redis_client, mock_redis):
        """Test JSON with nested structures."""
        data = {
            "user": {
                "id": 1,
                "name": "Test User",
                "preferences": {
                    "theme": "dark",
                    "notifications": True
                }
            },
            "packages": [1, 2, 3]
        }
        await redis_client.set_json("complex_key", data)
        retrieved = await redis_client.get_json("complex_key")
        assert retrieved == data


class TestRedisClientLocationOperations:
    """Tests for courier location operations."""

    @pytest.mark.asyncio
    async def test_set_courier_location(self, redis_client, mock_redis):
        """Test setting courier location."""
        location = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timestamp": "2024-01-15T10:30:00Z"
        }

        with patch.object(redis_client, 'set_json', new_callable=AsyncMock, return_value=True):
            result = await redis_client.set_courier_location(123, location)
            assert result is True

    @pytest.mark.asyncio
    async def test_get_courier_location(self, redis_client, mock_redis):
        """Test getting courier location."""
        location = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timestamp": "2024-01-15T10:30:00Z"
        }

        with patch.object(redis_client, 'get_json', new_callable=AsyncMock, return_value=location):
            result = await redis_client.get_courier_location(123)
            assert result == location

    @pytest.mark.asyncio
    async def test_get_courier_location_not_found(self, redis_client, mock_redis):
        """Test getting non-existent courier location."""
        with patch.object(redis_client, 'get_json', new_callable=AsyncMock, return_value=None):
            result = await redis_client.get_courier_location(999)
            assert result is None


class TestRedisClientAnalytics:
    """Tests for analytics caching."""

    @pytest.mark.asyncio
    async def test_cache_analytics(self, redis_client, mock_redis):
        """Test caching analytics data."""
        analytics = {
            "total_packages": 100,
            "active_couriers": 25,
            "deliveries_today": 15
        }

        with patch.object(redis_client, 'set_json', new_callable=AsyncMock, return_value=True):
            result = await redis_client.cache_analytics("dashboard", analytics)
            assert result is True

    @pytest.mark.asyncio
    async def test_get_cached_analytics(self, redis_client, mock_redis):
        """Test getting cached analytics."""
        analytics = {
            "total_packages": 100,
            "active_couriers": 25
        }

        with patch.object(redis_client, 'get_json', new_callable=AsyncMock, return_value=analytics):
            result = await redis_client.get_cached_analytics("dashboard")
            assert result == analytics

    @pytest.mark.asyncio
    async def test_get_cached_analytics_miss(self, redis_client, mock_redis):
        """Test cache miss for analytics."""
        with patch.object(redis_client, 'get_json', new_callable=AsyncMock, return_value=None):
            result = await redis_client.get_cached_analytics("nonexistent")
            assert result is None


class TestRedisClientPubSub:
    """Tests for Pub/Sub operations."""

    @pytest.mark.asyncio
    async def test_publish_string_message(self, redis_client, mock_redis):
        """Test publishing a string message."""
        result = await redis_client.publish("test_channel", "test_message")
        assert result == 1

    @pytest.mark.asyncio
    async def test_publish_dict_message(self, redis_client, mock_redis):
        """Test publishing a dict message (serialized to JSON)."""
        message = {"event": "location_update", "data": {"lat": 40.7}}
        result = await redis_client.publish("test_channel", message)
        assert result == 1

    @pytest.mark.asyncio
    async def test_publish_list_message(self, redis_client, mock_redis):
        """Test publishing a list message (serialized to JSON)."""
        message = [1, 2, 3, "test"]
        result = await redis_client.publish("test_channel", message)
        assert result == 1

    @pytest.mark.asyncio
    async def test_publish_location_update(self, redis_client, mock_redis):
        """Test publishing location update for package tracking."""
        location = {
            "latitude": 40.7128,
            "longitude": -74.0060,
            "timestamp": "2024-01-15T10:30:00Z"
        }
        result = await redis_client.publish_location_update(package_id=123, location=location)
        assert result == 1


class TestRedisClientClientProperty:
    """Tests for client property access."""

    def test_client_property_raises_when_not_connected(self):
        """Test that accessing client raises error when not connected."""
        client = RedisClient()
        # Don't connect

        with pytest.raises(RuntimeError, match="not connected"):
            _ = client.client

    def test_client_property_returns_client_when_connected(self, redis_client, mock_redis):
        """Test that client property returns the Redis client."""
        assert redis_client.client is mock_redis


class TestRedisClientSingleton:
    """Tests for singleton pattern."""

    @pytest.mark.asyncio
    async def test_get_instance_creates_singleton(self):
        """Test that get_instance creates a singleton."""
        # Reset the singleton
        RedisClient._instance = None
        RedisClient._pool = None

        with patch.object(RedisClient, 'connect', new_callable=AsyncMock):
            instance1 = await RedisClient.get_instance()
            instance2 = await RedisClient.get_instance()

            assert instance1 is instance2

        # Clean up
        RedisClient._instance = None
        RedisClient._pool = None
