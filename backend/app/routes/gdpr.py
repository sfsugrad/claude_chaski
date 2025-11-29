"""
GDPR Data Export Endpoint

Provides users with a comprehensive export of all their personal data
in compliance with GDPR Article 15 (Right of Access).
"""

from fastapi import APIRouter, Depends, Request, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Dict, Any, List
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.database import get_db
from app.models.user import User
from app.models.package import Package, CourierRoute
from app.models.notification import Notification
from app.models.rating import Rating
from app.models.message import Message
from app.models.audit_log import AuditLog
from app.models.bid import CourierBid
from app.models.delivery_proof import DeliveryProof
from app.models.payment import Transaction
# LocationUpdate imported inside function to avoid circular imports
from app.utils.dependencies import get_current_user
from app.services.audit_service import log_data_export_request, log_data_export_completed
from app.utils.encryption import EncryptionService

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


def serialize_datetime(dt: datetime) -> str:
    """Convert datetime to ISO format string"""
    return dt.isoformat() if dt else None


def export_user_profile(user: User, encryption_service: EncryptionService) -> Dict[str, Any]:
    """Export user profile data with decrypted PII"""
    return {
        "id": user.id,
        "email": encryption_service.decrypt(user.email_encrypted) if user.email_encrypted else user.email,
        "full_name": encryption_service.decrypt(user.full_name_encrypted) if user.full_name_encrypted else user.full_name,
        "phone_number": encryption_service.decrypt(user.phone_number_encrypted) if user.phone_number_encrypted else user.phone_number,
        "role": user.role.value,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "phone_verified": user.phone_verified,
        "default_address": user.default_address,
        "default_address_lat": user.default_address_lat,
        "default_address_lng": user.default_address_lng,
        "max_deviation_km": user.max_deviation_km,
        "preferred_language": user.preferred_language,
        "stripe_customer_id": user.stripe_customer_id,
        "created_at": serialize_datetime(user.created_at),
        "updated_at": serialize_datetime(user.updated_at),
    }


