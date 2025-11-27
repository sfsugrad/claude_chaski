from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import and_
from app.database import get_db
from app.models.package import CourierRoute
from app.models.user import User, UserRole
from app.utils.dependencies import get_current_user
from pydantic import BaseModel, Field
from typing import List
from datetime import datetime

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


@router.post("/routes", status_code=status.HTTP_201_CREATED, response_model=RouteResponse)
async def create_route(
    route: RouteCreate,
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

    # Update fields if provided
    if route_update.end_address is not None:
        route.end_address = route_update.end_address
    if route_update.end_lat is not None:
        route.end_lat = route_update.end_lat
    if route_update.end_lng is not None:
        route.end_lng = route_update.end_lng
    if route_update.max_deviation_km is not None:
        route.max_deviation_km = route_update.max_deviation_km
    if route_update.departure_time is not None:
        route.departure_time = route_update.departure_time

    db.commit()
    db.refresh(route)

    return route


@router.delete("/routes/{route_id}")
async def delete_route(
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

    return {"message": "Route deactivated successfully"}
