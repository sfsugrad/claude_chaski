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

    # PII fields - dual storage during migration (plain text + encrypted)
    email = Column(String, unique=True, index=True, nullable=False)
    email_encrypted = Column(String, nullable=True)  # Encrypted version

    hashed_password = Column(String, nullable=False)

    full_name = Column(String, nullable=False)
    full_name_encrypted = Column(String, nullable=True)  # Encrypted version

    phone_number = Column(String)
    phone_number_encrypted = Column(String, nullable=True)  # Encrypted version

    role = Column(SQLEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)
    verification_token = Column(String, nullable=True)
    verification_token_hash = Column(String, nullable=True)  # Hashed version for security
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Phone verification fields
    phone_verified = Column(Boolean, default=False)
    phone_verification_code = Column(String, nullable=True)
    phone_verification_code_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Password reset fields
    password_reset_token = Column(String, nullable=True)
    password_reset_token_hash = Column(String, nullable=True)  # Hashed version for security
    password_reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Account lockout fields
    account_locked_until = Column(DateTime(timezone=True), nullable=True)  # NULL = not locked

    # Default address fields (optional)
    default_address = Column(String, nullable=True)
    default_address_lat = Column(Float, nullable=True)
    default_address_lng = Column(Float, nullable=True)

    # Courier-specific fields
    max_deviation_km = Column(Integer, default=5)  # Default 5km deviation

    # Language preference (en, fr, es)
    preferred_language = Column(String(5), default='en', nullable=False)

    # Stripe customer ID (for senders to save payment methods)
    stripe_customer_id = Column(String(255), nullable=True, unique=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<User {self.email}>"