def export_packages(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all packages created by the user"""
    packages = db.query(Package).filter(Package.sender_id == user_id).all()
    return [
        {
            "id": pkg.id,
            "description": pkg.description,
            "size": pkg.size.value if pkg.size else None,
            "weight_kg": pkg.weight_kg,
            "status": pkg.status.value,
            "pickup_address": pkg.pickup_address,
            "pickup_lat": pkg.pickup_lat,
            "pickup_lng": pkg.pickup_lng,
            "pickup_contact_name": pkg.pickup_contact_name,
            "pickup_contact_phone": pkg.pickup_contact_phone,
            "dropoff_address": pkg.dropoff_address,
            "dropoff_lat": pkg.dropoff_lat,
            "dropoff_lng": pkg.dropoff_lng,
            "dropoff_contact_name": pkg.dropoff_contact_name,
            "dropoff_contact_phone": pkg.dropoff_contact_phone,
            "price": pkg.price,
            "courier_id": pkg.courier_id,
            "requires_proof": pkg.requires_proof,
            "is_active": pkg.is_active,
            "created_at": serialize_datetime(pkg.created_at),
            "updated_at": serialize_datetime(pkg.updated_at),
        }
        for pkg in packages
    ]


def export_courier_routes(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all courier routes created by the user"""
    routes = db.query(CourierRoute).filter(CourierRoute.courier_id == user_id).all()
    return [
        {
            "id": route.id,
            "origin": route.origin,
            "origin_lat": route.origin_lat,
            "origin_lng": route.origin_lng,
            "destination": route.destination,
            "destination_lat": route.destination_lat,
            "destination_lng": route.destination_lng,
            "departure_time": serialize_datetime(route.departure_time),
            "arrival_time": serialize_datetime(route.arrival_time),
            "max_deviation_km": route.max_deviation_km,
            "vehicle_type": route.vehicle_type,
            "available_space": route.available_space,
            "is_active": route.is_active,
            "created_at": serialize_datetime(route.created_at),
            "updated_at": serialize_datetime(route.updated_at),
        }
        for route in routes
    ]


def export_bids(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all bids submitted by the user as courier"""
    bids = db.query(CourierBid).filter(CourierBid.courier_id == user_id).all()
    return [
        {
            "id": bid.id,
            "package_id": bid.package_id,
            "proposed_price": bid.proposed_price,
            "message": bid.message,
            "status": bid.status.value,
            "accepted_at": serialize_datetime(bid.accepted_at),
            "rejected_at": serialize_datetime(bid.rejected_at),
            "created_at": serialize_datetime(bid.created_at),
        }
        for bid in bids
    ]


def export_ratings_given(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all ratings given by the user"""
    ratings = db.query(Rating).filter(Rating.rater_id == user_id).all()
    return [
        {
            "id": rating.id,
            "package_id": rating.package_id,
            "rated_user_id": rating.rated_user_id,
            "score": rating.score,
            "comment": rating.comment,
            "created_at": serialize_datetime(rating.created_at),
        }
        for rating in ratings
    ]


def export_ratings_received(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all ratings received by the user"""
    ratings = db.query(Rating).filter(Rating.rated_user_id == user_id).all()
    return [
        {
            "id": rating.id,
            "package_id": rating.package_id,
            "rater_user_id": rating.rater_id,
            "score": rating.score,
            "comment": rating.comment,
            "created_at": serialize_datetime(rating.created_at),
        }
        for rating in ratings
    ]


def export_messages_sent(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all messages sent by the user"""
    messages = db.query(Message).filter(Message.sender_id == user_id).all()
    return [
        {
            "id": msg.id,
            "package_id": msg.package_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "is_read": msg.is_read,
            "created_at": serialize_datetime(msg.created_at),
        }
        for msg in messages
    ]


def export_messages_received(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all messages received by the user (messages on their packages from others)"""
    # Messages sent by others on packages where user is sender
    from app.models.package import Package
    user_packages = db.query(Package.id).filter(Package.sender_id == user_id).subquery()
    messages = db.query(Message).filter(
        Message.package_id.in_(user_packages),
        Message.sender_id != user_id
    ).all()
    return [
        {
            "id": msg.id,
            "package_id": msg.package_id,
            "sender_id": msg.sender_id,
            "content": msg.content,
            "is_read": msg.is_read,
            "created_at": serialize_datetime(msg.created_at),
        }
        for msg in messages
    ]


def export_notifications(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all notifications sent to the user"""
    notifications = db.query(Notification).filter(Notification.user_id == user_id).all()
    return [
        {
            "id": notif.id,
            "type": notif.type.value if notif.type else None,
            "message": notif.message,
            "read": notif.read,
            "package_id": notif.package_id,
            "created_at": serialize_datetime(notif.created_at),
        }
        for notif in notifications
    ]


def export_audit_logs(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export all audit logs related to the user"""
    logs = db.query(AuditLog).filter(AuditLog.user_id == user_id).all()
    return [
        {
            "id": log.id,
            "action": log.action.value,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "details": log.details,
            "ip_address": log.ip_address,
            "user_agent": log.user_agent,
            "created_at": serialize_datetime(log.created_at),
        }
        for log in logs
    ]


def export_delivery_proofs(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export delivery proof records (metadata only, not actual images)"""
    # Find packages where user is sender or courier
    sender_packages = db.query(Package).filter(Package.sender_id == user_id).all()
    courier_packages = db.query(Package).filter(Package.assigned_courier_id == user_id).all()

    package_ids = [pkg.id for pkg in sender_packages + courier_packages]

    proofs = db.query(DeliveryProof).filter(DeliveryProof.package_id.in_(package_ids)).all()
    return [
        {
            "id": proof.id,
            "package_id": proof.package_id,
            "photo_s3_key": proof.photo_s3_key,
            "signature_s3_key": proof.signature_s3_key,
            "proof_type": proof.proof_type.value if proof.proof_type else None,
            "notes": proof.notes,
            "is_verified": proof.is_verified,
            "verified_at": serialize_datetime(proof.verified_at),
            "uploaded_at": serialize_datetime(proof.uploaded_at),
        }
        for proof in proofs
    ]


def export_payments(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export payment records for the user"""
    transactions = db.query(Transaction).filter(Transaction.sender_id == user_id).all()
    return [
        {
            "id": txn.id,
            "package_id": txn.package_id,
            "stripe_payment_intent_id": txn.stripe_payment_intent_id,
            "amount_cents": txn.amount_cents,
            "status": txn.status,
            "created_at": serialize_datetime(txn.created_at),
            "updated_at": serialize_datetime(txn.updated_at),
        }
        for txn in transactions
    ]


def export_tracking_locations(user_id: int, db: Session) -> List[Dict[str, Any]]:
    """Export tracking location history for packages where user is courier"""
    from app.models.tracking import TrackingSession

    # Find tracking sessions where user is courier
    sessions = db.query(TrackingSession).filter(TrackingSession.courier_id == user_id).all()

    result = []
    for session in sessions:
        for loc in session.location_updates:
            result.append({
                "id": loc.id,
                "session_id": loc.session_id,
                "package_id": session.package_id,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "accuracy_meters": loc.accuracy_meters,
                "timestamp": serialize_datetime(loc.timestamp),
            })
    return result


@router.get("/me/export")
@limiter.limit("3/hour")  # Strict rate limit: 3 exports per hour
async def export_user_data(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Export all personal data for the current user (GDPR Article 15).

    Returns a comprehensive JSON export of all data associated with the user:
    - Profile information
    - Packages (as sender)
    - Courier routes
    - Bids submitted
    - Ratings given and received
    - Messages sent and received
    - Notifications
    - Audit logs
    - Delivery proofs
    - Payments
    - Tracking locations

    Rate limited to 3 requests per hour to prevent abuse.
    """
    # Log the export request
    log_data_export_request(
        db=db,
        user_id=current_user.id,
        ip_address=request.client.host if request.client else None,
        user_agent=request.headers.get("user-agent")
    )

    try:
        # Initialize encryption service for decrypting PII
        encryption_service = EncryptionService()

        # Build comprehensive data export
        export_data = {
            "export_metadata": {
                "user_id": current_user.id,
                "export_date": datetime.utcnow().isoformat(),
                "export_version": "1.0",
                "gdpr_article": "Article 15 - Right of Access",
            },
            "profile": export_user_profile(current_user, encryption_service),
            "packages": export_packages(current_user.id, db),
            "courier_routes": export_courier_routes(current_user.id, db),
            "bids": export_bids(current_user.id, db),
            "ratings_given": export_ratings_given(current_user.id, db),
            "ratings_received": export_ratings_received(current_user.id, db),
            "messages_sent": export_messages_sent(current_user.id, db),
            "messages_received": export_messages_received(current_user.id, db),
            "notifications": export_notifications(current_user.id, db),
            "audit_logs": export_audit_logs(current_user.id, db),
            "delivery_proofs": export_delivery_proofs(current_user.id, db),
            "payments": export_payments(current_user.id, db),
            "tracking_locations": export_tracking_locations(current_user.id, db),
        }

        # Log successful export
        log_data_export_completed(
            db=db,
            user_id=current_user.id,
            ip_address=request.client.host if request.client else None,
            user_agent=request.headers.get("user-agent")
        )

        # Return as downloadable JSON
        response = JSONResponse(
            content=export_data,
            headers={
                "Content-Disposition": f"attachment; filename=chaski_data_export_{current_user.id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
            }
        )

        return response

    except Exception as e:
        # Log error but don't expose details to user
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Failed to generate data export. Please try again later or contact support."
        )
