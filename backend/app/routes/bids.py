"""
Bidding system routes for courier package bidding.

Endpoints:
- POST /bids - Create a bid on a package
- DELETE /bids/{id} - Withdraw a bid
- POST /bids/{id}/select - Select a bid (sender only)
- GET /bids/my-bids - Get courier's bids
- GET /packages/{package_id}/bids - Get all bids for a package
"""

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import and_, func
from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime, timedelta, timezone

from app.database import get_db
from app.models.package import Package, PackageStatus
from app.models.bid import CourierBid, BidStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.models.rating import Rating
from app.utils.dependencies import get_current_user
from app.routes.notifications import create_notification_with_broadcast
from app.services.audit_service import log_audit

router = APIRouter()


# Request/Response models
class BidCreate(BaseModel):
    package_id: int
    proposed_price: float = Field(..., gt=0, description="Proposed delivery price")
    estimated_delivery_hours: Optional[int] = Field(None, gt=0, description="Estimated hours to deliver")
    estimated_pickup_time: Optional[datetime] = Field(None, description="Estimated pickup time")
    message: Optional[str] = Field(None, max_length=500, description="Message to sender")
    route_id: Optional[int] = Field(None, description="Associated route ID")


class BidResponse(BaseModel):
    id: int
    package_id: int
    courier_id: int
    courier_name: str
    courier_rating: Optional[float]
    courier_total_ratings: int
    proposed_price: float
    estimated_delivery_hours: Optional[int]
    estimated_pickup_time: Optional[datetime]
    message: Optional[str]
    status: str
    created_at: datetime
    selected_at: Optional[datetime]

    class Config:
        from_attributes = True


class PackageBidsResponse(BaseModel):
    bids: List[BidResponse]
    bid_deadline: Optional[datetime]
    bid_count: int


def get_courier_bid_response(bid: CourierBid, courier: User, db: Session = None) -> BidResponse:
    """Convert a bid and courier to BidResponse."""
    # Compute ratings if db session provided
    courier_rating = None
    courier_total_ratings = 0

    if db:
        total_ratings = db.query(Rating).filter(
            Rating.rated_user_id == courier.id
        ).count()

        if total_ratings > 0:
            avg_result = db.query(func.avg(Rating.score)).filter(
                Rating.rated_user_id == courier.id
            ).scalar()
            courier_rating = round(float(avg_result), 2) if avg_result else None

        courier_total_ratings = total_ratings

    return BidResponse(
        id=bid.id,
        package_id=bid.package_id,
        courier_id=bid.courier_id,
        courier_name=courier.full_name,
        courier_rating=courier_rating,
        courier_total_ratings=courier_total_ratings,
        proposed_price=bid.proposed_price,
        estimated_delivery_hours=bid.estimated_delivery_hours,
        estimated_pickup_time=bid.estimated_pickup_time,
        message=bid.message,
        status=bid.status.value,
        created_at=bid.created_at,
        selected_at=bid.selected_at
    )


