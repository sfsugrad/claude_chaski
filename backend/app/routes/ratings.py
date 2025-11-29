from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from pydantic import BaseModel, Field
from app.database import get_db
from app.models.user import User
from app.models.package import Package, PackageStatus
from app.models.rating import Rating
from app.models.notification import NotificationType
from app.utils.dependencies import get_current_user
from app.routes.notifications import create_notification_with_broadcast
from app.utils.input_sanitizer import sanitize_rich_text

router = APIRouter()


def get_package_by_tracking_id(db: Session, tracking_id: str) -> Package | None:
    """Get a package by tracking_id, with fallback to numeric ID."""
    package = db.query(Package).filter(Package.tracking_id == tracking_id).first()
    if not package and tracking_id.isdigit():
        package = db.query(Package).filter(Package.id == int(tracking_id)).first()
    return package


# Request/Response Models
class RatingCreate(BaseModel):
    tracking_id: str
    score: int = Field(..., ge=1, le=5, description="Rating score from 1 to 5")
    comment: str | None = Field(None, max_length=1000, description="Optional review comment")


class RatingResponse(BaseModel):
    id: int
    rater_id: int
    rated_user_id: int
    package_id: int
    score: int
    comment: str | None
    created_at: datetime
    rater_name: str | None = None  # Populated when fetching ratings

    class Config:
        from_attributes = True


class UserRatingSummary(BaseModel):
    user_id: int
    average_rating: float | None
    total_ratings: int
    rating_breakdown: dict[int, int]  # {1: count, 2: count, ...5: count}


class RatingListResponse(BaseModel):
    ratings: list[RatingResponse]
    total: int
    average_rating: float | None


