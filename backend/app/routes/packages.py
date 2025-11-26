from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.package import Package, PackageSize, PackageStatus
from app.models.user import User
from app.utils.dependencies import get_current_user
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


class StatusUpdate(BaseModel):
    status: str


@router.put("/{package_id}/status")
async def update_package_status(
    package_id: int,
    status_update: StatusUpdate,
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

    package.status = new_status
    db.commit()

    return {"message": "Package status updated successfully", "status": new_status.value}
