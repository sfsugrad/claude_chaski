"""
Tests for id_verification.py routes - Stripe Identity verification endpoints.

Tests the ID verification workflow for couriers including:
- Courier endpoints (status, start, history, cancel)
- Webhook handling
- Admin endpoints (pending, all, review)
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
from datetime import datetime, timezone

from app.models.user import User, UserRole
from app.models.id_verification import IDVerification, IDVerificationStatus
from app.utils.auth import get_password_hash, create_access_token


# ==================== Fixtures ====================

@pytest.fixture
def courier_user(db_session):
    """Create a courier user for testing."""
    user = User(
        email="courier@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Courier",
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
def courier_token(courier_user):
    """Create auth token for courier user."""
    return create_access_token(data={"sub": courier_user.email})


@pytest.fixture
def verified_courier_user(db_session):
    """Create a courier user who is already ID verified."""
    user = User(
        email="verified_courier@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Verified Courier",
        role=UserRole.COURIER,
        is_active=True,
        is_verified=True,
        id_verified=True,
        max_deviation_km=10
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def verified_courier_token(verified_courier_user):
    """Create auth token for verified courier."""
    return create_access_token(data={"sub": verified_courier_user.email})


@pytest.fixture
def both_role_user(db_session):
    """Create a user with 'both' role."""
    user = User(
        email="both@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Both User",
        role=UserRole.BOTH,
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
def both_role_token(both_role_user):
    """Create auth token for both role user."""
    return create_access_token(data={"sub": both_role_user.email})


@pytest.fixture
def pending_verification(db_session, courier_user):
    """Create a pending verification for the courier."""
    verification = IDVerification(
        user_id=courier_user.id,
        stripe_verification_session_id="vs_test_pending_123",
        status=IDVerificationStatus.PENDING,
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(verification)
    db_session.commit()
    db_session.refresh(verification)
    return verification


@pytest.fixture
def failed_verification(db_session, courier_user):
    """Create a failed verification for the courier."""
    verification = IDVerification(
        user_id=courier_user.id,
        stripe_verification_session_id="vs_test_failed_123",
        status=IDVerificationStatus.FAILED,
        failure_reason="Document expired",
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(verification)
    db_session.commit()
    db_session.refresh(verification)
    return verification


@pytest.fixture
def requires_review_verification(db_session, courier_user):
    """Create a verification requiring admin review."""
    verification = IDVerification(
        user_id=courier_user.id,
        stripe_verification_session_id="vs_test_review_123",
        status=IDVerificationStatus.REQUIRES_REVIEW,
        failure_reason="Could not verify document",
        created_at=datetime.now(timezone.utc)
    )
    db_session.add(verification)
    db_session.commit()
    db_session.refresh(verification)
    return verification


# ==================== Courier Endpoint Tests ====================

class TestGetVerificationStatus:
    """Tests for GET /api/id-verification/status."""

    def test_get_status_no_verification(self, client, courier_token):
        """Should return unverified status when no verification exists."""
        response = client.get(
            "/api/id-verification/status",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_verified"] is False
        assert data["can_start_verification"] is True
        assert data["verification"] is None

    @patch('app.routes.id_verification.get_stripe_identity_service')
    def test_get_status_with_pending_verification(
        self, mock_service, client, courier_token, pending_verification
    ):
        """Should return pending status when verification is in progress."""
        mock_identity = MagicMock()
        mock_identity.get_user_verification_status = AsyncMock(return_value={
            "is_verified": False,
            "status": "pending",
            "can_start_verification": False,
            "verification": {
                "id": pending_verification.id,
                "status": "pending"
            }
        })
        mock_service.return_value = mock_identity

        response = client.get(
            "/api/id-verification/status",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["is_verified"] is False
        assert data["can_start_verification"] is False

    def test_get_status_sender_forbidden(self, client, authenticated_sender):
        """Senders should not be able to access ID verification."""
        response = client.get(
            "/api/id-verification/status",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == 403
        assert "Courier role required" in response.json()["detail"]

    def test_get_status_unauthorized(self, client):
        """Should return 401 without auth."""
        response = client.get("/api/id-verification/status")
        assert response.status_code == 401

    def test_get_status_both_role_allowed(self, client, both_role_token):
        """Users with 'both' role should be able to access ID verification."""
        response = client.get(
            "/api/id-verification/status",
            headers={"Authorization": f"Bearer {both_role_token}"}
        )
        assert response.status_code == 200


class TestStartVerification:
    """Tests for POST /api/id-verification/start."""

    @patch('app.routes.id_verification.get_stripe_identity_service')
    def test_start_verification_success(self, mock_service, client, courier_token, courier_user):
        """Should successfully start a new verification session."""
        mock_identity = MagicMock()
        mock_identity.create_verification_session = AsyncMock(return_value={
            "session_id": "vs_test_new_123",
            "url": "https://verify.stripe.com/start/vs_test_new_123",
            "verification_id": 1
        })
        mock_service.return_value = mock_identity

        response = client.post(
            "/api/id-verification/start",
            json={"return_url": "https://example.com/callback"},
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "url" in data
        assert "verification_id" in data

    def test_start_verification_already_verified(self, client, verified_courier_token):
        """Should reject if user is already verified."""
        response = client.post(
            "/api/id-verification/start",
            json={"return_url": "https://example.com/callback"},
            headers={"Authorization": f"Bearer {verified_courier_token}"}
        )
        assert response.status_code == 400
        assert "already been verified" in response.json()["detail"]

    def test_start_verification_sender_forbidden(self, client, authenticated_sender):
        """Senders should not be able to start verification."""
        response = client.post(
            "/api/id-verification/start",
            json={"return_url": "https://example.com/callback"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == 403


class TestGetVerificationHistory:
    """Tests for GET /api/id-verification/history."""

    def test_get_history_empty(self, client, courier_token):
        """Should return empty list when no verifications exist."""
        response = client.get(
            "/api/id-verification/history",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 200
        assert response.json() == []

    def test_get_history_with_verifications(
        self, client, courier_token, pending_verification, db_session, courier_user
    ):
        """Should return list of verifications."""
        # Add another verification
        failed = IDVerification(
            user_id=courier_user.id,
            stripe_verification_session_id="vs_old_123",
            status=IDVerificationStatus.FAILED,
            created_at=datetime.now(timezone.utc)
        )
        db_session.add(failed)
        db_session.commit()

        response = client.get(
            "/api/id-verification/history",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2


class TestCancelVerification:
    """Tests for POST /api/id-verification/cancel."""

    @patch('app.routes.id_verification.get_stripe_identity_service')
    def test_cancel_pending_verification(
        self, mock_service, client, courier_token, pending_verification
    ):
        """Should successfully cancel a pending verification."""
        mock_identity = MagicMock()
        mock_identity.cancel_verification_session = AsyncMock(return_value=True)
        mock_service.return_value = mock_identity

        response = client.post(
            "/api/id-verification/cancel",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 200
        assert "cancelled" in response.json()["message"].lower()

    def test_cancel_no_pending_verification(self, client, courier_token):
        """Should return 404 when no pending verification exists."""
        response = client.post(
            "/api/id-verification/cancel",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 404


# ==================== Webhook Tests ====================

class TestWebhook:
    """Tests for POST /api/id-verification/webhook."""

    @patch('app.routes.id_verification.stripe.Webhook.construct_event')
    @patch('app.routes.id_verification.get_stripe_identity_service')
    @patch('app.routes.id_verification.settings')
    def test_webhook_verified_event(
        self, mock_settings, mock_service, mock_construct, client, db_session, courier_user
    ):
        """Should process verified webhook event."""
        mock_settings.STRIPE_IDENTITY_WEBHOOK_SECRET = "whsec_test"

        # Create verification
        verification = IDVerification(
            user_id=courier_user.id,
            stripe_verification_session_id="vs_webhook_test",
            status=IDVerificationStatus.PROCESSING
        )
        db_session.add(verification)
        db_session.commit()

        mock_event = MagicMock()
        mock_event.type = "identity.verification_session.verified"
        mock_event.data.object.id = "vs_webhook_test"
        mock_construct.return_value = mock_event

        mock_identity = MagicMock()
        mock_identity.process_webhook_event = AsyncMock(return_value=verification)
        mock_service.return_value = mock_identity

        response = client.post(
            "/api/id-verification/webhook",
            content=b'{}',
            headers={"stripe-signature": "test_sig"}
        )
        assert response.status_code == 200
        assert response.json()["received"] is True

    def test_webhook_missing_signature(self, client):
        """Should reject webhook without signature."""
        response = client.post(
            "/api/id-verification/webhook",
            content=b'{}'
        )
        assert response.status_code == 400
        assert "Missing Stripe signature" in response.json()["detail"]

    @patch('app.routes.id_verification.settings')
    def test_webhook_secret_not_configured(self, mock_settings, client):
        """Should return 500 when webhook secret is not configured."""
        mock_settings.STRIPE_IDENTITY_WEBHOOK_SECRET = None

        response = client.post(
            "/api/id-verification/webhook",
            content=b'{}',
            headers={"stripe-signature": "test_sig"}
        )
        assert response.status_code == 500


# ==================== Admin Endpoint Tests ====================

class TestAdminGetPendingVerifications:
    """Tests for GET /api/id-verification/admin/pending."""

    def test_get_pending_as_admin(
        self, client, authenticated_admin, requires_review_verification
    ):
        """Admin should see pending verifications."""
        response = client.get(
            "/api/id-verification/admin/pending",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_pending_non_admin_forbidden(self, client, courier_token):
        """Non-admin should not access admin endpoints."""
        response = client.get(
            "/api/id-verification/admin/pending",
            headers={"Authorization": f"Bearer {courier_token}"}
        )
        assert response.status_code == 403

    def test_get_pending_pagination(
        self, client, authenticated_admin, db_session
    ):
        """Should support pagination."""
        # Create admin user for this test
        admin = User(
            email="admin_pag@test.com",
            hashed_password=get_password_hash("admin123"),
            full_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True
        )
        db_session.add(admin)
        db_session.commit()

        response = client.get(
            "/api/id-verification/admin/pending?skip=0&limit=10",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200


class TestAdminGetAllVerifications:
    """Tests for GET /api/id-verification/admin/all."""

    def test_get_all_as_admin(self, client, authenticated_admin, pending_verification):
        """Admin should see all verifications."""
        response = client.get(
            "/api/id-verification/admin/all",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200
        assert isinstance(response.json(), list)

    def test_get_all_with_status_filter(
        self, client, authenticated_admin, failed_verification
    ):
        """Should filter by status."""
        response = client.get(
            "/api/id-verification/admin/all?status_filter=failed",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200

    def test_get_all_invalid_status_filter(self, client, authenticated_admin):
        """Should reject invalid status filter."""
        response = client.get(
            "/api/id-verification/admin/all?status_filter=invalid_status",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 400


class TestAdminGetVerification:
    """Tests for GET /api/id-verification/admin/{verification_id}."""

    def test_get_verification_found(
        self, client, authenticated_admin, pending_verification
    ):
        """Should return verification details."""
        response = client.get(
            f"/api/id-verification/admin/{pending_verification.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == pending_verification.id

    def test_get_verification_not_found(self, client, authenticated_admin):
        """Should return 404 for non-existent verification."""
        response = client.get(
            "/api/id-verification/admin/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 404


class TestAdminReviewVerification:
    """Tests for POST /api/id-verification/admin/{verification_id}/review."""

    @patch('app.routes.id_verification.get_stripe_identity_service')
    def test_approve_verification(
        self, mock_service, client, authenticated_admin, requires_review_verification, db_session
    ):
        """Admin should be able to approve verification."""
        mock_identity = MagicMock()
        requires_review_verification.status = IDVerificationStatus.ADMIN_APPROVED
        mock_identity.admin_approve_verification = AsyncMock(
            return_value=requires_review_verification
        )
        mock_service.return_value = mock_identity

        response = client.post(
            f"/api/id-verification/admin/{requires_review_verification.id}/review",
            json={"action": "approve", "notes": "Approved after manual review"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200
        assert "approved" in response.json()["message"].lower()

    @patch('app.routes.id_verification.get_stripe_identity_service')
    def test_reject_verification(
        self, mock_service, client, authenticated_admin, requires_review_verification, db_session
    ):
        """Admin should be able to reject verification."""
        mock_identity = MagicMock()
        requires_review_verification.status = IDVerificationStatus.ADMIN_REJECTED
        mock_identity.admin_reject_verification = AsyncMock(
            return_value=requires_review_verification
        )
        mock_service.return_value = mock_identity

        response = client.post(
            f"/api/id-verification/admin/{requires_review_verification.id}/review",
            json={
                "action": "reject",
                "rejection_reason": "Document appears fraudulent",
                "notes": "Internal note"
            },
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200
        assert "rejected" in response.json()["message"].lower()

    def test_reject_without_reason(
        self, client, authenticated_admin, requires_review_verification
    ):
        """Should require rejection reason."""
        response = client.post(
            f"/api/id-verification/admin/{requires_review_verification.id}/review",
            json={"action": "reject"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 400
        assert "reason is required" in response.json()["detail"].lower()

    def test_invalid_action(
        self, client, authenticated_admin, requires_review_verification
    ):
        """Should reject invalid action."""
        response = client.post(
            f"/api/id-verification/admin/{requires_review_verification.id}/review",
            json={"action": "invalid_action"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 400
        assert "Invalid action" in response.json()["detail"]

    def test_review_wrong_status(
        self, client, authenticated_admin, db_session, courier_user
    ):
        """Should reject review of verification in wrong status."""
        # Create a PENDING verification (not reviewable)
        verification = IDVerification(
            user_id=courier_user.id,
            stripe_verification_session_id="vs_pending_review_test",
            status=IDVerificationStatus.PENDING
        )
        db_session.add(verification)
        db_session.commit()

        response = client.post(
            f"/api/id-verification/admin/{verification.id}/review",
            json={"action": "approve"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 400
        assert "Cannot review" in response.json()["detail"]


class TestAdminGetUserVerifications:
    """Tests for GET /api/id-verification/admin/user/{user_id}."""

    def test_get_user_verifications(
        self, client, authenticated_admin, courier_user, pending_verification
    ):
        """Should return all verifications for a specific user."""
        response = client.get(
            f"/api/id-verification/admin/user/{courier_user.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1

    def test_get_user_verifications_user_not_found(self, client, authenticated_admin):
        """Should return 404 for non-existent user."""
        response = client.get(
            "/api/id-verification/admin/user/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == 404
