from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum, Float
from sqlalchemy.sql import func
from app.models.base import Base
import enum

class UserRole(str, enum.Enum):
    SENDER = "sender"
    COURIER = "courier"
    BOTH = "both"  # User can be both sender and courier
    ADMIN = "admin"  # Platform administrator

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    phone_number = Column(String)
    role = Column(SQLEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Password reset fields
    password_reset_token = Column(String, nullable=True)
    password_reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Default address fields (optional)
    default_address = Column(String, nullable=True)
    default_address_lat = Column(Float, nullable=True)
    default_address_lng = Column(Float, nullable=True)

    # Courier-specific fields
    max_deviation_km = Column(Integer, default=5)  # Default 5km deviation

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.email}>"