@router.post("", response_model=BidResponse, status_code=status.HTTP_201_CREATED)
async def create_bid(
    bid_data: BidCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a bid on a package.

    Requirements:
    - User must be a courier
    - Package must be in OPEN_FOR_BIDS status
    - Courier cannot bid on own package
    - One bid per courier per package
    """
    # Verify courier role
    if current_user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only couriers can place bids"
        )

    # Get package
    package = db.query(Package).filter(
        and_(
            Package.id == bid_data.package_id,
            Package.is_active == True
        )
    ).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Verify package status allows bidding
    if package.status != PackageStatus.OPEN_FOR_BIDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot bid on package with status: {package.status.value}. Package must be open for bids."
        )

    # Cannot bid on own package
    if package.sender_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot bid on your own package"
        )

    # Check for existing bid
    existing_bid = db.query(CourierBid).filter(
        and_(
            CourierBid.package_id == bid_data.package_id,
            CourierBid.courier_id == current_user.id
        )
    ).first()

    if existing_bid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already placed a bid on this package"
        )

    # Create bid
    bid = CourierBid(
        package_id=bid_data.package_id,
        courier_id=current_user.id,
        route_id=bid_data.route_id,
        proposed_price=bid_data.proposed_price,
        estimated_delivery_hours=bid_data.estimated_delivery_hours,
        estimated_pickup_time=bid_data.estimated_pickup_time,
        message=bid_data.message,
        status=BidStatus.PENDING
    )

    db.add(bid)

    # Set bid deadline if not already set (first bid)
    if not package.bid_deadline:
        package.bid_deadline = datetime.now(timezone.utc) + timedelta(hours=24)

    package.bid_count = (package.bid_count or 0) + 1

    db.commit()
    db.refresh(bid)

    # Log audit
    log_audit(
        db=db,
        user_id=current_user.id,
        action="bid_created",
        resource_type="bid",
        resource_id=bid.id,
        details={"package_id": package.id, "proposed_price": bid.proposed_price},
        success=True
    )

    # Notify sender about new bid
    await create_notification_with_broadcast(
        db=db,
        user_id=package.sender_id,
        notification_type=NotificationType.NEW_BID_RECEIVED,
        message=f"New bid of ${bid.proposed_price:.2f} received from {current_user.full_name} for your package",
        package_id=package.id
    )

    return get_courier_bid_response(bid, current_user, db)


@router.delete("/{bid_id}")
async def withdraw_bid(
    bid_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Withdraw a pending bid.

    Requirements:
    - Must be the bid owner
    - Bid must be in PENDING status
    """
    bid = db.query(CourierBid).filter(CourierBid.id == bid_id).first()

    if not bid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid not found"
        )

    if bid.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only withdraw your own bids"
        )

    if bid.status != BidStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot withdraw bid with status: {bid.status.value}"
        )

    # Get package for notification
    package = db.query(Package).filter(Package.id == bid.package_id).first()

    # Update bid status
    bid.status = BidStatus.WITHDRAWN
    bid.withdrawn_at = datetime.now(timezone.utc)

    # Decrement package bid count
    if package and package.bid_count > 0:
        package.bid_count -= 1

    db.commit()

    # Log audit
    log_audit(
        db=db,
        user_id=current_user.id,
        action="bid_withdrawn",
        resource_type="bid",
        resource_id=bid.id,
        details={"package_id": bid.package_id},
        success=True
    )

    # Notify sender
    if package:
        await create_notification_with_broadcast(
            db=db,
            user_id=package.sender_id,
            notification_type=NotificationType.BID_WITHDRAWN,
            message=f"A courier has withdrawn their bid on your package",
            package_id=package.id
        )

    return {"message": "Bid withdrawn successfully"}


