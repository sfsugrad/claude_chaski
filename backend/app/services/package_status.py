"""
Package status transition validation and service.
Enforces strict status progression: NEW → OPEN_FOR_BIDS → BID_SELECTED → PENDING_PICKUP → IN_TRANSIT → DELIVERED

FAILED status can occur from PENDING_PICKUP or IN_TRANSIT, and only admins can retry (→ OPEN_FOR_BIDS).
CANCELED can occur from any non-terminal state.
"""
from datetime import datetime
from typing import Tuple, List
from sqlalchemy.orm import Session

from app.models.package import Package, PackageStatus


# Define allowed status transitions
ALLOWED_TRANSITIONS = {
    PackageStatus.NEW: [PackageStatus.OPEN_FOR_BIDS, PackageStatus.CANCELED],
    PackageStatus.OPEN_FOR_BIDS: [PackageStatus.BID_SELECTED, PackageStatus.CANCELED],
    PackageStatus.BID_SELECTED: [PackageStatus.PENDING_PICKUP, PackageStatus.OPEN_FOR_BIDS, PackageStatus.CANCELED],
    PackageStatus.PENDING_PICKUP: [PackageStatus.IN_TRANSIT, PackageStatus.FAILED, PackageStatus.CANCELED],
    PackageStatus.IN_TRANSIT: [PackageStatus.DELIVERED, PackageStatus.FAILED],
    PackageStatus.DELIVERED: [],  # Terminal state
    PackageStatus.CANCELED: [],  # Terminal state
    PackageStatus.FAILED: [PackageStatus.OPEN_FOR_BIDS],  # Admin only retry
}

# Human-readable status names for error messages
STATUS_LABELS = {
    PackageStatus.NEW: "New",
    PackageStatus.OPEN_FOR_BIDS: "Open for Bids",
    PackageStatus.BID_SELECTED: "Bid Selected",
    PackageStatus.PENDING_PICKUP: "Pending Pickup",
    PackageStatus.IN_TRANSIT: "In Transit",
    PackageStatus.DELIVERED: "Delivered",
    PackageStatus.CANCELED: "Canceled",
    PackageStatus.FAILED: "Failed",
}

# Required progression path for delivery
DELIVERY_PATH = [
    PackageStatus.NEW,
    PackageStatus.OPEN_FOR_BIDS,
    PackageStatus.BID_SELECTED,
    PackageStatus.PENDING_PICKUP,
    PackageStatus.IN_TRANSIT,
    PackageStatus.DELIVERED,
]

# Terminal states that cannot transition further (except FAILED with admin retry)
TERMINAL_STATES = [PackageStatus.DELIVERED, PackageStatus.CANCELED]


def validate_transition(
    current: PackageStatus,
    target: PackageStatus,
    is_admin: bool = False
) -> Tuple[bool, str]:
    """
    Validate if a status transition is allowed.

    Args:
        current: Current package status
        target: Target package status
        is_admin: Whether the actor is an admin (required for FAILED → OPEN_FOR_BIDS)

    Returns:
        Tuple of (is_valid, error_message)
    """
    if current == target:
        return False, f"Package is already in {STATUS_LABELS[current]} status"

    # Special case: FAILED → OPEN_FOR_BIDS requires admin
    if current == PackageStatus.FAILED and target == PackageStatus.OPEN_FOR_BIDS:
        if not is_admin:
            return False, "Only administrators can retry failed packages"
        return True, ""

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


