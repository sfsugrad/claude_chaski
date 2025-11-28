"""
Package status transition validation and service.
Enforces strict status progression: MATCHED → PICKED_UP → IN_TRANSIT → DELIVERED
"""
from datetime import datetime
from typing import Tuple, List, Optional
from sqlalchemy.orm import Session

from app.models.package import Package, PackageStatus
from app.models.user import User


# Define allowed status transitions
ALLOWED_TRANSITIONS = {
    PackageStatus.PENDING: [PackageStatus.MATCHED, PackageStatus.CANCELLED],
    PackageStatus.MATCHED: [PackageStatus.PICKED_UP, PackageStatus.PENDING, PackageStatus.CANCELLED],
    PackageStatus.PICKED_UP: [PackageStatus.IN_TRANSIT],
    PackageStatus.IN_TRANSIT: [PackageStatus.DELIVERED],
    PackageStatus.DELIVERED: [],  # Terminal state
    PackageStatus.CANCELLED: [],  # Terminal state
}

# Human-readable status names for error messages
STATUS_LABELS = {
    PackageStatus.PENDING: "Pending",
    PackageStatus.MATCHED: "Matched",
    PackageStatus.PICKED_UP: "Picked Up",
    PackageStatus.IN_TRANSIT: "In Transit",
    PackageStatus.DELIVERED: "Delivered",
    PackageStatus.CANCELLED: "Cancelled",
}

# Required progression path for delivery
DELIVERY_PATH = [
    PackageStatus.PENDING,
    PackageStatus.MATCHED,
    PackageStatus.PICKED_UP,
    PackageStatus.IN_TRANSIT,
    PackageStatus.DELIVERED,
]


def validate_transition(current: PackageStatus, target: PackageStatus) -> Tuple[bool, str]:
    """
    Validate if a status transition is allowed.

    Args:
        current: Current package status
        target: Target package status

    Returns:
        Tuple of (is_valid, error_message)
    """
    if current == target:
        return False, f"Package is already in {STATUS_LABELS[current]} status"

    if target not in ALLOWED_TRANSITIONS.get(current, []):
        allowed = ALLOWED_TRANSITIONS.get(current, [])
        if not allowed:
            return False, f"Cannot change status from {STATUS_LABELS[current]} - this is a terminal state"

        allowed_names = [STATUS_LABELS[s] for s in allowed]
        return False, (
            f"Invalid status transition: Cannot go from {STATUS_LABELS[current]} to {STATUS_LABELS[target]}. "
            f"Allowed next statuses: {', '.join(allowed_names)}"
        )

    return True, ""


def get_allowed_next_statuses(current: PackageStatus) -> List[str]:
    """
    Get list of allowed next statuses for a given current status.

    Args:
        current: Current package status

    Returns:
        List of allowed status values
    """
    return [s.value for s in ALLOWED_TRANSITIONS.get(current, [])]


def can_mark_delivered(package: Package) -> Tuple[bool, str]:
    """
    Check if a package can be marked as delivered.
    Verifies proof requirement and current status.

    Args:
        package: The package to check

    Returns:
        Tuple of (can_deliver, error_message)
    """
    # Must be in IN_TRANSIT status
    if package.status != PackageStatus.IN_TRANSIT:
        return False, (
            f"Package must be In Transit before marking as Delivered. "
            f"Current status: {STATUS_LABELS[package.status]}"
        )

    # If proof is required, check that delivery proof exists
    if package.requires_proof:
        # This will be checked by the delivery proof service
        # Here we just indicate that proof is required
        return True, "proof_required"

    return True, ""


def transition_package(
    db: Session,
    package: Package,
    target_status: PackageStatus,
    actor_id: int,
    force: bool = False
) -> Tuple[Package, str]:
    """
    Transition a package to a new status with validation.

    Args:
        db: Database session
        package: The package to transition
        target_status: The target status
        actor_id: ID of the user performing the action
        force: If True, skip validation (admin only)

    Returns:
        Tuple of (updated_package, error_message)
        If error_message is not empty, the transition failed
    """
    if not force:
        is_valid, error = validate_transition(package.status, target_status)
        if not is_valid:
            return package, error

    # Record the transition
    now = datetime.utcnow()
    old_status = package.status
    package.status = target_status
    package.status_changed_at = now

    # Update specific timestamp fields based on target status
    if target_status == PackageStatus.MATCHED:
        package.matched_at = now
        package.courier_id = actor_id  # Set courier when matched
    elif target_status == PackageStatus.PICKED_UP:
        package.picked_up_at = now
        package.pickup_time = now  # Also update legacy field
    elif target_status == PackageStatus.IN_TRANSIT:
        package.in_transit_at = now
    elif target_status == PackageStatus.DELIVERED:
        package.delivery_time = now
    elif target_status == PackageStatus.PENDING:
        # Courier declined - clear courier assignment
        if old_status == PackageStatus.MATCHED:
            package.courier_id = None
            package.matched_at = None

    db.commit()
    db.refresh(package)

    return package, ""


def get_status_progress(package: Package) -> dict:
    """
    Get the progress of a package through the delivery lifecycle.

    Args:
        package: The package to check

    Returns:
        Dict with progress information
    """
    current_index = -1
    for i, status in enumerate(DELIVERY_PATH):
        if package.status == status:
            current_index = i
            break

    # Handle cancelled separately
    if package.status == PackageStatus.CANCELLED:
        return {
            "current_step": -1,
            "total_steps": len(DELIVERY_PATH) - 1,  # Exclude PENDING from count
            "is_terminal": True,
            "is_cancelled": True,
            "progress_percent": 0,
            "steps": _build_steps(package, -1),
        }

    return {
        "current_step": current_index,
        "total_steps": len(DELIVERY_PATH) - 1,  # Exclude PENDING from count
        "is_terminal": package.status in [PackageStatus.DELIVERED, PackageStatus.CANCELLED],
        "is_cancelled": False,
        "progress_percent": int((current_index / (len(DELIVERY_PATH) - 1)) * 100) if current_index > 0 else 0,
        "steps": _build_steps(package, current_index),
    }


def _build_steps(package: Package, current_index: int) -> List[dict]:
    """Build step information for progress display."""
    steps = []
    timestamps = {
        PackageStatus.PENDING: package.created_at,
        PackageStatus.MATCHED: package.matched_at,
        PackageStatus.PICKED_UP: package.picked_up_at,
        PackageStatus.IN_TRANSIT: package.in_transit_at,
        PackageStatus.DELIVERED: package.delivery_time,
    }

    for i, status in enumerate(DELIVERY_PATH):
        if status == PackageStatus.PENDING:
            continue  # Skip pending in display

        timestamp = timestamps.get(status)
        steps.append({
            "status": status.value,
            "label": STATUS_LABELS[status],
            "completed": i <= current_index if current_index >= 0 else False,
            "current": i == current_index,
            "timestamp": timestamp.isoformat() if timestamp else None,
        })

    return steps
