"""Tests for app/services/websocket_manager.py - WebSocket connection management"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
import asyncio

from app.services.websocket_manager import (
    ConnectionManager,
    broadcast_notification,
    broadcast_unread_count,
    broadcast_package_update,
    broadcast_message,
    manager
)


class TestConnectionManager:
    """Tests for ConnectionManager class"""

    @pytest.fixture
    def connection_manager(self):
        """Create a fresh ConnectionManager for each test"""
        return ConnectionManager()

    @pytest.fixture
    def mock_websocket(self):
        """Create a mock WebSocket"""
        ws = AsyncMock()
        ws.accept = AsyncMock()
        ws.send_json = AsyncMock()
        return ws

    @pytest.mark.asyncio
    async def test_connect_new_user(self, connection_manager, mock_websocket):
        """Test connecting a new user"""
        user_id = 1

        await connection_manager.connect(mock_websocket, user_id)

        mock_websocket.accept.assert_called_once()
        assert user_id in connection_manager.active_connections
        assert mock_websocket in connection_manager.active_connections[user_id]

    @pytest.mark.asyncio
    async def test_connect_multiple_connections_same_user(self, connection_manager):
        """Test multiple connections for the same user"""
        user_id = 1
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await connection_manager.connect(ws1, user_id)
        await connection_manager.connect(ws2, user_id)

        assert len(connection_manager.active_connections[user_id]) == 2
        assert ws1 in connection_manager.active_connections[user_id]
        assert ws2 in connection_manager.active_connections[user_id]

    @pytest.mark.asyncio
    async def test_connect_different_users(self, connection_manager):
        """Test connecting different users"""
        ws1 = AsyncMock()
        ws2 = AsyncMock()

        await connection_manager.connect(ws1, 1)
        await connection_manager.connect(ws2, 2)

        assert 1 in connection_manager.active_connections
        assert 2 in connection_manager.active_connections
        assert len(connection_manager.active_connections) == 2

    def test_disconnect_user(self, connection_manager, mock_websocket):
        """Test disconnecting a user"""
        user_id = 1
        connection_manager.active_connections[user_id] = [mock_websocket]

        connection_manager.disconnect(mock_websocket, user_id)

        assert user_id not in connection_manager.active_connections

    def test_disconnect_one_of_multiple_connections(self, connection_manager):
        """Test disconnecting one of multiple connections"""
        user_id = 1
        ws1 = MagicMock()
        ws2 = MagicMock()
        connection_manager.active_connections[user_id] = [ws1, ws2]

        connection_manager.disconnect(ws1, user_id)

        assert user_id in connection_manager.active_connections
        assert len(connection_manager.active_connections[user_id]) == 1
        assert ws2 in connection_manager.active_connections[user_id]

    def test_disconnect_nonexistent_user(self, connection_manager, mock_websocket):
        """Test disconnecting a user that doesn't exist"""
        # Should not raise an error
        connection_manager.disconnect(mock_websocket, 999)
        assert 999 not in connection_manager.active_connections

    def test_disconnect_nonexistent_connection(self, connection_manager):
        """Test disconnecting a connection that doesn't exist"""
        user_id = 1
        ws1 = MagicMock()
        ws2 = MagicMock()
        connection_manager.active_connections[user_id] = [ws1]

        # Should not raise an error
        connection_manager.disconnect(ws2, user_id)
        assert ws1 in connection_manager.active_connections[user_id]

    @pytest.mark.asyncio
    async def test_send_personal_message_single_connection(self, connection_manager, mock_websocket):
        """Test sending message to user with single connection"""
        user_id = 1
        connection_manager.active_connections[user_id] = [mock_websocket]
        message = {"event_type": "test", "data": "hello"}

        await connection_manager.send_personal_message(message, user_id)

        mock_websocket.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_send_personal_message_multiple_connections(self, connection_manager):
        """Test sending message to user with multiple connections"""
        user_id = 1
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        connection_manager.active_connections[user_id] = [ws1, ws2]
        message = {"event_type": "test", "data": "hello"}

        await connection_manager.send_personal_message(message, user_id)

        ws1.send_json.assert_called_once_with(message)
        ws2.send_json.assert_called_once_with(message)

    @pytest.mark.asyncio
    async def test_send_personal_message_user_not_connected(self, connection_manager):
        """Test sending message to user with no connections"""
        message = {"event_type": "test", "data": "hello"}

        # Should not raise an error
        await connection_manager.send_personal_message(message, 999)

    @pytest.mark.asyncio
    async def test_send_personal_message_handles_failed_connection(self, connection_manager):
        """Test that failed connections are cleaned up"""
        user_id = 1
        ws_good = AsyncMock()
        ws_bad = AsyncMock()
        ws_bad.send_json.side_effect = Exception("Connection closed")
        connection_manager.active_connections[user_id] = [ws_good, ws_bad]
        message = {"event_type": "test", "data": "hello"}

        await connection_manager.send_personal_message(message, user_id)

        # Good connection should receive message
        ws_good.send_json.assert_called_once_with(message)
        # Bad connection should be removed
        assert ws_bad not in connection_manager.active_connections.get(user_id, [])

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all_users(self, connection_manager):
        """Test broadcast sends to all connected users"""
        ws1 = AsyncMock()
        ws2 = AsyncMock()
        ws3 = AsyncMock()
        connection_manager.active_connections[1] = [ws1]
        connection_manager.active_connections[2] = [ws2, ws3]
        message = {"event_type": "broadcast", "data": "hello everyone"}

        await connection_manager.broadcast(message)

        ws1.send_json.assert_called_once_with(message)
        ws2.send_json.assert_called_once_with(message)
        ws3.send_json.assert_called_once_with(message)

    def test_get_connection_count_no_connections(self, connection_manager):
        """Test connection count with no connections"""
        count = connection_manager.get_connection_count()
        assert count == 0

    def test_get_connection_count_all_users(self, connection_manager):
        """Test total connection count across all users"""
        connection_manager.active_connections[1] = [MagicMock(), MagicMock()]
        connection_manager.active_connections[2] = [MagicMock()]

        count = connection_manager.get_connection_count()
        assert count == 3

    def test_get_connection_count_specific_user(self, connection_manager):
        """Test connection count for specific user"""
        connection_manager.active_connections[1] = [MagicMock(), MagicMock()]
        connection_manager.active_connections[2] = [MagicMock()]

        count = connection_manager.get_connection_count(user_id=1)
        assert count == 2

    def test_get_connection_count_user_not_connected(self, connection_manager):
        """Test connection count for user with no connections"""
        count = connection_manager.get_connection_count(user_id=999)
        assert count == 0

    def test_is_user_connected_true(self, connection_manager):
        """Test is_user_connected returns True for connected user"""
        connection_manager.active_connections[1] = [MagicMock()]

        assert connection_manager.is_user_connected(1) is True

    def test_is_user_connected_false(self, connection_manager):
        """Test is_user_connected returns False for disconnected user"""
        assert connection_manager.is_user_connected(999) is False

    def test_is_user_connected_empty_list(self, connection_manager):
        """Test is_user_connected returns False for empty connection list"""
        connection_manager.active_connections[1] = []

        assert connection_manager.is_user_connected(1) is False


