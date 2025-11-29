"""
Delivery proof API endpoints.

Handles proof of delivery submission and verification.
"""
import base64
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.delivery_proof import DeliveryProof
from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.models.notification import NotificationType
from app.utils.dependencies import get_current_user
from app.services.file_storage import get_file_storage, StorageError
from app.services.package_status import transition_package, validate_transition
from app.services.stripe_service import get_stripe_service
from app.routes.notifications import create_notification_with_broadcast
from app.utils.geo import haversine_distance
import logging

logger = logging.getLogger(__name__)


router = APIRouter()


def get_package_by_tracking_id(db: Session, tracking_id: str) -> Package | None:
    """Get a package by tracking_id, with fallback to numeric ID."""
    package = db.query(Package).filter(Package.tracking_id == tracking_id).first()
    if not package and tracking_id.isdigit():
        package = db.query(Package).filter(Package.id == int(tracking_id)).first()
    return package


# Pydantic models
class UploadUrlRequest(BaseModel):
    """Request for pre-signed upload URL."""
    file_type: str = Field(..., pattern="^(photo|signature)$")
    content_type: str = Field(default="image/jpeg")


class UploadUrlResponse(BaseModel):
    """Response with pre-signed upload URL."""
    upload_url: str
    key: str
    fields: dict


class DeliveryProofCreate(BaseModel):
    """Create delivery proof record."""
    photo_s3_key: Optional[str] = None
    signature_s3_key: Optional[str] = None
    signature_data: Optional[str] = None  # Base64 encoded signature from canvas
    recipient_name: Optional[str] = Field(None, max_length=255)
    recipient_relationship: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = Field(None, max_length=1000)
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)
    location_accuracy_meters: Optional[float] = Field(None, ge=0)
    captured_at: datetime


class DeliveryProofResponse(BaseModel):
    """Delivery proof response."""
    id: int
    package_id: int
    courier_id: int
    photo_url: Optional[str]
    signature_url: Optional[str]
    recipient_name: Optional[str]
    recipient_relationship: Optional[str]
    notes: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    distance_from_dropoff_meters: Optional[float]
    is_verified: bool
    proof_type: str
    captured_at: datetime
    created_at: datetime

    class Config:
        from_attributes = True


def _calculate_distance_from_dropoff(
    proof_lat: Optional[float],
    proof_lng: Optional[float],
    package: Package
) -> Optional[float]:
    """Calculate distance from proof location to package dropoff."""
    if proof_lat is None or proof_lng is None:
        return None
    distance_km = haversine_distance(
        proof_lat, proof_lng,
        package.dropoff_lat, package.dropoff_lng
    )
    return distance_km * 1000  # Convert to meters


def _is_courier_for_package(user: User, package: Package) -> bool:
    """Check if user is the assigned courier for the package."""
    return package.courier_id == user.id


def _can_view_proof(user: User, package: Package) -> bool:
    """Check if user can view delivery proof."""
    # Sender, assigned courier, or admin can view
    return (
        package.sender_id == user.id or
        package.courier_id == user.id or
        user.role == UserRole.ADMIN
    )


