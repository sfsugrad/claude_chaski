"""
Stripe Identity service for ID verification.

Handles:
- Creating verification sessions
- Retrieving verification status
- Processing webhook events
"""
from typing import Optional, Dict, Any
from datetime import datetime, timedelta, timezone

import stripe
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.id_verification import IDVerification, IDVerificationStatus


class StripeIdentityService:
    """Service for Stripe Identity verification operations."""

    def __init__(self):
        stripe.api_key = settings.STRIPE_SECRET_KEY

    async def create_verification_session(
        self,
        db: Session,
        user: User,
        return_url: str
    ) -> Dict[str, Any]:
        """
        Create a Stripe Identity verification session.

        Args:
            db: Database session
            user: User to verify
            return_url: URL to redirect after verification

        Returns:
            Dict with session_id and url for redirecting user
        """
        # Check for existing pending/processing verification
        existing = db.query(IDVerification).filter(
            IDVerification.user_id == user.id,
            IDVerification.status.in_([
                IDVerificationStatus.PENDING,
                IDVerificationStatus.PROCESSING
            ])
        ).first()

        if existing:
            # Return existing session if still valid
            try:
                session = stripe.identity.VerificationSession.retrieve(
                    existing.stripe_verification_session_id
                )
                if session.status in ["requires_input", "processing"]:
                    return {
                        "session_id": existing.stripe_verification_session_id,
                        "url": session.url,
                        "verification_id": existing.id
                    }
            except stripe.error.StripeError:
                # Session expired or invalid, mark it and create new one
                existing.status = IDVerificationStatus.EXPIRED
                db.commit()

        # Create new verification session
        session = stripe.identity.VerificationSession.create(
            type="document",
            options={
                "document": {
                    "require_matching_selfie": True,
                    "allowed_types": ["driving_license", "passport", "id_card"]
                }
            },
            metadata={
                "user_id": str(user.id),
                "platform": "chaski"
            },
            return_url=return_url
        )

        # Create verification record
        verification = IDVerification(
            user_id=user.id,
            stripe_verification_session_id=session.id,
            status=IDVerificationStatus.PENDING,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        db.add(verification)
        db.commit()
        db.refresh(verification)

        return {
            "session_id": session.id,
            "url": session.url,
            "verification_id": verification.id
        }

    async def get_verification_session(
        self,
        session_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Retrieve verification session status from Stripe.

        Args:
            session_id: Stripe verification session ID

        Returns:
            Session data or None if not found
        """
        try:
            session = stripe.identity.VerificationSession.retrieve(
                session_id,
                expand=["verified_outputs"]
            )
            return {
                "id": session.id,
                "status": session.status,
                "type": session.type,
                "last_error": session.last_error,
                "verified_outputs": session.verified_outputs if hasattr(session, "verified_outputs") else None,
                "last_verification_report": session.last_verification_report
            }
        except stripe.error.StripeError:
            return None

    async def get_verification_report(
        self,
        report_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get detailed verification report from Stripe.

        Args:
            report_id: Stripe verification report ID

        Returns:
            Report data or None if not found
        """
        try:
            report = stripe.identity.VerificationReport.retrieve(report_id)
            return {
                "id": report.id,
                "type": report.type,
                "created": report.created,
                "document": report.document if hasattr(report, "document") else None,
                "selfie": report.selfie if hasattr(report, "selfie") else None
            }
        except stripe.error.StripeError:
            return None

    async def cancel_verification_session(
        self,
        db: Session,
        verification: IDVerification
    ) -> bool:
        """
        Cancel a pending verification session.

        Args:
            db: Database session
            verification: Verification record to cancel

        Returns:
            True if cancelled successfully
        """
        if verification.status not in [
            IDVerificationStatus.PENDING,
            IDVerificationStatus.PROCESSING
        ]:
            return False

        try:
            stripe.identity.VerificationSession.cancel(
                verification.stripe_verification_session_id
            )
        except stripe.error.StripeError:
            pass  # Session may already be cancelled

        verification.status = IDVerificationStatus.EXPIRED
        verification.completed_at = datetime.now(timezone.utc)
        db.commit()

        return True

    async def process_webhook_event(
        self,
        db: Session,
        event: stripe.Event
    ) -> Optional[IDVerification]:
        """
        Process Stripe Identity webhook event.

        Args:
            db: Database session
            event: Stripe webhook event

        Returns:
            Updated verification record or None
        """
        if event.type not in [
            "identity.verification_session.verified",
            "identity.verification_session.requires_input",
            "identity.verification_session.processing",
            "identity.verification_session.canceled"
        ]:
            return None

        session = event.data.object
        session_id = session.id

        # Find verification record
        verification = db.query(IDVerification).filter(
            IDVerification.stripe_verification_session_id == session_id
        ).first()

        if not verification:
            return None

        # Update based on event type
        if event.type == "identity.verification_session.verified":
            verification.status = IDVerificationStatus.VERIFIED
            verification.completed_at = datetime.now(timezone.utc)

            # Get report ID if available
            if session.last_verification_report:
                verification.stripe_verification_report_id = session.last_verification_report

            # Extract verified data (will be encrypted before storage)
            if hasattr(session, "verified_outputs") and session.verified_outputs:
                outputs = session.verified_outputs

                # Store document info
                if hasattr(outputs, "document") and outputs.document:
                    doc = outputs.document
                    verification.document_type = doc.type if hasattr(doc, "type") else None
                    verification.document_country = doc.issuing_country if hasattr(doc, "issuing_country") else None

                # Store verified name (encrypted)
                if hasattr(outputs, "first_name") and hasattr(outputs, "last_name"):
                    full_name = f"{outputs.first_name} {outputs.last_name}"
                    verification.verified_name_encrypted = self._encrypt_pii(full_name)

                # Store DOB (encrypted)
                if hasattr(outputs, "dob") and outputs.dob:
                    dob = outputs.dob
                    dob_str = f"{dob.year}-{dob.month:02d}-{dob.day:02d}"
                    verification.verified_dob_encrypted = self._encrypt_pii(dob_str)

            # Update user's id_verified status
            user = db.query(User).filter(User.id == verification.user_id).first()
            if user:
                user.id_verified = True

        elif event.type == "identity.verification_session.requires_input":
            # Session needs more input or failed checks
            if session.last_error:
                verification.failure_reason = session.last_error.reason if hasattr(session.last_error, "reason") else str(session.last_error)
                verification.failure_code = session.last_error.code if hasattr(session.last_error, "code") else None
                verification.status = IDVerificationStatus.REQUIRES_REVIEW
            else:
                verification.status = IDVerificationStatus.PENDING

        elif event.type == "identity.verification_session.processing":
            verification.status = IDVerificationStatus.PROCESSING
            verification.submitted_at = datetime.now(timezone.utc)

        elif event.type == "identity.verification_session.canceled":
            verification.status = IDVerificationStatus.EXPIRED
            verification.completed_at = datetime.now(timezone.utc)

        db.commit()
        db.refresh(verification)

        return verification

    def _encrypt_pii(self, value: str) -> str:
        """
        Encrypt PII data for storage.

        Args:
            value: Plain text value to encrypt

        Returns:
            Encrypted value or plain value if encryption not configured
        """
        if not settings.ENCRYPTION_KEY:
            return value

        try:
            from app.utils.encryption import encrypt_data
            return encrypt_data(value)
        except Exception:
            return value

    def _decrypt_pii(self, value: str) -> str:
        """
        Decrypt PII data from storage.

        Args:
            value: Encrypted value to decrypt

        Returns:
            Decrypted value or original value if decryption fails
        """
        if not settings.ENCRYPTION_KEY:
            return value

        try:
            from app.utils.encryption import decrypt_data
            return decrypt_data(value)
        except Exception:
            return value

    async def admin_approve_verification(
        self,
        db: Session,
        verification: IDVerification,
        admin_user: User,
        notes: Optional[str] = None
    ) -> IDVerification:
        """
        Admin manually approves a verification.

        Args:
            db: Database session
            verification: Verification to approve
            admin_user: Admin user performing approval
            notes: Optional admin notes

        Returns:
            Updated verification record
        """
        verification.status = IDVerificationStatus.ADMIN_APPROVED
        verification.reviewed_by_admin_id = admin_user.id
        verification.reviewed_at = datetime.now(timezone.utc)
        verification.admin_notes = notes
        verification.completed_at = datetime.now(timezone.utc)

        # Update user's id_verified status
        user = db.query(User).filter(User.id == verification.user_id).first()
        if user:
            user.id_verified = True

        db.commit()
        db.refresh(verification)

        return verification

    async def admin_reject_verification(
        self,
        db: Session,
        verification: IDVerification,
        admin_user: User,
        rejection_reason: str,
        notes: Optional[str] = None
    ) -> IDVerification:
        """
        Admin manually rejects a verification.

        Args:
            db: Database session
            verification: Verification to reject
            admin_user: Admin user performing rejection
            rejection_reason: Reason for rejection (shown to user)
            notes: Optional admin notes (internal)

        Returns:
            Updated verification record
        """
        verification.status = IDVerificationStatus.ADMIN_REJECTED
        verification.reviewed_by_admin_id = admin_user.id
        verification.reviewed_at = datetime.now(timezone.utc)
        verification.rejection_reason = rejection_reason
        verification.admin_notes = notes
        verification.completed_at = datetime.now(timezone.utc)

        # Ensure user's id_verified is False
        user = db.query(User).filter(User.id == verification.user_id).first()
        if user:
            user.id_verified = False

        db.commit()
        db.refresh(verification)

        return verification

    async def get_user_verification_status(
        self,
        db: Session,
        user: User
    ) -> Dict[str, Any]:
        """
        Get the current verification status for a user.

        Args:
            db: Database session
            user: User to check

        Returns:
            Dict with verification status information
        """
        # Get most recent verification
        verification = db.query(IDVerification).filter(
            IDVerification.user_id == user.id
        ).order_by(IDVerification.created_at.desc()).first()

        if not verification:
            return {
                "is_verified": False,
                "status": None,
                "can_start_verification": True,
                "verification": None
            }

        # Check if can start new verification
        can_start = verification.status in [
            IDVerificationStatus.FAILED,
            IDVerificationStatus.ADMIN_REJECTED,
            IDVerificationStatus.EXPIRED
        ]

        return {
            "is_verified": user.id_verified,
            "status": verification.status.value,
            "can_start_verification": can_start,
            "verification": {
                "id": verification.id,
                "status": verification.status.value,
                "created_at": verification.created_at.isoformat() if verification.created_at else None,
                "completed_at": verification.completed_at.isoformat() if verification.completed_at else None,
                "rejection_reason": verification.rejection_reason,
                "failure_reason": verification.failure_reason
            }
        }


# Singleton instance
_stripe_identity_service: Optional[StripeIdentityService] = None


def get_stripe_identity_service() -> StripeIdentityService:
    """Get singleton StripeIdentityService instance."""
    global _stripe_identity_service
    if _stripe_identity_service is None:
        _stripe_identity_service = StripeIdentityService()
    return _stripe_identity_service
