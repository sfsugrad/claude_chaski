"""
ID Verification API endpoints.

Handles Stripe Identity verification for couriers.
"""
import stripe
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole
from app.models.id_verification import IDVerification, IDVerificationStatus
from app.models.audit_log import AuditAction
from app.utils.dependencies import get_current_user, get_current_admin_user
from app.services.stripe_identity_service import get_stripe_identity_service
# from app.services.audit_service import AuditService  # TODO: Implement AuditService class


router = APIRouter()


# ==================== Request/Response Models ====================

class StartVerificationRequest(BaseModel):
    return_url: str


class StartVerificationResponse(BaseModel):
    session_id: str
    url: str
    verification_id: int


class VerificationStatusResponse(BaseModel):
    is_verified: bool
    status: Optional[str]
    can_start_verification: bool
    verification: Optional[dict]


class VerificationResponse(BaseModel):
    id: int
    user_id: int
    status: str
    document_type: Optional[str]
    document_country: Optional[str]
    created_at: datetime
    submitted_at: Optional[datetime]
    completed_at: Optional[datetime]
    rejection_reason: Optional[str]
    failure_reason: Optional[str]
    reviewed_at: Optional[datetime]

    class Config:
        from_attributes = True


class AdminReviewRequest(BaseModel):
    action: str  # "approve" or "reject"
    rejection_reason: Optional[str] = None
    notes: Optional[str] = None


class AdminVerificationResponse(BaseModel):
    id: int
    user_id: int
    user_email: Optional[str]
    user_full_name: Optional[str]
    status: str
    document_type: Optional[str]
    document_country: Optional[str]
    created_at: datetime
    submitted_at: Optional[datetime]
    completed_at: Optional[datetime]
    failure_reason: Optional[str]
    failure_code: Optional[str]
    rejection_reason: Optional[str]
    reviewed_by_admin_id: Optional[int]
    reviewed_at: Optional[datetime]
    admin_notes: Optional[str]

    class Config:
        from_attributes = True


# ==================== Helper Functions ====================

def _require_courier_role(user: User):
    """Ensure user has courier capabilities."""
    if user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Courier role required for ID verification"
        )


# ==================== Courier Endpoints ====================

@router.get("/status", response_model=VerificationStatusResponse)
async def get_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current ID verification status for the authenticated user.

    Returns whether the user is verified, their current verification status,
    and whether they can start a new verification.
    """
    _require_courier_role(current_user)

    identity_service = get_stripe_identity_service()
    status_info = await identity_service.get_user_verification_status(db, current_user)

    return VerificationStatusResponse(**status_info)


@router.post("/start", response_model=StartVerificationResponse)
async def start_verification(
    data: StartVerificationRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Start a new ID verification session.

    Creates a Stripe Identity verification session and returns the URL
    to redirect the user to complete verification.
    """
    _require_courier_role(current_user)

    # Check if already verified
    if current_user.id_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Your ID has already been verified"
        )

    identity_service = get_stripe_identity_service()

    try:
        result = await identity_service.create_verification_session(
            db=db,
            user=current_user,
            return_url=data.return_url
        )

        # Log the verification start
        # TODO: Re-enable when AuditService class is implemented
        # await AuditService.log(
        #     db=db,
        #     user_id=current_user.id,
        #     user_email=current_user.email,
        #     action=AuditAction.ID_VERIFICATION_STARTED,
        #     resource_type="id_verification",
        #     resource_id=result["verification_id"],
        #     details={"session_id": result["session_id"]},
        #     ip_address=request.client.host if request.client else None,
        #     user_agent=request.headers.get("user-agent")
        # )

        return StartVerificationResponse(
            session_id=result["session_id"],
            url=result["url"],
            verification_id=result["verification_id"]
        )

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to create verification session: {str(e)}"
        )


