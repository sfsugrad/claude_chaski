"""
Tests for payout API endpoints.

Tests cover:
- Connect account management
- Balance & earnings
- Payout requests
- Payout history
"""

import pytest
from unittest.mock import patch, MagicMock
from datetime import datetime, timedelta
import stripe

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.payment import (
    Transaction, TransactionStatus,
    StripeConnectAccount,
    CourierPayout, PayoutStatus
)
from app.utils.auth import get_password_hash, create_access_token
from app.utils.tracking_id import generate_tracking_id


# ==================== Fixtures ====================

@pytest.fixture
def sender_user(db_session):
    """Create a sender user."""
    user = User(
        email="sender@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Sender",
        role=UserRole.SENDER,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def courier_user(db_session):
    """Create a courier user."""
    user = User(
        email="courier@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Courier",
        role=UserRole.COURIER,
        is_active=True,
        is_verified=True,
        max_deviation_km=15
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def both_role_user(db_session):
    """Create a user with both role."""
    user = User(
        email="both@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Both User",
        role=UserRole.BOTH,
        is_active=True,
        is_verified=True,
        max_deviation_km=10
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def connect_account(db_session, courier_user):
    """Create a Stripe Connect account for courier."""
    account = StripeConnectAccount(
        courier_id=courier_user.id,
        stripe_account_id="acct_test123",
        account_type="express",
        country="US",
        details_submitted=True,
        charges_enabled=True,
        payouts_enabled=True,
        onboarding_complete=True
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def incomplete_connect_account(db_session, courier_user):
    """Create an incomplete Connect account."""
    account = StripeConnectAccount(
        courier_id=courier_user.id,
        stripe_account_id="acct_incomplete123",
        account_type="express",
        country="US",
        details_submitted=False,
        charges_enabled=False,
        payouts_enabled=False,
        onboarding_complete=False
    )
    db_session.add(account)
    db_session.commit()
    db_session.refresh(account)
    return account


@pytest.fixture
def completed_transaction(db_session, sender_user, courier_user):
    """Create a completed transaction for payout."""
    transaction = Transaction(
        package_id=1,  # Simplified
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        stripe_payment_intent_id="pi_test123",
        stripe_charge_id="ch_test123",
        amount_cents=10000,
        platform_fee_cents=1500,
        courier_payout_cents=8500,
        currency="USD",
        status=TransactionStatus.SUCCEEDED.value,
        completed_at=datetime.utcnow()
    )
    db_session.add(transaction)
    db_session.commit()
    db_session.refresh(transaction)
    return transaction


@pytest.fixture
def courier_payout(db_session, courier_user, completed_transaction):
    """Create a courier payout."""
    payout = CourierPayout(
        courier_id=courier_user.id,
        stripe_transfer_id="tr_test123",
        amount_cents=8500,
        currency="USD",
        transaction_ids=[completed_transaction.id],
        status=PayoutStatus.SUCCEEDED.value,
        completed_at=datetime.utcnow()
    )
    db_session.add(payout)
    db_session.commit()

    # Update transaction with transfer ID
    completed_transaction.stripe_transfer_id = "tr_test123"
    db_session.commit()
    db_session.refresh(payout)

    return payout


def get_auth_header(user: User):
    """Generate auth header for a user."""
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_stripe():
    """Mock Stripe API calls."""
    with patch('app.services.stripe_service.stripe') as mock:
        # Mock Account
        mock.Account.create.return_value = MagicMock(
            id='acct_test123',
            type='express',
            details_submitted=False,
            charges_enabled=False,
            payouts_enabled=False
        )
        mock.Account.retrieve.return_value = MagicMock(
            id='acct_test123',
            details_submitted=True,
            charges_enabled=True,
            payouts_enabled=True
        )

        # Mock AccountLink
        mock.AccountLink.create.return_value = MagicMock(
            url='https://connect.stripe.com/setup/test123'
        )

        # Mock create_login_link
        mock.Account.create_login_link.return_value = MagicMock(
            url='https://connect.stripe.com/express/dashboard123'
        )

        # Mock Transfer
        mock.Transfer.create.return_value = MagicMock(
            id='tr_test123',
            amount=8500,
            destination='acct_test123'
        )

        # Mock Balance
        mock.Balance.retrieve.return_value = MagicMock(
            available=[MagicMock(amount=5000, currency='usd')]
        )

        yield mock


# ==================== Connect Account Management ====================

class TestConnectAccountManagement:
    """Test Stripe Connect account management."""

    def test_create_connect_account_as_courier(self, client, courier_user, mock_stripe):
        """Test creating Connect account as courier."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 200
        account = response.json()
        assert account["stripe_account_id"] == "acct_test123"
        assert account["onboarding_complete"] is False

        # Verify Stripe account was created
        mock_stripe.Account.create.assert_called_once()

    def test_create_connect_account_as_both_role(self, client, both_role_user, mock_stripe):
        """Test creating Connect account with both role."""
        headers = get_auth_header(both_role_user)

        response = client.post("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 200

    def test_create_connect_account_as_sender(self, client, sender_user):
        """Test creating Connect account as sender (should fail)."""
        headers = get_auth_header(sender_user)

        response = client.post("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 403
        assert "courier" in response.json()["detail"].lower()

    def test_create_connect_account_already_exists(self, client, courier_user, connect_account, mock_stripe):
        """Test creating account when it already exists."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 200
        # Should return existing account without creating new one
        assert response.json()["id"] == connect_account.id
        mock_stripe.Account.create.assert_not_called()

    def test_get_connect_account(self, client, courier_user, connect_account):
        """Test getting Connect account."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 200
        account = response.json()
        assert account["stripe_account_id"] == "acct_test123"
        assert account["onboarding_complete"] is True

    def test_get_connect_account_not_exists(self, client, courier_user):
        """Test getting non-existent Connect account."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 200
        assert response.json() is None

    def test_get_connect_account_non_courier(self, client, sender_user):
        """Test getting Connect account as non-courier."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payouts/connect-account", headers=headers)

        assert response.status_code == 403

    def test_refresh_connect_account(self, client, courier_user, incomplete_connect_account, db_session, mock_stripe):
        """Test refreshing Connect account status."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/connect-account/refresh", headers=headers)

        assert response.status_code == 200
        account = response.json()

        # Verify account was updated
        db_session.refresh(incomplete_connect_account)
        assert incomplete_connect_account.details_submitted is True
        assert incomplete_connect_account.onboarding_complete is True

    def test_refresh_connect_account_not_found(self, client, courier_user, mock_stripe):
        """Test refreshing non-existent account."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/connect-account/refresh", headers=headers)

        assert response.status_code == 404

    def test_get_onboarding_link(self, client, courier_user, mock_stripe):
        """Test getting onboarding link."""
        headers = get_auth_header(courier_user)
        data = {
            "return_url": "https://example.com/return",
            "refresh_url": "https://example.com/refresh"
        }

        response = client.post("/api/payouts/connect-onboarding", headers=headers, json=data)

        assert response.status_code == 200
        assert "url" in response.json()
        assert "connect.stripe.com" in response.json()["url"]

        # Verify Stripe AccountLink was created
        mock_stripe.AccountLink.create.assert_called_once()

    def test_get_onboarding_link_creates_account_if_needed(self, client, courier_user, mock_stripe):
        """Test onboarding link creates account if doesn't exist."""
        headers = get_auth_header(courier_user)
        data = {
            "return_url": "https://example.com/return",
            "refresh_url": "https://example.com/refresh"
        }

        response = client.post("/api/payouts/connect-onboarding", headers=headers, json=data)

        assert response.status_code == 200
        # Account should be created first
        mock_stripe.Account.create.assert_called_once()

    def test_get_dashboard_link(self, client, courier_user, connect_account, mock_stripe):
        """Test getting Express dashboard link."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/connect-dashboard", headers=headers)

        assert response.status_code == 200
        assert "url" in response.json()
        assert "dashboard" in response.json()["url"]

    def test_get_dashboard_link_before_onboarding(self, client, courier_user, incomplete_connect_account, mock_stripe):
        """Test getting dashboard link before onboarding complete."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/connect-dashboard", headers=headers)

        assert response.status_code == 400
        assert "onboarding" in response.json()["detail"].lower()


# ==================== Balance & Earnings ====================

class TestBalanceAndEarnings:
    """Test balance and earnings endpoints."""

    def test_get_balance(self, client, courier_user, completed_transaction, mock_stripe):
        """Test getting courier balance."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/balance", headers=headers)

        assert response.status_code == 200
        balance = response.json()
        assert "pending_cents" in balance
        assert "available_cents" in balance
        assert "pending_dollars" in balance
        assert "available_dollars" in balance
        assert balance["pending_cents"] == 8500  # From transaction

    def test_get_balance_non_courier(self, client, sender_user):
        """Test getting balance as non-courier."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payouts/balance", headers=headers)

        assert response.status_code == 403

    def test_get_balance_no_earnings(self, client, courier_user, mock_stripe):
        """Test balance with no earnings."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/balance", headers=headers)

        assert response.status_code == 200
        balance = response.json()
        assert balance["pending_cents"] == 0
        assert balance["pending_dollars"] == 0.0

    def test_get_earnings_summary(self, client, courier_user, completed_transaction):
        """Test getting earnings summary."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/earnings", headers=headers)

        assert response.status_code == 200
        earnings = response.json()
        assert earnings["total_earnings_cents"] == 8500
        assert earnings["total_deliveries"] == 1
        assert earnings["pending_payout_cents"] == 8500
        assert earnings["last_payout_at"] is None

    def test_get_earnings_summary_with_payout(self, client, courier_user, courier_payout, completed_transaction):
        """Test earnings summary with payout history."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/earnings", headers=headers)

        assert response.status_code == 200
        earnings = response.json()
        assert earnings["pending_payout_cents"] == 0  # Already paid out
        assert earnings["last_payout_at"] is not None

    def test_get_earnings_summary_multiple_transactions(self, client, courier_user, sender_user, db_session):
        """Test earnings with multiple transactions."""
        # Create multiple transactions
        for i in range(3):
            t = Transaction(
                package_id=i+1,
                sender_id=sender_user.id,
                courier_id=courier_user.id,
                amount_cents=10000,
                platform_fee_cents=1500,
                courier_payout_cents=8500,
                currency="USD",
                status=TransactionStatus.SUCCEEDED.value,
                completed_at=datetime.utcnow()
            )
            db_session.add(t)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.get("/api/payouts/earnings", headers=headers)

        assert response.status_code == 200
        earnings = response.json()
        assert earnings["total_earnings_cents"] == 25500  # 3 * 8500
        assert earnings["total_deliveries"] == 3

    def test_get_earnings_summary_non_courier(self, client, sender_user):
        """Test earnings as non-courier."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payouts/earnings", headers=headers)

        assert response.status_code == 403


