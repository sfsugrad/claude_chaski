"""
Package Notes API endpoints.
"""
from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User, UserRole
from app.models.package import Package
from app.models.package_note import PackageNote, NoteAuthorType
from app.models.notification import Notification, NotificationType
from app.utils.dependencies import get_current_user
from app.utils.input_sanitizer import sanitize_plain_text

router = APIRouter()


def get_package_by_tracking_id(db: Session, tracking_id: str) -> Package | None:
    """Get a package by tracking_id, with fallback to numeric ID."""
    package = db.query(Package).filter(
        Package.tracking_id == tracking_id,
        Package.is_active == True
    ).first()
    if not package and tracking_id.isdigit():
        package = db.query(Package).filter(
            Package.id == int(tracking_id),
            Package.is_active == True
        ).first()
    return package


# Pydantic schemas
class NoteCreate(BaseModel):
    content: str


class NoteResponse(BaseModel):
    id: int
    package_id: int
    author_id: Optional[int]
    author_type: str
    author_name: Optional[str]
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


@router.get("/{tracking_id}/notes", response_model=List[NoteResponse])
async def get_package_notes(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all notes for a package.
    - Sender and admin can view notes at any time.
    - Courier can only view notes if assigned to the package.
    """
    package = get_package_by_tracking_id(db, tracking_id)

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check authorization
    is_sender = package.sender_id == current_user.id
    is_courier = package.courier_id and package.courier_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN

    if not (is_sender or is_courier or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view notes for this package"
        )

    notes = db.query(PackageNote).filter(
        PackageNote.package_id == package.id
    ).order_by(PackageNote.created_at.asc()).all()

    # Build response with author names
    result = []
    for note in notes:
        author_name = None
        if note.author_id:
            author = db.query(User).filter(User.id == note.author_id).first()
            if author:
                author_name = author.full_name
        elif note.author_type == NoteAuthorType.SYSTEM:
            author_name = "System"

        result.append(NoteResponse(
            id=note.id,
            package_id=note.package_id,
            author_id=note.author_id,
            author_type=note.author_type.value,
            author_name=author_name,
            content=note.content,
            created_at=note.created_at
        ))

    return result


@router.post("/{tracking_id}/notes", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def add_package_note(
    tracking_id: str,
    note_data: NoteCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Add a note to a package.
    - Sender and admin can add notes at any time after package is created.
    - Courier can only add notes after being assigned to the package.
    """
    package = get_package_by_tracking_id(db, tracking_id)

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Determine author type and check authorization
    is_sender = package.sender_id == current_user.id
    is_courier = package.courier_id and package.courier_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN

    # Courier can only add notes if they are assigned to the package
    if not is_sender and not is_admin and not is_courier:
        # Check if user is a courier trying to add note to unassigned package
        if current_user.role in [UserRole.COURIER, UserRole.BOTH] and not package.courier_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Couriers can only add notes after being assigned to the package"
            )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to add notes to this package"
        )

    if is_sender:
        author_type = NoteAuthorType.SENDER
    elif is_courier:
        author_type = NoteAuthorType.COURIER
    elif is_admin:
        # Admin notes are recorded as system notes
        author_type = NoteAuthorType.SYSTEM
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to add notes to this package"
        )

    # Validate content
    if not note_data.content or not note_data.content.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note content cannot be empty"
        )

    if len(note_data.content) > 1000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Note content cannot exceed 1000 characters"
        )

    # Sanitize note content to prevent XSS
    sanitized_content = sanitize_plain_text(note_data.content)

    # Create note
    note = PackageNote(
        package_id=package.id,
        author_id=current_user.id,
        author_type=author_type,
        content=sanitized_content
    )

    db.add(note)

    # Create notifications for sender and courier (if assigned)
    # Don't notify the author of the note
    author_type_label = "Sender" if author_type == NoteAuthorType.SENDER else (
        "Courier" if author_type == NoteAuthorType.COURIER else "Admin"
    )
    note_preview = note_data.content.strip()[:50] + ("..." if len(note_data.content.strip()) > 50 else "")

    # Notify sender if the note is not from them
    if not is_sender:
        sender_notification = Notification(
            user_id=package.sender_id,
            type=NotificationType.NEW_NOTE_ADDED,
            message=f"{author_type_label} added a note to package {package.tracking_id}: \"{note_preview}\"",
            package_id=package.id
        )
        db.add(sender_notification)

    # Notify courier if assigned and the note is not from them
    if package.courier_id and not is_courier:
        courier_notification = Notification(
            user_id=package.courier_id,
            type=NotificationType.NEW_NOTE_ADDED,
            message=f"{author_type_label} added a note to package {package.tracking_id}: \"{note_preview}\"",
            package_id=package.id
        )
        db.add(courier_notification)

    db.commit()
    db.refresh(note)

    return NoteResponse(
        id=note.id,
        package_id=note.package_id,
        author_id=note.author_id,
        author_type=note.author_type.value,
        author_name=current_user.full_name,
        content=note.content,
        created_at=note.created_at
    )


def add_system_note(db: Session, package_id: int, content: str):
    """
    Helper function to add a system-generated note.
    Can be called from other modules when status changes occur.
    """
    # Sanitize even system notes for consistency
    sanitized_content = sanitize_plain_text(content)

    note = PackageNote(
        package_id=package_id,
        author_id=None,
        author_type=NoteAuthorType.SYSTEM,
        content=sanitized_content
    )
    db.add(note)
    db.commit()
    return note
