"""
Real-time tracking models for courier location and package tracking.
"""
import enum
from datetime import datetime
from sqlalchemy import Column, Integer, Float, String, DateTime, ForeignKey, Enum, Index, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base


class TrackingEventType(str, enum.Enum):
    """Types of tracking events"""
    LOCATION_UPDATE = "location_update"
    PICKUP_STARTED = "pickup_started"
    PICKUP_COMPLETED = "pickup_completed"
    IN_TRANSIT = "in_transit"
    DELIVERY_STARTED = "delivery_started"
    DELIVERY_COMPLETED = "delivery_completed"
    DELAY_REPORTED = "delay_reported"
    ROUTE_DEVIATION = "route_deviation"


class TrackingSession(Base):
    """
    Represents an active tracking session for a package delivery.
    Created when courier picks up a package and ends when delivered.
    """
    __tablename__ = "tracking_sessions"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Session status
    is_active = Column(Boolean, default=True, nullable=False)
    started_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ended_at = Column(DateTime, nullable=True)

    # Last known location (cached from LocationUpdate)
    last_latitude = Column(Float, nullable=True)
    last_longitude = Column(Float, nullable=True)
    last_location_at = Column(DateTime, nullable=True)

    # ETA tracking
    estimated_arrival = Column(DateTime, nullable=True)
    distance_remaining_meters = Column(Float, nullable=True)

    # Tracking preferences
    share_live_location = Column(Boolean, default=True, nullable=False)
    update_interval_seconds = Column(Integer, default=30, nullable=False)

    # Relationships
    package = relationship("Package", backref="tracking_sessions")
    courier = relationship("User", backref="tracking_sessions")
    location_updates = relationship("LocationUpdate", back_populates="session", cascade="all, delete-orphan")
    tracking_events = relationship("TrackingEvent", back_populates="session", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_tracking_sessions_package_active", "package_id", "is_active"),
        Index("ix_tracking_sessions_courier_active", "courier_id", "is_active"),
    )


class LocationUpdate(Base):
    """
    Individual location updates from courier during delivery.
    Stored in database for history, cached in Redis for real-time access.
    """
    __tablename__ = "location_updates"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("tracking_sessions.id"), nullable=False)

    # Location data
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    accuracy_meters = Column(Float, nullable=True)
    altitude_meters = Column(Float, nullable=True)
    heading = Column(Float, nullable=True)  # Direction in degrees (0-360)
    speed_mps = Column(Float, nullable=True)  # Speed in meters per second

    # Metadata
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)
    source = Column(String(50), default="gps", nullable=False)  # gps, network, manual

    # Battery info (for managing update frequency)
    battery_level = Column(Float, nullable=True)  # 0-100

    # Relationship
    session = relationship("TrackingSession", back_populates="location_updates")

    __table_args__ = (
        Index("ix_location_updates_session_timestamp", "session_id", "timestamp"),
    )


class TrackingEvent(Base):
    """
    Significant events during package tracking (pickup, delivery, delays, etc.)
    """
    __tablename__ = "tracking_events"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("tracking_sessions.id"), nullable=False)

    # Event details
    event_type = Column(Enum(TrackingEventType), nullable=False)
    description = Column(String(500), nullable=True)

    # Location at time of event
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Additional data (JSON-serializable)
    extra_data = Column(String(2000), nullable=True)  # JSON string for flexibility

    # Relationship
    session = relationship("TrackingSession", back_populates="tracking_events")

    __table_args__ = (
        Index("ix_tracking_events_session_type", "session_id", "event_type"),
    )


class ETAEstimate(Base):
    """
    Historical ETA estimates for analytics and improvement.
    """
    __tablename__ = "eta_estimates"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("tracking_sessions.id"), nullable=False)

    # Estimate details
    estimated_arrival = Column(DateTime, nullable=False)
    actual_arrival = Column(DateTime, nullable=True)

    # Context
    distance_meters = Column(Float, nullable=False)
    calculated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Factors considered
    traffic_factor = Column(Float, default=1.0, nullable=False)  # Multiplier for traffic
    weather_factor = Column(Float, default=1.0, nullable=False)  # Multiplier for weather

    # Accuracy metrics (calculated after delivery)
    accuracy_minutes = Column(Float, nullable=True)  # Difference between estimated and actual
