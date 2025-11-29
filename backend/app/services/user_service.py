"""
User service for user-related business logic.
"""
from typing import List, Tuple
from sqlalchemy.orm import Session

from app.models.package import Package, PackageStatus


# Statuses that block user deactivation
BLOCKING_STATUSES = [
    PackageStatus.NEW,
    PackageStatus.OPEN_FOR_BIDS,
    PackageStatus.BID_SELECTED,
    PackageStatus.PENDING_PICKUP,
    PackageStatus.IN_TRANSIT,
]


def get_user_active_packages(db: Session, user_id: int) -> Tuple[List[Package], List[Package]]:
    """
    Get active packages for a user (as sender and as courier).

    Active packages are those not in terminal states (DELIVERED, CANCELED)
    and not in FAILED state.

    Args:
        db: Database session
        user_id: User ID to check

    Returns:
        Tuple of (packages_as_sender, packages_as_courier)
    """
    as_sender = db.query(Package).filter(
        Package.sender_id == user_id,
        Package.is_active == True,
        Package.status.in_(BLOCKING_STATUSES)
    ).all()

    as_courier = db.query(Package).filter(
        Package.courier_id == user_id,
        Package.is_active == True,
        Package.status.in_(BLOCKING_STATUSES)
    ).all()

    return as_sender, as_courier


def can_deactivate_user(db: Session, user_id: int) -> Tuple[bool, str, dict]:
    """
    Check if a user can be deactivated.

    A user cannot be deactivated if they have active packages
    (packages not in DELIVERED, CANCELED, or FAILED state).

    Args:
        db: Database session
        user_id: User ID to check

    Returns:
        Tuple of (can_deactivate, error_message, details)
        - can_deactivate: True if user can be deactivated
        - error_message: Error message if cannot deactivate
        - details: Dict with package IDs as sender and courier
    """
    as_sender, as_courier = get_user_active_packages(db, user_id)

    if not as_sender and not as_courier:
        return True, "", {}

    details = {
        "as_sender": [p.id for p in as_sender],
        "as_courier": [p.id for p in as_courier],
    }

    parts = []
    if as_sender:
        parts.append(f"{len(as_sender)} package(s) as sender")
    if as_courier:
        parts.append(f"{len(as_courier)} package(s) as courier")

    error = f"Cannot deactivate user with active packages: {' and '.join(parts)}"
    return False, error, details


def can_change_user_role(db: Session, user_id: int) -> Tuple[bool, str, dict]:
    """
    Check if a user's role can be changed.

    A user's role cannot be changed if they have active packages
    (packages not in DELIVERED, CANCELED, or FAILED state).

    This prevents situations where:
    - A sender loses access to their in-progress packages
    - A courier loses ability to complete assigned deliveries
    - Role permissions become inconsistent mid-delivery

    Args:
        db: Database session
        user_id: User ID to check

    Returns:
        Tuple of (can_change, error_message, details)
        - can_change: True if role can be changed
        - error_message: Error message if cannot change
        - details: Dict with package IDs as sender and courier
    """
    as_sender, as_courier = get_user_active_packages(db, user_id)

    if not as_sender and not as_courier:
        return True, "", {}

    details = {
        "as_sender": [p.id for p in as_sender],
        "as_courier": [p.id for p in as_courier],
    }

    parts = []
    if as_sender:
        parts.append(f"{len(as_sender)} package(s) as sender")
    if as_courier:
        parts.append(f"{len(as_courier)} package(s) as courier")

    error = f"Cannot change role for user with active packages: {' and '.join(parts)}. Please wait until all packages reach a terminal state (DELIVERED, CANCELED, or FAILED)."
    return False, error, details