@router.post("/{bid_id}/select", response_model=BidResponse)
async def select_bid(
    bid_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Select a bid for package delivery.

    Requirements:
    - Must be the package sender
    - Bid must be in PENDING status
    - Package must be in OPEN_FOR_BIDS status
    """
    bid = db.query(CourierBid).filter(CourierBid.id == bid_id).first()

    if not bid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid not found"
        )

    package = db.query(Package).filter(Package.id == bid.package_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Verify sender
    if package.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the package sender can select a bid"
        )

    # Verify bid status
    if bid.status != BidStatus.PENDING:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot select bid with status: {bid.status.value}"
        )

    # Verify package status
    if package.status != PackageStatus.OPEN_FOR_BIDS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot select bid for package with status: {package.status.value}"
        )

    # Get courier for response
    courier = db.query(User).filter(User.id == bid.courier_id).first()

    # Update selected bid
    now = datetime.now(timezone.utc)
    bid.status = BidStatus.SELECTED
    bid.selected_at = now

    # Update package
    package.status = PackageStatus.BID_SELECTED
    package.courier_id = bid.courier_id
    package.selected_bid_id = bid.id
    package.price = bid.proposed_price  # Use the bid price

    # Reject all other pending bids
    other_bids = db.query(CourierBid).filter(
        and_(
            CourierBid.package_id == bid.package_id,
            CourierBid.id != bid.id,
            CourierBid.status == BidStatus.PENDING
        )
    ).all()

    rejected_courier_ids = []
    for other_bid in other_bids:
        other_bid.status = BidStatus.REJECTED
        rejected_courier_ids.append(other_bid.courier_id)

    db.commit()
    db.refresh(bid)

    # Log audit
    log_audit(
        db=db,
        user_id=current_user.id,
        action="bid_selected",
        resource_type="bid",
        resource_id=bid.id,
        details={"package_id": package.id, "courier_id": bid.courier_id},
        success=True
    )

    # Notify winning courier
    await create_notification_with_broadcast(
        db=db,
        user_id=bid.courier_id,
        notification_type=NotificationType.BID_SELECTED,
        message=f"Your bid of ${bid.proposed_price:.2f} has been selected! The sender is waiting for pickup.",
        package_id=package.id
    )

    # Notify rejected couriers
    for courier_id in rejected_courier_ids:
        await create_notification_with_broadcast(
            db=db,
            user_id=courier_id,
            notification_type=NotificationType.BID_REJECTED,
            message=f"Another courier was selected for a package you bid on",
            package_id=package.id
        )

    return get_courier_bid_response(bid, courier, db)


@router.get("/my-bids", response_model=List[BidResponse])
async def get_my_bids(
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all bids for the current courier.

    Optional filter by status: pending, selected, rejected, withdrawn, expired
    """
    if current_user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only couriers can view their bids"
        )

    query = db.query(CourierBid).filter(CourierBid.courier_id == current_user.id)

    if status_filter:
        try:
            bid_status = BidStatus(status_filter)
            query = query.filter(CourierBid.status == bid_status)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}"
            )

    bids = query.order_by(CourierBid.created_at.desc()).all()

    return [get_courier_bid_response(bid, current_user, db) for bid in bids]


@router.get("/package/{package_id}", response_model=PackageBidsResponse)
async def get_package_bids(
    package_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all bids for a package.

    Access:
    - Package sender can see all bids
    - Couriers can only see their own bids
    - Admin can see all bids
    """
    package = db.query(Package).filter(
        and_(
            Package.id == package_id,
            Package.is_active == True
        )
    ).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Determine access level
    is_sender = package.sender_id == current_user.id
    is_admin = current_user.role == UserRole.ADMIN

    if is_sender or is_admin:
        # Get all bids
        bids = db.query(CourierBid).filter(
            CourierBid.package_id == package_id
        ).order_by(CourierBid.created_at.desc()).all()
    else:
        # Courier can only see their own bid
        bids = db.query(CourierBid).filter(
            and_(
                CourierBid.package_id == package_id,
                CourierBid.courier_id == current_user.id
            )
        ).all()

    # Get courier info for each bid
    bid_responses = []
    for bid in bids:
        courier = db.query(User).filter(User.id == bid.courier_id).first()
        if courier:
            bid_responses.append(get_courier_bid_response(bid, courier, db))

    return PackageBidsResponse(
        bids=bid_responses,
        bid_deadline=package.bid_deadline,
        bid_count=package.bid_count or 0
    )


@router.post("/{bid_id}/confirm-pickup")
async def confirm_pickup(
    bid_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Courier confirms they have picked up the package.
    Transitions package from BID_SELECTED to IN_TRANSIT.
    """
    bid = db.query(CourierBid).filter(CourierBid.id == bid_id).first()

    if not bid:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bid not found"
        )

    if bid.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the bid owner can confirm pickup"
        )

    if bid.status != BidStatus.SELECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only selected bids can be confirmed for pickup"
        )

    package = db.query(Package).filter(Package.id == bid.package_id).first()

    if not package or package.status != PackageStatus.BID_SELECTED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Package is not in the correct state for pickup confirmation"
        )

    # Transition directly to IN_TRANSIT (courier has picked up the package)
    package.status = PackageStatus.IN_TRANSIT
    package.in_transit_at = datetime.utcnow()

    db.commit()

    # Notify sender
    await create_notification_with_broadcast(
        db=db,
        user_id=package.sender_id,
        notification_type=NotificationType.PACKAGE_ACCEPTED,
        message=f"Your package has been picked up and is now in transit!",
        package_id=package.id
    )

    return {
        "message": "Pickup confirmed - package is now in transit",
        "package_id": package.id,
        "status": package.status.value
    }
