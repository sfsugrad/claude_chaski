"""
WebSocket Connection Manager for real-time notifications and tracking.

Handles user connections, authentication, and broadcasting messages
to specific users or all connected clients. Supports Redis pub/sub
for horizontal scaling across multiple server instances.
"""
from fastapi import WebSocket
from typing import Dict, List, Optional, Set
import json
import asyncio
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates.

    Maintains a mapping of user_id to their active WebSocket connections.
    A single user can have multiple connections (multiple browser tabs).
    Supports Redis pub/sub for cross-instance communication.
    """

    def __init__(self):
        # user_id -> list of WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}
        # package_id -> set of WebSocket connections (for tracking)
        self.tracking_subscriptions: Dict[int, Set[WebSocket]] = {}
        # websocket -> package_ids being tracked
        self.connection_tracking: Dict[WebSocket, Set[int]] = {}
        # Redis client reference (set during app startup)
        self._redis = None
        # Redis listener task
        self._redis_listener_task: Optional[asyncio.Task] = None

    async def connect(self, websocket: WebSocket, user_id: int):
        """Accept a WebSocket connection and register it for a user."""
        await websocket.accept()

        if user_id not in self.active_connections:
            self.active_connections[user_id] = []

        self.active_connections[user_id].append(websocket)
        logger.info(f"WebSocket connected for user {user_id}. Total connections: {len(self.active_connections[user_id])}")

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Remove a WebSocket connection for a user."""
        if user_id in self.active_connections:
            if websocket in self.active_connections[user_id]:
                self.active_connections[user_id].remove(websocket)
                logger.info(f"WebSocket disconnected for user {user_id}. Remaining: {len(self.active_connections[user_id])}")

            # Clean up empty user entries
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]

        # Clean up tracking subscriptions
        if websocket in self.connection_tracking:
            for package_id in self.connection_tracking[websocket]:
                if package_id in self.tracking_subscriptions:
                    self.tracking_subscriptions[package_id].discard(websocket)
                    if not self.tracking_subscriptions[package_id]:
                        del self.tracking_subscriptions[package_id]
            del self.connection_tracking[websocket]

    async def set_redis(self, redis_client):
        """Set Redis client and start listening for pub/sub messages."""
        self._redis = redis_client
        if self._redis:
            self._redis_listener_task = asyncio.create_task(self._redis_listener())
            logger.info("Redis pub/sub listener started")

    async def stop_redis_listener(self):
        """Stop the Redis listener task."""
        if self._redis_listener_task:
            self._redis_listener_task.cancel()
            try:
                await self._redis_listener_task
            except asyncio.CancelledError:
                pass
            self._redis_listener_task = None

    async def _redis_listener(self):
        """Listen for Redis pub/sub messages and broadcast to local connections."""
        if not self._redis:
            return

        try:
            pubsub = self._redis.client.pubsub()
            # Subscribe to user notification channels and tracking channels
            await pubsub.psubscribe("user:*", "tracking:*")

            async for message in pubsub.listen():
                if message["type"] == "pmessage":
                    await self._handle_redis_message(message)
        except asyncio.CancelledError:
            logger.info("Redis listener cancelled")
        except Exception as e:
            logger.error(f"Redis listener error: {e}")

    async def _handle_redis_message(self, message: dict):
        """Handle a message received from Redis pub/sub."""
        try:
            channel = message["channel"]
            data = json.loads(message["data"]) if isinstance(message["data"], str) else message["data"]

            if channel.startswith("user:"):
                # User-specific message
                user_id = int(channel.split(":")[1])
                await self.send_personal_message(data, user_id)
            elif channel.startswith("tracking:"):
                # Package tracking message
                package_id = int(channel.split(":")[1])
                await self._send_to_tracking_subscribers(package_id, data)
        except Exception as e:
            logger.error(f"Error handling Redis message: {e}")

    async def subscribe_to_tracking(self, websocket: WebSocket, package_id: int):
        """Subscribe a WebSocket connection to package tracking updates."""
        if package_id not in self.tracking_subscriptions:
            self.tracking_subscriptions[package_id] = set()
        self.tracking_subscriptions[package_id].add(websocket)

        if websocket not in self.connection_tracking:
            self.connection_tracking[websocket] = set()
        self.connection_tracking[websocket].add(package_id)

        logger.info(f"WebSocket subscribed to tracking for package {package_id}")

    async def unsubscribe_from_tracking(self, websocket: WebSocket, package_id: int):
        """Unsubscribe a WebSocket connection from package tracking updates."""
        if package_id in self.tracking_subscriptions:
            self.tracking_subscriptions[package_id].discard(websocket)
            if not self.tracking_subscriptions[package_id]:
                del self.tracking_subscriptions[package_id]

        if websocket in self.connection_tracking:
            self.connection_tracking[websocket].discard(package_id)
            if not self.connection_tracking[websocket]:
                del self.connection_tracking[websocket]

        logger.info(f"WebSocket unsubscribed from tracking for package {package_id}")

    async def _send_to_tracking_subscribers(self, package_id: int, message: dict):
        """Send a message to all WebSocket connections tracking a package."""
        if package_id not in self.tracking_subscriptions:
            return

        disconnected = []
        for websocket in self.tracking_subscriptions[package_id]:
            try:
                await websocket.send_json(message)
            except Exception as e:
                logger.warning(f"Failed to send tracking update for package {package_id}: {e}")
                disconnected.append(websocket)

        # Clean up failed connections
        for ws in disconnected:
            self.tracking_subscriptions[package_id].discard(ws)
            if ws in self.connection_tracking:
                self.connection_tracking[ws].discard(package_id)

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to all connections of a specific user."""
        if user_id in self.active_connections:
            disconnected = []
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.warning(f"Failed to send message to user {user_id}: {e}")
                    disconnected.append(connection)

            # Clean up failed connections
            for conn in disconnected:
                self.disconnect(conn, user_id)

    async def broadcast(self, message: dict):
        """Send a message to all connected clients."""
        for user_id in list(self.active_connections.keys()):
            await self.send_personal_message(message, user_id)

    def get_connection_count(self, user_id: Optional[int] = None) -> int:
        """Get the number of active connections."""
        if user_id is not None:
            return len(self.active_connections.get(user_id, []))
        return sum(len(conns) for conns in self.active_connections.values())

    def is_user_connected(self, user_id: int) -> bool:
        """Check if a user has any active WebSocket connections."""
        return user_id in self.active_connections and len(self.active_connections[user_id]) > 0


# Global connection manager instance
manager = ConnectionManager()


async def broadcast_notification(user_id: int, notification_data: dict):
    """
    Broadcast a notification to a specific user via WebSocket.

    Args:
        user_id: The ID of the user to notify
        notification_data: Dict containing notification details
    """
    message = {
        "event_type": "notification_created",
        "notification": notification_data
    }
    await manager.send_personal_message(message, user_id)


async def broadcast_unread_count(user_id: int, count: int):
    """
    Broadcast updated unread notification count to a user.

    Args:
        user_id: The ID of the user
        count: The new unread count
    """
    message = {
        "event_type": "unread_count_updated",
        "count": count
    }
    await manager.send_personal_message(message, user_id)


async def broadcast_package_update(user_id: int, package_data: dict):
    """
    Broadcast a package status update to a user.

    Args:
        user_id: The ID of the user to notify
        package_data: Dict containing package details
    """
    message = {
        "event_type": "package_updated",
        "package": package_data
    }
    await manager.send_personal_message(message, user_id)


async def broadcast_message(user_id: int, message_data: dict):
    """
    Broadcast a chat message to a user via WebSocket.

    Args:
        user_id: The ID of the user to notify
        message_data: Dict containing message details
    """
    message = {
        "event_type": "message_received",
        "message": message_data
    }
    await manager.send_personal_message(message, user_id)


async def broadcast_location_update(package_id: int, location_data: dict):
    """
    Broadcast a location update for a package being tracked.

    Args:
        package_id: The ID of the package being tracked
        location_data: Dict containing location details (lat, lng, heading, speed, eta)
    """
    message = {
        "event_type": "location_update",
        "package_id": package_id,
        "location": location_data
    }
    await manager._send_to_tracking_subscribers(package_id, message)


async def broadcast_tracking_event(package_id: int, event_data: dict):
    """
    Broadcast a tracking event (pickup, delivery, delay, etc.) for a package.

    Args:
        package_id: The ID of the package
        event_data: Dict containing event details
    """
    message = {
        "event_type": "tracking_event",
        "package_id": package_id,
        "event": event_data
    }
    await manager._send_to_tracking_subscribers(package_id, message)


async def broadcast_eta_update(package_id: int, eta_data: dict):
    """
    Broadcast an ETA update for a package being tracked.

    Args:
        package_id: The ID of the package
        eta_data: Dict containing ETA details
    """
    message = {
        "event_type": "eta_update",
        "package_id": package_id,
        "eta": eta_data
    }
    await manager._send_to_tracking_subscribers(package_id, message)
