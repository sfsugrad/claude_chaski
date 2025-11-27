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
