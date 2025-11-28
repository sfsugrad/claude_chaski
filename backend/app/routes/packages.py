from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.package import Package, PackageSize, PackageStatus
from app.models.user import User
from app.models.notification import NotificationType
from app.utils.dependencies import get_current_user
from app.routes.notifications import create_notification, create_notification_with_broadcast
from app.utils.email import (
    send_package_in_transit_email,
    send_package_delivered_email,
    send_package_cancelled_email,
)
from app.services.audit_service import (
    log_package_create,
    log_package_update,
    log_package_status_change,
    log_package_cancel,
)
from app.services.package_status import (
    validate_transition,
    get_allowed_next_statuses,
    transition_package,
    can_mark_delivered,
    get_status_progress,
    can_cancel_with_reason,
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
    requires_proof: bool = True  # Whether delivery proof is required
    sender_id: int | None = None  # Admin only: specify sender user

class PackageResponse(BaseModel):
    id: int
    sender_id: int
    courier_id: int | None
    sender_name: str | None = None
    courier_name: str | None = None
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
    requires_proof: bool
    created_at: datetime
    updated_at: datetime | None
    # Status transition timestamps
    status_changed_at: datetime | None = None
    bid_selected_at: datetime | None = None
    pending_pickup_at: datetime | None = None
    in_transit_at: datetime | None = None
    failed_at: datetime | None = None
    # Allowed next statuses for UI
    allowed_next_statuses: List[str] = []

    class Config:
        from_attributes = True


def package_to_response(package: Package, db: Session, is_admin: bool = False) -> PackageResponse:
    """Convert a Package model to PackageResponse with user names."""
    sender = db.query(User).filter(User.id == package.sender_id).first()
    courier = None
    if package.courier_id:
        courier = db.query(User).filter(User.id == package.courier_id).first()

    return PackageResponse(
        id=package.id,
        sender_id=package.sender_id,
        courier_id=package.courier_id,
        sender_name=sender.full_name if sender else None,
        courier_name=courier.full_name if courier else None,
        description=package.description,
        size=package.size.value,
        weight_kg=package.weight_kg,
        status=package.status.value,
        pickup_address=package.pickup_address,
        pickup_lat=package.pickup_lat,
        pickup_lng=package.pickup_lng,
        dropoff_address=package.dropoff_address,
        dropoff_lat=package.dropoff_lat,
        dropoff_lng=package.dropoff_lng,
        pickup_contact_name=package.pickup_contact_name,
        pickup_contact_phone=package.pickup_contact_phone,
        dropoff_contact_name=package.dropoff_contact_name,
        dropoff_contact_phone=package.dropoff_contact_phone,
        price=package.price,
        requires_proof=package.requires_proof if package.requires_proof is not None else True,
        created_at=package.created_at,
        updated_at=package.updated_at,
        status_changed_at=package.status_changed_at,
        bid_selected_at=package.bid_selected_at,
        pending_pickup_at=package.pending_pickup_at,
        in_transit_at=package.in_transit_at,
        failed_at=package.failed_at,
        allowed_next_statuses=get_allowed_next_statuses(package.status, is_admin),
    )

@router.post("/", status_code=status.HTTP_201_CREATED, response_model=PackageResponse)
async def create_package(
    request: Request,
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

    # Create package with NEW status, then auto-transition to OPEN_FOR_BIDS
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
        requires_proof=package_data.requires_proof,
        status=PackageStatus.NEW
    )

    db.add(new_package)
    db.commit()
    db.refresh(new_package)

    # Auto-transition from NEW to OPEN_FOR_BIDS
    new_package, _ = transition_package(db, new_package, PackageStatus.OPEN_FOR_BIDS, sender_id, force=True)
    db.refresh(new_package)

    # Audit log package creation
    log_package_create(
        db, current_user, new_package.id,
        {"description": new_package.description, "size": new_package.size.value, "sender_id": sender_id},
        request
    )

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
    is_admin = current_user.role.value == 'admin'
    if is_admin:
        packages = db.query(Package).order_by(Package.created_at.desc()).all()
        return [package_to_response(pkg, db, is_admin=True) for pkg in packages]

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

    return [package_to_response(pkg, db) for pkg in unique_packages]


@router.get("/{package_id}", response_model=PackageResponse)
async def get_package(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific package details"""
    from app.models.user import UserRole

    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    is_admin = current_user.role.value == 'admin'

    # Admins can view any package
    if is_admin:
        return package_to_response(package, db, is_admin=True)

    # Sender can always view their own packages
    if package.sender_id == current_user.id:
        return package_to_response(package, db)

    # Assigned courier can view the package
    if package.courier_id == current_user.id:
        return package_to_response(package, db)

    # Couriers can view packages open for bids (to decide whether to bid)
    if current_user.role in [UserRole.COURIER, UserRole.BOTH] and package.status == PackageStatus.OPEN_FOR_BIDS:
        return package_to_response(package, db)

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="You don't have access to this package"
    )


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
    request: Request,
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

    # Only allow editing NEW or OPEN_FOR_BIDS packages
    if package.status not in [PackageStatus.NEW, PackageStatus.OPEN_FOR_BIDS]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot edit package with status '{package.status.value}'. Only new or open for bids packages can be edited."
        )

    # Track changes for audit log
    changes = {}

    # Update fields if provided
    if package_update.description is not None:
        changes["description"] = {"old": package.description, "new": package_update.description}
        package.description = package_update.description

    if package_update.size is not None:
        try:
            changes["size"] = {"old": package.size.value, "new": package_update.size}
            package.size = PackageSize(package_update.size)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid package size. Must be: small, medium, large, or extra_large"
            )

    if package_update.weight_kg is not None:
        changes["weight_kg"] = {"old": package.weight_kg, "new": package_update.weight_kg}
        package.weight_kg = package_update.weight_kg

    if package_update.pickup_contact_name is not None:
        changes["pickup_contact_name"] = {"old": package.pickup_contact_name, "new": package_update.pickup_contact_name}
        package.pickup_contact_name = package_update.pickup_contact_name

    if package_update.pickup_contact_phone is not None:
        changes["pickup_contact_phone"] = {"old": package.pickup_contact_phone, "new": package_update.pickup_contact_phone}
        package.pickup_contact_phone = package_update.pickup_contact_phone

    if package_update.dropoff_contact_name is not None:
        changes["dropoff_contact_name"] = {"old": package.dropoff_contact_name, "new": package_update.dropoff_contact_name}
        package.dropoff_contact_name = package_update.dropoff_contact_name

    if package_update.dropoff_contact_phone is not None:
        changes["dropoff_contact_phone"] = {"old": package.dropoff_contact_phone, "new": package_update.dropoff_contact_phone}
        package.dropoff_contact_phone = package_update.dropoff_contact_phone

    if package_update.price is not None:
        changes["price"] = {"old": package.price, "new": package_update.price}
        package.price = package_update.price

    package.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(package)

    # Audit log package update
    if changes:
        log_package_update(db, current_user, package_id, changes, request)

    return package


@router.put("/{package_id}/status")
async def update_package_status(
    request: Request,
    package_id: int,
    status_update: StatusUpdate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update package status with strict transition validation.

    Only the assigned courier can update status for delivery operations.
    Status progression: PENDING_PICKUP → IN_TRANSIT → DELIVERED

    FAILED status can be set from PENDING_PICKUP or IN_TRANSIT when delivery fails.
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

    # Validate status value
    try:
        new_status = PackageStatus(status_update.status)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid status"
        )

    # Validate transition is allowed
    is_valid, error_message = validate_transition(package.status, new_status)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error_message
        )

    # Special handling for DELIVERED status
    if new_status == PackageStatus.DELIVERED:
        can_deliver, result = can_mark_delivered(package)
        if not can_deliver:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=result
            )
        if result == "proof_required":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Delivery proof is required for this package. Please submit proof via the delivery proof endpoint."
            )

    old_status = package.status

    # Use the transition service to update status with timestamps
    package, error = transition_package(db, package, new_status, current_user.id)
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    package.updated_at = datetime.utcnow()
    db.commit()

    # Audit log status change
    log_package_status_change(db, current_user, package_id, old_status.value, new_status.value, request)

    # Get sender info for notifications
    sender = db.query(User).filter(User.id == package.sender_id).first()

    # Send notifications based on new status
    if new_status == PackageStatus.IN_TRANSIT and old_status != PackageStatus.IN_TRANSIT:
        # IN_TRANSIT means courier confirmed pickup and package is now in transit
        # Create in-app notification with WebSocket broadcast
        await create_notification_with_broadcast(
            db=db,
            user_id=package.sender_id,
            notification_type=NotificationType.PACKAGE_IN_TRANSIT,
            message=f"Your package '{package.description[:50]}' has been picked up and is now in transit",
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

    elif new_status == PackageStatus.FAILED and old_status != PackageStatus.FAILED:
        # Create in-app notification with WebSocket broadcast for sender
        await create_notification_with_broadcast(
            db=db,
            user_id=package.sender_id,
            notification_type=NotificationType.DELIVERY_FAILED,
            message=f"Delivery failed for package '{package.description[:50]}'. Please contact support.",
            package_id=package.id
        )

    return {"message": "Package status updated successfully", "status": new_status.value}


@router.put("/{package_id}/cancel", response_model=PackageResponse)
async def cancel_package(
    request: Request,
    package_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a package.

    Only the sender who created the package or an admin can cancel it.
    Cannot cancel packages that are IN_TRANSIT, DELIVERED, CANCELED, or FAILED.
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

    # Validate cancellation is allowed
    can_cancel_pkg, error = can_cancel_with_reason(package)
    if not can_cancel_pkg:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    # Store courier_id before cancelling (for notification)
    courier_id = package.courier_id

    package.status = PackageStatus.CANCELED
    package.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(package)

    # Audit log package cancellation
    log_package_cancel(db, current_user, package_id, "User cancelled", request)

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
