"""
WebSocket endpoint for real-time notifications and updates.

Provides authenticated WebSocket connections for:
- Real-time notification delivery
- Package status updates
- Matching event notifications
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query, status, Depends
from sqlalchemy.orm import Session
from jose import jwt, JWTError
import asyncio
import logging

from app.config import settings
from app.database import get_db
from app.services.websocket_manager import manager

router = APIRouter()
logger = logging.getLogger(__name__)

# Store for dependency-injected database session
_test_db_session = None


def set_test_db_session(db: Session | None):
    """Set a test database session for WebSocket tests."""
    global _test_db_session
    _test_db_session = db


def get_websocket_db() -> Session:
    """Get database session for WebSocket handlers."""
    global _test_db_session
    if _test_db_session is not None:
        return _test_db_session

    from app.database import SessionLocal
    return SessionLocal()


async def get_user_from_token(token: str) -> int | None:
    """
    Validate JWT token and extract user_id.

    Args:
        token: JWT access token

    Returns:
        user_id if valid, None otherwise
    """
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        email: str = payload.get("sub")
        if email is None:
            return None

        # We need to get user_id from email
        from app.models.user import User

        db = get_websocket_db()
        try:
            user = db.query(User).filter(User.email == email).first()
            if user and user.is_active:
                return user.id
            return None
        finally:
            if _test_db_session is None:
                db.close()

    except JWTError as e:
        logger.warning(f"WebSocket JWT validation failed: {e}")
        return None


@router.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(None)
):
    """
    WebSocket endpoint for real-time updates.

    Connection URL: ws://localhost:8000/api/ws?token=<jwt_token>

    Events sent to client:
    - notification_created: New notification
    - unread_count_updated: Updated unread count
    - package_updated: Package status change
    - ping: Keepalive (every 30 seconds)

    Events received from client:
    - pong: Response to ping
    - mark_read: Mark notification as read
    """
    # Validate token before accepting connection
    if not token:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    user_id = await get_user_from_token(token)
    if not user_id:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Accept connection and register user
    await manager.connect(websocket, user_id)

    try:
        # Send initial connection confirmation
        await websocket.send_json({
            "event_type": "connected",
            "user_id": user_id,
            "message": "WebSocket connection established"
        })

        # Start ping task to keep connection alive
        ping_task = asyncio.create_task(send_periodic_ping(websocket))

        try:
            while True:
                # Wait for messages from client
                data = await websocket.receive_json()
                await handle_client_message(websocket, user_id, data)

        except WebSocketDisconnect:
            logger.info(f"WebSocket disconnected for user {user_id}")
        finally:
            ping_task.cancel()

    except Exception as e:
        logger.error(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(websocket, user_id)


async def send_periodic_ping(websocket: WebSocket):
    """Send ping messages every 30 seconds to keep connection alive."""
    try:
        while True:
            await asyncio.sleep(30)
            try:
                await websocket.send_json({"event_type": "ping"})
            except Exception:
                break
    except asyncio.CancelledError:
        pass


async def handle_client_message(websocket: WebSocket, user_id: int, data: dict):
    """
    Handle incoming messages from the client.

    Args:
        websocket: The WebSocket connection
        user_id: The authenticated user's ID
        data: The received message data
    """
    # Support both "action" and "event_type" keys for flexibility
    action = data.get("action") or data.get("event_type")

    if action == "pong":
        # Keepalive response, no action needed
        pass

    elif action == "ping":
        # Client ping, respond with pong
        await websocket.send_json({"event_type": "pong"})

    elif action == "mark_read":
        # Mark a notification as read
        notification_id = data.get("notification_id")
        if notification_id:
            from app.models.notification import Notification

            db = get_websocket_db()
            try:
                notification = db.query(Notification).filter(
                    Notification.id == notification_id,
                    Notification.user_id == user_id
                ).first()

                if notification:
                    notification.read = True
                    db.commit()

                    # Broadcast updated unread count
                    unread_count = db.query(Notification).filter(
                        Notification.user_id == user_id,
                        Notification.read == False
                    ).count()

                    await websocket.send_json({
                        "event_type": "notification_marked_read",
                        "notification_id": notification_id,
                        "unread_count": unread_count
                    })
            finally:
                if _test_db_session is None:
                    db.close()

    elif action == "get_unread_count":
        # Request current unread count
        from app.models.notification import Notification

        db = get_websocket_db()
        try:
            unread_count = db.query(Notification).filter(
                Notification.user_id == user_id,
                Notification.read == False
            ).count()

            await websocket.send_json({
                "event_type": "unread_count_updated",
                "count": unread_count
            })
        finally:
            if _test_db_session is None:
                db.close()

    else:
        # Unknown action type
        await websocket.send_json({
            "event_type": "error",
            "message": f"Unknown action: {action}"
        })
