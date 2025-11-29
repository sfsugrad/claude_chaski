"""
Redis client service for caching, pub/sub, and real-time features.
"""
import json
from typing import Any, Optional
from contextlib import asynccontextmanager

import redis.asyncio as redis
from redis.asyncio import Redis

from app.config import settings


class RedisClient:
    """Async Redis client wrapper with connection pooling."""

    _instance: Optional["RedisClient"] = None
    _pool: Optional[redis.ConnectionPool] = None

    def __init__(self):
        self._client: Optional[Redis] = None
        self._pubsub: Optional[redis.client.PubSub] = None

    @classmethod
    async def get_instance(cls) -> "RedisClient":
        """Get singleton instance of RedisClient."""
        if cls._instance is None:
            cls._instance = cls()
            await cls._instance.connect()
        return cls._instance

    async def connect(self) -> None:
        """Initialize Redis connection pool."""
        if self._pool is None:
            self._pool = redis.ConnectionPool.from_url(
                settings.REDIS_URL,
                max_connections=20,
                decode_responses=True
            )
        self._client = redis.Redis(connection_pool=self._pool)

    async def disconnect(self) -> None:
        """Close Redis connection."""
        if self._pubsub:
            await self._pubsub.close()
        if self._client:
            await self._client.close()
        if self._pool:
            await self._pool.disconnect()

    @property
    def client(self) -> Redis:
        """Get the Redis client instance."""
        if self._client is None:
            raise RuntimeError("Redis client not connected. Call connect() first.")
        return self._client

    # Basic cache operations
    async def get(self, key: str) -> Optional[str]:
        """Get value from cache."""
        return await self.client.get(key)

    async def set(
        self,
        key: str,
        value: str,
        ttl: Optional[int] = None
    ) -> bool:
        """Set value in cache with optional TTL."""
        if ttl:
            return await self.client.setex(key, ttl, value)
        return await self.client.set(key, value)

    async def delete(self, key: str) -> int:
        """Delete key from cache."""
        return await self.client.delete(key)

    async def exists(self, key: str) -> bool:
        """Check if key exists."""
        return await self.client.exists(key) > 0

    async def expire(self, key: str, ttl: int) -> bool:
        """Set TTL on a key."""
        return await self.client.expire(key, ttl)

    # Hash operations
    async def hset(self, key: str, mapping: dict) -> int:
        """Set multiple hash fields."""
        return await self.client.hset(key, mapping=mapping)

    async def hget(self, key: str, field: str) -> Optional[str]:
        """Get a hash field value."""
        return await self.client.hget(key, field)

    async def hgetall(self, key: str) -> dict:
        """Get all hash fields and values."""
        return await self.client.hgetall(key)

    async def hdel(self, key: str, *fields: str) -> int:
        """Delete hash fields."""
        return await self.client.hdel(key, *fields)

    # Set operations
    async def sadd(self, key: str, *members: str) -> int:
        """Add members to a set."""
        return await self.client.sadd(key, *members)

    async def srem(self, key: str, *members: str) -> int:
        """Remove members from a set."""
        return await self.client.srem(key, *members)

    async def smembers(self, key: str) -> set:
        """Get all members of a set."""
        return await self.client.smembers(key)

    async def sismember(self, key: str, member: str) -> bool:
        """Check if member is in set."""
        return await self.client.sismember(key, member)

    # JSON operations
    async def get_json(self, key: str) -> Optional[Any]:
        """Get and deserialize JSON value."""
        value = await self.get(key)
        if value:
            return json.loads(value)
        return None

    async def set_json(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None
    ) -> bool:
        """Serialize and set JSON value."""
        return await self.set(key, json.dumps(value), ttl)

    # Pub/Sub operations
    async def publish(self, channel: str, message: Any) -> int:
        """Publish message to channel."""
        if isinstance(message, (dict, list)):
            message = json.dumps(message)
        return await self.client.publish(channel, message)

    async def subscribe(self, *channels: str) -> redis.client.PubSub:
        """Subscribe to channels and return PubSub instance."""
        if self._pubsub is None:
            self._pubsub = self.client.pubsub()
        await self._pubsub.subscribe(*channels)
        return self._pubsub

    async def unsubscribe(self, *channels: str) -> None:
        """Unsubscribe from channels."""
        if self._pubsub:
            await self._pubsub.unsubscribe(*channels)

    @asynccontextmanager
    async def pubsub_listener(self, *channels: str):
        """Context manager for pub/sub listening."""
        pubsub = await self.subscribe(*channels)
        try:
            yield pubsub
        finally:
            await self.unsubscribe(*channels)

    # Location-specific operations
    async def set_courier_location(
        self,
        courier_id: int,
        location: dict
    ) -> bool:
        """Cache courier's current location."""
        key = f"location:courier:{courier_id}"
        return await self.set_json(key, location, settings.REDIS_LOCATION_TTL)

    async def get_courier_location(self, courier_id: int) -> Optional[dict]:
        """Get courier's cached location."""
        key = f"location:courier:{courier_id}"
        return await self.get_json(key)

    async def publish_location_update(
        self,
        package_id: int,
        location: dict
    ) -> int:
        """Publish location update for package tracking."""
        channel = f"tracking:{package_id}"
        return await self.publish(channel, location)

    # Analytics caching
    async def cache_analytics(
        self,
        key: str,
        data: dict,
        ttl: int = 300
    ) -> bool:
        """Cache analytics data with default 5-minute TTL."""
        cache_key = f"analytics:{key}"
        return await self.set_json(cache_key, data, ttl)

    async def get_cached_analytics(self, key: str) -> Optional[dict]:
        """Get cached analytics data."""
        cache_key = f"analytics:{key}"
        return await self.get_json(cache_key)


# Dependency for FastAPI
async def get_redis() -> RedisClient:
    """FastAPI dependency for Redis client."""
    return await RedisClient.get_instance()


# Startup/shutdown handlers
async def init_redis() -> RedisClient:
    """Initialize Redis on app startup."""
    client = await RedisClient.get_instance()
    return client


async def close_redis() -> None:
    """Close Redis on app shutdown."""
    if RedisClient._instance:
        await RedisClient._instance.disconnect()
        RedisClient._instance = None
        RedisClient._pool = None
