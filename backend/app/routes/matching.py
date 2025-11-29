from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from pydantic import BaseModel
from typing import List
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

from app.models.package import Package, PackageStatus, CourierRoute
from app.models.user import User, UserRole
from app.utils.dependencies import get_current_user
from app.utils.geo import haversine_distance
from app.services.route_deactivation_service import is_route_expired

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
