"""
Real-time tracking service for courier location and package tracking.
Handles location updates, ETA calculations, and event broadcasting.
"""
import json
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session

from app.models.tracking import (
    TrackingSession,
    LocationUpdate,
    TrackingEvent,
    ETAEstimate,
    TrackingEventType
)
from app.models.package import Package, PackageStatus
from app.services.redis_client import RedisClient
from app.utils.geo import haversine_distance
from app.config import settings


# Average courier speed assumptions (meters per second)
AVERAGE_WALKING_SPEED = 1.4  # ~5 km/h
AVERAGE_BIKING_SPEED = 4.2  # ~15 km/h
AVERAGE_DRIVING_SPEED = 8.3  # ~30 km/h (urban)
DEFAULT_SPEED = AVERAGE_DRIVING_SPEED


class TrackingService:
    """Service for managing real-time package tracking."""

    def __init__(self, db: Session, redis: Optional[RedisClient] = None):
        self.db = db
        self.redis = redis

    async def start_tracking_session(
        self,
        package_id: int,
        courier_id: int,
        initial_latitude: Optional[float] = None,
        initial_longitude: Optional[float] = None,
        share_live_location: bool = True
    ) -> TrackingSession:
        """Start a new tracking session when courier picks up package."""
        # Check for existing active session
        existing = self.db.query(TrackingSession).filter(
            TrackingSession.package_id == package_id,
            TrackingSession.is_active == True
        ).first()

        if existing:
            # End existing session
            existing.is_active = False
            existing.ended_at = datetime.utcnow()

        # Create new session
        session = TrackingSession(
            package_id=package_id,
            courier_id=courier_id,
            is_active=True,
            started_at=datetime.utcnow(),
            last_latitude=initial_latitude,
            last_longitude=initial_longitude,
            last_location_at=datetime.utcnow() if initial_latitude else None,
            share_live_location=share_live_location
        )
        self.db.add(session)
        self.db.commit()
        self.db.refresh(session)

        # Create initial tracking event
        await self.create_tracking_event(
            session.id,
            TrackingEventType.PICKUP_COMPLETED,
            "Package picked up, tracking started",
            initial_latitude,
            initial_longitude
        )

        # Cache initial location if provided
        if self.redis and initial_latitude and initial_longitude:
            await self._cache_location(session, initial_latitude, initial_longitude)

        return session

    async def end_tracking_session(
        self,
        session_id: int,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> TrackingSession:
        """End a tracking session when delivery is completed."""
        session = self.db.query(TrackingSession).filter(
            TrackingSession.id == session_id
        ).first()

        if not session:
            raise ValueError(f"Tracking session {session_id} not found")

        session.is_active = False
        session.ended_at = datetime.utcnow()
        self.db.commit()

        # Create delivery completed event
        await self.create_tracking_event(
            session_id,
            TrackingEventType.DELIVERY_COMPLETED,
            "Package delivered successfully",
            latitude,
            longitude
        )

        # Clear cached location
        if self.redis:
            await self.redis.delete(f"location:session:{session_id}")
            await self.redis.delete(f"location:courier:{session.courier_id}")

        return session

    async def update_location(
        self,
        session_id: int,
        latitude: float,
        longitude: float,
        accuracy_meters: Optional[float] = None,
        altitude_meters: Optional[float] = None,
        heading: Optional[float] = None,
        speed_mps: Optional[float] = None,
        battery_level: Optional[float] = None,
        source: str = "gps"
    ) -> LocationUpdate:
        """Record a new location update for a tracking session."""
        session = self.db.query(TrackingSession).filter(
            TrackingSession.id == session_id,
            TrackingSession.is_active == True
        ).first()

        if not session:
            raise ValueError(f"Active tracking session {session_id} not found")

        # Create location update record
        location_update = LocationUpdate(
            session_id=session_id,
            latitude=latitude,
            longitude=longitude,
            accuracy_meters=accuracy_meters,
            altitude_meters=altitude_meters,
            heading=heading,
            speed_mps=speed_mps,
            battery_level=battery_level,
            source=source,
            timestamp=datetime.utcnow()
        )
        self.db.add(location_update)

        # Update session with latest location
        session.last_latitude = latitude
        session.last_longitude = longitude
        session.last_location_at = datetime.utcnow()

        # Calculate new ETA
        package = self.db.query(Package).filter(Package.id == session.package_id).first()
        if package and package.dropoff_latitude and package.dropoff_longitude:
            eta = await self._calculate_eta(
                latitude, longitude,
                package.dropoff_latitude, package.dropoff_longitude,
                speed_mps or DEFAULT_SPEED
            )
            if eta:
                session.estimated_arrival = eta['arrival_time']
                session.distance_remaining_meters = eta['distance_meters']

        self.db.commit()
        self.db.refresh(location_update)

        # Cache and broadcast location
        if self.redis and session.share_live_location:
            await self._cache_location(session, latitude, longitude, heading, speed_mps)
            await self._broadcast_location(session, location_update)

        return location_update

    async def get_active_session(self, package_id: int) -> Optional[TrackingSession]:
        """Get the active tracking session for a package."""
        return self.db.query(TrackingSession).filter(
            TrackingSession.package_id == package_id,
            TrackingSession.is_active == True
        ).first()

    async def get_session_by_id(self, session_id: int) -> Optional[TrackingSession]:
        """Get tracking session by ID."""
        return self.db.query(TrackingSession).filter(
            TrackingSession.id == session_id
        ).first()

    async def get_location_history(
        self,
        session_id: int,
        limit: int = 100,
        since: Optional[datetime] = None
    ) -> List[LocationUpdate]:
        """Get location history for a tracking session."""
        query = self.db.query(LocationUpdate).filter(
            LocationUpdate.session_id == session_id
        )

        if since:
            query = query.filter(LocationUpdate.timestamp >= since)

        return query.order_by(LocationUpdate.timestamp.desc()).limit(limit).all()

    async def get_current_location(self, package_id: int) -> Optional[Dict[str, Any]]:
        """Get current location from cache or database."""
        session = await self.get_active_session(package_id)
        if not session:
            return None

        # Try cache first
        if self.redis:
            cached = await self.redis.get_json(f"location:session:{session.id}")
            if cached:
                return cached

        # Fall back to database
        if session.last_latitude and session.last_longitude:
            return {
                "latitude": session.last_latitude,
                "longitude": session.last_longitude,
                "timestamp": session.last_location_at.isoformat() if session.last_location_at else None,
                "estimated_arrival": session.estimated_arrival.isoformat() if session.estimated_arrival else None,
                "distance_remaining_meters": session.distance_remaining_meters
            }

        return None

    async def create_tracking_event(
        self,
        session_id: int,
        event_type: TrackingEventType,
        description: Optional[str] = None,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> TrackingEvent:
        """Create a tracking event."""
        event = TrackingEvent(
            session_id=session_id,
            event_type=event_type,
            description=description,
            latitude=latitude,
            longitude=longitude,
            extra_data=json.dumps(metadata) if metadata else None,
            created_at=datetime.utcnow()
        )
        self.db.add(event)
        self.db.commit()
        self.db.refresh(event)

        # Broadcast event
        if self.redis:
            session = await self.get_session_by_id(session_id)
            if session:
                await self.redis.publish(
                    f"tracking:{session.package_id}",
                    {
                        "type": "tracking_event",
                        "event_type": event_type.value,
                        "description": description,
                        "latitude": latitude,
                        "longitude": longitude,
                        "timestamp": event.created_at.isoformat()
                    }
                )

        return event

    async def get_tracking_events(
        self,
        session_id: int,
        event_types: Optional[List[TrackingEventType]] = None
    ) -> List[TrackingEvent]:
        """Get tracking events for a session."""
        query = self.db.query(TrackingEvent).filter(
            TrackingEvent.session_id == session_id
        )

        if event_types:
            query = query.filter(TrackingEvent.event_type.in_(event_types))

        return query.order_by(TrackingEvent.created_at.desc()).all()

    async def report_delay(
        self,
        session_id: int,
        reason: str,
        estimated_delay_minutes: int,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None
    ) -> TrackingEvent:
        """Report a delivery delay."""
        session = await self.get_session_by_id(session_id)
        if not session:
            raise ValueError(f"Tracking session {session_id} not found")

        # Update ETA
        if session.estimated_arrival:
            session.estimated_arrival = session.estimated_arrival + timedelta(minutes=estimated_delay_minutes)
            self.db.commit()

        return await self.create_tracking_event(
            session_id,
            TrackingEventType.DELAY_REPORTED,
            reason,
            latitude,
            longitude,
            {"estimated_delay_minutes": estimated_delay_minutes}
        )

    async def _calculate_eta(
        self,
        current_lat: float,
        current_lng: float,
        dest_lat: float,
        dest_lng: float,
        speed_mps: float = DEFAULT_SPEED
    ) -> Optional[Dict[str, Any]]:
        """Calculate ETA based on current location and destination."""
        distance = haversine_distance(current_lat, current_lng, dest_lat, dest_lng)
        distance_meters = distance * 1000  # Convert km to meters

        if speed_mps <= 0:
            speed_mps = DEFAULT_SPEED

        # Calculate time in seconds
        time_seconds = distance_meters / speed_mps

        # Add buffer for stops, traffic, etc. (20% buffer)
        time_seconds *= 1.2

        arrival_time = datetime.utcnow() + timedelta(seconds=time_seconds)

        return {
            "distance_meters": distance_meters,
            "time_seconds": time_seconds,
            "arrival_time": arrival_time
        }

    async def _cache_location(
        self,
        session: TrackingSession,
        latitude: float,
        longitude: float,
        heading: Optional[float] = None,
        speed_mps: Optional[float] = None
    ) -> None:
        """Cache current location in Redis."""
        if not self.redis:
            return

        location_data = {
            "latitude": latitude,
            "longitude": longitude,
            "heading": heading,
            "speed_mps": speed_mps,
            "timestamp": datetime.utcnow().isoformat(),
            "estimated_arrival": session.estimated_arrival.isoformat() if session.estimated_arrival else None,
            "distance_remaining_meters": session.distance_remaining_meters
        }

        # Cache by session and courier
        await self.redis.set_json(
            f"location:session:{session.id}",
            location_data,
            settings.REDIS_LOCATION_TTL
        )
        await self.redis.set_courier_location(session.courier_id, location_data)

    async def _broadcast_location(
        self,
        session: TrackingSession,
        location_update: LocationUpdate
    ) -> None:
        """Broadcast location update to subscribers."""
        if not self.redis:
            return

        await self.redis.publish_location_update(
            session.package_id,
            {
                "type": "location_update",
                "session_id": session.id,
                "latitude": location_update.latitude,
                "longitude": location_update.longitude,
                "heading": location_update.heading,
                "speed_mps": location_update.speed_mps,
                "timestamp": location_update.timestamp.isoformat(),
                "estimated_arrival": session.estimated_arrival.isoformat() if session.estimated_arrival else None,
                "distance_remaining_meters": session.distance_remaining_meters
            }
        )


# Dependency for FastAPI
def get_tracking_service(db: Session, redis: Optional[RedisClient] = None) -> TrackingService:
    """Factory function for tracking service."""
    return TrackingService(db, redis)