@router.post("/upload-url/{tracking_id}", response_model=UploadUrlResponse)
async def get_upload_url(
    tracking_id: str,
    request: UploadUrlRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get pre-signed URL for uploading proof photo/signature to S3.

    Only the assigned courier can upload proof.
    """
    # Get package
    package = get_package_by_tracking_id(db, tracking_id)

    if not package or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check if user is the assigned courier
    if not _is_courier_for_package(current_user, package):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned courier can upload delivery proof"
        )

    # Package must be in transit
    if package.status != PackageStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot upload proof for package in {package.status.value} status. Package must be 'In Transit'."
        )

    # Check if proof already exists
    existing_proof = db.query(DeliveryProof).filter(
        DeliveryProof.package_id == package.id
    ).first()

    if existing_proof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery proof already exists for this package"
        )

    try:
        storage = get_file_storage()
        result = await storage.generate_presigned_upload_url(
            package_id=package.id,
            file_type=request.file_type,
            content_type=request.content_type
        )
        return UploadUrlResponse(**result)
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.post("/{tracking_id}", response_model=DeliveryProofResponse)
async def create_delivery_proof(
    tracking_id: str,
    proof_data: DeliveryProofCreate,
    background_tasks: BackgroundTasks,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create delivery proof record.

    This marks the package as delivered and triggers payment processing.
    """
    # Get package
    package = get_package_by_tracking_id(db, tracking_id)

    if not package or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check if user is the assigned courier
    if not _is_courier_for_package(current_user, package):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the assigned courier can submit delivery proof"
        )

    # Package must be IN_TRANSIT
    if package.status != PackageStatus.IN_TRANSIT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot submit proof for package in {package.status.value} status. Package must be 'In Transit'."
        )

    # Check if proof already exists
    existing_proof = db.query(DeliveryProof).filter(
        DeliveryProof.package_id == package.id
    ).first()

    if existing_proof:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Delivery proof already exists for this package"
        )

    # Must have at least photo or signature
    has_photo = bool(proof_data.photo_s3_key)
    has_signature = bool(proof_data.signature_s3_key or proof_data.signature_data)

    if not has_photo and not has_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one proof type (photo or signature) is required"
        )

    # Handle signature data from canvas
    signature_s3_key = proof_data.signature_s3_key
    if proof_data.signature_data and not signature_s3_key:
        try:
            # Decode base64 and upload
            storage = get_file_storage()
            # Remove data URL prefix if present
            sig_data = proof_data.signature_data
            if "," in sig_data:
                sig_data = sig_data.split(",")[1]
            signature_bytes = base64.b64decode(sig_data)
            signature_s3_key = await storage.upload_file(
                file_data=signature_bytes,
                package_id=package.id,
                file_type="signature",
                content_type="image/png"
            )
        except Exception as e:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Failed to process signature: {str(e)}"
            )

    # Calculate distance from dropoff
    distance_from_dropoff = _calculate_distance_from_dropoff(
        proof_data.latitude,
        proof_data.longitude,
        package
    )

    # Create delivery proof
    proof = DeliveryProof(
        package_id=package.id,
        courier_id=current_user.id,
        photo_s3_key=proof_data.photo_s3_key,
        signature_s3_key=signature_s3_key,
        recipient_name=proof_data.recipient_name,
        recipient_relationship=proof_data.recipient_relationship,
        notes=proof_data.notes,
        latitude=proof_data.latitude,
        longitude=proof_data.longitude,
        location_accuracy_meters=proof_data.location_accuracy_meters,
        distance_from_dropoff_meters=distance_from_dropoff,
        captured_at=proof_data.captured_at
    )

    db.add(proof)

    # Update package status to DELIVERED using transition service
    package, error = transition_package(db, package, PackageStatus.DELIVERED, current_user.id)
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to transition package to delivered: {error}"
        )

    db.commit()
    db.refresh(proof)

    # Generate URLs for response
    storage = get_file_storage()
    photo_url = None
    signature_url = None

    if proof.photo_s3_key:
        try:
            photo_url = await storage.generate_presigned_download_url(proof.photo_s3_key)
        except StorageError:
            photo_url = storage.get_public_url(proof.photo_s3_key)

    if proof.signature_s3_key:
        try:
            signature_url = await storage.generate_presigned_download_url(proof.signature_s3_key)
        except StorageError:
            signature_url = storage.get_public_url(proof.signature_s3_key)

    # Notify sender
    await create_notification_with_broadcast(
        db=db,
        user_id=package.sender_id,
        notification_type=NotificationType.DELIVERY_PROOF_SUBMITTED,
        message=f"Delivery proof submitted for your package to {package.dropoff_address}",
        package_id=package.id
    )

    # Auto-trigger payment processing
    if package.price and package.price > 0:
        background_tasks.add_task(
            _process_payment_after_delivery,
            db,
            package.id,
            package.sender_id
        )

    return DeliveryProofResponse(
        id=proof.id,
        package_id=proof.package_id,
        courier_id=proof.courier_id,
        photo_url=photo_url,
        signature_url=signature_url,
        recipient_name=proof.recipient_name,
        recipient_relationship=proof.recipient_relationship,
        notes=proof.notes,
        latitude=proof.latitude,
        longitude=proof.longitude,
        distance_from_dropoff_meters=proof.distance_from_dropoff_meters,
        is_verified=proof.is_verified,
        proof_type=proof.proof_type,
        captured_at=proof.captured_at,
        created_at=proof.created_at
    )


