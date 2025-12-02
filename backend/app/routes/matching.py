from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from pydantic import BaseModel
from typing import List, Optional
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

from app.models.package import Package, PackageStatus, CourierRoute
from app.models.user import User, UserRole
from app.models.bid import CourierBid, BidStatus
from app.models.rating import Rating
from app.utils.dependencies import get_current_user
from app.utils.geo import haversine_distance
from app.services.route_deactivation_service import is_route_expired
from app.utils.matching_utils import is_package_within_route_deviation

router = APIRouter()


def calculate_detour(route_line: LineString, pickup_point: Point, dropoff_point: Point) -> float:
    """
    Calculate the detour distance required to pickup and deliver a package.
    Returns the additional distance in km compared to the direct route.
    """
    # Find nearest points on route to pickup and dropoff
    pickup_on_route = nearest_points(route_line, pickup_point)[0]
    dropoff_on_route = nearest_points(route_line, dropoff_point)[0]

    # Calculate distances
    pickup_detour = haversine_distance(
        pickup_point.y, pickup_point.x,
        pickup_on_route.y, pickup_on_route.x
    )
    dropoff_detour = haversine_distance(
        dropoff_point.y, dropoff_point.x,
        dropoff_on_route.y, dropoff_on_route.x
    )
    delivery_distance = haversine_distance(
        pickup_point.y, pickup_point.x,
        dropoff_point.y, dropoff_point.x
    )

    return pickup_detour + dropoff_detour + delivery_distance


class MatchedPackageResponse(BaseModel):
    package_id: int
    tracking_id: str
    sender_id: int
    description: str
    size: str
    weight_kg: float
    pickup_address: str
    pickup_lat: float
    pickup_lng: float
    dropoff_address: str
    dropoff_lat: float
    dropoff_lng: float
    price: float | None
    distance_from_route_km: float
    estimated_detour_km: float
    pickup_contact_name: str | None
    pickup_contact_phone: str | None
    dropoff_contact_name: str | None
    dropoff_contact_phone: str | None