def get_allowed_next_statuses(current: PackageStatus, is_admin: bool = False) -> List[str]:
    """
    Get list of allowed next statuses for a given current status.

    Args:
        current: Current package status
        is_admin: Whether the actor is an admin

    Returns:
        List of allowed status values
    """
    allowed = ALLOWED_TRANSITIONS.get(current, [])

    # If not admin and current is FAILED, they can't transition
    if current == PackageStatus.FAILED and not is_admin:
        return []

    return [s.value for s in allowed]


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
    is_admin: bool = False,
    force: bool = False
) -> Tuple[Package, str]:
    """
    Transition a package to a new status with validation.

    Args:
        db: Database session
        package: The package to transition
        target_status: The target status
        actor_id: ID of the user performing the action
        is_admin: Whether the actor is an admin
        force: If True, skip validation (admin only)

    Returns:
        Tuple of (updated_package, error_message)
        If error_message is not empty, the transition failed
    """
    if not force:
        is_valid, error = validate_transition(package.status, target_status, is_admin)
        if not is_valid:
            return package, error

    # Record the transition
    now = datetime.utcnow()
    old_status = package.status
    package.status = target_status
    package.status_changed_at = now

    # Update specific timestamp fields based on target status
    if target_status == PackageStatus.OPEN_FOR_BIDS:
        # When retrying from FAILED, clear the failed state
        if old_status == PackageStatus.FAILED:
            package.failed_at = None
            package.courier_id = None
    elif target_status == PackageStatus.BID_SELECTED:
        package.bid_selected_at = now
        # courier_id is set when bid is selected (in bids.py)
    elif target_status == PackageStatus.PENDING_PICKUP:
        package.pending_pickup_at = now
    elif target_status == PackageStatus.IN_TRANSIT:
        package.in_transit_at = now
        package.pickup_time = now  # Also update pickup_time for compatibility
    elif target_status == PackageStatus.DELIVERED:
        package.delivery_time = now
    elif target_status == PackageStatus.FAILED:
        package.failed_at = now
    elif target_status == PackageStatus.CANCELED:
        # Clear courier assignment if canceling before delivery
        if old_status in [PackageStatus.BID_SELECTED, PackageStatus.PENDING_PICKUP]:
            package.courier_id = None

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

    # Handle special states
    if package.status == PackageStatus.CANCELED:
        return {
            "current_step": -1,
            "total_steps": len(DELIVERY_PATH) - 1,  # Exclude NEW from count
            "is_terminal": True,
            "is_canceled": True,
            "is_failed": False,
            "progress_percent": 0,
            "steps": _build_steps(package, -1),
        }

    if package.status == PackageStatus.FAILED:
        return {
            "current_step": -1,
            "total_steps": len(DELIVERY_PATH) - 1,
            "is_terminal": False,  # Can be retried by admin
            "is_canceled": False,
            "is_failed": True,
            "progress_percent": 0,
            "steps": _build_steps(package, -1),
        }

    return {
        "current_step": current_index,
        "total_steps": len(DELIVERY_PATH) - 1,  # Exclude NEW from count
        "is_terminal": package.status == PackageStatus.DELIVERED,
        "is_canceled": False,
        "is_failed": False,
        "progress_percent": int((current_index / (len(DELIVERY_PATH) - 1)) * 100) if current_index > 0 else 0,
        "steps": _build_steps(package, current_index),
    }


def _build_steps(package: Package, current_index: int) -> List[dict]:
    """Build step information for progress display."""
    steps = []
    timestamps = {
        PackageStatus.NEW: package.created_at,
        PackageStatus.OPEN_FOR_BIDS: package.status_changed_at if package.status == PackageStatus.OPEN_FOR_BIDS else None,
        PackageStatus.BID_SELECTED: package.bid_selected_at,
        PackageStatus.PENDING_PICKUP: package.pending_pickup_at,
        PackageStatus.IN_TRANSIT: package.in_transit_at,
        PackageStatus.DELIVERED: package.delivery_time,
    }

    for i, status in enumerate(DELIVERY_PATH):
        if status == PackageStatus.NEW:
            continue  # Skip NEW in display

        timestamp = timestamps.get(status)
        steps.append({
            "status": status.value,
            "label": STATUS_LABELS[status],
            "completed": i <= current_index if current_index >= 0 else False,
            "current": i == current_index,
            "timestamp": timestamp.isoformat() if timestamp else None,
        })

    return steps


def is_terminal_state(status: PackageStatus) -> bool:
    """Check if a status is a terminal state."""
    return status in TERMINAL_STATES


def can_cancel(status_or_package) -> bool:
    """
    Check if a package/status can be canceled.

    Args:
        status_or_package: Either a PackageStatus enum or a Package object

    Returns:
        Boolean indicating if cancellation is allowed
    """
    # Get status from either Package or PackageStatus
    if isinstance(status_or_package, Package):
        status = status_or_package.status
    else:
        status = status_or_package

    # Cannot cancel terminal states
    if status in TERMINAL_STATES:
        return False

    # Cannot cancel FAILED (must retry or leave as is)
    if status == PackageStatus.FAILED:
        return False

    # Cannot cancel IN_TRANSIT (package is already with courier)
    if status == PackageStatus.IN_TRANSIT:
        return False

    return True


def can_cancel_with_reason(package: Package) -> Tuple[bool, str]:
    """
    Check if a package can be canceled, with error message.

    Args:
        package: The package to check

    Returns:
        Tuple of (can_cancel, error_message)
    """
    # Cannot cancel terminal states
    if package.status in TERMINAL_STATES:
        return False, f"Cannot cancel a package that is already {STATUS_LABELS[package.status]}"

    # Cannot cancel FAILED (must retry or leave as is)
    if package.status == PackageStatus.FAILED:
        return False, "Cannot cancel a failed package. Contact admin to retry or resolve."

    # Cannot cancel IN_TRANSIT (package is already with courier)
    if package.status == PackageStatus.IN_TRANSIT:
        return False, "Cannot cancel a package that is in transit"

    return True, ""
