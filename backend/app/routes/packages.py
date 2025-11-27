from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.package import Package, PackageSize, PackageStatus
from app.models.user import User
from app.models.notification import NotificationType
from app.utils.dependencies import get_current_user
from app.routes.notifications import create_notification, create_notification_with_broadcast
from app.utils.email import (
    send_package_picked_up_email,
    send_package_in_transit_email,
    send_package_delivered_email,
    send_package_cancelled_email,
)
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
from geopy.geocoders import Nominatim
from geopy.exc import GeocoderTimedOut, GeocoderServiceError

router = APIRouter()

# Initialize geocoder
geolocator = Nominatim(user_agent="chaski")

class PackageCreate(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    size: str = Field(..., pattern="^(small|medium|large|extra_large)$")
    weight_kg: float = Field(..., gt=0, le=1000)
    pickup_address: str = Field(..., min_length=1)
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str = Field(..., min_length=1)
    dropoff_lat: float
    dropoff_lng: float
    pickup_contact_name: str | None = None
    pickup_contact_phone: str | None = None
    dropoff_contact_name: str | None = None
    dropoff_contact_phone: str | None = None
    price: float | None = Field(None, ge=0)
    sender_id: int | None = None  # Admin only: specify sender user

class PackageResponse(BaseModel):
    id: int
    sender_id: int
    courier_id: int | None
    description: str
    size: str
    weight_kg: float
    status: str
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_lat: float
    dropoff_lng: float
    pickup_contact_name: str | None
    pickup_contact_phone: str | None
    dropoff_contact_name: str | None
    dropoff_contact_phone: str | None
    price: float | None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=PackageResponse)
async def create_package(
    package_data: PackageCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new package delivery request.

    Requires authentication. User must have 'sender', 'both', or 'admin' role.
    """
    # Verify user can send packages
    if current_user.role.value not in ['sender', 'both', 'admin']:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senders and admins can create packages"
        )

    # Validate package size
    try:
        package_size = PackageSize(package_data.size)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid package size. Must be: small, medium, large, or extra_large"
        )

    # Determine sender_id: use provided sender_id if admin, otherwise current user
    sender_id = current_user.id
    if package_data.sender_id is not None:
        # Only admins can specify a different sender
        if current_user.role.value != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can create packages for other users"
            )
        # Verify the specified sender exists
        sender = db.query(User).filter(User.id == package_data.sender_id).first()
        if not sender:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"User with ID {package_data.sender_id} not found"
            )
        sender_id = package_data.sender_id

    # Create package
    new_package = Package(
        sender_id=sender_id,
        description=package_data.description,
        size=package_size,
        weight_kg=package_data.weight_kg,
        pickup_address=package_data.pickup_address,
        pickup_lat=package_data.pickup_lat,
        pickup_lng=package_data.pickup_lng,
        pickup_contact_name=package_data.pickup_contact_name,
        pickup_contact_phone=package_data.pickup_contact_phone,
        dropoff_address=package_data.dropoff_address,
        dropoff_lat=package_data.dropoff_lat,
        dropoff_lng=package_data.dropoff_lng,
        dropoff_contact_name=package_data.dropoff_contact_name,
        dropoff_contact_phone=package_data.dropoff_contact_phone,
        price=package_data.price,
        status=PackageStatus.PENDING
    )

    db.add(new_package)
    db.commit()
    db.refresh(new_package)

    return new_package


@router.get("/", response_model=List[PackageResponse])
async def get_packages(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all packages for current user.

    - If admin: returns all packages
    - If sender: returns packages they've created
    - If courier: returns packages they're delivering
    - If both: returns all their packages
    """
    # Admins can see all packages
    if current_user.role.value == 'admin':
        return db.query(Package).order_by(Package.created_at.desc()).all()

    packages = []

    if current_user.role.value in ['sender', 'both']:
        # Get packages user has sent
        sender_packages = db.query(Package).filter(
            Package.sender_id == current_user.id
        ).order_by(Package.created_at.desc()).all()
        packages.extend(sender_packages)

    if current_user.role.value in ['courier', 'both']:
        # Get packages user is delivering
        courier_packages = db.query(Package).filter(
            Package.courier_id == current_user.id
        ).order_by(Package.created_at.desc()).all()
        packages.extend(courier_packages)

    # Remove duplicates (for users with 'both' role)
    unique_packages = {pkg.id: pkg for pkg in packages}.values()

    return list(unique_packages)


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific package details"""
    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Admins can view any package
    if current_user.role.value == 'admin':
        return package

    # Check if user has access to this package
    if package.sender_id != current_user.id and package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this package"
        )

    return package


class PackageUpdate(BaseModel):
    description: str | None = Field(None, min_length=1, max_length=500)
    size: str | None = Field(None, pattern="^(small|medium|large|extra_large)$")
    weight_kg: float | None = Field(None, gt=0, le=1000)
    pickup_contact_name: str | None = None
    pickup_contact_phone: str | None = None
    dropoff_contact_name: str | None = None
    dropoff_contact_phone: str | None = None
    price: float | None = Field(None, ge=0)


class StatusUpdate(BaseModel):
    status: str


@router.put("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: int,
    package_update: PackageUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update package details.

    Only the sender who created the package or an admin can update it.
    Only pending packages can be edited.
    """
    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check permissions: must be admin or the sender who created it
    is_admin = current_user.role.value == 'admin'
    is_sender = package.sender_id == current_user.id

    if not (is_admin or is_sender):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to edit this package"
        )

    # Only allow editing pending packages
    if package.status != PackageStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit package with status '{package.status.value}'. Only pending packages can be edited."
        )

    # Update fields if provided
    if package_update.description is not None:
        package.description = package_update.description

    if package_update.size is not None:
        try:
            package.size = PackageSize(package_update.size)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid package size. Must be: small, medium, large, or extra_large"
            )

    if package_update.weight_kg is not None:
        package.weight_kg = package_update.weight_kg

    if package_update.pickup_contact_name is not None:
        package.pickup_contact_name = package_update.pickup_contact_name

    if package_update.pickup_contact_phone is not None:
        package.pickup_contact_phone = package_update.pickup_contact_phone

    if package_update.dropoff_contact_name is not None:
        package.dropoff_contact_name = package_update.dropoff_contact_name

    if package_update.dropoff_contact_phone is not None:
        package.dropoff_contact_phone = package_update.dropoff_contact_phone

    if package_update.price is not None:
        package.price = package_update.price

    package.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(package)

    return package


