"""
Package status transition validation and service.
Enforces strict status progression: MATCHED → ACCEPTED → PICKED_UP → IN_TRANSIT → DELIVERED

The ACCEPTED status requires both sender and courier to explicitly accept the match.
"""
from datetime import datetime
from typing import Tuple, List, Optional
from sqlalchemy.orm import Session

from app.models.package import Package, PackageStatus
from app.models.user import User


# Define allowed status transitions
ALLOWED_TRANSITIONS = {
    # New bidding workflow
    PackageStatus.PENDING: [PackageStatus.BIDDING, PackageStatus.MATCHED, PackageStatus.CANCELLED],
    PackageStatus.BIDDING: [PackageStatus.BID_SELECTED, PackageStatus.PENDING, PackageStatus.CANCELLED],
    PackageStatus.BID_SELECTED: [PackageStatus.PENDING_PICKUP, PackageStatus.BIDDING, PackageStatus.CANCELLED],
    PackageStatus.PENDING_PICKUP: [PackageStatus.PICKED_UP, PackageStatus.CANCELLED],
    PackageStatus.PICKED_UP: [PackageStatus.IN_TRANSIT],
    PackageStatus.IN_TRANSIT: [PackageStatus.DELIVERED],
    PackageStatus.DELIVERED: [],  # Terminal state
    PackageStatus.CANCELLED: [],  # Terminal state
    # Legacy workflow (keep for existing data)
    PackageStatus.MATCHED: [PackageStatus.ACCEPTED, PackageStatus.PENDING, PackageStatus.CANCELLED],
    PackageStatus.ACCEPTED: [PackageStatus.PICKED_UP, PackageStatus.CANCELLED],
}

# Human-readable status names for error messages
STATUS_LABELS = {
    PackageStatus.PENDING: "Pending",
    PackageStatus.BIDDING: "Open for Bidding",
    PackageStatus.BID_SELECTED: "Bid Selected",
    PackageStatus.PENDING_PICKUP: "Pending Pickup",
    PackageStatus.PICKED_UP: "Picked Up",
    PackageStatus.IN_TRANSIT: "In Transit",
    PackageStatus.DELIVERED: "Delivered",
    PackageStatus.CANCELLED: "Cancelled",
    # Legacy statuses
    PackageStatus.MATCHED: "Matched (Awaiting Acceptance)",
    PackageStatus.ACCEPTED: "Accepted",
}

# Required progression path for delivery (new bidding workflow)
DELIVERY_PATH = [
    PackageStatus.PENDING,
    PackageStatus.BIDDING,
    PackageStatus.BID_SELECTED,
    PackageStatus.PENDING_PICKUP,
    PackageStatus.PICKED_UP,
    PackageStatus.IN_TRANSIT,
    PackageStatus.DELIVERED,
]