async def _process_payment_after_delivery(
    db: Session,
    package_id: int,
    sender_id: int
):
    """Background task to process payment after delivery proof submission."""
    try:
        # Get fresh package and sender from database
        package = db.query(Package).filter(Package.id == package_id).first()
        sender = db.query(User).filter(User.id == sender_id).first()

        if not package or not sender:
            logger.error(f"Package or sender not found for payment: package_id={package_id}")
            return

        if not package.price or package.price <= 0:
            logger.info(f"No payment required for package {package_id} (no price set)")
            return

        stripe_service = get_stripe_service()
        transaction = await stripe_service.create_payment_intent(db, package, sender)

        if transaction.status == "succeeded":
            # Notify sender of successful payment
            await create_notification_with_broadcast(
                db=db,
                user_id=sender.id,
                notification_type=NotificationType.PAYMENT_RECEIVED,
                message=f"Payment of ${package.price:.2f} processed for delivery to {package.dropoff_address}",
                package_id=package_id
            )

            # Notify courier of earnings
            if package.courier_id:
                courier_earnings = transaction.courier_payout_cents / 100
                await create_notification_with_broadcast(
                    db=db,
                    user_id=package.courier_id,
                    notification_type=NotificationType.PAYMENT_RECEIVED,
                    message=f"You earned ${courier_earnings:.2f} for delivering package #{package_id}",
                    package_id=package_id
                )

        elif transaction.status in ["requires_payment", "requires_action"]:
            # Notify sender that payment action is required
            await create_notification_with_broadcast(
                db=db,
                user_id=sender.id,
                notification_type=NotificationType.PAYMENT_FAILED,
                message=f"Payment required for your delivered package. Please update your payment method.",
                package_id=package_id
            )

        logger.info(f"Payment processed for package {package_id}: status={transaction.status}")

    except Exception as e:
        logger.error(f"Failed to process payment for package {package_id}: {str(e)}")
        # Notify sender of payment failure
        try:
            await create_notification_with_broadcast(
                db=db,
                user_id=sender_id,
                notification_type=NotificationType.PAYMENT_FAILED,
                message=f"Payment processing failed for your delivery. Please contact support.",
                package_id=package_id
            )
        except Exception:
            pass


@router.get("/{tracking_id}", response_model=DeliveryProofResponse)
async def get_delivery_proof(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get delivery proof for a package.

    Accessible by sender, assigned courier, or admin.
    """
    # Get package
    package = get_package_by_tracking_id(db, tracking_id)

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check access
    if not _can_view_proof(current_user, package):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this delivery proof"
        )

    # Get proof
    proof = db.query(DeliveryProof).filter(
        DeliveryProof.package_id == package.id
    ).first()

    if not proof:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Delivery proof not found"
        )

    # Generate URLs
    storage = get_file_storage()
    photo_url = None
    signature_url = None

    if proof.photo_s3_key:
        try:
            photo_url = await storage.generate_presigned_download_url(proof.photo_s3_key)
        except StorageError:
            photo_url = storage.get_public_url(proof.photo_s3_key)

    if proof.signature_s3_key:
        try:
            signature_url = await storage.generate_presigned_download_url(proof.signature_s3_key)
        except StorageError:
            signature_url = storage.get_public_url(proof.signature_s3_key)

    return DeliveryProofResponse(
        id=proof.id,
        package_id=proof.package_id,
        courier_id=proof.courier_id,
        photo_url=photo_url,
        signature_url=signature_url,
        recipient_name=proof.recipient_name,
        recipient_relationship=proof.recipient_relationship,
        notes=proof.notes,
        latitude=proof.latitude,
        longitude=proof.longitude,
        distance_from_dropoff_meters=proof.distance_from_dropoff_meters,
        is_verified=proof.is_verified,
        proof_type=proof.proof_type,
        captured_at=proof.captured_at,
        created_at=proof.created_at
    )


@router.get("/{tracking_id}/photo")
async def get_proof_photo_url(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get signed URL for proof photo."""
    package = get_package_by_tracking_id(db, tracking_id)

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    if not _can_view_proof(current_user, package):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this delivery proof"
        )

    proof = db.query(DeliveryProof).filter(
        DeliveryProof.package_id == package.id
    ).first()

    if not proof or not proof.photo_s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proof photo not found"
        )

    try:
        storage = get_file_storage()
        url = await storage.generate_presigned_download_url(proof.photo_s3_key)
        return {"url": url, "expires_in": 3600}
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{tracking_id}/signature")
async def get_proof_signature_url(
    tracking_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get signed URL for proof signature."""
    package = get_package_by_tracking_id(db, tracking_id)

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    if not _can_view_proof(current_user, package):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have access to this delivery proof"
        )

    proof = db.query(DeliveryProof).filter(
        DeliveryProof.package_id == package.id
    ).first()

    if not proof or not proof.signature_s3_key:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proof signature not found"
        )

    try:
        storage = get_file_storage()
        url = await storage.generate_presigned_download_url(proof.signature_s3_key)
        return {"url": url, "expires_in": 3600}
    except StorageError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
