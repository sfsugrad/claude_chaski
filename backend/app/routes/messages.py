from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, and_, func
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.user import User
from app.models.package import Package
from app.models.message import Message
from app.utils.dependencies import get_current_user

router = APIRouter()


# Request/Response Models
class MessageCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: int
    package_id: int
    sender_id: int
    sender_name: str
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class MessageListResponse(BaseModel):
    messages: list[MessageResponse]
    total: int


class ConversationSummary(BaseModel):
    package_id: int
    package_description: str
    other_user_id: int
    other_user_name: str
    last_message: str
    last_message_at: datetime
    unread_count: int


class ConversationListResponse(BaseModel):
    conversations: list[ConversationSummary]
    total: int


def check_message_access(package: Package, user: User) -> bool:
    """Check if user has access to messages for this package."""
    from app.models.user import UserRole

    # Sender always has access
    if user.id == package.sender_id:
        return True

    # Assigned courier has access
    if package.courier_id and user.id == package.courier_id:
        return True

    # For packages open for bids, any courier can message (to ask questions before accepting)
    if package.status.value == 'open_for_bids' and user.role in [UserRole.COURIER, UserRole.BOTH]:
        return True

    return False


def get_other_user_for_conversation(package: Package, current_user: User, db: Session) -> User | None:
    """Get the other participant in the conversation.

    For pending packages without a courier, we look at who sent messages
    to determine the other participant.
    """
    if current_user.id == package.sender_id:
        # Sender wants to see who they're chatting with
        if package.courier_id:
            # Assigned courier
            other_id = package.courier_id
        else:
            # Pending package - find the courier who messaged
            other_message = db.query(Message).filter(
                Message.package_id == package.id,
                Message.sender_id != current_user.id
            ).first()
            if other_message:
                other_id = other_message.sender_id
            else:
                return None
    else:
        # Courier (or potential courier) wants to see the sender
        other_id = package.sender_id

    if other_id is None:
        return None

    return db.query(User).filter(User.id == other_id).first()


def get_other_user(package: Package, current_user: User, db: Session) -> User | None:
    """Get the other participant for sending messages (simple version)."""
    if current_user.id == package.sender_id:
        other_id = package.courier_id
    else:
        other_id = package.sender_id

    if other_id is None:
        return None

    return db.query(User).filter(User.id == other_id).first()


@router.get("/conversations", response_model=ConversationListResponse)
async def get_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all conversations (packages with messages) for the current user.
    Returns packages where the user is sender, courier, or has sent messages.
    """
    # Find package IDs where user has sent or received messages
    # This includes: sender, assigned courier, or courier who messaged a pending package
    packages_user_messaged = db.query(Message.package_id).filter(
        Message.sender_id == current_user.id
    ).distinct().subquery()

    packages_with_messages = db.query(
        Message.package_id,
        func.max(Message.created_at).label('last_message_at'),
        func.max(Message.id).label('last_message_id')
    ).join(Package).filter(
        or_(
            Package.sender_id == current_user.id,
            Package.courier_id == current_user.id,
            Message.package_id.in_(packages_user_messaged)  # Include packages where user sent messages
        )
    ).group_by(Message.package_id).subquery()

    # Get total count
    total = db.query(packages_with_messages).count()

    # Get packages ordered by last message
    package_ids = db.query(
        packages_with_messages.c.package_id,
        packages_with_messages.c.last_message_id
    ).order_by(
        desc(packages_with_messages.c.last_message_at)
    ).offset(skip).limit(limit).all()

    conversations = []
    for pkg_id, last_msg_id in package_ids:
        package = db.query(Package).filter(Package.id == pkg_id).first()
        if not package:
            continue

        other_user = get_other_user_for_conversation(package, current_user, db)
        if not other_user:
            continue

        # Get last message
        last_message = db.query(Message).filter(Message.id == last_msg_id).first()

        # Get unread count for this conversation
        unread_count = db.query(Message).filter(
            Message.package_id == pkg_id,
            Message.sender_id != current_user.id,
            Message.is_read == False
        ).count()

        conversations.append(ConversationSummary(
            package_id=package.id,
            package_description=package.description[:50] + "..." if len(package.description) > 50 else package.description,
            other_user_id=other_user.id,
            other_user_name=other_user.full_name,
            last_message=last_message.content[:100] + "..." if len(last_message.content) > 100 else last_message.content,
            last_message_at=last_message.created_at,
            unread_count=unread_count
        ))

    return ConversationListResponse(
        conversations=conversations,
        total=total
    )


@router.get("/unread-count")
async def get_unread_message_count(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get total unread message count across all conversations."""
    # Get packages where user is sender or courier
    user_packages = db.query(Package.id).filter(
        or_(
            Package.sender_id == current_user.id,
            Package.courier_id == current_user.id
        )
    ).subquery()

    # Count unread messages not sent by current user
    count = db.query(Message).filter(
        Message.package_id.in_(user_packages),
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).count()

    return {"unread_count": count}