# Legacy delivery path (for existing packages)
LEGACY_DELIVERY_PATH = [
    PackageStatus.PENDING,
    PackageStatus.MATCHED,
    PackageStatus.ACCEPTED,
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
        # Reset acceptance flags for new match
        package.sender_accepted = False
        package.courier_accepted = False
        package.sender_accepted_at = None
        package.courier_accepted_at = None
    elif target_status == PackageStatus.ACCEPTED:
        package.accepted_at = now
    elif target_status == PackageStatus.PICKED_UP:
        package.picked_up_at = now
        package.pickup_time = now  # Also update legacy field
    elif target_status == PackageStatus.IN_TRANSIT:
        package.in_transit_at = now
    elif target_status == PackageStatus.DELIVERED:
        package.delivery_time = now
    elif target_status == PackageStatus.PENDING:
        # Courier declined or match reset - clear courier assignment
        if old_status in [PackageStatus.MATCHED, PackageStatus.ACCEPTED]:
            package.courier_id = None
            package.matched_at = None
            package.accepted_at = None
            package.sender_accepted = False
            package.courier_accepted = False
            package.sender_accepted_at = None
            package.courier_accepted_at = None

    db.commit()
    db.refresh(package)

    return package, ""


def accept_package_match(
    db: Session,
    package: Package,
    user_id: int,
    is_sender: bool
) -> Tuple[Package, str]:
    """
    Record acceptance from sender or courier for a matched package.
    When both have accepted, automatically transitions to ACCEPTED status.

    Args:
        db: Database session
        package: The package to accept
        user_id: ID of the user accepting
        is_sender: True if the user is the sender, False if courier

    Returns:
        Tuple of (updated_package, error_message)
    """
    # Must be in MATCHED status
    if package.status != PackageStatus.MATCHED:
        return package, f"Package must be in Matched status to accept. Current status: {STATUS_LABELS[package.status]}"

    # Verify user is authorized
    if is_sender:
        if package.sender_id != user_id:
            return package, "Only the package sender can accept as sender"
        if package.sender_accepted:
            return package, "Sender has already accepted this match"
    else:
        if package.courier_id != user_id:
            return package, "Only the assigned courier can accept as courier"
        if package.courier_accepted:
            return package, "Courier has already accepted this match"

    now = datetime.utcnow()

    # Record acceptance
    if is_sender:
        package.sender_accepted = True
        package.sender_accepted_at = now
    else:
        package.courier_accepted = True
        package.courier_accepted_at = now

    # Check if both have accepted
    if package.sender_accepted and package.courier_accepted:
        # Auto-transition to ACCEPTED
        package.status = PackageStatus.ACCEPTED
        package.accepted_at = now
        package.status_changed_at = now

    db.commit()
    db.refresh(package)

    return package, ""


def get_acceptance_status(package: Package) -> dict:
    """
    Get the acceptance status for a matched package.

    Args:
        package: The package to check

    Returns:
        Dict with acceptance information
    """
    return {
        "sender_accepted": package.sender_accepted,
        "courier_accepted": package.courier_accepted,
        "sender_accepted_at": package.sender_accepted_at.isoformat() if package.sender_accepted_at else None,
        "courier_accepted_at": package.courier_accepted_at.isoformat() if package.courier_accepted_at else None,
        "both_accepted": package.sender_accepted and package.courier_accepted,
        "awaiting_sender": not package.sender_accepted,
        "awaiting_courier": not package.courier_accepted,
    }


def _get_delivery_path(package: Package) -> list:
    """Determine which delivery path to use based on package status."""
    # If package is using legacy statuses (MATCHED or ACCEPTED), use legacy path
    if package.status in [PackageStatus.MATCHED, PackageStatus.ACCEPTED]:
        return LEGACY_DELIVERY_PATH
    # Otherwise use the new bidding workflow path
    return DELIVERY_PATH


def get_status_progress(package: Package) -> dict:
    """
    Get the progress of a package through the delivery lifecycle.

    Args:
        package: The package to check

    Returns:
        Dict with progress information
    """
    delivery_path = _get_delivery_path(package)

    current_index = -1
    for i, status in enumerate(delivery_path):
        if package.status == status:
            current_index = i
            break

    # Handle cancelled separately
    if package.status == PackageStatus.CANCELLED:
        return {
            "current_step": -1,
            "total_steps": len(delivery_path) - 1,  # Exclude PENDING from count
            "is_terminal": True,
            "is_cancelled": True,
            "progress_percent": 0,
            "steps": _build_steps(package, -1, delivery_path),
        }

    return {
        "current_step": current_index,
        "total_steps": len(delivery_path) - 1,  # Exclude PENDING from count
        "is_terminal": package.status in [PackageStatus.DELIVERED, PackageStatus.CANCELLED],
        "is_cancelled": False,
        "progress_percent": int((current_index / (len(delivery_path) - 1)) * 100) if current_index > 0 else 0,
        "steps": _build_steps(package, current_index, delivery_path),
    }


def _build_steps(package: Package, current_index: int, delivery_path: list = None) -> List[dict]:
    """Build step information for progress display."""
    if delivery_path is None:
        delivery_path = DELIVERY_PATH

    steps = []
    timestamps = {
        # New bidding workflow timestamps
        PackageStatus.PENDING: package.created_at,
        PackageStatus.BIDDING: package.status_changed_at if package.status == PackageStatus.BIDDING else None,
        PackageStatus.BID_SELECTED: package.status_changed_at if package.status == PackageStatus.BID_SELECTED else None,
        PackageStatus.PENDING_PICKUP: package.status_changed_at if package.status == PackageStatus.PENDING_PICKUP else None,
        PackageStatus.PICKED_UP: package.picked_up_at,
        PackageStatus.IN_TRANSIT: package.in_transit_at,
        PackageStatus.DELIVERED: package.delivery_time,
        # Legacy workflow timestamps
        PackageStatus.MATCHED: package.matched_at,
        PackageStatus.ACCEPTED: package.accepted_at,
    }

    for i, status in enumerate(delivery_path):
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