@router.get("/history", response_model=List[VerificationResponse])
async def get_verification_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get verification history for the authenticated user.

    Returns all verification attempts ordered by most recent first.
    """
    _require_courier_role(current_user)

    verifications = db.query(IDVerification).filter(
        IDVerification.user_id == current_user.id
    ).order_by(IDVerification.created_at.desc()).all()

    return [
        VerificationResponse(
            id=v.id,
            user_id=v.user_id,
            status=v.status.value,
            document_type=v.document_type,
            document_country=v.document_country,
            created_at=v.created_at,
            submitted_at=v.submitted_at,
            completed_at=v.completed_at,
            rejection_reason=v.rejection_reason,
            failure_reason=v.failure_reason,
            reviewed_at=v.reviewed_at
        )
        for v in verifications
    ]


@router.post("/cancel")
async def cancel_verification(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Cancel a pending verification session.

    Only cancels the most recent pending/processing verification.
    """
    _require_courier_role(current_user)

    # Find pending verification
    verification = db.query(IDVerification).filter(
        IDVerification.user_id == current_user.id,
        IDVerification.status.in_([
            IDVerificationStatus.PENDING,
            IDVerificationStatus.PROCESSING
        ])
    ).order_by(IDVerification.created_at.desc()).first()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No pending verification to cancel"
        )

    identity_service = get_stripe_identity_service()
    await identity_service.cancel_verification_session(db, verification)

    return {"message": "Verification cancelled successfully"}


@router.post("/refresh", response_model=VerificationStatusResponse)
async def refresh_verification_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Manually refresh verification status from Stripe.

    Useful for local development without webhooks or when webhook delivery fails.
    This endpoint polls Stripe for the current session status and updates the local record.
    """
    _require_courier_role(current_user)

    # Find the most recent verification
    verification = db.query(IDVerification).filter(
        IDVerification.user_id == current_user.id
    ).order_by(IDVerification.created_at.desc()).first()

    if not verification:
        return VerificationStatusResponse(
            is_verified=False,
            status=None,
            can_start_verification=True,
            verification=None
        )

    # Only refresh if in pending/processing state
    if verification.status in [IDVerificationStatus.PENDING, IDVerificationStatus.PROCESSING]:
        identity_service = get_stripe_identity_service()

        # Fetch current status from Stripe
        session_data = await identity_service.get_verification_session(
            verification.stripe_verification_session_id
        )

        if session_data:
            stripe_status = session_data.get("status")

            # Map Stripe status to our status
            if stripe_status == "verified":
                verification.status = IDVerificationStatus.VERIFIED
                verification.completed_at = datetime.now()

                # Get report ID if available
                if session_data.get("last_verification_report"):
                    verification.stripe_verification_report_id = session_data["last_verification_report"]

                # Update user's id_verified status
                current_user.id_verified = True
                db.commit()

            elif stripe_status == "requires_input":
                last_error = session_data.get("last_error")
                if last_error:
                    verification.failure_reason = str(last_error.get("reason", last_error)) if isinstance(last_error, dict) else str(last_error)
                    verification.failure_code = last_error.get("code") if isinstance(last_error, dict) else None
                    verification.status = IDVerificationStatus.REQUIRES_REVIEW
                else:
                    verification.status = IDVerificationStatus.PENDING
                db.commit()

            elif stripe_status == "processing":
                if verification.status != IDVerificationStatus.PROCESSING:
                    verification.status = IDVerificationStatus.PROCESSING
                    verification.submitted_at = datetime.now()
                    db.commit()

            elif stripe_status == "canceled":
                verification.status = IDVerificationStatus.EXPIRED
                verification.completed_at = datetime.now()
                db.commit()

    # Return current status
    return VerificationStatusResponse(
        is_verified=current_user.id_verified,
        status=verification.status.value if verification else None,
        can_start_verification=verification.status in [
            IDVerificationStatus.FAILED,
            IDVerificationStatus.ADMIN_REJECTED,
            IDVerificationStatus.EXPIRED
        ] if verification else True,
        verification={
            "id": verification.id,
            "status": verification.status.value,
            "created_at": verification.created_at.isoformat() if verification.created_at else None,
            "completed_at": verification.completed_at.isoformat() if verification.completed_at else None,
            "rejection_reason": verification.rejection_reason,
            "failure_reason": verification.failure_reason
        } if verification else None
    )


# ==================== Webhook Endpoint ====================

@router.post("/webhook")
async def handle_stripe_webhook(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Handle Stripe Identity webhook events.

    This endpoint receives webhook notifications from Stripe about
    verification session status changes.
    """
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    if not sig_header:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature"
        )

    # Verify webhook signature
    webhook_secret = settings.STRIPE_IDENTITY_WEBHOOK_SECRET
    if not webhook_secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook secret not configured"
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid payload"
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid signature"
        )

    # Process the event
    identity_service = get_stripe_identity_service()
    verification = await identity_service.process_webhook_event(db, event)

    # Log verification events
    if verification:
        if event.type == "identity.verification_session.verified":
            action = AuditAction.ID_VERIFICATION_COMPLETED
        elif event.type == "identity.verification_session.processing":
            action = AuditAction.ID_VERIFICATION_SUBMITTED
        elif event.type in ["identity.verification_session.requires_input", "identity.verification_session.canceled"]:
            action = AuditAction.ID_VERIFICATION_FAILED
        else:
            action = None

        if action:
            # TODO: Re-enable when AuditService class is implemented
            pass
            # await AuditService.log(
            #     db=db,
            #     user_id=verification.user_id,
            #     action=action,
            #     resource_type="id_verification",
            #     resource_id=verification.id,
            #     details={
            #         "event_type": event.type,
            #         "session_id": verification.stripe_verification_session_id,
            #         "status": verification.status.value
            #     }
            # )

    return {"received": True}


