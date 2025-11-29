"""
Real-time tracking API endpoints for courier location and package tracking.
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.package import Package, PackageStatus
from app.models.tracking import TrackingSession, TrackingEventType
from app.utils.dependencies import get_current_user
from app.services.tracking_service import TrackingService
from app.services.redis_client import RedisClient, get_redis

router = APIRouter()


def get_package_by_tracking_id(db: Session, tracking_id: str) -> Package | None:
    """Get a package by tracking_id, with fallback to numeric ID."""
    package = db.query(Package).filter(Package.tracking_id == tracking_id).first()
    if not package and tracking_id.isdigit():
        package = db.query(Package).filter(Package.id == int(tracking_id)).first()
    return package


# Pydantic models
class LocationUpdateRequest(BaseModel):
    """Request model for location update."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    accuracy_meters: Optional[float] = Field(None, ge=0)
    altitude_meters: Optional[float] = None
    heading: Optional[float] = Field(None, ge=0, le=360)
    speed_mps: Optional[float] = Field(None, ge=0)
    battery_level: Optional[float] = Field(None, ge=0, le=100)
    source: str = Field(default="gps")


class StartTrackingRequest(BaseModel):
    """Request model for starting a tracking session."""
    initial_latitude: Optional[float] = Field(None, ge=-90, le=90)
    initial_longitude: Optional[float] = Field(None, ge=-180, le=180)
    share_live_location: bool = True


class ReportDelayRequest(BaseModel):
    """Request model for reporting a delivery delay."""
    reason: str = Field(..., min_length=5, max_length=500)
    estimated_delay_minutes: int = Field(..., ge=1, le=480)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


class LocationResponse(BaseModel):
    """Response model for location data."""
    latitude: float
    longitude: float
    heading: Optional[float]
    speed_mps: Optional[float]
    timestamp: str
    estimated_arrival: Optional[str]
    distance_remaining_meters: Optional[float]


class TrackingSessionResponse(BaseModel):
    """Response model for tracking session."""
    id: int
    package_id: int
    courier_id: int
    is_active: bool
    started_at: str
    ended_at: Optional[str]
    last_latitude: Optional[float]
    last_longitude: Optional[float]
    last_location_at: Optional[str]
    estimated_arrival: Optional[str]
    distance_remaining_meters: Optional[float]
    share_live_location: bool

    class Config:
        from_attributes = True


class TrackingEventResponse(BaseModel):
    """Response model for tracking event."""
    id: int
    event_type: str
    description: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    created_at: str
    extra_data: Optional[str]

    class Config:
        from_attributes = True


class LocationHistoryResponse(BaseModel):
    """Response model for location history entry."""
    id: int
    latitude: float
    longitude: float
    accuracy_meters: Optional[float]
    heading: Optional[float]
    speed_mps: Optional[float]
    timestamp: str
    source: str

    class Config:
        from_attributes = True


# Helper function to get tracking service
async def get_tracking_service(
    db: Session = Depends(get_db),
    redis: Optional[RedisClient] = Depends(get_redis)
) -> TrackingService:
    """Get tracking service with dependencies."""
    try:
        return TrackingService(db, redis)
    except Exception:
        # Redis might not be available in dev/test
        return TrackingService(db, None)


# Courier endpoints
@router.post("/sessions/{tracking_id}/start", response_model=TrackingSessionResponse)
async def start_tracking(
    tracking_id: str,
    request: StartTrackingRequest,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Start a tracking session for a package.
    Only the assigned courier can start tracking.
    """
    # Verify package exists and user is the courier
    package = get_package_by_tracking_id(db, tracking_id)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    if package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not the assigned courier for this package"
        )

    if package.status not in [PackageStatus.BID_SELECTED, PackageStatus.PENDING_PICKUP, PackageStatus.IN_TRANSIT]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot start tracking for package with status {package.status.value}"
        )

    session = await tracking_service.start_tracking_session(
        package_id=package.id,
        courier_id=current_user.id,
        initial_latitude=request.initial_latitude,
        initial_longitude=request.initial_longitude,
        share_live_location=request.share_live_location
    )

    return _session_to_response(session)


@router.post("/sessions/{session_id}/end", response_model=TrackingSessionResponse)
async def end_tracking(
    session_id: int,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    End a tracking session.
    Only the courier who started the session can end it.
    """
    session = await tracking_service.get_session_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking session not found"
        )

    if session.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to end this tracking session"
        )

    session = await tracking_service.end_tracking_session(session_id)
    return _session_to_response(session)