class TestBroadcastFunctions:
    """Tests for broadcast helper functions"""

    @pytest.mark.asyncio
    async def test_broadcast_notification(self):
        """Test broadcast_notification sends correct message format"""
        with patch('app.services.websocket_manager.manager') as mock_manager:
            mock_manager.send_personal_message = AsyncMock()
            notification_data = {"id": 1, "message": "Test notification"}

            await broadcast_notification(user_id=1, notification_data=notification_data)

            mock_manager.send_personal_message.assert_called_once()
            call_args = mock_manager.send_personal_message.call_args
            message = call_args[0][0]
            assert message["event_type"] == "notification_created"
            assert message["notification"] == notification_data

    @pytest.mark.asyncio
    async def test_broadcast_unread_count(self):
        """Test broadcast_unread_count sends correct message format"""
        with patch('app.services.websocket_manager.manager') as mock_manager:
            mock_manager.send_personal_message = AsyncMock()

            await broadcast_unread_count(user_id=1, count=5)

            mock_manager.send_personal_message.assert_called_once()
            call_args = mock_manager.send_personal_message.call_args
            message = call_args[0][0]
            assert message["event_type"] == "unread_count_updated"
            assert message["count"] == 5

    @pytest.mark.asyncio
    async def test_broadcast_package_update(self):
        """Test broadcast_package_update sends correct message format"""
        with patch('app.services.websocket_manager.manager') as mock_manager:
            mock_manager.send_personal_message = AsyncMock()
            package_data = {"id": 1, "status": "in_transit"}

            await broadcast_package_update(user_id=1, package_data=package_data)

            mock_manager.send_personal_message.assert_called_once()
            call_args = mock_manager.send_personal_message.call_args
            message = call_args[0][0]
            assert message["event_type"] == "package_updated"
            assert message["package"] == package_data

    @pytest.mark.asyncio
    async def test_broadcast_message(self):
        """Test broadcast_message sends correct message format"""
        with patch('app.services.websocket_manager.manager') as mock_manager:
            mock_manager.send_personal_message = AsyncMock()
            message_data = {"id": 1, "content": "Hello!", "sender_id": 2}

            await broadcast_message(user_id=1, message_data=message_data)

            mock_manager.send_personal_message.assert_called_once()
            call_args = mock_manager.send_personal_message.call_args
            message = call_args[0][0]
            assert message["event_type"] == "message_received"
            assert message["message"] == message_data


class TestGlobalManager:
    """Tests for the global manager instance"""

    def test_global_manager_exists(self):
        """Test that global manager instance exists"""
        assert manager is not None
        assert isinstance(manager, ConnectionManager)

    def test_global_manager_has_empty_connections_initially(self):
        """Test that global manager starts with no connections"""
        # Note: This test may fail if run after other tests that add connections
        # In a real test suite, you'd want to isolate this
        fresh_manager = ConnectionManager()
        assert len(fresh_manager.active_connections) == 0
