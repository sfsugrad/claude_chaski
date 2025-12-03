from sqlalchemy import Column, Integer, String, Boolean, DateTime, Enum as SQLEnum, Float
from sqlalchemy.orm import relationship
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

    # Email - hash for lookup, encrypted for storage
    email_hash = Column(String, unique=True, index=True, nullable=True)  # SHA256 hash for lookup
    email_encrypted = Column(String, nullable=True)  # Encrypted version for retrieval
    email = Column(String, unique=True, index=True, nullable=True)  # DEPRECATED: Remove after migration

    hashed_password = Column(String, nullable=False)

    # Name fields - encrypted only (not queried)
    first_name_encrypted = Column(String, nullable=True)  # Encrypted version
    first_name = Column(String, nullable=True)  # Plaintext for transition
    middle_name_encrypted = Column(String, nullable=True)  # Encrypted version (optional)
    middle_name = Column(String, nullable=True)  # Plaintext for transition (optional)
    last_name_encrypted = Column(String, nullable=True)  # Encrypted version
    last_name = Column(String, nullable=True)  # Plaintext for transition

    # Full name - DEPRECATED: kept for backwards compatibility, computed from first/middle/last
    full_name_encrypted = Column(String, nullable=True)  # DEPRECATED: Remove after migration
    full_name = Column(String, nullable=True)  # DEPRECATED: Remove after migration

    @property
    def computed_full_name(self) -> str:
        """Compute full name from first, middle, and last name."""
        parts = [self.first_name]
        if self.middle_name:
            parts.append(self.middle_name)
        if self.last_name:
            parts.append(self.last_name)
        return ' '.join(filter(None, parts)) or self.full_name or ''

    # Phone number - hash for uniqueness check, encrypted for storage
    phone_number_hash = Column(String, unique=True, index=True, nullable=True)  # SHA256 hash for lookup
    phone_number_encrypted = Column(String, nullable=True)  # Encrypted version
    phone_number = Column(String, nullable=True)  # DEPRECATED: Remove after migration

    role = Column(SQLEnum(UserRole), nullable=False)
    is_active = Column(Boolean, default=True)
    is_verified = Column(Boolean, default=False)

    # Verification token - hashed only (plaintext no longer stored)
    verification_token_hash = Column(String, nullable=True)  # SHA256 hash for lookup
    verification_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    verification_token = Column(String, nullable=True)  # DEPRECATED: Remove after migration

    # Phone verification fields
    phone_verified = Column(Boolean, default=False)
    phone_verification_code = Column(String, nullable=True)
    phone_verification_code_expires_at = Column(DateTime(timezone=True), nullable=True)

    # Password reset token - hashed only (plaintext no longer stored)
    password_reset_token_hash = Column(String, nullable=True)  # SHA256 hash for lookup
    password_reset_token_expires_at = Column(DateTime(timezone=True), nullable=True)
    password_reset_token = Column(String, nullable=True)  # DEPRECATED: Remove after migration

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

    # ID verification for couriers (Stripe Identity)
    id_verified = Column(Boolean, default=False)  # True when ID verification approved

    # Legal agreement acceptance tracking
    terms_accepted_at = Column(DateTime(timezone=True), nullable=True)  # When Terms of Service was accepted
    privacy_accepted_at = Column(DateTime(timezone=True), nullable=True)  # When Privacy Policy was accepted
    courier_agreement_accepted_at = Column(DateTime(timezone=True), nullable=True)  # When Courier Agreement was accepted (courier/both roles)
    terms_version = Column(String(20), nullable=True)  # Version of Terms accepted (e.g., "1.0")
    privacy_version = Column(String(20), nullable=True)  # Version of Privacy Policy accepted
    courier_agreement_version = Column(String(20), nullable=True)  # Version of Courier Agreement accepted

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    id_verifications = relationship(
        "IDVerification",
        back_populates="user",
        foreign_keys="IDVerification.user_id",
        cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<User {self.email}>"
