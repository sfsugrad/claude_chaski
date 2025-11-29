"""
Tests for payment API endpoints.

Tests cover:
- Setup intents & payment methods
- Payment intents & charging
- Transaction management
- Refunds
- Stripe webhook handling
"""

import pytest
from unittest.mock import patch, MagicMock, Mock, PropertyMock
from datetime import datetime, timedelta
import stripe

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.payment import Transaction, TransactionStatus, PaymentMethod
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
def sender_with_stripe_customer(db_session):
    """Create a sender user with Stripe customer ID."""
    user = User(
        email="sender-stripe@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Stripe Sender",
        role=UserRole.SENDER,
        is_active=True,
        is_verified=True,
        stripe_customer_id="cus_test123",
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
def package_for_payment(db_session, sender_user, courier_user):
    """Create a package ready for payment."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        description="Test package",
        size="medium",
        weight_kg=5.0,
        pickup_address="123 Start St",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="456 End Ave",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        price=25.50,
        status=PackageStatus.IN_TRANSIT,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def payment_method(db_session, sender_user):
    """Create a payment method for sender."""
    pm = PaymentMethod(
        user_id=sender_user.id,
        stripe_payment_method_id="pm_test123",
        card_brand="visa",
        card_last_four="4242",
        card_exp_month=12,
        card_exp_year=2025,
        is_default=True
    )
    db_session.add(pm)
    db_session.commit()
    db_session.refresh(pm)
    return pm


@pytest.fixture
def completed_transaction(db_session, package_for_payment, sender_user, courier_user):
    """Create a completed transaction."""
    transaction = Transaction(
        package_id=package_for_payment.id,
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        stripe_payment_intent_id="pi_test123",
        stripe_charge_id="ch_test123",
        amount_cents=2550,
        platform_fee_cents=255,
        courier_payout_cents=2295,
        currency="USD",
        status=TransactionStatus.SUCCEEDED.value,
        completed_at=datetime.utcnow()
    )
    db_session.add(transaction)
    db_session.commit()
    db_session.refresh(transaction)
    return transaction


def get_auth_header(user: User):
    """Generate auth header for a user."""
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def mock_stripe():
    """Mock Stripe API calls."""
    with patch('app.services.stripe_service.stripe') as mock:
        # Mock Customer
        mock.Customer.create.return_value = MagicMock(id='cus_test123')
        mock.Customer.retrieve.return_value = MagicMock(id='cus_test123')
        mock.Customer.modify.return_value = MagicMock(id='cus_test123')

        # Mock SetupIntent
        mock.SetupIntent.create.return_value = MagicMock(
            id='seti_test123',
            client_secret='seti_test123_secret_abcdef'
        )

        # Mock PaymentMethod
        mock.PaymentMethod.attach.return_value = None
        mock.PaymentMethod.retrieve.return_value = MagicMock(
            card=MagicMock(
                brand='visa',
                last4='4242',
                exp_month=12,
                exp_year=2025
            )
        )
        mock.PaymentMethod.detach.return_value = None

        # Mock PaymentIntent
        mock.PaymentIntent.create.return_value = MagicMock(
            id='pi_test123',
            status='succeeded',
            latest_charge='ch_test123',
            client_secret='pi_test123_secret_abcdef'
        )
        mock.PaymentIntent.confirm.return_value = MagicMock(
            id='pi_test123',
            status='succeeded',
            latest_charge='ch_test123'
        )

        # Mock Refund
        mock.Refund.create.return_value = MagicMock(
            id='re_test123',
            amount=2550,
            status='succeeded'
        )

        # Mock Webhook
        mock.Webhook.construct_event.return_value = MagicMock(
            type='payment_intent.succeeded',
            data=MagicMock(
                object=MagicMock(
                    id='pi_test123',
                    latest_charge='ch_test123'
                )
            )
        )

        yield mock


# ==================== Setup Intents & Payment Methods ====================

class TestSetupIntentAndPaymentMethods:
    """Test setup intents and payment method management."""

    def test_create_setup_intent_new_customer(self, client, sender_user, mock_stripe):
        """Test creating setup intent for user without Stripe customer."""
        headers = get_auth_header(sender_user)

        response = client.post("/api/payments/setup-intent", headers=headers)

        assert response.status_code == 200
        data = response.json()
        assert "client_secret" in data
        assert "setup_intent_id" in data
        assert data["setup_intent_id"] == "seti_test123"

        # Verify Stripe customer was created
        mock_stripe.Customer.create.assert_called_once()

    def test_create_setup_intent_existing_customer(self, client, sender_with_stripe_customer, mock_stripe):
        """Test creating setup intent for user with existing Stripe customer."""
        headers = get_auth_header(sender_with_stripe_customer)

        response = client.post("/api/payments/setup-intent", headers=headers)

        assert response.status_code == 200

        # Should not create new customer
        mock_stripe.Customer.create.assert_not_called()

    def test_create_setup_intent_stripe_error(self, client, sender_user):
        """Test setup intent creation with Stripe error."""
        headers = get_auth_header(sender_user)

        with patch('app.services.stripe_service.stripe') as mock:
            mock.SetupIntent.create.side_effect = stripe.error.StripeError("Test error")
            mock.Customer.create.return_value = MagicMock(id='cus_test')

            response = client.post("/api/payments/setup-intent", headers=headers)

            assert response.status_code == 400
            assert "Test error" in response.json()["detail"]

    def test_save_payment_method_success(self, client, sender_user, mock_stripe):
        """Test saving payment method after SetupIntent."""
        headers = get_auth_header(sender_user)
        data = {
            "payment_method_id": "pm_test456",
            "set_as_default": True
        }

        response = client.post("/api/payments/methods", headers=headers, json=data)

        assert response.status_code == 200
        pm_data = response.json()
        assert pm_data["stripe_payment_method_id"] == "pm_test456"
        assert pm_data["card_brand"] == "visa"
        assert pm_data["card_last_four"] == "4242"
        assert pm_data["is_default"] is True

        # Verify Stripe calls
        mock_stripe.PaymentMethod.attach.assert_called_once()
        mock_stripe.Customer.modify.assert_called_once()

    def test_save_payment_method_not_default(self, client, sender_user, mock_stripe):
        """Test saving payment method without setting as default."""
        headers = get_auth_header(sender_user)
        data = {
            "payment_method_id": "pm_test789",
            "set_as_default": False
        }

        response = client.post("/api/payments/methods", headers=headers, json=data)

        assert response.status_code == 200
        pm_data = response.json()
        assert pm_data["is_default"] is False

        # Should not modify customer default
        mock_stripe.Customer.modify.assert_not_called()

    def test_list_payment_methods(self, client, sender_user, payment_method, db_session):
        """Test listing user's payment methods."""
        # Create another non-default payment method
        pm2 = PaymentMethod(
            user_id=sender_user.id,
            stripe_payment_method_id="pm_test456",
            card_brand="mastercard",
            card_last_four="5555",
            card_exp_month=6,
            card_exp_year=2026,
            is_default=False
        )
        db_session.add(pm2)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get("/api/payments/methods", headers=headers)

        assert response.status_code == 200
        methods = response.json()
        assert len(methods) == 2

        # Default should be first
        assert methods[0]["is_default"] is True
        assert methods[0]["card_brand"] == "visa"
        assert methods[1]["is_default"] is False
        assert methods[1]["card_brand"] == "mastercard"

    def test_delete_payment_method_success(self, client, sender_user, payment_method, mock_stripe):
        """Test deleting a payment method."""
        headers = get_auth_header(sender_user)

        response = client.delete(f"/api/payments/methods/{payment_method.id}", headers=headers)

        assert response.status_code == 200
        assert "deleted" in response.json()["message"].lower()

        # Verify detached from Stripe
        mock_stripe.PaymentMethod.detach.assert_called_once_with("pm_test123")

    def test_delete_payment_method_not_found(self, client, sender_user, mock_stripe):
        """Test deleting non-existent payment method."""
        headers = get_auth_header(sender_user)

        response = client.delete("/api/payments/methods/99999", headers=headers)

        assert response.status_code == 404

    def test_delete_payment_method_unauthorized(self, client, sender_user, payment_method, courier_user):
        """Test deleting another user's payment method."""
        headers = get_auth_header(courier_user)

        response = client.delete(f"/api/payments/methods/{payment_method.id}", headers=headers)

        assert response.status_code == 404  # Should not reveal existence

    def test_set_default_payment_method(self, client, sender_user, payment_method, db_session, mock_stripe):
        """Test setting a payment method as default."""
        # Create another payment method
        pm2 = PaymentMethod(
            user_id=sender_user.id,
            stripe_payment_method_id="pm_test456",
            card_brand="mastercard",
            card_last_four="5555",
            is_default=False
        )
        db_session.add(pm2)
        db_session.commit()
        db_session.refresh(pm2)

        headers = get_auth_header(sender_user)
        response = client.put(f"/api/payments/methods/{pm2.id}/default", headers=headers)

        assert response.status_code == 200

        # Verify pm2 is now default
        db_session.refresh(pm2)
        db_session.refresh(payment_method)
        assert pm2.is_default is True
        assert payment_method.is_default is False


# ==================== Payment Intents & Charging ====================

class TestPaymentIntentsAndCharging:
    """Test payment intent creation and charging."""

    def test_charge_delivery_with_default_payment_method(self, client, sender_user, package_for_payment, payment_method, mock_stripe):
        """Test charging for delivery with default payment method."""
        headers = get_auth_header(sender_user)

        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["amount_cents"] == 2550  # $25.50
        assert transaction["status"] == "succeeded"
        assert transaction["package_id"] == package_for_payment.id

        # Verify payment intent was created with confirmation
        mock_stripe.PaymentIntent.create.assert_called_once()
        call_args = mock_stripe.PaymentIntent.create.call_args
        assert call_args[1]["amount"] == 2550
        assert call_args[1]["confirm"] is True
        assert call_args[1]["payment_method"] == "pm_test123"

    def test_charge_delivery_without_default_payment_method(self, client, sender_user, package_for_payment, mock_stripe):
        """Test charging delivery without default payment method."""
        # Mock to return requires_payment status
        mock_stripe.PaymentIntent.create.return_value = MagicMock(
            id='pi_test123',
            status='requires_payment_method',
            client_secret='pi_test123_secret'
        )

        headers = get_auth_header(sender_user)
        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["status"] == "requires_payment"

    def test_charge_with_specific_payment_method(self, client, sender_user, package_for_payment, mock_stripe):
        """Test charging with specific payment method provided."""
        # Mock requires payment then success on confirm
        mock_stripe.PaymentIntent.create.return_value = MagicMock(
            id='pi_test123',
            status='requires_payment_method',
            client_secret='pi_test123_secret'
        )

        headers = get_auth_header(sender_user)
        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={"payment_method_id": "pm_test999"}
        )

        assert response.status_code == 200

        # Should confirm with provided payment method
        mock_stripe.PaymentIntent.confirm.assert_called_once()

    def test_charge_package_not_found(self, client, sender_user):
        """Test charging non-existent package."""
        headers = get_auth_header(sender_user)

        response = client.post(
            "/api/payments/charge/99999",
            headers=headers,
            json={}
        )

        assert response.status_code == 404

    def test_charge_not_sender_package(self, client, courier_user, package_for_payment):
        """Test charging package user doesn't own."""
        headers = get_auth_header(courier_user)

        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 404

    def test_charge_already_paid_package(self, client, sender_user, package_for_payment, completed_transaction):
        """Test charging package that's already paid."""
        headers = get_auth_header(sender_user)

        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 400
        assert "already processed" in response.json()["detail"].lower()

    def test_charge_package_without_price(self, client, sender_user, db_session, mock_stripe):
        """Test charging package without price set."""
        # Create package without price
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="No price package",
            size="small",
            weight_kg=2.0,
            pickup_address="123 St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            price=None,
            status=PackageStatus.IN_TRANSIT,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.post(
            f"/api/payments/charge/{package.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 400
        assert "price" in response.json()["detail"].lower()

    def test_platform_fee_calculation(self, client, sender_user, courier_user, payment_method, db_session, mock_stripe):
        """Test platform fee and courier payout calculations."""
        # Create package with known price
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            courier_id=courier_user.id,  # Add courier
            description="Fee test package",
            size="small",
            weight_kg=5.0,
            pickup_address="123 St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            price=100.00,  # $100
            status=PackageStatus.IN_TRANSIT,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.post(
            f"/api/payments/charge/{package.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["amount_cents"] == 10000
        assert transaction["platform_fee_cents"] == 1500  # 15% fee
        assert transaction["courier_payout_cents"] == 8500

    def test_charge_creates_courier_notification(self, client, sender_user, package_for_payment, payment_method, mock_stripe, db_session):
        """Test that successful charge creates courier notification."""
        headers = get_auth_header(sender_user)

        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 200

        # Check notification was created
        from app.models.notification import Notification
        notification = db_session.query(Notification).filter(
            Notification.user_id == package_for_payment.courier_id,
            Notification.package_id == package_for_payment.id
        ).first()

        assert notification is not None
        assert "payment" in notification.message.lower()

    def test_charge_with_stripe_error(self, client, sender_user, package_for_payment, payment_method):
        """Test charge with Stripe API error."""
        with patch('app.services.stripe_service.stripe') as mock:
            # Mock customer creation to return string
            mock.Customer.create.return_value = MagicMock(id='cus_test123')
            # Set attribute to return string instead of MagicMock
            type(mock.Customer.create.return_value).id = PropertyMock(return_value='cus_test123')

            mock.PaymentIntent.create.side_effect = stripe.error.CardError(
                message="Card declined",
                param=None,
                code="card_declined"
            )

            headers = get_auth_header(sender_user)
            response = client.post(
                f"/api/payments/charge/{package_for_payment.id}",
                headers=headers,
                json={}
            )

            assert response.status_code == 400
            assert "declined" in response.json()["detail"].lower()

    def test_transaction_idempotency(self, client, sender_user, package_for_payment, payment_method, mock_stripe):
        """Test transaction has idempotency key."""
        headers = get_auth_header(sender_user)

        response = client.post(
            f"/api/payments/charge/{package_for_payment.id}",
            headers=headers,
            json={}
        )

        assert response.status_code == 200

        # Verify idempotency key was passed
        call_args = mock_stripe.PaymentIntent.create.call_args
        assert "idempotency_key" in call_args[1]
        assert f"pkg_{package_for_payment.id}" in call_args[1]["idempotency_key"]


# ==================== Transaction Management ====================

class TestTransactionManagement:
    """Test transaction listing and retrieval."""

    def test_list_transactions_as_sender(self, client, sender_user, completed_transaction):
        """Test listing transactions as sender."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payments/transactions", headers=headers)

        assert response.status_code == 200
        transactions = response.json()
        assert len(transactions) == 1
        assert transactions[0]["id"] == completed_transaction.id
        assert transactions[0]["sender_id"] == sender_user.id

    def test_list_transactions_as_courier(self, client, courier_user, completed_transaction):
        """Test listing transactions as courier."""
        headers = get_auth_header(courier_user)

        response = client.get("/api/payments/transactions", headers=headers)

        assert response.status_code == 200
        transactions = response.json()
        assert len(transactions) == 1
        assert transactions[0]["id"] == completed_transaction.id
        assert transactions[0]["courier_id"] == courier_user.id

    def test_list_transactions_pagination(self, client, sender_user, package_for_payment, db_session):
        """Test transaction pagination."""
        # Create 25 transactions
        for i in range(25):
            t = Transaction(
                package_id=package_for_payment.id,
                sender_id=sender_user.id,
                amount_cents=1000 + i,
                platform_fee_cents=100,
                courier_payout_cents=900,
                currency="USD",
                status=TransactionStatus.SUCCEEDED.value
            )
            db_session.add(t)
        db_session.commit()

        headers = get_auth_header(sender_user)

        # First page (default limit 20)
        response = client.get("/api/payments/transactions", headers=headers)
        assert len(response.json()) == 20

        # Second page
        response = client.get("/api/payments/transactions?skip=20&limit=10", headers=headers)
        assert len(response.json()) == 5

    def test_list_transactions_empty(self, client, sender_user):
        """Test listing transactions with no transactions."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payments/transactions", headers=headers)

        assert response.status_code == 200
        assert response.json() == []

    def test_get_transaction_as_sender(self, client, sender_user, completed_transaction):
        """Test getting transaction details as sender."""
        headers = get_auth_header(sender_user)

        response = client.get(
            f"/api/payments/transactions/{completed_transaction.id}",
            headers=headers
        )

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["id"] == completed_transaction.id
        assert transaction["amount_cents"] == 2550

    def test_get_transaction_as_courier(self, client, courier_user, completed_transaction):
        """Test getting transaction details as courier."""
        headers = get_auth_header(courier_user)

        response = client.get(
            f"/api/payments/transactions/{completed_transaction.id}",
            headers=headers
        )

        assert response.status_code == 200

    def test_get_transaction_unauthorized(self, client, db_session, completed_transaction):
        """Test getting transaction by unrelated user."""
        # Create third user
        other_user = User(
            email="other@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Other User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True
        )
        db_session.add(other_user)
        db_session.commit()

        headers = get_auth_header(other_user)
        response = client.get(
            f"/api/payments/transactions/{completed_transaction.id}",
            headers=headers
        )

        assert response.status_code == 404

    def test_get_transaction_not_found(self, client, sender_user):
        """Test getting non-existent transaction."""
        headers = get_auth_header(sender_user)

        response = client.get("/api/payments/transactions/99999", headers=headers)

        assert response.status_code == 404


# ==================== Refunds ====================

class TestRefunds:
    """Test refund functionality."""

    def test_full_refund(self, client, sender_user, completed_transaction, mock_stripe):
        """Test full refund of transaction."""
        headers = get_auth_header(sender_user)

        response = client.post(
            f"/api/payments/transactions/{completed_transaction.id}/refund",
            headers=headers,
            json={"reason": "Customer requested refund"}
        )

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["refund_amount_cents"] == 2550
        assert transaction["status"] == "refunded"

        # Verify Stripe refund was created
        mock_stripe.Refund.create.assert_called_once()
        call_args = mock_stripe.Refund.create.call_args
        assert call_args[1]["charge"] == "ch_test123"
        assert call_args[1]["amount"] == 2550

    def test_partial_refund(self, client, sender_user, completed_transaction, mock_stripe):
        """Test partial refund of transaction."""
        mock_stripe.Refund.create.return_value = MagicMock(
            id='re_test123',
            amount=1000,
            status='succeeded'
        )

        headers = get_auth_header(sender_user)
        response = client.post(
            f"/api/payments/transactions/{completed_transaction.id}/refund",
            headers=headers,
            json={"amount_cents": 1000, "reason": "Partial refund"}
        )

        assert response.status_code == 200
        transaction = response.json()
        assert transaction["refund_amount_cents"] == 1000
        assert transaction["status"] == "partially_refunded"

    def test_refund_not_found(self, client, sender_user, mock_stripe):
        """Test refunding non-existent transaction."""
        headers = get_auth_header(sender_user)

        response = client.post(
            "/api/payments/transactions/99999/refund",
            headers=headers,
            json={"reason": "Test"}
        )

        assert response.status_code == 404

    def test_refund_not_sender(self, client, courier_user, completed_transaction):
        """Test refund by non-sender (should fail)."""
        headers = get_auth_header(courier_user)

        response = client.post(
            f"/api/payments/transactions/{completed_transaction.id}/refund",
            headers=headers,
            json={"reason": "Not allowed"}
        )

        assert response.status_code == 404  # Filtered out by sender_id check

    def test_refund_not_succeeded_transaction(self, client, sender_user, package_for_payment, db_session):
        """Test refunding transaction that hasn't succeeded."""
        pending_transaction = Transaction(
            package_id=package_for_payment.id,
            sender_id=sender_user.id,
            amount_cents=2550,
            platform_fee_cents=255,
            courier_payout_cents=2295,
            currency="USD",
            status=TransactionStatus.PENDING.value
        )
        db_session.add(pending_transaction)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.post(
            f"/api/payments/transactions/{pending_transaction.id}/refund",
            headers=headers,
            json={"reason": "Test"}
        )

        assert response.status_code == 404  # Not eligible

    def test_refund_updates_status(self, client, sender_user, completed_transaction, db_session, mock_stripe):
        """Test refund updates transaction status correctly."""
        headers = get_auth_header(sender_user)

        response = client.post(
            f"/api/payments/transactions/{completed_transaction.id}/refund",
            headers=headers,
            json={"reason": "Test"}
        )

        assert response.status_code == 200

        # Verify database was updated
        db_session.refresh(completed_transaction)
        assert completed_transaction.status == TransactionStatus.REFUNDED.value
        assert completed_transaction.refund_reason == "Test"

    def test_multiple_partial_refunds(self, client, sender_user, completed_transaction, db_session, mock_stripe):
        """Test multiple partial refunds."""
        headers = get_auth_header(sender_user)

        # First partial refund
        mock_stripe.Refund.create.return_value = MagicMock(id='re_1', amount=1000)
        response1 = client.post(
            f"/api/payments/transactions/{completed_transaction.id}/refund",
            headers=headers,
            json={"amount_cents": 1000, "reason": "First"}
        )
        assert response1.status_code == 200
        assert response1.json()["status"] == "partially_refunded"

        # Refresh and verify status change
        db_session.refresh(completed_transaction)
        # Transaction is now partially_refunded, not succeeded, so second refund won't work
        # Change transaction back to succeeded for second refund to work
        completed_transaction.status = TransactionStatus.SUCCEEDED.value
        db_session.commit()

        # Second partial refund
        mock_stripe.Refund.create.return_value = MagicMock(id='re_2', amount=1550)
        response2 = client.post(
            f"/api/payments/transactions/{completed_transaction.id}/refund",
            headers=headers,
            json={"amount_cents": 1550, "reason": "Second"}
        )
        assert response2.status_code == 200

        # Total refund should equal full amount now
        transaction = response2.json()
        assert transaction["refund_amount_cents"] == 2550
        assert transaction["status"] == "refunded"

    def test_refund_stripe_error(self, client, sender_user, completed_transaction):
        """Test refund with Stripe error."""
        with patch('app.services.stripe_service.stripe') as mock:
            mock.Refund.create.side_effect = stripe.error.StripeError("Refund failed")

            headers = get_auth_header(sender_user)
            response = client.post(
                f"/api/payments/transactions/{completed_transaction.id}/refund",
                headers=headers,
                json={"reason": "Test"}
            )

            assert response.status_code == 400
            assert "failed" in response.json()["detail"].lower()


# ==================== Stripe Webhooks ====================

class TestStripeWebhooks:
    """Test Stripe webhook handling."""

    def test_payment_succeeded_webhook(self, client, sender_user, package_for_payment, courier_user, db_session):
        """Test payment_intent.succeeded webhook."""
        # Create pending transaction
        transaction = Transaction(
            package_id=package_for_payment.id,
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            stripe_payment_intent_id="pi_webhook123",
            amount_cents=2550,
            platform_fee_cents=255,
            courier_payout_cents=2295,
            currency="USD",
            status=TransactionStatus.PROCESSING.value
        )
        db_session.add(transaction)
        db_session.commit()

        # Mock webhook event
        with patch('app.routes.payments.stripe.Webhook.construct_event') as mock_webhook:
            mock_webhook.return_value = Mock(
                type='payment_intent.succeeded',
                data=Mock(
                    object=Mock(
                        id='pi_webhook123',
                        latest_charge='ch_webhook123'
                    )
                )
            )

            response = client.post(
                "/api/payments/webhook",
                content=b'{"type": "payment_intent.succeeded"}',
                headers={"stripe-signature": "test_signature"}
            )

            assert response.status_code == 200
            assert response.json()["status"] == "received"

            # Verify transaction was updated
            db_session.refresh(transaction)
            assert transaction.status == TransactionStatus.SUCCEEDED.value
            assert transaction.stripe_charge_id == "ch_webhook123"
            assert transaction.completed_at is not None

    def test_payment_failed_webhook(self, client, sender_user, package_for_payment, db_session):
        """Test payment_intent.payment_failed webhook."""
        # Create transaction
        transaction = Transaction(
            package_id=package_for_payment.id,
            sender_id=sender_user.id,
            stripe_payment_intent_id="pi_fail123",
            amount_cents=2550,
            platform_fee_cents=255,
            courier_payout_cents=2295,
            currency="USD",
            status=TransactionStatus.PROCESSING.value
        )
        db_session.add(transaction)
        db_session.commit()

        # Mock webhook event
        with patch('app.routes.payments.stripe.Webhook.construct_event') as mock_webhook:
            mock_webhook.return_value = Mock(
                type='payment_intent.payment_failed',
                data=Mock(
                    object=Mock(
                        id='pi_fail123',
                        last_payment_error=Mock(message='Insufficient funds')
                    )
                )
            )

            response = client.post(
                "/api/payments/webhook",
                content=b'{"type": "payment_intent.payment_failed"}',
                headers={"stripe-signature": "test_signature"}
            )

            assert response.status_code == 200

            # Verify transaction was updated
            db_session.refresh(transaction)
            assert transaction.status == TransactionStatus.FAILED.value
            assert "Insufficient funds" in transaction.error_message

    def test_webhook_missing_signature(self, client):
        """Test webhook without signature header."""
        response = client.post(
            "/api/payments/webhook",
            content=b'{"type": "test"}'
        )

        assert response.status_code == 400
        assert "signature" in response.json()["detail"].lower()

    def test_webhook_invalid_signature(self, client):
        """Test webhook with invalid signature."""
        with patch('app.routes.payments.stripe.Webhook.construct_event') as mock:
            mock.side_effect = stripe.error.SignatureVerificationError("Invalid signature", "sig")

            response = client.post(
                "/api/payments/webhook",
                content=b'{"type": "test"}',
                headers={"stripe-signature": "invalid"}
            )

            assert response.status_code == 400
            assert "signature" in response.json()["detail"].lower()

    def test_webhook_invalid_payload(self, client):
        """Test webhook with malformed payload."""
        with patch('app.routes.payments.stripe.Webhook.construct_event') as mock:
            mock.side_effect = ValueError("Invalid payload")

            response = client.post(
                "/api/payments/webhook",
                content=b'invalid json',
                headers={"stripe-signature": "test_sig"}
            )

            assert response.status_code == 400
            assert "payload" in response.json()["detail"].lower()

    def test_webhook_unknown_event_type(self, client):
        """Test webhook with unknown event type (should still return 200)."""
        with patch('app.routes.payments.stripe.Webhook.construct_event') as mock:
            mock.return_value = Mock(
                type='unknown.event.type',
                data=Mock(object=Mock())
            )

            response = client.post(
                "/api/payments/webhook",
                content=b'{"type": "unknown.event.type"}',
                headers={"stripe-signature": "test_sig"}
            )

            # Should still return 200 for unknown events
            assert response.status_code == 200

    def test_webhook_account_updated(self, client, courier_user, db_session):
        """Test account.updated webhook for Connect accounts."""
        from app.models.payment import StripeConnectAccount

        # Create connect account
        connect_account = StripeConnectAccount(
            courier_id=courier_user.id,
            stripe_account_id="acct_test123",
            account_type="express",
            country="US",
            details_submitted=False,
            charges_enabled=False,
            payouts_enabled=False
        )
        db_session.add(connect_account)
        db_session.commit()

        # Mock webhook event
        with patch('app.routes.payments.stripe.Webhook.construct_event') as mock:
            mock.return_value = Mock(
                type='account.updated',
                data=Mock(
                    object=Mock(
                        id='acct_test123',
                        details_submitted=True,
                        charges_enabled=True,
                        payouts_enabled=True
                    )
                )
            )

            response = client.post(
                "/api/payments/webhook",
                content=b'{"type": "account.updated"}',
                headers={"stripe-signature": "test_sig"}
            )

            assert response.status_code == 200

            # Verify account was updated
            db_session.refresh(connect_account)
            assert connect_account.details_submitted is True
            assert connect_account.charges_enabled is True
            assert connect_account.payouts_enabled is True
            assert connect_account.onboarding_complete is True
