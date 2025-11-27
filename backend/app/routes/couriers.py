from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models.package import CourierRoute, Package, PackageStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.utils.dependencies import get_current_user
from app.utils.geo import haversine_distance
from app.routes.notifications import create_notification, create_notification_with_broadcast
from app.utils.email import send_route_match_found_email
from app.services.audit_service import log_route_create, log_route_update, log_route_delete
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

router = APIRouter()

# Pydantic Schemas
class RouteCreate(BaseModel):
    start_address: str = Field(..., min_length=1)
    start_lat: float = Field(..., ge=-90, le=90)
    start_lng: float = Field(..., ge=-180, le=180)
    end_address: str = Field(..., min_length=1)
    end_lat: float = Field(..., ge=-90, le=90)
    end_lng: float = Field(..., ge=-180, le=180)
    max_deviation_km: int = Field(default=5, ge=1, le=50)
    departure_time: datetime | None = None

class RouteUpdate(BaseModel):
    end_address: str | None = Field(None, min_length=1)
    end_lat: float | None = Field(None, ge=-90, le=90)
    end_lng: float | None = Field(None, ge=-180, le=180)
    max_deviation_km: int | None = Field(None, ge=1, le=50)
    departure_time: datetime | None = None

class RouteResponse(BaseModel):
    id: int
    courier_id: int
    start_address: str
    start_lat: float
    start_lng: float
    end_address: str
    end_lat: float
    end_lng: float
    max_deviation_km: int
    departure_time: datetime | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


def verify_courier_role(user: User):
    """Helper function to verify user has courier role"""
    if user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only couriers can manage routes"
        )


def count_matching_packages(db: Session, route: CourierRoute) -> int:
    """Count packages that match a courier route."""
    route_line = LineString([
        (route.start_lng, route.start_lat),
        (route.end_lng, route.end_lat)
    ])

    pending_packages = db.query(Package).filter(
        and_(
            Package.status == PackageStatus.PENDING,
            Package.is_active == True
        )
    ).all()

    count = 0
    for package in pending_packages:
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
        if max_distance <= route.max_deviation_km:
            count += 1

    return count


