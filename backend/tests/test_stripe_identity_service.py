"""
Tests for stripe_identity_service.py - Stripe Identity verification service.

Tests the StripeIdentityService class for ID verification operations.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone, timedelta

from app.models.user import User, UserRole
from app.models.id_verification import IDVerification, IDVerificationStatus
from app.services.stripe_identity_service import StripeIdentityService, get_stripe_identity_service
from app.utils.auth import get_password_hash


# ==================== Fixtures ====================

@pytest.fixture
def identity_service():
    """Create a StripeIdentityService instance."""
    return StripeIdentityService()


@pytest.fixture
def courier_user(db_session):
    """Create a courier user for testing."""
    user = User(
        email="courier_service@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Service Courier",
        role=UserRole.COURIER,
        is_active=True,
        is_verified=True,
        id_verified=False,
        max_deviation_km=10
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def admin_user(db_session):
    """Create an admin user for testing."""
    user = User(
        email="admin_service@test.com",
        hashed_password=get_password_hash("admin123"),
        full_name="Service Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def pending_verification(db_session, courier_user):
    """Create a pending verification."""
    verification = IDVerification(
        user_id=courier_user.id,
        stripe_verification_session_id="vs_pending_service_123",
        status=IDVerificationStatus.PENDING,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(verification)
    db_session.commit()
    db_session.refresh(verification)
    return verification


@pytest.fixture
def processing_verification(db_session, courier_user):
    """Create a processing verification."""
    verification = IDVerification(
        user_id=courier_user.id,
        stripe_verification_session_id="vs_processing_service_123",
        status=IDVerificationStatus.PROCESSING,
        submitted_at=datetime.now(timezone.utc),
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(verification)
    db_session.commit()
    db_session.refresh(verification)
    return verification


@pytest.fixture
def requires_review_verification(db_session, courier_user):
    """Create a verification requiring review."""
    verification = IDVerification(
        user_id=courier_user.id,
        stripe_verification_session_id="vs_review_service_123",
        status=IDVerificationStatus.REQUIRES_REVIEW,
        failure_reason="Document unclear",
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(verification)
    db_session.commit()
    db_session.refresh(verification)
    return verification


# ==================== create_verification_session Tests ====================

class TestCreateVerificationSession:
    """Tests for create_verification_session method."""

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    async def test_create_new_session(self, mock_stripe_session, identity_service, db_session, courier_user):
        """Should create a new Stripe verification session."""
        mock_session = MagicMock()
        mock_session.id = "vs_new_test_123"
        mock_session.url = "https://verify.stripe.com/start/vs_new_test_123"
        mock_stripe_session.create.return_value = mock_session

        result = await identity_service.create_verification_session(
            db=db_session,
            user=courier_user,
            return_url="https://example.com/callback"
        )

        assert result["session_id"] == "vs_new_test_123"
        assert "url" in result
        assert "verification_id" in result

        # Verify session was created with correct parameters
        mock_stripe_session.create.assert_called_once()
        call_kwargs = mock_stripe_session.create.call_args.kwargs
        assert call_kwargs["type"] == "document"
        assert call_kwargs["return_url"] == "https://example.com/callback"
        assert call_kwargs["metadata"]["user_id"] == str(courier_user.id)

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    async def test_reuse_existing_pending_session(
        self, mock_stripe_session, identity_service, db_session, pending_verification, courier_user
    ):
        """Should return existing session if still valid."""
        # Mock retrieve to return valid session
        mock_session = MagicMock()
        mock_session.status = "requires_input"
        mock_session.url = "https://verify.stripe.com/continue"
        mock_stripe_session.retrieve.return_value = mock_session

        result = await identity_service.create_verification_session(
            db=db_session,
            user=courier_user,
            return_url="https://example.com/callback"
        )

        # Should return existing session, not create new one
        assert result["session_id"] == pending_verification.stripe_verification_session_id
        mock_stripe_session.create.assert_not_called()

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    @patch('app.services.stripe_identity_service.stripe.error.StripeError', Exception)
    async def test_create_new_when_existing_expired(
        self, mock_stripe_session, identity_service, db_session, pending_verification, courier_user
    ):
        """Should create new session if existing one is expired."""
        # Mock retrieve to fail (session expired)
        mock_stripe_session.retrieve.side_effect = Exception("Session expired")

        # Mock create for new session
        mock_new_session = MagicMock()
        mock_new_session.id = "vs_new_after_expired_123"
        mock_new_session.url = "https://verify.stripe.com/new"
        mock_stripe_session.create.return_value = mock_new_session

        result = await identity_service.create_verification_session(
            db=db_session,
            user=courier_user,
            return_url="https://example.com/callback"
        )

        # Should have created a new session
        assert result["session_id"] == "vs_new_after_expired_123"


# ==================== get_verification_session Tests ====================

class TestGetVerificationSession:
    """Tests for get_verification_session method."""

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    async def test_get_session_success(self, mock_stripe_session, identity_service):
        """Should retrieve session successfully."""
        mock_session = MagicMock()
        mock_session.id = "vs_test_123"
        mock_session.status = "verified"
        mock_session.type = "document"
        mock_session.last_error = None
        mock_session.last_verification_report = "vr_test_123"
        mock_stripe_session.retrieve.return_value = mock_session

        result = await identity_service.get_verification_session("vs_test_123")

        assert result is not None
        assert result["id"] == "vs_test_123"
        assert result["status"] == "verified"

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    @patch('app.services.stripe_identity_service.stripe.error.StripeError', Exception)
    async def test_get_session_not_found(self, mock_stripe_session, identity_service):
        """Should return None for non-existent session."""
        mock_stripe_session.retrieve.side_effect = Exception("Session not found")

        result = await identity_service.get_verification_session("vs_nonexistent")

        assert result is None


# ==================== cancel_verification_session Tests ====================

class TestCancelVerificationSession:
    """Tests for cancel_verification_session method."""

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    async def test_cancel_pending_session(
        self, mock_stripe_session, identity_service, db_session, pending_verification
    ):
        """Should cancel pending verification."""
        result = await identity_service.cancel_verification_session(
            db=db_session,
            verification=pending_verification
        )

        assert result is True
        mock_stripe_session.cancel.assert_called_once()
        assert pending_verification.status == IDVerificationStatus.EXPIRED

    @pytest.mark.asyncio
    @patch('app.services.stripe_identity_service.stripe.identity.VerificationSession')
    async def test_cancel_processing_session(
        self, mock_stripe_session, identity_service, db_session, processing_verification
    ):
        """Should cancel processing verification."""
        result = await identity_service.cancel_verification_session(
            db=db_session,
            verification=processing_verification
        )

        assert result is True

    @pytest.mark.asyncio
    async def test_cancel_wrong_status(
        self, identity_service, db_session, requires_review_verification
    ):
        """Should not cancel verification in wrong status."""
        result = await identity_service.cancel_verification_session(
            db=db_session,
            verification=requires_review_verification
        )

        assert result is False
        # Status should remain unchanged
        assert requires_review_verification.status == IDVerificationStatus.REQUIRES_REVIEW


# ==================== process_webhook_event Tests ====================

class TestProcessWebhookEvent:
    """Tests for process_webhook_event method."""

    @pytest.mark.asyncio
    async def test_process_verified_event(
        self, identity_service, db_session, processing_verification, courier_user
    ):
        """Should update verification to verified on success."""
        mock_event = MagicMock()
        mock_event.type = "identity.verification_session.verified"
        mock_event.data.object.id = processing_verification.stripe_verification_session_id
        mock_event.data.object.last_verification_report = "vr_test"
        mock_event.data.object.verified_outputs = None

        result = await identity_service.process_webhook_event(db_session, mock_event)

        assert result is not None
        assert result.status == IDVerificationStatus.VERIFIED
        assert result.completed_at is not None

        # Check user was marked as verified
        db_session.refresh(courier_user)
        assert courier_user.id_verified is True

    @pytest.mark.asyncio
    async def test_process_processing_event(
        self, identity_service, db_session, pending_verification
    ):
        """Should update verification to processing."""
        mock_event = MagicMock()
        mock_event.type = "identity.verification_session.processing"
        mock_event.data.object.id = pending_verification.stripe_verification_session_id

        result = await identity_service.process_webhook_event(db_session, mock_event)

        assert result is not None
        assert result.status == IDVerificationStatus.PROCESSING
        assert result.submitted_at is not None

    @pytest.mark.asyncio
    async def test_process_requires_input_event(
        self, identity_service, db_session, processing_verification
    ):
        """Should update verification to requires review on failure."""
        mock_event = MagicMock()
        mock_event.type = "identity.verification_session.requires_input"
        mock_event.data.object.id = processing_verification.stripe_verification_session_id
        mock_event.data.object.last_error = MagicMock()
        mock_event.data.object.last_error.reason = "Document expired"
        mock_event.data.object.last_error.code = "document_expired"

        result = await identity_service.process_webhook_event(db_session, mock_event)

        assert result is not None
        assert result.status == IDVerificationStatus.REQUIRES_REVIEW
        assert result.failure_reason == "Document expired"

    @pytest.mark.asyncio
    async def test_process_canceled_event(
        self, identity_service, db_session, pending_verification
    ):
        """Should update verification to expired on cancellation."""
        mock_event = MagicMock()
        mock_event.type = "identity.verification_session.canceled"
        mock_event.data.object.id = pending_verification.stripe_verification_session_id

        result = await identity_service.process_webhook_event(db_session, mock_event)

        assert result is not None
        assert result.status == IDVerificationStatus.EXPIRED

    @pytest.mark.asyncio
    async def test_process_unknown_event_type(self, identity_service, db_session):
        """Should ignore unknown event types."""
        mock_event = MagicMock()
        mock_event.type = "identity.unknown_event"

        result = await identity_service.process_webhook_event(db_session, mock_event)

        assert result is None

    @pytest.mark.asyncio
    async def test_process_event_verification_not_found(self, identity_service, db_session):
        """Should return None if verification not found."""
        mock_event = MagicMock()
        mock_event.type = "identity.verification_session.verified"
        mock_event.data.object.id = "vs_nonexistent_123"

        result = await identity_service.process_webhook_event(db_session, mock_event)

        assert result is None


# ==================== admin_approve_verification Tests ====================

class TestAdminApproveVerification:
    """Tests for admin_approve_verification method."""

    @pytest.mark.asyncio
    async def test_approve_verification(
        self, identity_service, db_session, requires_review_verification, admin_user, courier_user
    ):
        """Should approve verification and set user as verified."""
        result = await identity_service.admin_approve_verification(
            db=db_session,
            verification=requires_review_verification,
            admin_user=admin_user,
            notes="Approved after manual review"
        )

        assert result.status == IDVerificationStatus.ADMIN_APPROVED
        assert result.reviewed_by_admin_id == admin_user.id
        assert result.reviewed_at is not None
        assert result.admin_notes == "Approved after manual review"

        # Check user was marked as verified
        db_session.refresh(courier_user)
        assert courier_user.id_verified is True


# ==================== admin_reject_verification Tests ====================

class TestAdminRejectVerification:
    """Tests for admin_reject_verification method."""

    @pytest.mark.asyncio
    async def test_reject_verification(
        self, identity_service, db_session, requires_review_verification, admin_user, courier_user
    ):
        """Should reject verification and ensure user is not verified."""
        result = await identity_service.admin_reject_verification(
            db=db_session,
            verification=requires_review_verification,
            admin_user=admin_user,
            rejection_reason="Document appears fraudulent",
            notes="Internal note"
        )

        assert result.status == IDVerificationStatus.ADMIN_REJECTED
        assert result.reviewed_by_admin_id == admin_user.id
        assert result.rejection_reason == "Document appears fraudulent"
        assert result.admin_notes == "Internal note"

        # Check user was marked as not verified
        db_session.refresh(courier_user)
        assert courier_user.id_verified is False


# ==================== get_user_verification_status Tests ====================

class TestGetUserVerificationStatus:
    """Tests for get_user_verification_status method."""

    @pytest.mark.asyncio
    async def test_no_verification(self, identity_service, db_session, courier_user):
        """Should return can_start_verification=True when no verification exists."""
        result = await identity_service.get_user_verification_status(db_session, courier_user)

        assert result["is_verified"] is False
        assert result["status"] is None
        assert result["can_start_verification"] is True
        assert result["verification"] is None

    @pytest.mark.asyncio
    async def test_verified_user(self, identity_service, db_session, courier_user):
        """Should return verified status."""
        courier_user.id_verified = True

        # Create verified verification record
        verification = IDVerification(
            user_id=courier_user.id,
            stripe_verification_session_id="vs_verified_status_123",
            status=IDVerificationStatus.VERIFIED,
            completed_at=datetime.now(timezone.utc)
        )
        db_session.add(verification)
        db_session.commit()

        result = await identity_service.get_user_verification_status(db_session, courier_user)

        assert result["is_verified"] is True
        assert result["status"] == "verified"
        assert result["can_start_verification"] is False

    @pytest.mark.asyncio
    async def test_failed_verification_can_retry(
        self, identity_service, db_session, courier_user
    ):
        """Should allow retry after failed verification."""
        verification = IDVerification(
            user_id=courier_user.id,
            stripe_verification_session_id="vs_failed_status_123",
            status=IDVerificationStatus.FAILED
        )
        db_session.add(verification)
        db_session.commit()

        result = await identity_service.get_user_verification_status(db_session, courier_user)

        assert result["is_verified"] is False
        assert result["can_start_verification"] is True


# ==================== Singleton Tests ====================

class TestGetStripeIdentityService:
    """Tests for get_stripe_identity_service singleton."""

    def test_returns_same_instance(self):
        """Should return the same instance on multiple calls."""
        service1 = get_stripe_identity_service()
        service2 = get_stripe_identity_service()

        assert service1 is service2

    def test_returns_stripe_identity_service(self):
        """Should return StripeIdentityService instance."""
        service = get_stripe_identity_service()

        assert isinstance(service, StripeIdentityService)