@router.post("/sessions/{session_id}/location", response_model=LocationResponse)
async def update_location(
    session_id: int,
    request: LocationUpdateRequest,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Update courier location for a tracking session.
    Only the courier can update their location.
    """
    session = await tracking_service.get_session_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking session not found"
        )

    if session.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to update this session"
        )

    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tracking session is not active"
        )

    location_update = await tracking_service.update_location(
        session_id=session_id,
        latitude=request.latitude,
        longitude=request.longitude,
        accuracy_meters=request.accuracy_meters,
        altitude_meters=request.altitude_meters,
        heading=request.heading,
        speed_mps=request.speed_mps,
        battery_level=request.battery_level,
        source=request.source
    )

    # Refresh session to get updated ETA
    session = await tracking_service.get_session_by_id(session_id)

    return LocationResponse(
        latitude=location_update.latitude,
        longitude=location_update.longitude,
        heading=location_update.heading,
        speed_mps=location_update.speed_mps,
        timestamp=location_update.timestamp.isoformat(),
        estimated_arrival=session.estimated_arrival.isoformat() if session.estimated_arrival else None,
        distance_remaining_meters=session.distance_remaining_meters
    )


@router.post("/sessions/{session_id}/delay", response_model=TrackingEventResponse)
async def report_delay(
    session_id: int,
    request: ReportDelayRequest,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Report a delivery delay.
    Only the courier can report delays.
    """
    session = await tracking_service.get_session_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking session not found"
        )

    if session.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not authorized to report delays for this session"
        )

    if not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tracking session is not active"
        )

    event = await tracking_service.report_delay(
        session_id=session_id,
        reason=request.reason,
        estimated_delay_minutes=request.estimated_delay_minutes,
        latitude=request.latitude,
        longitude=request.longitude
    )

    return _event_to_response(event)


# Public/sender endpoints
@router.get("/packages/{tracking_id}/location", response_model=LocationResponse)
async def get_current_location(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Get current location for a package being tracked.
    Available to sender and courier.
    """
    # Verify package exists and user has access
    package = get_package_by_tracking_id(db, tracking_id)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    if package.sender_id != current_user.id and package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this package's tracking"
        )

    location = await tracking_service.get_current_location(package.id)
    if not location:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active tracking session or location data available"
        )

    return LocationResponse(
        latitude=location["latitude"],
        longitude=location["longitude"],
        heading=location.get("heading"),
        speed_mps=location.get("speed_mps"),
        timestamp=location.get("timestamp", datetime.utcnow().isoformat()),
        estimated_arrival=location.get("estimated_arrival"),
        distance_remaining_meters=location.get("distance_remaining_meters")
    )


@router.get("/packages/{tracking_id}/session", response_model=TrackingSessionResponse)
async def get_active_session(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Get the active tracking session for a package.
    Available to sender and courier.
    """
    # Verify package exists and user has access
    package = get_package_by_tracking_id(db, tracking_id)
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    if package.sender_id != current_user.id and package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this package's tracking"
        )

    session = await tracking_service.get_active_session(package.id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active tracking session for this package"
        )

    return _session_to_response(session)


@router.get("/sessions/{session_id}/history", response_model=List[LocationHistoryResponse])
async def get_location_history(
    session_id: int,
    limit: int = 100,
    since: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Get location history for a tracking session.
    Available to sender and courier.
    """
    session = await tracking_service.get_session_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking session not found"
        )

    # Verify access
    package = db.query(Package).filter(Package.id == session.package_id).first()
    if package.sender_id != current_user.id and package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tracking session"
        )

    since_dt = None
    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace("Z", "+00:00"))
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid datetime format for 'since' parameter"
            )

    history = await tracking_service.get_location_history(session_id, limit, since_dt)

    return [
        LocationHistoryResponse(
            id=loc.id,
            latitude=loc.latitude,
            longitude=loc.longitude,
            accuracy_meters=loc.accuracy_meters,
            heading=loc.heading,
            speed_mps=loc.speed_mps,
            timestamp=loc.timestamp.isoformat(),
            source=loc.source
        )
        for loc in history
    ]


@router.get("/sessions/{session_id}/events", response_model=List[TrackingEventResponse])
async def get_tracking_events(
    session_id: int,
    current_user: User = Depends(get_current_user),
    tracking_service: TrackingService = Depends(get_tracking_service),
    db: Session = Depends(get_db)
):
    """
    Get tracking events for a session.
    Available to sender and courier.
    """
    session = await tracking_service.get_session_by_id(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Tracking session not found"
        )

    # Verify access
    package = db.query(Package).filter(Package.id == session.package_id).first()
    if package.sender_id != current_user.id and package.courier_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this tracking session"
        )

    events = await tracking_service.get_tracking_events(session_id)

    return [_event_to_response(event) for event in events]


# Helper functions
def _session_to_response(session: TrackingSession) -> TrackingSessionResponse:
    """Convert tracking session model to response."""
    return TrackingSessionResponse(
        id=session.id,
        package_id=session.package_id,
        courier_id=session.courier_id,
        is_active=session.is_active,
        started_at=session.started_at.isoformat(),
        ended_at=session.ended_at.isoformat() if session.ended_at else None,
        last_latitude=session.last_latitude,
        last_longitude=session.last_longitude,
        last_location_at=session.last_location_at.isoformat() if session.last_location_at else None,
        estimated_arrival=session.estimated_arrival.isoformat() if session.estimated_arrival else None,
        distance_remaining_meters=session.distance_remaining_meters,
        share_live_location=session.share_live_location
    )


def _event_to_response(event) -> TrackingEventResponse:
    """Convert tracking event model to response."""
    return TrackingEventResponse(
        id=event.id,
        event_type=event.event_type.value,
        description=event.description,
        latitude=event.latitude,
        longitude=event.longitude,
        created_at=event.created_at.isoformat(),
        extra_data=event.extra_data
    )
