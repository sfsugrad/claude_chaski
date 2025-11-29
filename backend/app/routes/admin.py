from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, or_, desc
from app.database import get_db
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.message import Message
from app.models.package_note import PackageNote, NoteAuthorType
from app.models.audit_log import AuditLog, AuditAction
from app.utils.dependencies import get_current_admin_user
from app.utils.encryption import get_encryption_service
from app.utils.password_validator import validate_password
from app.services.audit_service import (
    log_user_create,
    log_user_update,
    log_user_role_change,
    log_user_deactivate,
    log_user_activate,
    log_user_verify,
    log_user_unverify,
    log_user_delete,
    log_package_delete,
    log_package_deactivate,
    log_admin_stats_access,
    log_matching_job_run,
    log_audit,
)
from app.services.package_status import transition_package
from app.services.user_service import can_deactivate_user
from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional

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
    tracking_id: str
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


class AuditLogResponse(BaseModel):
    id: int
    user_id: int | None
    user_email: str | None
    action: str
    resource_type: str | None
    resource_id: int | None
    details: dict | None
    ip_address: str | None
    user_agent: str | None
    success: str
    error_message: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    total: int
    logs: List[AuditLogResponse]


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
    request: Request,
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

    # Validate password strength
    is_valid, password_errors = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Password does not meet security requirements",
                "errors": password_errors
            }
        )

    # Encrypt PII data (dual-write: store both plain text and encrypted)
    encryption_service = get_encryption_service()
    encrypted_email = encryption_service.encrypt(user_data.email) if encryption_service else None
    encrypted_full_name = encryption_service.encrypt(user_data.full_name) if encryption_service else None
    encrypted_phone = encryption_service.encrypt(user_data.phone_number) if encryption_service and user_data.phone_number else None

    # Create new user
    new_user = User(
        email=user_data.email,
        email_encrypted=encrypted_email,
        hashed_password=get_password_hash(user_data.password),
        full_name=user_data.full_name,
        full_name_encrypted=encrypted_full_name,
        role=user_role,
        phone_number=user_data.phone_number,
        phone_number_encrypted=encrypted_phone,
        max_deviation_km=user_data.max_deviation_km,
        is_verified=True,  # Admin-created users are auto-verified
        is_active=True
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log user creation
    log_user_create(db, admin, new_user, request)

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
    request: Request,
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

    old_role = user.role.value
    user.role = new_role
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Audit log role change
    log_user_role_change(db, admin, user, old_role, new_role.value, request)

    return user


class ToggleUserActive(BaseModel):
    is_active: bool


class ToggleUserVerified(BaseModel):
    is_verified: bool


class UpdateUserProfile(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None
    max_deviation_km: int | None = None


@router.put("/users/{user_id}/profile", response_model=UserAdminResponse)
async def update_user_profile(
    request: Request,
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

    # Track changes for audit log
    changes = {}

    # Get encryption service for PII dual-write
    encryption_service = get_encryption_service()

    # Update fields if provided (dual-write for PII)
    if profile_update.full_name is not None:
        changes["full_name"] = {"old": user.full_name, "new": profile_update.full_name}
        user.full_name = profile_update.full_name
        user.full_name_encrypted = encryption_service.encrypt(profile_update.full_name) if encryption_service else None

    if profile_update.phone_number is not None:
        changes["phone_number"] = {"old": user.phone_number, "new": profile_update.phone_number}
        user.phone_number = profile_update.phone_number
        user.phone_number_encrypted = encryption_service.encrypt(profile_update.phone_number) if encryption_service else None

    if profile_update.max_deviation_km is not None:
        # Validate max_deviation_km range
        if profile_update.max_deviation_km < 1 or profile_update.max_deviation_km > 500:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Max deviation must be between 1 and 500 km"
            )
        changes["max_deviation_km"] = {"old": user.max_deviation_km, "new": profile_update.max_deviation_km}
        user.max_deviation_km = profile_update.max_deviation_km

    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Audit log profile update
    if changes:
        log_user_update(db, admin, user, changes, request)

    return user


@router.put("/users/{user_id}/toggle-active", response_model=UserAdminResponse)
async def toggle_user_active(
    request: Request,
    user_id: int,
    toggle_data: ToggleUserActive,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Toggle user active status (admin only).

    This provides soft delete functionality - inactive users cannot log in
    but their data is preserved in the database.

    Deactivation is blocked if the user has active packages (not in terminal state).
    Blocking states: NEW, OPEN_FOR_BIDS, BID_SELECTED, PENDING_PICKUP, IN_TRANSIT.
    Allowed states: DELIVERED, CANCELED, FAILED.

    Args:
        user_id: User ID
        toggle_data: New active status
        db: Database session
        admin: Current admin user

    Returns:
        Updated user details

    Raises:
        HTTPException: If user not found, trying to deactivate self, or has active packages
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

    # Check for active packages when deactivating
    if not toggle_data.is_active:
        can_deactivate, error, details = can_deactivate_user(db, user_id)
        if not can_deactivate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={
                    "message": error,
                    "packages_as_sender": details.get("as_sender", []),
                    "packages_as_courier": details.get("as_courier", []),
                }
            )

    user.is_active = toggle_data.is_active
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Audit log activation/deactivation
    if toggle_data.is_active:
        log_user_activate(db, admin, user, request)
    else:
        log_user_deactivate(db, admin, user, request)

    return user


@router.put("/users/{user_id}/toggle-verified", response_model=UserAdminResponse)
async def toggle_user_verified(
    request: Request,
    user_id: int,
    toggle_data: ToggleUserVerified,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Toggle user verified status (admin only).

    Verified users have confirmed their email address or have been manually
    verified by an admin.

    Args:
        user_id: User ID
        toggle_data: New verified status
        db: Database session
        admin: Current admin user

    Returns:
        Updated user details

    Raises:
        HTTPException: If user not found
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    user.is_verified = toggle_data.is_verified
    user.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # Audit log verification/unverification
    if toggle_data.is_verified:
        log_user_verify(db, admin, user, request)
    else:
        log_user_unverify(db, admin, user, request)

    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    request: Request,
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

    # Store user info before deletion for audit log
    deleted_user_email = user.email

    # Delete related packages first (or rely on cascade delete if configured)
    db.query(Package).filter(
        or_(Package.sender_id == user_id, Package.courier_id == user_id)
    ).delete(synchronize_session=False)

    db.delete(user)
    db.commit()

    # Audit log user deletion
    log_user_delete(db, admin, user_id, deleted_user_email, request)

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
    request: Request,
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

    # Audit log package deletion
    log_package_delete(db, admin, package_id, request)

    return None


class TogglePackageActive(BaseModel):
    is_active: bool


@router.put("/packages/{package_id}/toggle-active", response_model=PackageAdminResponse)
async def toggle_package_active(
    request: Request,
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

    # Only allow deactivating packages that are open for bids or new
    if not toggle_data.is_active and package.status not in [PackageStatus.NEW, PackageStatus.OPEN_FOR_BIDS]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only new or open for bids packages can be deactivated. Package is currently in '{}' status.".format(package.status.value)
        )

    package.is_active = toggle_data.is_active
    package.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(package)

    # Audit log package deactivation (only log deactivation, not reactivation)
    if not toggle_data.is_active:
        log_package_deactivate(db, admin, package_id, request)

    return package


# Admin Statistics Endpoint
@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    request: Request,
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
            Package.status == PackageStatus.OPEN_FOR_BIDS,
            Package.status == PackageStatus.BID_SELECTED,
            Package.status == PackageStatus.PENDING_PICKUP,
            Package.status == PackageStatus.IN_TRANSIT
        )
    ).scalar()
    completed_packages = db.query(func.count(Package.id)).filter(
        Package.status == PackageStatus.DELIVERED
    ).scalar()
    pending_packages = db.query(func.count(Package.id)).filter(
        Package.status == PackageStatus.OPEN_FOR_BIDS
    ).scalar()

    # Revenue statistics (sum of all package prices)
    total_revenue = db.query(func.sum(Package.price)).scalar() or 0.0

    # Audit log stats access
    log_admin_stats_access(db, admin, request)

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


# Background Job Management
class RunMatchingJobRequest(BaseModel):
    dry_run: bool = False
    notify_hours_threshold: int = 24


class MatchedPackageInfo(BaseModel):
    package_id: int
    tracking_id: str
    description: str
    distance_km: float
    detour_km: float
    notified: bool


class RouteMatchDetail(BaseModel):
    route_id: int
    courier_id: int
    courier_name: str
    route: str
    matches_found: int
    notifications_sent: int
    matched_packages: List[MatchedPackageInfo]


class MatchingJobResult(BaseModel):
    started_at: str
    completed_at: str
    routes_processed: int
    total_matches_found: int
    notifications_created: int
    notifications_skipped: int
    route_details: List[RouteMatchDetail]


@router.post("/jobs/run-matching", response_model=MatchingJobResult)
async def run_matching_job_endpoint(
    http_request: Request,
    request: RunMatchingJobRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Manually trigger the package-route matching job (admin only).

    This job finds packages that match active courier routes and creates
    notifications for the couriers.

    Args:
        request: Job configuration options
        admin: Current admin user

    Returns:
        Job execution results
    """
    from app.services.matching_job import run_matching_job

    results = run_matching_job(
        notify_hours_threshold=request.notify_hours_threshold,
        dry_run=request.dry_run
    )

    # Audit log matching job execution
    log_matching_job_run(
        db, admin, results['notifications_created'], request.dry_run, http_request
    )

    return MatchingJobResult(
        started_at=results['started_at'],
        completed_at=results['completed_at'],
        routes_processed=results['routes_processed'],
        total_matches_found=results['total_matches_found'],
        notifications_created=results['notifications_created'],
        notifications_skipped=results['notifications_skipped'],
        route_details=results['route_details']
    )


# Audit Log Endpoints
@router.get("/audit-logs", response_model=AuditLogListResponse)
async def get_audit_logs(
    skip: int = 0,
    limit: int = 100,
    action: str | None = None,
    user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: int | None = None,
    success: str | None = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get audit logs (admin only).

    Query params:
    - skip: Number of records to skip (pagination)
    - limit: Maximum number of records to return (max 500)
    - action: Filter by action type (e.g., 'login_success', 'user_create')
    - user_id: Filter by user ID who performed the action
    - resource_type: Filter by resource type (e.g., 'user', 'package', 'route')
    - resource_id: Filter by resource ID
    - success: Filter by success status ('success', 'failed', 'denied')

    Returns:
        List of audit logs with total count
    """
    # Limit max to prevent excessive queries
    limit = min(limit, 500)

    query = db.query(AuditLog)

    # Apply filters
    if action:
        try:
            action_enum = AuditAction(action)
            query = query.filter(AuditLog.action == action_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid action type: {action}"
            )

    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    if resource_type:
        query = query.filter(AuditLog.resource_type == resource_type)

    if resource_id:
        query = query.filter(AuditLog.resource_id == resource_id)

    if success:
        query = query.filter(AuditLog.success == success)

    # Get total count before pagination
    total = query.count()

    # Apply pagination and ordering
    logs = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit).all()

    # Convert to response format
    log_responses = [
        AuditLogResponse(
            id=log.id,
            user_id=log.user_id,
            user_email=log.user_email,
            action=log.action.value,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            details=log.details,
            ip_address=log.ip_address,
            user_agent=log.user_agent,
            success=log.success,
            error_message=log.error_message,
            created_at=log.created_at
        )
        for log in logs
    ]

    return AuditLogListResponse(total=total, logs=log_responses)


@router.get("/audit-logs/actions", response_model=List[str])
async def get_audit_log_actions(
    admin: User = Depends(get_current_admin_user)
):
    """
    Get list of all available audit log action types (admin only).

    Returns:
        List of action type strings
    """
    return [action.value for action in AuditAction]


@router.get("/audit-logs/{log_id}", response_model=AuditLogResponse)
async def get_audit_log_by_id(
    log_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get a specific audit log by ID (admin only).

    Args:
        log_id: Audit log ID

    Returns:
        Audit log details

    Raises:
        HTTPException: If audit log not found
    """
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audit log not found"
        )

    return AuditLogResponse(
        id=log.id,
        user_id=log.user_id,
        user_email=log.user_email,
        action=log.action.value,
        resource_type=log.resource_type,
        resource_id=log.resource_id,
        details=log.details,
        ip_address=log.ip_address,
        user_agent=log.user_agent,
        success=log.success,
        error_message=log.error_message,
        created_at=log.created_at
    )


# Route Cleanup Job Schemas
class RouteCleanupJobRequest(BaseModel):
    dry_run: bool = Field(default=False, description="If true, don't make changes")


class DeactivatedRouteDetail(BaseModel):
    route_id: int
    courier_id: int
    trip_date: str | None
    start_address: str | None
    end_address: str | None


class RouteCleanupJobResult(BaseModel):
    started_at: str
    completed_at: str
    dry_run: bool
    routes_deactivated: int
    deactivated_routes: List[DeactivatedRouteDetail]


@router.post("/jobs/run-route-cleanup", response_model=RouteCleanupJobResult)
async def run_route_cleanup_job_endpoint(
    http_request: Request,
    request: RouteCleanupJobRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Manually trigger the route cleanup job (admin only).

    This job deactivates courier routes whose trip_date has passed,
    as they are no longer relevant for package matching.

    Args:
        request: Job configuration options
        admin: Current admin user

    Returns:
        Job execution results
    """
    from app.services.route_cleanup_job import run_route_cleanup_job

    results = run_route_cleanup_job(dry_run=request.dry_run, db=db)

    return RouteCleanupJobResult(
        started_at=results['started_at'],
        completed_at=results['completed_at'],
        dry_run=results['dry_run'],
        routes_deactivated=results['routes_deactivated'],
        deactivated_routes=[
            DeactivatedRouteDetail(**route) for route in results['deactivated_routes']
        ]
    )


# Response model for retry endpoint
class PackageRetryResponse(BaseModel):
    id: int
    status: str
    message: str


@router.post("/packages/{package_id}/retry", response_model=PackageRetryResponse)
async def retry_failed_package(
    package_id: int,
    http_request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Retry a failed package by returning it to OPEN_FOR_BIDS status.

    This endpoint is admin-only and allows failed deliveries to be
    retried by opening them up for new courier bids.

    Args:
        package_id: The ID of the package to retry

    Returns:
        Updated package status information
    """
    # Get the package
    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Verify package is in FAILED status
    if package.status != PackageStatus.FAILED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only retry packages with FAILED status. Current status: {package.status.value}"
        )

    # Clear previous courier assignment
    package.courier_id = None
    package.selected_bid_id = None

    # Transition to OPEN_FOR_BIDS (is_admin=True allows FAILED -> OPEN_FOR_BIDS)
    transition_package(
        db=db,
        package=package,
        new_status=PackageStatus.OPEN_FOR_BIDS,
        is_admin=True
    )

    # Log audit
    log_audit(
        db=db,
        user_id=admin.id,
        action="package_retry",
        resource_type="package",
        resource_id=package.id,
        details={
            "previous_status": PackageStatus.FAILED.value,
            "new_status": PackageStatus.OPEN_FOR_BIDS.value
        },
        success=True,
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent")
    )

    return PackageRetryResponse(
        id=package.id,
        status=package.status.value,
        message="Package has been returned to OPEN_FOR_BIDS status for new courier bids"
    )


class MarkFailedRequest(BaseModel):
    reason: str = Field(..., min_length=1, max_length=500, description="Reason for marking the package as failed")


class PackageFailedResponse(BaseModel):
    id: int
    status: str
    reason: str
    message: str


@router.post("/packages/{package_id}/fail", response_model=PackageFailedResponse)
async def mark_package_failed(
    package_id: int,
    fail_request: MarkFailedRequest,
    http_request: Request,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Mark a package as FAILED (admin only).

    This endpoint is admin-only and allows marking packages as failed
    when there are issues with the delivery. The package must be in
    IN_TRANSIT status (package must be picked up and in transit).

    Args:
        package_id: The ID of the package to mark as failed
        fail_request: Contains the reason for failure

    Returns:
        Updated package status information
    """
    # Get the package
    package = db.query(Package).filter(Package.id == package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Verify package is in IN_TRANSIT status
    if package.status != PackageStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Can only mark packages as failed from IN_TRANSIT status. Current status: {package.status.value}"
        )

    old_status = package.status

    # Transition to FAILED (is_admin=True allows the transition)
    package, error = transition_package(
        db=db,
        package=package,
        target_status=PackageStatus.FAILED,
        actor_id=admin.id,
        is_admin=True
    )

    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )

    # Log audit
    log_audit(
        db=db,
        user=admin,
        action=AuditAction.PACKAGE_STATUS_CHANGE,
        resource_type="package",
        resource_id=package.id,
        details={
            "previous_status": old_status.value,
            "new_status": PackageStatus.FAILED.value,
            "reason": fail_request.reason
        },
        success=True,
        ip_address=http_request.client.host if http_request.client else None,
        user_agent=http_request.headers.get("user-agent")
    )

    return PackageFailedResponse(
        id=package.id,
        status=package.status.value,
        reason=fail_request.reason,
        message=f"Package has been marked as FAILED. Reason: {fail_request.reason}"
    )


# ============================================================
# Admin Messages & Notes Endpoints
# ============================================================

class AdminMessageResponse(BaseModel):
    id: int
    package_id: int
    package_description: str
    sender_id: int
    sender_name: str
    sender_email: str
    content: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True


class AdminMessageListResponse(BaseModel):
    messages: List[AdminMessageResponse]
    total: int


class AdminNoteResponse(BaseModel):
    id: int
    package_id: int
    package_description: str
    author_id: Optional[int]
    author_name: Optional[str]
    author_email: Optional[str]
    author_type: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class AdminNoteListResponse(BaseModel):
    notes: List[AdminNoteResponse]
    total: int


class AdminConversationSummary(BaseModel):
    package_id: int
    package_description: str
    sender_id: int
    sender_name: str
    courier_id: Optional[int]
    courier_name: Optional[str]
    message_count: int
    last_message_at: datetime
    last_message_preview: str


class AdminConversationListResponse(BaseModel):
    conversations: List[AdminConversationSummary]
    total: int


@router.get("/messages", response_model=AdminMessageListResponse)
async def get_all_messages(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    package_id: Optional[int] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all messages across all packages (admin only).

    Query params:
    - skip: Number of records to skip (pagination)
    - limit: Maximum number of records to return (max 500)
    - package_id: Filter by package ID
    - user_id: Filter by sender user ID

    Returns:
        List of all messages with package and sender details
    """
    query = db.query(Message)

    if package_id:
        query = query.filter(Message.package_id == package_id)
    if user_id:
        query = query.filter(Message.sender_id == user_id)

    total = query.count()
    messages = query.order_by(desc(Message.created_at)).offset(skip).limit(limit).all()

    result = []
    for msg in messages:
        package = db.query(Package).filter(Package.id == msg.package_id).first()
        sender = db.query(User).filter(User.id == msg.sender_id).first()

        result.append(AdminMessageResponse(
            id=msg.id,
            package_id=msg.package_id,
            package_description=package.description[:50] + "..." if package and len(package.description) > 50 else (package.description if package else "Unknown"),
            sender_id=msg.sender_id,
            sender_name=sender.full_name if sender else "Unknown",
            sender_email=sender.email if sender else "Unknown",
            content=msg.content,
            is_read=msg.is_read,
            created_at=msg.created_at
        ))

    return AdminMessageListResponse(messages=result, total=total)


@router.get("/conversations", response_model=AdminConversationListResponse)
async def get_all_conversations(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all package conversations (admin only).

    Returns a summary of all packages that have messages, with the message count
    and last message preview.

    Returns:
        List of conversation summaries
    """
    # Get packages with messages, grouped by package
    packages_with_messages = db.query(
        Message.package_id,
        func.count(Message.id).label('message_count'),
        func.max(Message.created_at).label('last_message_at'),
        func.max(Message.id).label('last_message_id')
    ).group_by(Message.package_id).subquery()

    total = db.query(packages_with_messages).count()

    # Get ordered list
    conversations_query = db.query(
        packages_with_messages.c.package_id,
        packages_with_messages.c.message_count,
        packages_with_messages.c.last_message_at,
        packages_with_messages.c.last_message_id
    ).order_by(desc(packages_with_messages.c.last_message_at)).offset(skip).limit(limit).all()

    result = []
    for pkg_id, msg_count, last_at, last_msg_id in conversations_query:
        package = db.query(Package).filter(Package.id == pkg_id).first()
        if not package:
            continue

        sender = db.query(User).filter(User.id == package.sender_id).first()
        courier = db.query(User).filter(User.id == package.courier_id).first() if package.courier_id else None
        last_message = db.query(Message).filter(Message.id == last_msg_id).first()

        result.append(AdminConversationSummary(
            package_id=pkg_id,
            package_description=package.description[:50] + "..." if len(package.description) > 50 else package.description,
            sender_id=package.sender_id,
            sender_name=sender.full_name if sender else "Unknown",
            courier_id=package.courier_id,
            courier_name=courier.full_name if courier else None,
            message_count=msg_count,
            last_message_at=last_at,
            last_message_preview=last_message.content[:100] + "..." if last_message and len(last_message.content) > 100 else (last_message.content if last_message else "")
        ))

    return AdminConversationListResponse(conversations=result, total=total)


@router.get("/packages/{package_id}/messages", response_model=AdminMessageListResponse)
async def get_package_messages_admin(
    package_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all messages for a specific package (admin only).

    Returns:
        List of all messages for the package with sender details
    """
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    query = db.query(Message).filter(Message.package_id == package_id)
    total = query.count()
    messages = query.order_by(Message.created_at).offset(skip).limit(limit).all()

    result = []
    for msg in messages:
        sender = db.query(User).filter(User.id == msg.sender_id).first()

        result.append(AdminMessageResponse(
            id=msg.id,
            package_id=msg.package_id,
            package_description=package.description[:50] + "..." if len(package.description) > 50 else package.description,
            sender_id=msg.sender_id,
            sender_name=sender.full_name if sender else "Unknown",
            sender_email=sender.email if sender else "Unknown",
            content=msg.content,
            is_read=msg.is_read,
            created_at=msg.created_at
        ))

    return AdminMessageListResponse(messages=result, total=total)


@router.get("/notes", response_model=AdminNoteListResponse)
async def get_all_notes(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    package_id: Optional[int] = None,
    author_id: Optional[int] = None,
    author_type: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all package notes across all packages (admin only).

    Query params:
    - skip: Number of records to skip (pagination)
    - limit: Maximum number of records to return (max 500)
    - package_id: Filter by package ID
    - author_id: Filter by author user ID
    - author_type: Filter by author type (SENDER, COURIER, SYSTEM)

    Returns:
        List of all notes with package and author details
    """
    query = db.query(PackageNote)

    if package_id:
        query = query.filter(PackageNote.package_id == package_id)
    if author_id:
        query = query.filter(PackageNote.author_id == author_id)
    if author_type:
        try:
            note_type = NoteAuthorType(author_type.upper())
            query = query.filter(PackageNote.author_type == note_type)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid author_type. Must be one of: SENDER, COURIER, SYSTEM"
            )

    total = query.count()
    notes = query.order_by(desc(PackageNote.created_at)).offset(skip).limit(limit).all()

    result = []
    for note in notes:
        package = db.query(Package).filter(Package.id == note.package_id).first()
        author = db.query(User).filter(User.id == note.author_id).first() if note.author_id else None

        author_name = None
        author_email = None
        if author:
            author_name = author.full_name
            author_email = author.email
        elif note.author_type == NoteAuthorType.SYSTEM:
            author_name = "System"

        result.append(AdminNoteResponse(
            id=note.id,
            package_id=note.package_id,
            package_description=package.description[:50] + "..." if package and len(package.description) > 50 else (package.description if package else "Unknown"),
            author_id=note.author_id,
            author_name=author_name,
            author_email=author_email,
            author_type=note.author_type.value,
            content=note.content,
            created_at=note.created_at
        ))

    return AdminNoteListResponse(notes=result, total=total)


@router.get("/packages/{package_id}/notes", response_model=AdminNoteListResponse)
async def get_package_notes_admin(
    package_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db),
    admin: User = Depends(get_current_admin_user)
):
    """
    Get all notes for a specific package (admin only).

    Returns:
        List of all notes for the package with author details
    """
    package = db.query(Package).filter(Package.id == package_id).first()
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    query = db.query(PackageNote).filter(PackageNote.package_id == package_id)
    total = query.count()
    notes = query.order_by(PackageNote.created_at).offset(skip).limit(limit).all()

    result = []
    for note in notes:
        author = db.query(User).filter(User.id == note.author_id).first() if note.author_id else None

        author_name = None
        author_email = None
        if author:
            author_name = author.full_name
            author_email = author.email
        elif note.author_type == NoteAuthorType.SYSTEM:
            author_name = "System"

        result.append(AdminNoteResponse(
            id=note.id,
            package_id=note.package_id,
            package_description=package.description[:50] + "..." if len(package.description) > 50 else package.description,
            author_id=note.author_id,
            author_name=author_name,
            author_email=author_email,
            author_type=note.author_type.value,
            content=note.content,
            created_at=note.created_at
        ))

    return AdminNoteListResponse(notes=result, total=total)