@router.post("/routes", status_code=status.HTTP_201_CREATED, response_model=RouteResponse)
async def create_route(
    request: Request,
    route: RouteCreate,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new courier route.

    Business Rules:
    - Only courier/both roles can create routes
    - Deactivate any existing active routes for this courier (one active route at a time)
    - Validate coordinates are within valid ranges
    """
    verify_courier_role(current_user)

    # Deactivate existing active routes (one active route per courier)
    db.query(CourierRoute).filter(
        and_(
            CourierRoute.courier_id == current_user.id,
            CourierRoute.is_active == True
        )
    ).update({"is_active": False})

    # Create new route
    new_route = CourierRoute(
        courier_id=current_user.id,
        start_address=route.start_address,
        start_lat=route.start_lat,
        start_lng=route.start_lng,
        end_address=route.end_address,
        end_lat=route.end_lat,
        end_lng=route.end_lng,
        max_deviation_km=route.max_deviation_km,
        departure_time=route.departure_time,
        is_active=True
    )

    db.add(new_route)
    db.commit()
    db.refresh(new_route)

    # Audit log route creation
    log_route_create(
        db, current_user, new_route.id,
        {"start": route.start_address, "end": route.end_address, "max_deviation_km": route.max_deviation_km},
        request
    )

    # Check for matching packages and notify courier
    matching_count = count_matching_packages(db, new_route)
    if matching_count > 0:
        # Create in-app notification with WebSocket broadcast
        await create_notification_with_broadcast(
            db=db,
            user_id=current_user.id,
            notification_type=NotificationType.ROUTE_MATCH_FOUND,
            message=f"Found {matching_count} package(s) along your route from {route.start_address[:30]} to {route.end_address[:30]}",
            package_id=None
        )
        # Send email notification in background
        background_tasks.add_task(
            send_route_match_found_email,
            courier_email=current_user.email,
            courier_name=current_user.full_name,
            matching_packages_count=matching_count,
            route_origin=route.start_address,
            route_destination=route.end_address
        )

    return new_route


@router.get("/routes", response_model=List[RouteResponse])
async def get_routes(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    active_only: bool = False
):
    """
    Get all routes for current courier.

    Query params:
    - active_only: If true, only return active routes
    """
    verify_courier_role(current_user)

    query = db.query(CourierRoute).filter(CourierRoute.courier_id == current_user.id)

    if active_only:
        query = query.filter(CourierRoute.is_active == True)

    return query.order_by(CourierRoute.created_at.desc()).all()


@router.get("/routes/{route_id}", response_model=RouteResponse)
async def get_route(
    route_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get specific route details"""
    verify_courier_role(current_user)

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

    return route


@router.put("/routes/{route_id}", response_model=RouteResponse)
async def update_route(
    request: Request,
    route_id: int,
    route_update: RouteUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update route details.

    Only end address, deviation, and departure time can be updated.
    Start address is locked once route is created.
    """
    verify_courier_role(current_user)

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

    # Track changes for audit log
    changes = {}

    # Update fields if provided
    if route_update.end_address is not None:
        changes["end_address"] = {"old": route.end_address, "new": route_update.end_address}
        route.end_address = route_update.end_address
    if route_update.end_lat is not None:
        changes["end_lat"] = {"old": route.end_lat, "new": route_update.end_lat}
        route.end_lat = route_update.end_lat
    if route_update.end_lng is not None:
        changes["end_lng"] = {"old": route.end_lng, "new": route_update.end_lng}
        route.end_lng = route_update.end_lng
    if route_update.max_deviation_km is not None:
        changes["max_deviation_km"] = {"old": route.max_deviation_km, "new": route_update.max_deviation_km}
        route.max_deviation_km = route_update.max_deviation_km
    if route_update.departure_time is not None:
        changes["departure_time"] = {"old": str(route.departure_time), "new": str(route_update.departure_time)}
        route.departure_time = route_update.departure_time

    db.commit()
    db.refresh(route)

    # Audit log route update
    if changes:
        log_route_update(db, current_user, route_id, changes, request)

    return route


@router.delete("/routes/{route_id}")
async def delete_route(
    request: Request,
    route_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete (soft delete) a courier route"""
    verify_courier_role(current_user)

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

    # Soft delete
    route.is_active = False
    db.commit()

    # Audit log route deletion
    log_route_delete(db, current_user, route_id, request)

    return {"message": "Route deactivated successfully"}


@router.put("/routes/{route_id}/activate", response_model=RouteResponse)
async def activate_route(
    route_id: int,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Activate an inactive route from history.

    Business Rules:
    - Only courier/both roles can activate routes
    - Route must belong to the current user
    - Route must be inactive
    - Deactivates any existing active routes (one active route at a time)
    """
    verify_courier_role(current_user)

    # Find the route
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

    if route.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Route is already active"
        )

    # Deactivate any existing active routes (one active route per courier)
    db.query(CourierRoute).filter(
        and_(
            CourierRoute.courier_id == current_user.id,
            CourierRoute.is_active == True
        )
    ).update({"is_active": False})

    # Activate the selected route
    route.is_active = True
    db.commit()
    db.refresh(route)

    # Check for matching packages and notify courier
    matching_count = count_matching_packages(db, route)
    if matching_count > 0:
        # Create in-app notification with WebSocket broadcast
        await create_notification_with_broadcast(
            db=db,
            user_id=current_user.id,
            notification_type=NotificationType.ROUTE_MATCH_FOUND,
            message=f"Found {matching_count} package(s) along your reactivated route from {route.start_address[:30]} to {route.end_address[:30]}",
            package_id=None
        )
        # Send email notification in background
        background_tasks.add_task(
            send_route_match_found_email,
            courier_email=current_user.email,
            courier_name=current_user.full_name,
            matching_packages_count=matching_count,
            route_origin=route.start_address,
            route_destination=route.end_address
        )

    return route