@router.post("/", status_code=status.HTTP_201_CREATED, response_model=RatingResponse)
async def create_rating(
    rating_data: RatingCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a rating for a delivered package.

    Business Rules:
    - Package must be delivered
    - User must be either sender or courier of the package
    - User can only rate the other party (sender rates courier, courier rates sender)
    - One rating per user per package
    """
    # Get the package
    package = get_package_by_tracking_id(db, rating_data.tracking_id)

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Package must be delivered
    if package.status != PackageStatus.DELIVERED:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only rate after package is delivered"
        )

    # Determine who is being rated
    if current_user.id == package.sender_id:
        # Sender is rating the courier
        if not package.courier_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package has no courier to rate"
            )
        rated_user_id = package.courier_id
    elif current_user.id == package.courier_id:
        # Courier is rating the sender
        rated_user_id = package.sender_id
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only rate packages you were involved in"
        )

    # Check if user already rated this package
    existing_rating = db.query(Rating).filter(
        and_(
            Rating.rater_id == current_user.id,
            Rating.package_id == package.id
        )
    ).first()

    if existing_rating:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already rated this package"
        )

    # Sanitize rating comment (allow safe HTML for basic formatting)
    sanitized_comment = None
    if rating_data.comment:
        sanitized_comment = sanitize_rich_text(rating_data.comment)

    # Create the rating
    new_rating = Rating(
        rater_id=current_user.id,
        rated_user_id=rated_user_id,
        package_id=package.id,
        score=rating_data.score,
        comment=sanitized_comment
    )

    db.add(new_rating)
    db.commit()
    db.refresh(new_rating)

    # Create notification for the rated user with WebSocket broadcast
    # Don't include package_id so it routes to reviews page instead of package page
    await create_notification_with_broadcast(
        db=db,
        user_id=rated_user_id,
        notification_type=NotificationType.NEW_RATING,
        message=f"You received a {rating_data.score}-star rating from {'the sender' if current_user.id == package.courier_id else 'the courier'}",
        package_id=None
    )

    return RatingResponse(
        id=new_rating.id,
        rater_id=new_rating.rater_id,
        rated_user_id=new_rating.rated_user_id,
        package_id=new_rating.package_id,
        score=new_rating.score,
        comment=new_rating.comment,
        created_at=new_rating.created_at,
        rater_name=current_user.full_name
    )


@router.get("/user/{user_id}", response_model=RatingListResponse)
async def get_user_ratings(
    user_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all ratings for a specific user.
    """
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Get ratings with rater information
    query = db.query(Rating, User.full_name).join(
        User, Rating.rater_id == User.id
    ).filter(Rating.rated_user_id == user_id)

    total = query.count()

    # Calculate average rating
    avg_result = db.query(func.avg(Rating.score)).filter(
        Rating.rated_user_id == user_id
    ).scalar()
    average_rating = round(float(avg_result), 2) if avg_result else None

    # Get paginated ratings
    results = query.order_by(Rating.created_at.desc()).offset(skip).limit(limit).all()

    ratings = [
        RatingResponse(
            id=rating.id,
            rater_id=rating.rater_id,
            rated_user_id=rating.rated_user_id,
            package_id=rating.package_id,
            score=rating.score,
            comment=rating.comment,
            created_at=rating.created_at,
            rater_name=rater_name
        )
        for rating, rater_name in results
    ]

    return RatingListResponse(
        ratings=ratings,
        total=total,
        average_rating=average_rating
    )


@router.get("/user/{user_id}/summary", response_model=UserRatingSummary)
async def get_user_rating_summary(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get rating summary for a user (average, total count, breakdown by score).
    """
    # Verify user exists
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Get average and total
    avg_result = db.query(func.avg(Rating.score)).filter(
        Rating.rated_user_id == user_id
    ).scalar()
    total = db.query(Rating).filter(Rating.rated_user_id == user_id).count()

    # Get breakdown by score
    breakdown_query = db.query(
        Rating.score,
        func.count(Rating.id)
    ).filter(Rating.rated_user_id == user_id).group_by(Rating.score).all()

    breakdown = {i: 0 for i in range(1, 6)}
    for score, count in breakdown_query:
        breakdown[score] = count

    return UserRatingSummary(
        user_id=user_id,
        average_rating=round(float(avg_result), 2) if avg_result else None,
        total_ratings=total,
        rating_breakdown=breakdown
    )


@router.get("/package/{tracking_id}", response_model=list[RatingResponse])
async def get_package_ratings(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all ratings for a specific package (both sender and courier ratings).
    """
    # Verify package exists
    package = get_package_by_tracking_id(db, tracking_id)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Get ratings with rater information
    results = db.query(Rating, User.full_name).join(
        User, Rating.rater_id == User.id
    ).filter(Rating.package_id == package.id).all()

    return [
        RatingResponse(
            id=rating.id,
            rater_id=rating.rater_id,
            rated_user_id=rating.rated_user_id,
            package_id=rating.package_id,
            score=rating.score,
            comment=rating.comment,
            created_at=rating.created_at,
            rater_name=rater_name
        )
        for rating, rater_name in results
    ]


@router.get("/my-pending", response_model=list[dict])
async def get_my_pending_ratings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get packages where the current user can submit a rating.
    Returns delivered packages where the user was involved and hasn't rated yet.
    """
    # Get delivered packages where user was sender or courier
    delivered_packages = db.query(Package).filter(
        and_(
            Package.status == PackageStatus.DELIVERED,
            (Package.sender_id == current_user.id) | (Package.courier_id == current_user.id)
        )
    ).all()

    # Get packages user has already rated
    rated_package_ids = db.query(Rating.package_id).filter(
        Rating.rater_id == current_user.id
    ).all()
    rated_ids = {r[0] for r in rated_package_ids}

    # Filter out already rated packages and format response
    pending = []
    for pkg in delivered_packages:
        if pkg.id not in rated_ids:
            # Determine who to rate
            if pkg.sender_id == current_user.id:
                # User is sender, will rate courier
                rated_user = db.query(User).filter(User.id == pkg.courier_id).first()
                role = "courier"
            else:
                # User is courier, will rate sender
                rated_user = db.query(User).filter(User.id == pkg.sender_id).first()
                role = "sender"

            if rated_user:
                pending.append({
                    "package_id": pkg.id,
                    "package_description": pkg.description,
                    "delivery_time": pkg.delivery_time.isoformat() if pkg.delivery_time else None,
                    "user_to_rate_id": rated_user.id,
                    "user_to_rate_name": rated_user.full_name,
                    "user_to_rate_role": role
                })

    return pending
