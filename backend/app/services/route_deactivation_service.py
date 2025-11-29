"""
Route Deactivation Service

Handles validation and cleanup when deactivating courier routes:
- Checks for active deliveries that would block deactivation
- Withdraws pending bids
- Cancels selected bids and resets packages
- Sends notifications to affected users
"""
from datetime import datetime, timezone
from typing import Tuple, List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.package import Package, PackageStatus, CourierRoute
from app.models.bid import CourierBid, BidStatus
from app.models.notification import NotificationType


def has_active_deliveries(db: Session, courier_id: int) -> Tuple[bool, List[Package]]:
    """
    Check if courier has packages in PENDING_PICKUP or IN_TRANSIT status.

    Args:
        db: Database session
        courier_id: The courier's user ID

    Returns:
        Tuple of (has_active_deliveries, list_of_active_packages)
    """
    active_packages = db.query(Package).filter(
        and_(
            Package.courier_id == courier_id,
            Package.is_active == True,
            Package.status.in_([PackageStatus.PENDING_PICKUP, PackageStatus.IN_TRANSIT])
        )
    ).all()

    return len(active_packages) > 0, active_packages


def withdraw_pending_bids_for_courier(
    db: Session,
    courier_id: int,
    route_id: Optional[int] = None
) -> List[int]:
    """
    Withdraw all PENDING bids for a courier (optionally filtered by route).

    Args:
        db: Database session
        courier_id: The courier's user ID
        route_id: Optional route ID to filter bids

    Returns:
        List of withdrawn bid IDs
    """
    now = datetime.now(timezone.utc)

    query = db.query(CourierBid).filter(
        and_(
            CourierBid.courier_id == courier_id,
            CourierBid.status == BidStatus.PENDING
        )
    )

    if route_id:
        query = query.filter(CourierBid.route_id == route_id)

    pending_bids = query.all()
    withdrawn_ids = []

    for bid in pending_bids:
        bid.status = BidStatus.WITHDRAWN
        bid.withdrawn_at = now
        withdrawn_ids.append(bid.id)

        # Decrement package bid count
        package = db.query(Package).filter(Package.id == bid.package_id).first()
        if package and package.bid_count > 0:
            package.bid_count -= 1

    return withdrawn_ids


def cancel_selected_bids_for_courier(db: Session, courier_id: int) -> List[Dict[str, Any]]:
    """
    Cancel SELECTED bids where package is in BID_SELECTED status (not yet picked up).
    Resets package to OPEN_FOR_BIDS, keeping the original bid_deadline.

    Args:
        db: Database session
        courier_id: The courier's user ID

    Returns:
        List of affected package info dicts
    """
    now = datetime.now(timezone.utc)

    # Find packages where this courier has a SELECTED bid and package is BID_SELECTED
    affected_packages = db.query(Package).filter(
        and_(
            Package.courier_id == courier_id,
            Package.status == PackageStatus.BID_SELECTED,
            Package.is_active == True
        )
    ).all()

    cancelled_info = []

    for package in affected_packages:
        # Find and cancel the selected bid
        selected_bid = db.query(CourierBid).filter(
            and_(
                CourierBid.id == package.selected_bid_id,
                CourierBid.status == BidStatus.SELECTED
            )
        ).first()

        if selected_bid:
            selected_bid.status = BidStatus.WITHDRAWN
            selected_bid.withdrawn_at = now

        # Reset package to OPEN_FOR_BIDS (keep original bid_deadline)
        package.status = PackageStatus.OPEN_FOR_BIDS
        package.courier_id = None
        package.selected_bid_id = None
        package.bid_selected_at = None

        cancelled_info.append({
            "package_id": package.id,
            "sender_id": package.sender_id,
            "description": package.description
        })

    return cancelled_info


async def handle_route_deactivation(
    db: Session,
    courier_id: int,
    route_id: Optional[int] = None
) -> Dict[str, Any]:
    """
    Complete route deactivation handler. Call this BEFORE setting is_active=False.

    1. Withdraw pending bids
    2. Cancel selected bids (not yet picked up)
    3. Create notifications

    Args:
        db: Database session
        courier_id: The courier's user ID
        route_id: Optional specific route being deactivated

    Returns:
        Summary of actions taken
    """
    from app.routes.notifications import create_notification_with_broadcast

    result = {
        "bids_withdrawn": 0,
        "bids_cancelled": 0,
        "packages_reset": []
    }

    # Withdraw pending bids
    withdrawn_ids = withdraw_pending_bids_for_courier(db, courier_id, route_id)
    result["bids_withdrawn"] = len(withdrawn_ids)

    # Cancel selected bids and reset packages
    cancelled = cancel_selected_bids_for_courier(db, courier_id)
    result["bids_cancelled"] = len(cancelled)
    result["packages_reset"] = cancelled

    # Send notifications to affected senders
    for pkg_info in cancelled:
        description_preview = pkg_info["description"][:30] if pkg_info["description"] else "Package"
        await create_notification_with_broadcast(
            db=db,
            user_id=pkg_info["sender_id"],
            notification_type=NotificationType.BID_CANCELLED_BY_COURIER,
            message=f"The courier you selected has cancelled. Your package '{description_preview}...' is open for new bids.",
            package_id=pkg_info["package_id"]
        )

    # Notify courier about withdrawn bids
    if result["bids_withdrawn"] > 0 or result["bids_cancelled"] > 0:
        await create_notification_with_broadcast(
            db=db,
            user_id=courier_id,
            notification_type=NotificationType.ROUTE_DEACTIVATED,
            message=f"Route deactivated. {result['bids_withdrawn']} pending bid(s) withdrawn, {result['bids_cancelled']} selected bid(s) cancelled.",
            package_id=None
        )

    return result


def is_route_expired(route: CourierRoute) -> bool:
    """
    Check if a route's trip_date has passed.

    Routes without a trip_date are treated as indefinite (not expired).

    Args:
        route: CourierRoute model instance

    Returns:
        True if route's trip_date is in the past, False otherwise
    """
    if not route.trip_date:
        return False
    now = datetime.now(timezone.utc)
    # Make trip_date timezone-aware if it isn't already
    trip_date = route.trip_date
    if trip_date.tzinfo is None:
        trip_date = trip_date.replace(tzinfo=timezone.utc)
    return trip_date < now
