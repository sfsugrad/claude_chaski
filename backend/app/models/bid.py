from sqlalchemy import Column, Integer, Float, DateTime, ForeignKey, Enum as SQLEnum, Text, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum


class BidStatus(str, enum.Enum):
    PENDING = "pending"      # Awaiting sender decision
    SELECTED = "selected"    # Sender chose this bid
    REJECTED = "rejected"    # Another bid was selected
    WITHDRAWN = "withdrawn"  # Courier withdrew
    EXPIRED = "expired"      # Deadline passed


class CourierBid(Base):
    """Courier bid on a package delivery"""
    __tablename__ = "courier_bids"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id", ondelete="CASCADE"), nullable=False, index=True)
    courier_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    route_id = Column(Integer, ForeignKey("courier_routes.id", ondelete="SET NULL"), nullable=True)

    # Bid details
    proposed_price = Column(Float, nullable=False)
    estimated_delivery_hours = Column(Integer, nullable=True)
    estimated_pickup_time = Column(DateTime(timezone=True), nullable=True)
    message = Column(Text, nullable=True)  # Max 500 chars enforced at API level

    # Status
    status = Column(SQLEnum(BidStatus), default=BidStatus.PENDING, nullable=False, index=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    selected_at = Column(DateTime(timezone=True), nullable=True)
    withdrawn_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        UniqueConstraint('package_id', 'courier_id', name='unique_bid_per_courier_package'),
        CheckConstraint('proposed_price > 0', name='positive_bid_price'),
    )

    def __repr__(self):
        return f"<CourierBid {self.id} - Package {self.package_id} - Courier {self.courier_id} - {self.status}>"
