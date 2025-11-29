"""
Delivery proof model for capturing proof of delivery.
"""
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class DeliveryProof(Base):
    """
    Stores delivery proof submitted by couriers.

    Proof can include photos, signatures, and recipient information
    to verify successful delivery.
    """
    __tablename__ = "delivery_proofs"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False, unique=True)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Photo proof (S3 storage)
    photo_url = Column(String, nullable=True)
    photo_s3_key = Column(String, nullable=True)

    # Signature proof (S3 storage)
    signature_url = Column(String, nullable=True)
    signature_s3_key = Column(String, nullable=True)

    # Recipient information
    recipient_name = Column(String(255), nullable=True)
    recipient_relationship = Column(String(100), nullable=True)  # 'addressee', 'family', 'neighbor', etc.
    notes = Column(Text, nullable=True)

    # Location verification (where proof was captured)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    location_accuracy_meters = Column(Float, nullable=True)

    # Distance from expected dropoff location
    distance_from_dropoff_meters = Column(Float, nullable=True)

    # Verification status
    is_verified = Column(Boolean, default=False)
    verified_at = Column(DateTime(timezone=True), nullable=True)
    verification_notes = Column(Text, nullable=True)

    # Timestamps
    captured_at = Column(DateTime(timezone=True), nullable=False)  # When proof was captured
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    package = relationship("Package", backref="delivery_proof", uselist=False)
    courier = relationship("User", foreign_keys=[courier_id])

    def __repr__(self):
        return f"<DeliveryProof {self.id} - Package {self.package_id}>"

    @property
    def has_photo(self) -> bool:
        """Check if photo proof exists."""
        return bool(self.photo_url or self.photo_s3_key)

    @property
    def has_signature(self) -> bool:
        """Check if signature proof exists."""
        return bool(self.signature_url or self.signature_s3_key)

    @property
    def proof_type(self) -> str:
        """Get the type of proof available."""
        if self.has_photo and self.has_signature:
            return "both"
        elif self.has_photo:
            return "photo"
        elif self.has_signature:
            return "signature"
        return "none"
