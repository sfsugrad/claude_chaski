from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.models.base import Base
import enum


class IDVerificationStatus(str, enum.Enum):
    PENDING = "pending"                  # Verification session created
    PROCESSING = "processing"            # User submitted, Stripe processing
    VERIFIED = "verified"                # Stripe verified successfully
    FAILED = "failed"                    # Stripe verification failed
    REQUIRES_REVIEW = "requires_review"  # Edge case, needs admin review
    ADMIN_APPROVED = "admin_approved"    # Admin manually approved
    ADMIN_REJECTED = "admin_rejected"    # Admin manually rejected
    EXPIRED = "expired"                  # Session expired without completion


class IDVerification(Base):
    __tablename__ = "id_verifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Stripe Identity fields
    stripe_verification_session_id = Column(String(255), unique=True, index=True)
    stripe_verification_report_id = Column(String(255), nullable=True)

    # Status tracking
    status = Column(SQLEnum(IDVerificationStatus), default=IDVerificationStatus.PENDING, index=True)

    # Verification result data (encrypted for PII protection)
    document_type = Column(String(50), nullable=True)  # passport, driving_license, id_card
    document_country = Column(String(3), nullable=True)  # ISO 3166-1 alpha-3 country code
    verified_name_encrypted = Column(Text, nullable=True)  # Encrypted verified name from ID
    verified_dob_encrypted = Column(Text, nullable=True)   # Encrypted date of birth from ID

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    submitted_at = Column(DateTime(timezone=True), nullable=True)  # When user completed Stripe flow
    completed_at = Column(DateTime(timezone=True), nullable=True)  # When verification result received
    expires_at = Column(DateTime(timezone=True), nullable=True)    # Session expiration time

    # Admin review fields
    reviewed_by_admin_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    admin_notes = Column(Text, nullable=True)
    rejection_reason = Column(Text, nullable=True)

    # Stripe error info (if failed)
    failure_reason = Column(String(255), nullable=True)
    failure_code = Column(String(100), nullable=True)

    # Relationships
    user = relationship("User", foreign_keys=[user_id], back_populates="id_verifications")
    reviewed_by = relationship("User", foreign_keys=[reviewed_by_admin_id])

    def __repr__(self):
        return f"<IDVerification {self.id} user={self.user_id} status={self.status}>"
