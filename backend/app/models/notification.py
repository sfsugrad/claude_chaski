from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Enum as SQLEnum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
from app.models.base import Base
import enum


class NotificationType(str, enum.Enum):
    PACKAGE_MATCHED = "PACKAGE_MATCHED"
    PACKAGE_ACCEPTED = "PACKAGE_ACCEPTED"
    PACKAGE_DECLINED = "PACKAGE_DECLINED"
    PACKAGE_PICKED_UP = "PACKAGE_PICKED_UP"
    PACKAGE_IN_TRANSIT = "PACKAGE_IN_TRANSIT"
    PACKAGE_DELIVERED = "PACKAGE_DELIVERED"
    PACKAGE_CANCELLED = "PACKAGE_CANCELLED"
    ROUTE_MATCH_FOUND = "ROUTE_MATCH_FOUND"
    PACKAGE_MATCH_FOUND = "PACKAGE_MATCH_FOUND"  # Notify courier about a package matching their route
    NEW_RATING = "NEW_RATING"  # Notify user about receiving a new rating
    DELIVERY_PROOF_SUBMITTED = "DELIVERY_PROOF_SUBMITTED"  # Notify sender that proof was submitted
    PAYMENT_RECEIVED = "PAYMENT_RECEIVED"  # Payment processed successfully
    PAYMENT_FAILED = "PAYMENT_FAILED"  # Payment processing failed
    PAYOUT_SENT = "PAYOUT_SENT"  # Courier payout initiated
    PAYOUT_FAILED = "PAYOUT_FAILED"  # Courier payout failed
    PACKAGE_REMINDER = "PACKAGE_REMINDER"  # Reminder for stale MATCHED packages
    # Bidding notifications
    NEW_BID_RECEIVED = "NEW_BID_RECEIVED"  # Sender: new bid on their package
    BID_SELECTED = "BID_SELECTED"  # Courier: their bid was selected
    BID_REJECTED = "BID_REJECTED"  # Courier: another bid was selected
    BID_WITHDRAWN = "BID_WITHDRAWN"  # Sender: courier withdrew their bid
    BID_DEADLINE_WARNING = "BID_DEADLINE_WARNING"  # Sender: 6 hours left to select a bid
    BID_DEADLINE_EXTENDED = "BID_DEADLINE_EXTENDED"  # Sender: deadline extended by 12 hours
    BID_DEADLINE_EXPIRED = "BID_DEADLINE_EXPIRED"  # All parties: bidding period ended
    NEW_NOTE_ADDED = "NEW_NOTE_ADDED"  # Sender/Courier: new note added to their package
    SYSTEM = "SYSTEM"


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
