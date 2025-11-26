from datetime import datetime
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

    # Validate role
    role_upper = role_update.role.upper()
    try:
        new_role = UserRole[role_upper]
    except KeyError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: SENDER, COURIER, BOTH, ADMIN"
        )

    # Prevent admin from removing their own admin role
    if user.id == admin.id and new_role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove your own admin privileges"
        )

    user.role = new_role
    user.updated_at = datetime.utcnow()
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
    Delete a user (admin only).
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