# ==================== Payout Requests ====================

class TestPayoutRequests:
    """Test payout request functionality."""

    def test_request_payout_all_pending(self, client, courier_user, connect_account, completed_transaction, mock_stripe):
        """Test requesting payout of all pending transactions."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 200
        payout = response.json()
        assert payout["amount_cents"] == 8500
        assert payout["status"] == "succeeded"
        assert completed_transaction.id in payout["transaction_ids"]

        # Verify Stripe transfer was created
        mock_stripe.Transfer.create.assert_called_once()

    def test_request_payout_specific_transactions(self, client, courier_user, connect_account, completed_transaction, mock_stripe):
        """Test requesting payout with specific transaction IDs."""
        headers = get_auth_header(courier_user)
        data = {"transaction_ids": [completed_transaction.id]}

        response = client.post("/api/payouts/request", headers=headers, json=data)

        assert response.status_code == 200
        payout = response.json()
        assert payout["transaction_ids"] == [completed_transaction.id]

    def test_request_payout_without_connect_account(self, client, courier_user):
        """Test payout request without Connect account."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 400
        assert "setup" in response.json()["detail"].lower()

    def test_request_payout_incomplete_account(self, client, courier_user, incomplete_connect_account):
        """Test payout request with incomplete account."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 400
        assert "setup" in response.json()["detail"].lower()

    def test_request_payout_no_pending_earnings(self, client, courier_user, connect_account):
        """Test payout request with no pending earnings."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 400
        assert "no pending" in response.json()["detail"].lower()

    def test_request_payout_non_courier(self, client, sender_user):
        """Test payout request as non-courier."""
        headers = get_auth_header(sender_user)

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 403

    def test_request_payout_invalid_transaction_ids(self, client, courier_user, connect_account, mock_stripe):
        """Test payout with invalid transaction IDs."""
        headers = get_auth_header(courier_user)
        data = {"transaction_ids": [99999]}

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 400

    def test_request_payout_other_courier_transactions(self, client, courier_user, connect_account, sender_user, db_session):
        """Test payout with another courier's transactions."""
        # Create another courier
        other_courier = User(
            email="other_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Other Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        # Create transaction for other courier
        t = Transaction(
            package_id=99,
            sender_id=sender_user.id,
            courier_id=other_courier.id,
            amount_cents=10000,
            platform_fee_cents=1500,
            courier_payout_cents=8500,
            currency="USD",
            status=TransactionStatus.SUCCEEDED.value
        )
        db_session.add(t)
        db_session.commit()

        headers = get_auth_header(courier_user)
        data = {"transaction_ids": [t.id]}

        response = client.post("/api/payouts/request", headers=headers, json=data)

        assert response.status_code == 400

    def test_request_payout_updates_transaction(self, client, courier_user, connect_account, completed_transaction, db_session, mock_stripe):
        """Test payout updates transaction with transfer ID."""
        headers = get_auth_header(courier_user)

        response = client.post("/api/payouts/request", headers=headers, json={})

        assert response.status_code == 200

        # Verify transaction was updated
        db_session.refresh(completed_transaction)
        assert completed_transaction.stripe_transfer_id == "tr_test123"

    def test_request_payout_stripe_error(self, client, courier_user, connect_account, completed_transaction):
        """Test payout with Stripe error."""
        with patch('app.services.stripe_service.stripe') as mock:
            mock.Transfer.create.side_effect = stripe.error.StripeError("Transfer failed")

            headers = get_auth_header(courier_user)
            response = client.post("/api/payouts/request", headers=headers, json={})

            assert response.status_code == 400
            assert "failed" in response.json()["detail"].lower()


# ==================== Payout History ====================

class TestPayoutHistory:
    """Test payout history endpoints."""

    def test_get_payout_history(self, client, courier_user, courier_payout):
        """Test getting payout history."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/history", headers=headers)

        assert response.status_code == 200
        payouts = response.json()
        assert len(payouts) == 1
        assert payouts[0]["id"] == courier_payout.id
        assert payouts[0]["amount_cents"] == 8500

    def test_get_payout_history_empty(self, client, courier_user):
        """Test payout history with no payouts."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/history", headers=headers)

        assert response.status_code == 200
        assert response.json() == []

    def test_get_payout_history_pagination(self, client, courier_user, sender_user, db_session):
        """Test payout history pagination."""
        # Create 25 payouts
        for i in range(25):
            payout = CourierPayout(
                courier_id=courier_user.id,
                stripe_transfer_id=f"tr_test{i}",
                amount_cents=1000 + i,
                currency="USD",
                transaction_ids=[],
                status=PayoutStatus.SUCCEEDED.value,
                completed_at=datetime.utcnow()
            )
            db_session.add(payout)
        db_session.commit()

        headers = get_auth_header(courier_user)

        # First page
        response = client.get("/api/payouts/history", headers=headers)
        assert len(response.json()) == 20

        # Second page
        response = client.get("/api/payouts/history?skip=20&limit=10", headers=headers)
        assert len(response.json()) == 5

    def test_get_payout_history_non_courier(self, client, sender_user):
        """Test payout history as non-courier."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payouts/history", headers=headers)

        assert response.status_code == 403

    def test_get_specific_payout(self, client, courier_user, courier_payout):
        """Test getting specific payout details."""
        headers = get_auth_header(courier_user)

        response = client.get(f"/api/payouts/history/{courier_payout.id}", headers=headers)

        assert response.status_code == 200
        payout = response.json()
        assert payout["id"] == courier_payout.id
        assert payout["amount_cents"] == 8500

    def test_get_specific_payout_not_found(self, client, courier_user):
        """Test getting non-existent payout."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payouts/history/99999", headers=headers)

        assert response.status_code == 404

    def test_get_specific_payout_other_courier(self, client, courier_user, db_session):
        """Test getting another courier's payout."""
        # Create another courier
        other_courier = User(
            email="other@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Other Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        # Create payout for other courier
        payout = CourierPayout(
            courier_id=other_courier.id,
            stripe_transfer_id="tr_other",
            amount_cents=5000,
            currency="USD",
            transaction_ids=[],
            status=PayoutStatus.SUCCEEDED.value
        )
        db_session.add(payout)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.get(f"/api/payouts/history/{payout.id}", headers=headers)

        assert response.status_code == 404  # Should not reveal existence
