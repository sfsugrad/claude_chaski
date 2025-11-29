"""Tests for WebSocket real-time updates functionality."""

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.utils.auth import get_password_hash, create_access_token
from app.routes.ws import set_test_db_session


@pytest.fixture(autouse=True)
def setup_websocket_db(db_session):
    """Set up test database session for WebSocket handlers."""
    set_test_db_session(db_session)
    yield
    set_test_db_session(None)


class TestWebSocketConnection:
    """Test WebSocket connection and authentication."""

    def test_websocket_connection_without_token(self, client):
        """WebSocket connection should be rejected without token."""
        with pytest.raises(Exception):
            with client.websocket_connect("/api/ws"):
                pass

    def test_websocket_connection_with_invalid_token(self, client):
        """WebSocket connection should be rejected with invalid token."""
        with pytest.raises(Exception):
            with client.websocket_connect("/api/ws?token=invalid_token"):
                pass

    def test_websocket_connection_with_valid_token(self, client, db_session):
        """WebSocket connection should be accepted with valid token."""
        # Create a user
        user = User(
            email="wstest@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="WS Test User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(user)
        db_session.commit()

        # Create a valid token
        token = create_access_token(data={"sub": user.email})

        # Connect to WebSocket
        with client.websocket_connect(f"/api/ws?token={token}") as websocket:
            # Connection should be established - first message is the connected confirmation
            connected_msg = websocket.receive_json()
            assert connected_msg["event_type"] == "connected"

            # Send a ping to verify connection is working
            websocket.send_json({"action": "ping"})
            data = websocket.receive_json()
            assert data["event_type"] == "pong"


class TestWebSocketMessages:
    """Test WebSocket message handling."""

    @pytest.fixture
    def connected_websocket(self, client, db_session):
        """Create a connected WebSocket for testing."""
        user = User(
            email="wsmsg@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="WS Message User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        token = create_access_token(data={"sub": user.email})

        return {
            "user": user,
            "token": token,
            "client": client
        }

    def test_ping_pong(self, connected_websocket):
        """WebSocket should respond to ping with pong."""
        token = connected_websocket["token"]
        client = connected_websocket["client"]

        with client.websocket_connect(f"/api/ws?token={token}") as websocket:
            # Skip the initial "connected" message
            websocket.receive_json()

            websocket.send_json({"action": "ping"})
            data = websocket.receive_json()
            assert data["event_type"] == "pong"

    def test_get_unread_count(self, connected_websocket, db_session):
        """WebSocket should return unread notification count."""
        user = connected_websocket["user"]
        token = connected_websocket["token"]
        client = connected_websocket["client"]

        # Create some unread notifications
        for i in range(3):
            notification = Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Test notification {i}",
                read=False
            )
            db_session.add(notification)
        db_session.commit()

        with client.websocket_connect(f"/api/ws?token={token}") as websocket:
            # Skip the initial "connected" message
            websocket.receive_json()

            websocket.send_json({"action": "get_unread_count"})
            data = websocket.receive_json()
            assert data["event_type"] == "unread_count_updated"
            assert data["count"] == 3

    def test_mark_notification_read(self, connected_websocket, db_session):
        """WebSocket should mark notification as read."""
        user = connected_websocket["user"]
        token = connected_websocket["token"]
        client = connected_websocket["client"]

        # Create an unread notification
        notification = Notification(
            user_id=user.id,
            type=NotificationType.SYSTEM,
            message="Test notification",
            read=False
        )
        db_session.add(notification)
        db_session.commit()
        db_session.refresh(notification)

        with client.websocket_connect(f"/api/ws?token={token}") as websocket:
            # Skip the initial "connected" message
            websocket.receive_json()

            websocket.send_json({
                "action": "mark_read",
                "notification_id": notification.id
            })
            # Wait for response
            data = websocket.receive_json()
            assert data["event_type"] == "notification_marked_read"

            # The notification should now be marked as read
            db_session.refresh(notification)
            assert notification.read is True


class TestConnectionManager:
    """Test the WebSocket connection manager."""

    def test_multiple_connections_same_user(self, client, db_session):
        """User can have multiple WebSocket connections."""
        user = User(
            email="multiconn@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Multi Connection User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(user)
        db_session.commit()

        token = create_access_token(data={"sub": user.email})

        # Open first connection
        with client.websocket_connect(f"/api/ws?token={token}") as ws1:
            # Skip initial "connected" message
            ws1.receive_json()

            ws1.send_json({"action": "ping"})
            data1 = ws1.receive_json()
            assert data1["event_type"] == "pong"

            # Open second connection (same user)
            with client.websocket_connect(f"/api/ws?token={token}") as ws2:
                # Skip initial "connected" message
                ws2.receive_json()

                ws2.send_json({"action": "ping"})
                data2 = ws2.receive_json()
                assert data2["event_type"] == "pong"

                # Both connections should be working
                ws1.send_json({"action": "ping"})
                data1 = ws1.receive_json()
                assert data1["event_type"] == "pong"


class TestWebSocketBroadcast:
    """Test notification broadcasting via WebSocket."""

    def test_broadcast_notification_imports(self):
        """Test that broadcast functions can be imported."""
        from app.services.websocket_manager import (
            broadcast_notification,
            broadcast_unread_count,
            manager
        )
        assert broadcast_notification is not None
        assert broadcast_unread_count is not None
        assert manager is not None

    def test_notification_with_broadcast_function(self):
        """Test that create_notification_with_broadcast function exists."""
        from app.routes.notifications import create_notification_with_broadcast
        assert create_notification_with_broadcast is not None


class TestWebSocketManagerUnit:
    """Unit tests for the WebSocket connection manager."""

    def test_connection_manager_initialization(self):
        """Test ConnectionManager initializes correctly."""
        from app.services.websocket_manager import ConnectionManager
        cm = ConnectionManager()
        assert cm.active_connections == {}

    def test_connection_manager_disconnect_nonexistent(self):
        """Test disconnect handles non-existent connections gracefully."""
        from app.services.websocket_manager import ConnectionManager
        from unittest.mock import MagicMock

        cm = ConnectionManager()
        mock_ws = MagicMock()

        # Should not raise exception
        cm.disconnect(mock_ws, user_id=999)

    def test_connection_manager_send_to_nonexistent_user(self):
        """Test sending message to non-connected user doesn't raise."""
        from app.services.websocket_manager import ConnectionManager
        import asyncio

        cm = ConnectionManager()

        async def test():
            # Should not raise exception
            await cm.send_personal_message({"test": "message"}, user_id=999)

        asyncio.run(test())