@router.get("/packages-along-route/{route_id}", response_model=List[MatchedPackageResponse])
async def get_packages_along_route(
    route_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Find packages along a courier's route within deviation distance.

    Algorithm:
    1. Get courier route and validate ownership
    2. Create LineString from route coordinates
    3. Query all pending packages
    4. For each package:
       - Calculate distance from pickup/dropoff to route line
       - If within max_deviation_km, calculate detour distance
    5. Sort by detour distance (shortest first)
    """
    # Verify courier role
    if current_user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only couriers can view matching packages"
        )

    # Verify route ownership
    route = db.query(CourierRoute).filter(
        and_(
            CourierRoute.id == route_id,
            CourierRoute.courier_id == current_user.id,
            CourierRoute.is_active == True
        )
    ).first()

    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active route not found"
        )

    # Check if route has expired
    if is_route_expired(route):
        trip_date_str = route.trip_date.strftime('%Y-%m-%d') if route.trip_date else 'unknown'
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"This route has expired. Trip date {trip_date_str} has passed."
        )

    # Create route line (Shapely uses lng, lat order)
    route_line = LineString([
        (route.start_lng, route.start_lat),
        (route.end_lng, route.end_lat)
    ])

    # Get all packages open for bids
    pending_packages = db.query(Package).filter(
        and_(
            Package.status == PackageStatus.OPEN_FOR_BIDS,
            Package.is_active == True
        )
    ).all()

    matched_packages = []

    for package in pending_packages:
        pickup_point = Point(package.pickup_lng, package.pickup_lat)
        dropoff_point = Point(package.dropoff_lng, package.dropoff_lat)

        # Calculate distance from route to pickup and dropoff
        pickup_nearest = nearest_points(route_line, pickup_point)[0]
        dropoff_nearest = nearest_points(route_line, dropoff_point)[0]

        pickup_distance = haversine_distance(
            pickup_point.y, pickup_point.x,
            pickup_nearest.y, pickup_nearest.x
        )
        dropoff_distance = haversine_distance(
            dropoff_point.y, dropoff_point.x,
            dropoff_nearest.y, dropoff_nearest.x
        )

        # Check if within deviation
        max_distance = max(pickup_distance, dropoff_distance)

        if max_distance <= route.max_deviation_km:
            detour = calculate_detour(route_line, pickup_point, dropoff_point)

            matched_packages.append(MatchedPackageResponse(
                package_id=package.id,
                tracking_id=package.tracking_id,
                sender_id=package.sender_id,
                description=package.description,
                size=package.size.value,
                weight_kg=package.weight_kg,
                pickup_address=package.pickup_address,
                pickup_lat=package.pickup_lat,
                pickup_lng=package.pickup_lng,
                dropoff_address=package.dropoff_address,
                dropoff_lat=package.dropoff_lat,
                dropoff_lng=package.dropoff_lng,
                price=package.price,
                distance_from_route_km=round(max_distance, 2),
                estimated_detour_km=round(detour, 2),
                pickup_contact_name=package.pickup_contact_name,
                pickup_contact_phone=package.pickup_contact_phone,
                dropoff_contact_name=package.dropoff_contact_name,
                dropoff_contact_phone=package.dropoff_contact_phone,
            ))

    # Sort by detour distance (optimize for shortest detours first)
    matched_packages.sort(key=lambda x: x.estimated_detour_km)

    return matched_packages


@router.get("/optimized-route/{route_id}")
async def get_optimized_route(
    route_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get optimized route with all accepted packages ordered by position along the route.
    """
    from app.services.route_optimizer import optimize_package_order

    # Verify courier role
    if current_user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only couriers can view optimized routes"
        )

    # Get route
    route = db.query(CourierRoute).filter(
        and_(
            CourierRoute.id == route_id,
            CourierRoute.courier_id == current_user.id
        )
    ).first()

    if not route:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Route not found"
        )

    # Get accepted packages for this courier (pending pickup or in transit)
    packages = db.query(Package).filter(
        and_(
            Package.courier_id == current_user.id,
            Package.status.in_([PackageStatus.PENDING_PICKUP, PackageStatus.IN_TRANSIT]),
            Package.is_active == True
        )
    ).all()

    if not packages:
        return {
            "route_id": route.id,
            "start": {"address": route.start_address, "lat": route.start_lat, "lng": route.start_lng},
            "end": {"address": route.end_address, "lat": route.end_lat, "lng": route.end_lng},
            "stops": [],
            "total_stops": 0
        }

    # Optimize order
    optimized_stops = optimize_package_order(
        (route.start_lat, route.start_lng),
        (route.end_lat, route.end_lng),
        packages
    )

    return {
        "route_id": route.id,
        "start": {"address": route.start_address, "lat": route.start_lat, "lng": route.start_lng},
        "end": {"address": route.end_address, "lat": route.end_lat, "lng": route.end_lng},
        "stops": optimized_stops,
        "total_stops": len(optimized_stops)
    }


class MatchedCourierResponse(BaseModel):
    """Response model for a courier who matches a package"""
    courier_id: int
    courier_name: str
    courier_email: str
    average_rating: Optional[float]
    total_ratings: int
    total_deliveries: int
    route_id: int
    route_start_address: str
    route_end_address: str
    max_deviation_km: int
    distance_from_route_km: float
    estimated_detour_km: float
    has_bid: bool
    bid_status: Optional[str]
    bid_proposed_price: Optional[float]


class MatchedCouriersListResponse(BaseModel):
    """Response model for list of matched couriers"""
    package_id: int
    tracking_id: str
    total_matched_couriers: int
    couriers_with_bids: int
    matched_couriers: List[MatchedCourierResponse]


