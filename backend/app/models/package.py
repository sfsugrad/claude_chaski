from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum

class PackageStatus(str, enum.Enum):
    NEW = "NEW"                      # Just created, auto-transitions to OPEN_FOR_BIDS
    OPEN_FOR_BIDS = "OPEN_FOR_BIDS"  # Shown to couriers, accepting offers
    BID_SELECTED = "BID_SELECTED"    # Sender chose a courier from bids
    PENDING_PICKUP = "PENDING_PICKUP"  # Courier confirmed, awaiting pickup
    IN_TRANSIT = "IN_TRANSIT"        # Courier confirmed pickup, package in transit
    DELIVERED = "DELIVERED"          # Package delivered (terminal)
    CANCELED = "CANCELED"            # Sender canceled or expired (terminal)
    FAILED = "FAILED"                # Pickup/delivery failed (admin can retry)

class PackageSize(str, enum.Enum):
    SMALL = "small"      # < 5kg, fits in a bag
    MEDIUM = "medium"    # 5-20kg, box size
    LARGE = "large"      # 20-50kg, large box
    EXTRA_LARGE = "extra_large"  # > 50kg

class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Package details
    description = Column(Text, nullable=False)
    size = Column(SQLEnum(PackageSize), nullable=False)
    weight_kg = Column(Float, nullable=False)

    # Pickup information
    pickup_address = Column(String, nullable=False)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    pickup_contact_name = Column(String)
    pickup_contact_phone = Column(String)

    # Dropoff information
    dropoff_address = Column(String, nullable=False)
    dropoff_lat = Column(Float, nullable=False)
    dropoff_lng = Column(Float, nullable=False)
    dropoff_contact_name = Column(String)
    dropoff_contact_phone = Column(String)

    # Status and pricing
    status = Column(SQLEnum(PackageStatus), default=PackageStatus.NEW)
    price = Column(Float)  # Price sender is willing to pay
    is_active = Column(Boolean, default=True)  # Soft delete flag

    # Delivery proof configuration
    requires_proof = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    pickup_time = Column(DateTime(timezone=True), nullable=True)
    delivery_time = Column(DateTime(timezone=True), nullable=True)

    # Status transition timestamps
    status_changed_at = Column(DateTime(timezone=True), nullable=True)
    bid_selected_at = Column(DateTime(timezone=True), nullable=True)
    pending_pickup_at = Column(DateTime(timezone=True), nullable=True)
    in_transit_at = Column(DateTime(timezone=True), nullable=True)
    failed_at = Column(DateTime(timezone=True), nullable=True)

    # Bidding fields
    bid_deadline = Column(DateTime(timezone=True), nullable=True)
    selected_bid_id = Column(Integer, ForeignKey("courier_bids.id", ondelete="SET NULL", use_alter=True), nullable=True)
    bid_count = Column(Integer, default=0, nullable=False)
    deadline_extensions = Column(Integer, default=0, nullable=False)  # Track extensions (max 2)
    deadline_warning_sent = Column(Boolean, default=False, nullable=False)  # Track if 6-hour warning sent

    # Relationships
    # sender = relationship("User", foreign_keys=[sender_id])
    # courier = relationship("User", foreign_keys=[courier_id])

    def __repr__(self):
        return f"<Package {self.id} - {self.status}>"


class CourierRoute(Base):
    """Store courier's travel routes for matching"""
    __tablename__ = "courier_routes"

    id = Column(Integer, primary_key=True, index=True)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Route information
    start_address = Column(String, nullable=False)
    start_lat = Column(Float, nullable=False)
    start_lng = Column(Float, nullable=False)

    end_address = Column(String, nullable=False)
    end_lat = Column(Float, nullable=False)
    end_lng = Column(Float, nullable=False)

    # Route preferences
    max_deviation_km = Column(Integer, default=5)
    departure_time = Column(DateTime(timezone=True))
    trip_date = Column(DateTime(timezone=True), nullable=True)  # Date of the trip

    # Status
    is_active = Column(Boolean, default=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<CourierRoute {self.id} - Courier {self.courier_id}>"
