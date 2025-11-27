"""
WebSocket Connection Manager for real-time notifications.

Handles user connections, authentication, and broadcasting messages
to specific users or all connected clients.
"""
from fastapi import WebSocket
from typing import Dict, List, Optional
import json
import logging

logger = logging.getLogger(__name__)


class ConnectionManager:
    """
    Manages WebSocket connections for real-time updates.

    Maintains a mapping of user_id to their active WebSocket connections.
    A single user can have multiple connections (multiple browser tabs).
    """

    def __init__(self):
        # user_id -> list of WebSocket connections
        self.active_connections: Dict[int, List[WebSocket]] = {}

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
