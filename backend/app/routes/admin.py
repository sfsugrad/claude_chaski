from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from app.database import get_db
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.utils.dependencies import get_current_admin_user
from pydantic import BaseModel, EmailStr
from typing import List

router = APIRouter()


# Response Models
class UserAdminResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    phone_number: str | None
    is_active: bool
    is_verified: bool
    max_deviation_km: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class PackageAdminResponse(BaseModel):
    id: int
    sender_id: int
    courier_id: int | None
    description: str
    size: str
    weight_kg: float
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_lat: float
    dropoff_lng: float
    status: str
    price: float | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class PlatformStats(BaseModel):
    total_users: int
    total_senders: int
    total_couriers: int
    total_both: int
    total_admins: int
    total_packages: int
    active_packages: int
    completed_packages: int
    pending_packages: int
    total_revenue: float


class UpdateUserRole(BaseModel):
    role: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    phone_number: str | None = None
    max_deviation_km: int = 5


# Admin User Management Endpoints
@router.get("/users", response_model=List[UserAdminResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all users in the system (admin only).

    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        db: Database session
        admin: Current admin user

    Returns:
        List of all users
    """
    users = db.query(User).offset(skip).limit(limit).all()
    return users


@router.post("/users", status_code=status.HTTP_201_CREATED, response_model=UserAdminResponse)
async def create_user(
    user_data: CreateUserRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Create a new user (admin only).

    Allows admins to create users with any role, including other admins.

    Args:
        user_data: User creation data
        db: Database session
        admin: Current admin user

    Returns:
        Created user details

    Raises:
        HTTPException: If email already exists or invalid role
    """
    from app.utils.auth import get_password_hash

    # Check if user with email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Validate role
    role_upper = user_data.role.upper()
    try:
        user_role = UserRole[role_upper]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: SENDER, COURIER, BOTH, ADMIN"
        )

    # Validate password length
    if len(user_data.password) < 8:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 8 characters long"
        )

    # Create new user
    new_user = User(
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        role=user_role,
        phone_number=user_data.phone_number,
        max_deviation_km=user_data.max_deviation_km,
        is_verified=True,  # Admin-created users are auto-verified
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/users/{user_id}", response_model=UserAdminResponse)
async def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get a specific user by ID (admin only).

    Args:
        user_id: User ID
        db: Database session
        admin: Current admin user

    Returns:
        User details

    Raises:
        HTTPException: If user not found
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/users/{user_id}", response_model=UserAdminResponse)
async def update_user_role(
    user_id: int,
    role_update: UpdateUserRole,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Update a user's role (admin only).

    Args:
        user_id: User ID
        role_update: New role data
        db: Database session
        admin: Current admin user

    Returns:
        Updated user details

    Raises:
        HTTPException: If user not found or invalid role
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from changing their own role
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot change your own role"
        )

    # Validate role
    role_upper = role_update.role.upper()
    try:
        new_role = UserRole[role_upper]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: SENDER, COURIER, BOTH, ADMIN"
        )

    user.role = new_role
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user


class ToggleUserActive(BaseModel):
    is_active: bool