# ==================== Admin Endpoints ====================

@router.get("/admin/pending", response_model=List[AdminVerificationResponse])
async def admin_get_pending_verifications(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all pending verifications requiring admin review.

    Admin only endpoint.
    """
    verifications = db.query(IDVerification).filter(
        IDVerification.status.in_([
            IDVerificationStatus.REQUIRES_REVIEW,
            IDVerificationStatus.FAILED
        ])
    ).order_by(IDVerification.created_at.asc()).offset(skip).limit(limit).all()

    result = []
    for v in verifications:
        user = db.query(User).filter(User.id == v.user_id).first()
        result.append(AdminVerificationResponse(
            id=v.id,
            user_id=v.user_id,
            user_email=user.email if user else None,
            user_full_name=user.full_name if user else None,
            status=v.status.value,
            document_type=v.document_type,
            document_country=v.document_country,
            created_at=v.created_at,
            submitted_at=v.submitted_at,
            completed_at=v.completed_at,
            failure_reason=v.failure_reason,
            failure_code=v.failure_code,
            rejection_reason=v.rejection_reason,
            reviewed_by_admin_id=v.reviewed_by_admin_id,
            reviewed_at=v.reviewed_at,
            admin_notes=v.admin_notes
        ))

    return result


@router.get("/admin/all", response_model=List[AdminVerificationResponse])
async def admin_get_all_verifications(
    skip: int = 0,
    limit: int = 50,
    status_filter: Optional[str] = None,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all verifications with optional status filter.

    Admin only endpoint.
    """
    query = db.query(IDVerification)

    if status_filter:
        try:
            status_enum = IDVerificationStatus(status_filter)
            query = query.filter(IDVerification.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status filter: {status_filter}"
            )

    verifications = query.order_by(
        IDVerification.created_at.desc()
    ).offset(skip).limit(limit).all()

    result = []
    for v in verifications:
        user = db.query(User).filter(User.id == v.user_id).first()
        result.append(AdminVerificationResponse(
            id=v.id,
            user_id=v.user_id,
            user_email=user.email if user else None,
            user_full_name=user.full_name if user else None,
            status=v.status.value,
            document_type=v.document_type,
            document_country=v.document_country,
            created_at=v.created_at,
            submitted_at=v.submitted_at,
            completed_at=v.completed_at,
            failure_reason=v.failure_reason,
            failure_code=v.failure_code,
            rejection_reason=v.rejection_reason,
            reviewed_by_admin_id=v.reviewed_by_admin_id,
            reviewed_at=v.reviewed_at,
            admin_notes=v.admin_notes
        ))

    return result


@router.get("/admin/{verification_id}", response_model=AdminVerificationResponse)
async def admin_get_verification(
    verification_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed verification information.

    Admin only endpoint.
    """
    verification = db.query(IDVerification).filter(
        IDVerification.id == verification_id
    ).first()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification not found"
        )

    user = db.query(User).filter(User.id == verification.user_id).first()

    return AdminVerificationResponse(
        id=verification.id,
        user_id=verification.user_id,
        user_email=user.email if user else None,
        user_full_name=user.full_name if user else None,
        status=verification.status.value,
        document_type=verification.document_type,
        document_country=verification.document_country,
        created_at=verification.created_at,
        submitted_at=verification.submitted_at,
        completed_at=verification.completed_at,
        failure_reason=verification.failure_reason,
        failure_code=verification.failure_code,
        rejection_reason=verification.rejection_reason,
        reviewed_by_admin_id=verification.reviewed_by_admin_id,
        reviewed_at=verification.reviewed_at,
        admin_notes=verification.admin_notes
    )


@router.post("/admin/{verification_id}/review")
async def admin_review_verification(
    verification_id: int,
    data: AdminReviewRequest,
    request: Request,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Admin review a verification - approve or reject.

    Admin only endpoint.
    """
    verification = db.query(IDVerification).filter(
        IDVerification.id == verification_id
    ).first()

    if not verification:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Verification not found"
        )

    # Only allow review of certain statuses
    if verification.status not in [
        IDVerificationStatus.REQUIRES_REVIEW,
        IDVerificationStatus.FAILED,
        IDVerificationStatus.VERIFIED  # Allow override of auto-verified
    ]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot review verification in status: {verification.status.value}"
        )

    identity_service = get_stripe_identity_service()

    if data.action == "approve":
        updated = await identity_service.admin_approve_verification(
            db=db,
            verification=verification,
            admin_user=current_user,
            notes=data.notes
        )

        # Log approval
        # TODO: Re-enable when AuditService class is implemented
        # await AuditService.log(
        #     db=db,
        #     user_id=current_user.id,
        #     user_email=current_user.email,
        #     action=AuditAction.ID_VERIFICATION_ADMIN_APPROVED,
        #     resource_type="id_verification",
        #     resource_id=verification.id,
        #     details={
        #         "target_user_id": verification.user_id,
        #         "notes": data.notes
        #     },
        #     ip_address=request.client.host if request.client else None,
        #     user_agent=request.headers.get("user-agent")
        # )

        return {"message": "Verification approved", "status": updated.status.value}

    elif data.action == "reject":
        if not data.rejection_reason:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejection reason is required"
            )

        updated = await identity_service.admin_reject_verification(
            db=db,
            verification=verification,
            admin_user=current_user,
            rejection_reason=data.rejection_reason,
            notes=data.notes
        )

        # Log rejection
        # TODO: Re-enable when AuditService class is implemented
        # await AuditService.log(
        #     db=db,
        #     user_id=current_user.id,
        #     user_email=current_user.email,
        #     action=AuditAction.ID_VERIFICATION_ADMIN_REJECTED,
        #     resource_type="id_verification",
        #     resource_id=verification.id,
        #     details={
        #         "target_user_id": verification.user_id,
        #         "rejection_reason": data.rejection_reason,
        #         "notes": data.notes
        #     },
        #     ip_address=request.client.host if request.client else None,
        #     user_agent=request.headers.get("user-agent")
        # )

        return {"message": "Verification rejected", "status": updated.status.value}

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid action. Must be 'approve' or 'reject'"
        )


@router.get("/admin/user/{user_id}", response_model=List[AdminVerificationResponse])
async def admin_get_user_verifications(
    user_id: int,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get all verifications for a specific user.

    Admin only endpoint.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    verifications = db.query(IDVerification).filter(
        IDVerification.user_id == user_id
    ).order_by(IDVerification.created_at.desc()).all()

    return [
        AdminVerificationResponse(
            id=v.id,
            user_id=v.user_id,
            user_email=user.email,
            user_full_name=user.full_name,
            status=v.status.value,
            document_type=v.document_type,
            document_country=v.document_country,
            created_at=v.created_at,
            submitted_at=v.submitted_at,
            completed_at=v.completed_at,
            failure_reason=v.failure_reason,
            failure_code=v.failure_code,
            rejection_reason=v.rejection_reason,
            reviewed_by_admin_id=v.reviewed_by_admin_id,
            reviewed_at=v.reviewed_at,
            admin_notes=v.admin_notes
        )
        for v in verifications
    ]