@router.get("/package/{package_id}", response_model=MessageListResponse)
async def get_package_messages(
    package_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all messages for a specific package.
    Only the sender and courier of the package can access messages.
    """
    # Get the package
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check access
    if not check_message_access(package, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to messages for this package"
        )

    # Get total count
    total = db.query(Message).filter(Message.package_id == package_id).count()

    # Get messages ordered by created_at (oldest first for chat display)
    messages = db.query(Message).filter(
        Message.package_id == package_id
    ).order_by(Message.created_at).offset(skip).limit(limit).all()

    # Build response with sender names
    message_responses = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()
        message_responses.append(MessageResponse(
            id=msg.id,
            package_id=msg.package_id,
            sender_id=msg.sender_id,
            sender_name=sender.full_name if sender else "Unknown",
            content=msg.content,
            is_read=msg.is_read,
            created_at=msg.created_at
        ))

    return MessageListResponse(
        messages=message_responses,
        total=total
    )


@router.post("/package/{package_id}", response_model=MessageResponse, status_code=status.HTTP_201_CREATED)
async def send_message(
    package_id: int,
    message_data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send a message for a specific package.
    Only the sender and courier of the package can send messages.
    """
    from app.services.websocket_manager import broadcast_message

    # Get the package
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check access
    if not check_message_access(package, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to send messages for this package"
        )

    # Create the message
    message = Message(
        package_id=package_id,
        sender_id=current_user.id,
        content=message_data.content
    )
    db.add(message)
    db.commit()
    db.refresh(message)

    # Build response
    response = MessageResponse(
        id=message.id,
        package_id=message.package_id,
        sender_id=message.sender_id,
        sender_name=current_user.full_name,
        content=message.content,
        is_read=message.is_read,
        created_at=message.created_at
    )

    # Broadcast to the other participant(s)
    message_data_dict = {
        "id": message.id,
        "package_id": message.package_id,
        "sender_id": message.sender_id,
        "sender_name": current_user.full_name,
        "content": message.content,
        "is_read": message.is_read,
        "created_at": message.created_at.isoformat()
    }

    # For pending packages, we need to notify based on who's in the conversation
    if current_user.id == package.sender_id:
        # Sender is sending - notify all couriers who have messaged about this package
        courier_ids = db.query(Message.sender_id).filter(
            Message.package_id == package_id,
            Message.sender_id != package.sender_id
        ).distinct().all()
        for (courier_id,) in courier_ids:
            await broadcast_message(courier_id, message_data_dict)
    else:
        # Courier is sending - notify the sender
        await broadcast_message(package.sender_id, message_data_dict)

    return response


@router.put("/{message_id}/read", response_model=MessageResponse)
async def mark_message_read(
    message_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark a specific message as read."""
    message = db.query(Message).filter(Message.id == message_id).first()
    if not message:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Message not found"
        )

    # Get the package to check access
    package = db.query(Package).filter(Package.id == message.package_id).first()
    if not package or not check_message_access(package, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this message"
        )

    # Only mark as read if it wasn't sent by current user
    if message.sender_id != current_user.id:
        message.is_read = True
        db.commit()
        db.refresh(message)

    sender = db.query(User).filter(User.id == message.sender_id).first()
    return MessageResponse(
        id=message.id,
        package_id=message.package_id,
        sender_id=message.sender_id,
        sender_name=sender.full_name if sender else "Unknown",
        content=message.content,
        is_read=message.is_read,
        created_at=message.created_at
    )


@router.put("/package/{package_id}/read-all")
async def mark_all_messages_read(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Mark all messages in a conversation as read."""
    # Get the package
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check access
    if not check_message_access(package, current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to messages for this package"
        )

    # Mark all messages from the other user as read
    updated_count = db.query(Message).filter(
        Message.package_id == package_id,
        Message.sender_id != current_user.id,
        Message.is_read == False
    ).update({"is_read": True}, synchronize_session=False)
    db.commit()

    return {"message": f"Marked {updated_count} messages as read"}