class UpdateUserProfile(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None
    max_deviation_km: int | None = None


@router.put("/users/{user_id}/profile", response_model=UserAdminResponse)
async def update_user_profile(
    user_id: int,
    profile_update: UpdateUserProfile,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Update user profile information (admin only).

    Allows admins to update user's full name, phone number, and max deviation.

    Args:
        user_id: User ID
        profile_update: Profile data to update
        db: Database session
        admin: Current admin user

    Returns:
        Updated user details

    Raises:
        HTTPException: If user not found or invalid max_deviation_km
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Update fields if provided
    if profile_update.full_name is not None:
        user.full_name = profile_update.full_name

    if profile_update.phone_number is not None:
        user.phone_number = profile_update.phone_number

    if profile_update.max_deviation_km is not None:
        # Validate max_deviation_km range
        if profile_update.max_deviation_km < 1 or profile_update.max_deviation_km > 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Max deviation must be between 1 and 500 km"
            )
        user.max_deviation_km = profile_update.max_deviation_km

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user


@router.put("/users/{user_id}/toggle-active", response_model=UserAdminResponse)
async def toggle_user_active(
    user_id: int,
    toggle_data: ToggleUserActive,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Toggle user active status (admin only).

    This provides soft delete functionality - inactive users cannot log in
    but their data is preserved in the database.

    Args:
        user_id: User ID
        toggle_data: New active status
        db: Database session
        admin: Current admin user

    Returns:
        Updated user details

    Raises:
        HTTPException: If user not found or trying to deactivate self
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from deactivating themselves
    if user.id == admin.id and not toggle_data.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot deactivate your own account"
        )

    user.is_active = toggle_data.is_active
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Delete a user (admin only) - DEPRECATED, use toggle-active instead.
    Cascades to delete related packages.

    Args:
        user_id: User ID
        db: Database session
        admin: Current admin user

    Raises:
        HTTPException: If user not found or trying to delete self
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent admin from deleting themselves
    if user.id == admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    # Delete related packages first (or rely on cascade delete if configured)
    db.query(Package).filter(
        or_(Package.sender_id == user_id, Package.courier_id == user_id)
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    return None


# Admin Package Management Endpoints
@router.get("/packages", response_model=List[PackageAdminResponse])
async def get_all_packages(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all packages in the system (admin only).

    Args:
        skip: Number of records to skip (pagination)
        limit: Maximum number of records to return
        db: Database session
        admin: Current admin user

    Returns:
        List of all packages
    """
    packages = db.query(Package).offset(skip).limit(limit).all()
    return packages


@router.get("/packages/{package_id}", response_model=PackageAdminResponse)
async def get_package_by_id(
    package_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get a specific package by ID (admin only).

    Args:
        package_id: Package ID
        db: Database session
        admin: Current admin user

    Returns:
        Package details

    Raises:
        HTTPException: If package not found
    """
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    return package


@router.delete("/packages/{package_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_package(
    package_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Delete a package (admin only).

    Args:
        package_id: Package ID
        db: Database session
        admin: Current admin user

    Raises:
        HTTPException: If package not found
    """
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    db.delete(package)
    db.commit()

    return None


class TogglePackageActive(BaseModel):
    is_active: bool


@router.put("/packages/{package_id}/toggle-active", response_model=PackageAdminResponse)
async def toggle_package_active(
    package_id: int,
    toggle_data: TogglePackageActive,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Toggle package active status (admin only).

    This provides soft delete functionality - inactive packages are hidden
    from regular views but preserved in the database.

    Args:
        package_id: Package ID
        toggle_data: New active status
        db: Database session
        admin: Current admin user

    Returns:
        Updated package details

    Raises:
        HTTPException: If package not found
    """
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Only allow deactivating packages that are in PENDING status
    if not toggle_data.is_active and package.status != PackageStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending packages can be deactivated. Package is currently in '{}' status.".format(package.status.value)
        )

    package.is_active = toggle_data.is_active
    package.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(package)

    return package


# Admin Statistics Endpoint
@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get platform statistics (admin only).

    Args:
        db: Database session
        admin: Current admin user

    Returns:
        Platform statistics including user counts and package metrics
    """
    # User statistics
    total_users = db.query(func.count(User.id)).scalar()
    total_senders = db.query(func.count(User.id)).filter(
        User.role == UserRole.SENDER
    ).scalar()
    total_couriers = db.query(func.count(User.id)).filter(
        User.role == UserRole.COURIER
    ).scalar()
    total_both = db.query(func.count(User.id)).filter(
        User.role == UserRole.BOTH
    ).scalar()
    total_admins = db.query(func.count(User.id)).filter(
        User.role == UserRole.ADMIN
    ).scalar()

    # Package statistics
    total_packages = db.query(func.count(Package.id)).scalar()
    active_packages = db.query(func.count(Package.id)).filter(
        or_(
            Package.status == PackageStatus.PENDING,
            Package.status == PackageStatus.IN_TRANSIT,
            Package.status == PackageStatus.MATCHED
        )
    ).scalar()
    completed_packages = db.query(func.count(Package.id)).filter(
        Package.status == PackageStatus.DELIVERED
    ).scalar()
    pending_packages = db.query(func.count(Package.id)).filter(
        Package.status == PackageStatus.PENDING
    ).scalar()

    # Revenue statistics (sum of all package prices)
    total_revenue = db.query(func.sum(Package.price)).scalar() or 0.0

    return PlatformStats(
        total_users=total_users,
        total_senders=total_senders,
        total_couriers=total_couriers,
        total_both=total_both,
        total_admins=total_admins,
        total_packages=total_packages,
        active_packages=active_packages,
        completed_packages=completed_packages,
        pending_packages=pending_packages,
        total_revenue=float(total_revenue)
    )