@router.get("/matched-couriers/{tracking_id}", response_model=MatchedCouriersListResponse)
async def get_matched_couriers_for_package(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get all couriers whose routes match a package.

    This endpoint is for senders to see which couriers can potentially
    deliver their package. Shows:
    - Courier info (name, rating, deliveries)
    - Route info (start/end, deviation)
    - Distance/detour calculations
    - Whether they've placed a bid

    Only accessible by:
    - Package sender
    - Admin users
    """
    # Get the package
    package = db.query(Package).filter(Package.tracking_id == tracking_id).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check authorization - only sender or admin can view matched couriers
    if current_user.role != UserRole.ADMIN and package.sender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the package sender or admin can view matched couriers"
        )

    # Only show matched couriers for OPEN_FOR_BIDS packages
    if package.status != PackageStatus.OPEN_FOR_BIDS:
        return MatchedCouriersListResponse(
            package_id=package.id,
            tracking_id=package.tracking_id,
            total_matched_couriers=0,
            couriers_with_bids=0,
            matched_couriers=[]
        )

    # Get all active, non-expired routes
    active_routes = db.query(CourierRoute).filter(
        CourierRoute.is_active == True
    ).all()

    # Filter out expired routes
    active_routes = [r for r in active_routes if not is_route_expired(r)]

    # Get existing bids for this package
    existing_bids = db.query(CourierBid).filter(
        CourierBid.package_id == package.id
    ).all()
    bids_by_courier = {bid.courier_id: bid for bid in existing_bids}

    # Get delivery counts per courier (completed deliveries)
    from sqlalchemy import func
    delivery_counts = dict(
        db.query(Package.courier_id, func.count(Package.id))
        .filter(Package.status == PackageStatus.DELIVERED)
        .group_by(Package.courier_id)
        .all()
    )

    # Get rating stats for all couriers (average rating and count)
    rating_query = db.query(
        Rating.rated_user_id,
        func.avg(Rating.score),
        func.count(Rating.id)
    ).group_by(Rating.rated_user_id).all()
    rating_stats = {row[0]: (row[1], row[2]) for row in rating_query}

    matched_couriers = []

    for route in active_routes:
        # Check if package is within this route's deviation
        if not is_package_within_route_deviation(package, route):
            continue

        # Get courier info
        courier = db.query(User).filter(User.id == route.courier_id).first()
        if not courier or not courier.is_active:
            continue

        # Calculate distances
        route_line = LineString([
            (route.start_lng, route.start_lat),
            (route.end_lng, route.end_lat)
        ])
        pickup_point = Point(package.pickup_lng, package.pickup_lat)
        dropoff_point = Point(package.dropoff_lng, package.dropoff_lat)

        pickup_nearest = nearest_points(route_line, pickup_point)[0]
        dropoff_nearest = nearest_points(route_line, dropoff_point)[0]

        pickup_distance = haversine_distance(
            pickup_point.y, pickup_point.x,
            pickup_nearest.y, pickup_nearest.x
        )
        dropoff_distance = haversine_distance(
            dropoff_point.y, dropoff_point.x,
            dropoff_nearest.y, dropoff_nearest.x
        )

        max_distance = max(pickup_distance, dropoff_distance)
        detour = calculate_detour(route_line, pickup_point, dropoff_point)

        # Check if courier has bid
        bid = bids_by_courier.get(courier.id)

        # Get courier rating stats
        courier_rating = rating_stats.get(courier.id)
        avg_rating = round(float(courier_rating[0]), 2) if courier_rating and courier_rating[0] else None
        total_ratings = courier_rating[1] if courier_rating else 0

        matched_couriers.append(MatchedCourierResponse(
            courier_id=courier.id,
            courier_name=courier.full_name,
            courier_email=courier.email,
            average_rating=avg_rating,
            total_ratings=total_ratings,
            total_deliveries=delivery_counts.get(courier.id, 0),
            route_id=route.id,
            route_start_address=route.start_address,
            route_end_address=route.end_address,
            max_deviation_km=route.max_deviation_km,
            distance_from_route_km=round(max_distance, 2),
            estimated_detour_km=round(detour, 2),
            has_bid=bid is not None,
            bid_status=bid.status.value if bid else None,
            bid_proposed_price=bid.proposed_price if bid else None,
        ))

    # Sort by: couriers with bids first, then by detour distance
    matched_couriers.sort(key=lambda x: (not x.has_bid, x.estimated_detour_km))

    couriers_with_bids = sum(1 for c in matched_couriers if c.has_bid)

    return MatchedCouriersListResponse(
        package_id=package.id,
        tracking_id=package.tracking_id,
        total_matched_couriers=len(matched_couriers),
        couriers_with_bids=couriers_with_bids,
        matched_couriers=matched_couriers
    )