@router.put("/{package_id}/status")
async def update_package_status(
    package_id: int,
    status_update: StatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update package status.

    Only the assigned courier can update status.
    """
    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Verify user is the assigned courier
    if package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned courier can update package status"
        )

    # Validate status
    try:
        new_status = PackageStatus(status_update.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status"
        )

    old_status = package.status
    package.status = new_status
    package.updated_at = datetime.utcnow()
    db.commit()

    # Get sender info for notifications
    sender = db.query(User).filter(User.id == package.sender_id).first()

    # Send notifications based on new status
    if new_status == PackageStatus.PICKED_UP and old_status != PackageStatus.PICKED_UP:
        # Create in-app notification with WebSocket broadcast
        await create_notification_with_broadcast(
            db=db,
            user_id=package.sender_id,
            notification_type=NotificationType.PACKAGE_PICKED_UP,
            message=f"Your package '{package.description[:50]}' has been picked up by the courier",
            package_id=package.id
        )
        # Send email
        if sender:
            background_tasks.add_task(
                send_package_picked_up_email,
                sender_email=sender.email,
                sender_name=sender.full_name,
                courier_name=current_user.full_name,
                package_description=package.description,
                dropoff_address=package.dropoff_address,
                package_id=package.id
            )

    elif new_status == PackageStatus.IN_TRANSIT and old_status != PackageStatus.IN_TRANSIT:
        # Create in-app notification with WebSocket broadcast
        await create_notification_with_broadcast(
            db=db,
            user_id=package.sender_id,
            notification_type=NotificationType.PACKAGE_IN_TRANSIT,
            message=f"Your package '{package.description[:50]}' is now in transit",
            package_id=package.id
        )
        # Send email
        if sender:
            background_tasks.add_task(
                send_package_in_transit_email,
                sender_email=sender.email,
                sender_name=sender.full_name,
                package_description=package.description,
                dropoff_address=package.dropoff_address,
                package_id=package.id
            )

    elif new_status == PackageStatus.DELIVERED and old_status != PackageStatus.DELIVERED:
        # Create in-app notification with WebSocket broadcast
        await create_notification_with_broadcast(
            db=db,
            user_id=package.sender_id,
            notification_type=NotificationType.PACKAGE_DELIVERED,
            message=f"Your package '{package.description[:50]}' has been delivered successfully!",
            package_id=package.id
        )
        # Send email
        if sender:
            background_tasks.add_task(
                send_package_delivered_email,
                sender_email=sender.email,
                sender_name=sender.full_name,
                package_description=package.description,
                dropoff_address=package.dropoff_address,
                courier_name=current_user.full_name,
                package_id=package.id
            )

    return {"message": "Package status updated successfully", "status": new_status.value}


@router.put("/{package_id}/cancel", response_model=PackageResponse)
async def cancel_package(
    package_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a package.

    Only the sender who created the package can cancel it.
    Only pending or matched packages can be cancelled.
    """
    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check permissions: must be the sender who created it or admin
    is_admin = current_user.role.value == 'admin'
    is_sender = package.sender_id == current_user.id

    if not (is_admin or is_sender):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to cancel this package"
        )

    # Only allow cancelling pending or matched packages
    if package.status not in [PackageStatus.PENDING, PackageStatus.MATCHED]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel package with status '{package.status.value}'. Only pending or matched packages can be cancelled."
        )

    # Store courier_id before cancelling (for notification)
    courier_id = package.courier_id

    package.status = PackageStatus.CANCELLED
    package.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(package)

    # Notify the courier if package was matched
    if courier_id:
        courier = db.query(User).filter(User.id == courier_id).first()
        if courier:
            # Create in-app notification for courier with WebSocket broadcast
            await create_notification_with_broadcast(
                db=db,
                user_id=courier_id,
                notification_type=NotificationType.PACKAGE_CANCELLED,
                message=f"Package '{package.description[:50]}' has been cancelled by the sender",
                package_id=package.id
            )
            # Send email to courier
            background_tasks.add_task(
                send_package_cancelled_email,
                recipient_email=courier.email,
                recipient_name=courier.full_name,
                package_description=package.description,
                cancellation_reason="Cancelled by sender",
                package_id=package.id
            )

    # Create in-app notification for sender (confirmation) with WebSocket broadcast
    await create_notification_with_broadcast(
        db=db,
        user_id=package.sender_id,
        notification_type=NotificationType.PACKAGE_CANCELLED,
        message=f"Your package '{package.description[:50]}' has been cancelled",
        package_id=package.id
    )

    return package
