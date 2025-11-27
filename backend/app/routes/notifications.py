from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from app.database import get_db
from app.models.user import User
from app.models.notification import Notification, NotificationType
from app.utils.dependencies import get_current_user

router = APIRouter()


# Request/Response Models
class NotificationResponse(BaseModel):
    id: int
    user_id: int
    type: str
    message: str
    read: bool
    package_id: int | None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    unread_count: int


class MarkReadRequest(BaseModel):
    notification_ids: list[int] | None = None  # If None, mark all as read


class NotificationCreate(BaseModel):
    """Used internally for creating notifications"""
    user_id: int
    type: NotificationType
    message: str
    package_id: int | None = None


@router.get("/", response_model=NotificationListResponse)
async def get_notifications(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    unread_only: bool = Query(False),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get notifications for the current user.

    - **skip**: Number of notifications to skip (pagination)
    - **limit**: Maximum number of notifications to return (1-100)
    - **unread_only**: If true, only return unread notifications
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if unread_only:
        query = query.filter(Notification.read == False)

    # Get total count before pagination
    total = query.count()

    # Get unread count
    unread_count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False
    ).count()

    # Get paginated notifications, ordered by newest first (using id as it's more reliable across DBs)
    notifications = query.order_by(desc(Notification.id)).offset(skip).limit(limit).all()

    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        unread_count=unread_count
    )


@router.get("/unread-count")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get the count of unread notifications for the current user."""
    count = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False
    ).count()

    return {"unread_count": count}


@router.get("/{notification_id}", response_model=NotificationResponse)
async def get_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific notification by ID."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    return notification


@router.put("/{notification_id}/read", response_model=NotificationResponse)
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a specific notification as read."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    notification.read = True
    db.commit()
    db.refresh(notification)

    return notification


@router.put("/mark-read")
async def mark_notifications_read(
    request: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Mark multiple notifications as read.

    If notification_ids is provided, only those notifications are marked as read.
    If notification_ids is None or empty, all notifications for the user are marked as read.
    """
    query = db.query(Notification).filter(
        Notification.user_id == current_user.id,
        Notification.read == False
    )

    if request.notification_ids:
        query = query.filter(Notification.id.in_(request.notification_ids))

    updated_count = query.update({"read": True}, synchronize_session=False)
    db.commit()

    return {"message": f"Marked {updated_count} notifications as read"}


@router.delete("/{notification_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_notification(
    notification_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific notification."""
    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == current_user.id
    ).first()

    if not notification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Notification not found"
        )

    db.delete(notification)
    db.commit()

    return None


@router.delete("/")
async def delete_all_notifications(
    read_only: bool = Query(False, description="If true, only delete read notifications"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete notifications for the current user.

    - **read_only**: If true, only delete read notifications. If false, delete all.
    """
    query = db.query(Notification).filter(Notification.user_id == current_user.id)

    if read_only:
        query = query.filter(Notification.read == True)

    deleted_count = query.delete(synchronize_session=False)
    db.commit()

    return {"message": f"Deleted {deleted_count} notifications"}


# Utility function for creating notifications (used by other parts of the app)
def create_notification(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    message: str,
    package_id: int | None = None
) -> Notification:
    """
    Create a new notification for a user.

    This is a utility function to be used by other parts of the application
    (e.g., when a package status changes, when a match is found, etc.)
    """
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        message=message,
        package_id=package_id
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)
    return notification


async def create_notification_with_broadcast(
    db: Session,
    user_id: int,
    notification_type: NotificationType,
    message: str,
    package_id: int | None = None
) -> Notification:
    """
    Create a new notification and broadcast it via WebSocket.

    This is the preferred method for creating notifications as it provides
    real-time updates to connected clients.
    """
    from app.services.websocket_manager import broadcast_notification, broadcast_unread_count

    # Create the notification in database
    notification = Notification(
        user_id=user_id,
        type=notification_type,
        message=message,
        package_id=package_id
    )
    db.add(notification)
    db.commit()
    db.refresh(notification)

    # Broadcast via WebSocket
    notification_data = {
        "id": notification.id,
        "user_id": notification.user_id,
        "type": notification.type.value,
        "message": notification.message,
        "read": notification.read,
        "package_id": notification.package_id,
        "created_at": notification.created_at.isoformat()
    }
    await broadcast_notification(user_id, notification_data)

    # Also broadcast updated unread count
    unread_count = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.read == False
    ).count()
    await broadcast_unread_count(user_id, unread_count)

    return notification
