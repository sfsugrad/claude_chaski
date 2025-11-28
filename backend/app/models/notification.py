from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
import enum


class NotificationType(str, enum.Enum):
    PACKAGE_MATCHED = "package_matched"
    PACKAGE_ACCEPTED = "package_accepted"
    PACKAGE_DECLINED = "package_declined"
    PACKAGE_PICKED_UP = "package_picked_up"
    PACKAGE_IN_TRANSIT = "package_in_transit"
    PACKAGE_DELIVERED = "package_delivered"
    PACKAGE_CANCELLED = "package_cancelled"
    ROUTE_MATCH_FOUND = "route_match_found"
    PACKAGE_MATCH_FOUND = "package_match_found"  # Notify courier about a package matching their route
    NEW_RATING = "new_rating"  # Notify user about receiving a new rating
    DELIVERY_PROOF_SUBMITTED = "delivery_proof_submitted"  # Notify sender that proof was submitted
    PAYMENT_RECEIVED = "payment_received"  # Payment processed successfully
    PAYMENT_FAILED = "payment_failed"  # Payment processing failed
    PAYOUT_SENT = "payout_sent"  # Courier payout initiated
    PAYOUT_FAILED = "payout_failed"  # Courier payout failed
    PACKAGE_REMINDER = "package_reminder"  # Reminder for stale MATCHED packages
    # Bidding notifications
    NEW_BID_RECEIVED = "new_bid_received"  # Sender: new bid on their package
    BID_SELECTED = "bid_selected"  # Courier: their bid was selected
    BID_REJECTED = "bid_rejected"  # Courier: another bid was selected
    BID_WITHDRAWN = "bid_withdrawn"  # Sender: courier withdrew their bid
    BID_DEADLINE_WARNING = "bid_deadline_warning"  # Sender: 6 hours left to select a bid
    BID_DEADLINE_EXTENDED = "bid_deadline_extended"  # Sender: deadline extended by 12 hours
    BID_DEADLINE_EXPIRED = "bid_deadline_expired"  # All parties: bidding period ended
    SYSTEM = "system"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    type = Column(SQLEnum(NotificationType), nullable=False)
    message = Column(String, nullable=False)
    read = Column(Boolean, default=False, index=True)

    # Optional reference to related package
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="notifications")
    package = relationship("Package", backref="notifications")

    def __repr__(self):
        return f"<Notification {self.id} for user {self.user_id}: {self.type.value}>"
