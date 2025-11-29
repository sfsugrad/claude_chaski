"""
Tests for Stripe service.

Unit tests for all Stripe service methods with full API mocking.

Tests cover:
- Customer management
- Payment methods
- Payment processing
- Refund processing
- Connect accounts
- Payouts
"""

import pytest
from unittest.mock import patch, MagicMock, PropertyMock
from datetime import datetime
import stripe

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.payment import (
    Transaction, TransactionStatus,
    StripeConnectAccount,
    PaymentMethod,
    CourierPayout, PayoutStatus
)
from app.services.stripe_service import StripeService, get_stripe_service
from app.utils.auth import get_password_hash
from app.utils.tracking_id import generate_tracking_id


# ==================== Fixtures ====================

@pytest.fixture
def service():
    """Get StripeService instance."""
    return StripeService()


@pytest.fixture
def sender_user(db_session):
    """Create a sender user."""
    user = User(
        email="sender@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Sender",
        role=UserRole.SENDER,
        is_active=True,
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sender_with_customer(db_session):
    """Create sender with Stripe customer ID."""
    user = User(
        email="sender_cust@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Sender With Customer",
        role=UserRole.SENDER,
        stripe_customer_id="cus_existing123",
        is_active=True,
        is_verified=True
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
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def package_for_payment(db_session, sender_user, courier_user):
    """Create a package for payment."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        description="Test package",
        size="medium",
        weight_kg=5.0,
        pickup_address="123 Start",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="456 End",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        price=50.00,
        status=PackageStatus.IN_TRANSIT,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def payment_method(db_session, sender_user):
    """Create a payment method."""
    pm = PaymentMethod(
        user_id=sender_user.id,
        stripe_payment_method_id="pm_test123",
        card_brand="visa",
        card_last_four="4242",
        is_default=True
    )
    db_session.add(pm)
    db_session.commit()
    db_session.refresh(pm)
    return pm


@pytest.fixture
def transaction(db_session, package_for_payment, sender_user, courier_user):
    """Create a transaction."""
    t = Transaction(
        package_id=package_for_payment.id,
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        stripe_payment_intent_id="pi_test123",
        stripe_charge_id="ch_test123",
        amount_cents=5000,
        platform_fee_cents=750,
        courier_payout_cents=4250,
        currency="USD",
        status=TransactionStatus.SUCCEEDED.value,
        completed_at=datetime.utcnow()
    )
    db_session.add(t)
    db_session.commit()
    db_session.refresh(t)
    return t


@pytest.fixture
def connect_account(db_session, courier_user):
    """Create a Connect account."""
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


# ==================== Customer Management ====================

class TestCustomerManagement:
    """Test customer management methods."""

    @pytest.mark.asyncio
    async def test_get_or_create_customer_new(self, service, sender_user, db_session):
        """Test creating new Stripe customer."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_new123')

            customer_id = await service.get_or_create_customer(db_session, sender_user)

            assert customer_id == 'cus_new123'
            mock_stripe.Customer.create.assert_called_once_with(
                email=sender_user.email,
                name=sender_user.full_name,
                metadata={
                    "user_id": str(sender_user.id),
                    "platform": "chaski"
                }
            )

            # Verify user was updated
            db_session.refresh(sender_user)
            assert sender_user.stripe_customer_id == 'cus_new123'

    @pytest.mark.asyncio
    async def test_get_or_create_customer_existing(self, service, sender_with_customer, db_session):
        """Test getting existing Stripe customer."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            customer_id = await service.get_or_create_customer(db_session, sender_with_customer)

            assert customer_id == 'cus_existing123'
            # Should not create new customer
            mock_stripe.Customer.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_customer(self, service):
        """Test getting customer by ID."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_customer = MagicMock(id='cus_test', email='test@example.com')
            mock_stripe.Customer.retrieve.return_value = mock_customer

            customer = await service.get_customer('cus_test')

            assert customer.id == 'cus_test'
            mock_stripe.Customer.retrieve.assert_called_once_with('cus_test')

    @pytest.mark.asyncio
    async def test_get_customer_not_found(self, service):
        """Test getting non-existent customer."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            # Create a proper Stripe error instance
            error = stripe.error.InvalidRequestError("Not found", param=None)
            mock_stripe.Customer.retrieve.side_effect = error

            customer = await service.get_customer('cus_invalid')

            assert customer is None

    @pytest.mark.asyncio
    async def test_customer_metadata(self, service, sender_user, db_session):
        """Test customer created with correct metadata."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_meta123')

            await service.get_or_create_customer(db_session, sender_user)

            call_args = mock_stripe.Customer.create.call_args
            assert call_args[1]['metadata']['user_id'] == str(sender_user.id)
            assert call_args[1]['metadata']['platform'] == 'chaski'


# ==================== Payment Methods ====================

class TestPaymentMethods:
    """Test payment method management."""

    @pytest.mark.asyncio
    async def test_create_setup_intent(self, service, sender_user, db_session):
        """Test creating setup intent."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_setup')
            mock_stripe.SetupIntent.create.return_value = MagicMock(
                id='seti_test123',
                client_secret='seti_secret_abc'
            )

            result = await service.create_setup_intent(db_session, sender_user)

            assert result['setup_intent_id'] == 'seti_test123'
            assert result['client_secret'] == 'seti_secret_abc'
            mock_stripe.SetupIntent.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_save_payment_method(self, service, sender_user, db_session):
        """Test saving payment method."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_pm')
            mock_stripe.PaymentMethod.attach.return_value = None
            mock_stripe.PaymentMethod.retrieve.return_value = MagicMock(
                card=MagicMock(brand='visa', last4='4242', exp_month=12, exp_year=2025)
            )
            mock_stripe.Customer.modify.return_value = None

            pm = await service.save_payment_method(
                db=db_session,
                user=sender_user,
                payment_method_id='pm_new123',
                set_as_default=True
            )

            assert pm.stripe_payment_method_id == 'pm_new123'
            assert pm.card_brand == 'visa'
            assert pm.card_last_four == '4242'
            assert pm.is_default is True

            # Verify Stripe calls
            mock_stripe.PaymentMethod.attach.assert_called_once()
            mock_stripe.Customer.modify.assert_called_once()

    @pytest.mark.asyncio
    async def test_save_payment_method_not_default(self, service, sender_user, db_session):
        """Test saving payment method without setting as default."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_pm')
            mock_stripe.PaymentMethod.attach.return_value = None
            mock_stripe.PaymentMethod.retrieve.return_value = MagicMock(
                card=MagicMock(brand='mastercard', last4='5555', exp_month=6, exp_year=2026)
            )

            pm = await service.save_payment_method(
                db=db_session,
                user=sender_user,
                payment_method_id='pm_new456',
                set_as_default=False
            )

            assert pm.is_default is False
            # Should not modify customer default
            mock_stripe.Customer.modify.assert_not_called()

    @pytest.mark.asyncio
    async def test_list_payment_methods(self, service, sender_user, payment_method, db_session):
        """Test listing payment methods."""
        methods = await service.list_payment_methods(db_session, sender_user)

        assert len(methods) == 1
        assert methods[0].id == payment_method.id

    @pytest.mark.asyncio
    async def test_delete_payment_method(self, service, sender_user, payment_method, db_session):
        """Test deleting payment method."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.PaymentMethod.detach.return_value = None

            success = await service.delete_payment_method(db_session, sender_user, payment_method.id)

            assert success is True
            mock_stripe.PaymentMethod.detach.assert_called_once_with('pm_test123')

            # Verify deleted from database
            pm = db_session.query(PaymentMethod).filter(PaymentMethod.id == payment_method.id).first()
            assert pm is None

    @pytest.mark.asyncio
    async def test_delete_payment_method_not_found(self, service, sender_user, db_session):
        """Test deleting non-existent payment method."""
        success = await service.delete_payment_method(db_session, sender_user, 99999)

        assert success is False

    @pytest.mark.asyncio
    async def test_delete_payment_method_stripe_error(self, service, sender_user, payment_method, db_session):
        """Test delete continues even with Stripe error."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            error = stripe.error.InvalidRequestError("Already detached", param=None)
            mock_stripe.PaymentMethod.detach.side_effect = error

            success = await service.delete_payment_method(db_session, sender_user, payment_method.id)

            # Should still succeed (already detached)
            assert success is True


# ==================== Payment Processing ====================

class TestPaymentProcessing:
    """Test payment intent and processing."""

    @pytest.mark.asyncio
    async def test_create_payment_intent_with_default_pm(self, service, package_for_payment, sender_user, payment_method, db_session):
        """Test creating payment intent with default payment method."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_pay')
            mock_stripe.PaymentIntent.create.return_value = MagicMock(
                id='pi_auto123',
                status='succeeded',
                latest_charge='ch_auto123'
            )

            transaction = await service.create_payment_intent(
                db=db_session,
                package=package_for_payment,
                sender=sender_user
            )

            assert transaction.amount_cents == 5000  # $50
            assert transaction.status == TransactionStatus.SUCCEEDED.value
            assert transaction.stripe_payment_intent_id == 'pi_auto123'

            # Verify payment intent created with confirmation
            call_args = mock_stripe.PaymentIntent.create.call_args
            assert call_args[1]['confirm'] is True
            assert call_args[1]['payment_method'] == 'pm_test123'

    @pytest.mark.asyncio
    async def test_create_payment_intent_without_default_pm(self, service, package_for_payment, sender_user, db_session):
        """Test creating payment intent without default payment method."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_pay')
            mock_stripe.PaymentIntent.create.return_value = MagicMock(
                id='pi_manual123',
                status='requires_payment_method',
                latest_charge=None
            )

            transaction = await service.create_payment_intent(
                db=db_session,
                package=package_for_payment,
                sender=sender_user
            )

            assert transaction.status == TransactionStatus.REQUIRES_PAYMENT.value

            # Should not auto-confirm
            call_args = mock_stripe.PaymentIntent.create.call_args
            assert 'confirm' not in call_args[1] or call_args[1]['confirm'] is not True

    @pytest.mark.asyncio
    async def test_create_payment_intent_no_price(self, service, package_for_payment, sender_user, db_session):
        """Test creating payment intent for package without price."""
        package_for_payment.price = None
        db_session.commit()

        with pytest.raises(ValueError, match="price"):
            await service.create_payment_intent(
                db=db_session,
                package=package_for_payment,
                sender=sender_user
            )

    @pytest.mark.asyncio
    async def test_payment_intent_fee_calculation(self, service, package_for_payment, sender_user, db_session):
        """Test platform fee and courier payout calculation."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_fee')
            mock_stripe.PaymentIntent.create.return_value = MagicMock(
                id='pi_fee',
                status='succeeded',
                latest_charge='ch_fee'
            )

            transaction = await service.create_payment_intent(
                db=db_session,
                package=package_for_payment,
                sender=sender_user
            )

            # $50 package: platform fee 15%, courier gets 85%
            assert transaction.platform_fee_cents == 750  # 15% of 5000
            assert transaction.courier_payout_cents == 4250  # 85% of 5000

    @pytest.mark.asyncio
    async def test_payment_intent_metadata(self, service, package_for_payment, sender_user, db_session):
        """Test payment intent includes correct metadata."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_meta')
            mock_stripe.PaymentIntent.create.return_value = MagicMock(
                id='pi_meta',
                status='succeeded',
                latest_charge='ch_meta'
            )

            await service.create_payment_intent(
                db=db_session,
                package=package_for_payment,
                sender=sender_user
            )

            call_args = mock_stripe.PaymentIntent.create.call_args
            metadata = call_args[1]['metadata']
            assert metadata['package_id'] == str(package_for_payment.id)
            assert metadata['sender_id'] == str(sender_user.id)
            assert metadata['platform'] == 'chaski'

    @pytest.mark.asyncio
    async def test_payment_intent_idempotency_key(self, service, package_for_payment, sender_user, db_session):
        """Test payment intent has idempotency key."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Customer.create.return_value = MagicMock(id='cus_idem')
            mock_stripe.PaymentIntent.create.return_value = MagicMock(
                id='pi_idem',
                status='succeeded',
                latest_charge='ch_idem'
            )

            await service.create_payment_intent(
                db=db_session,
                package=package_for_payment,
                sender=sender_user
            )

            call_args = mock_stripe.PaymentIntent.create.call_args
            assert 'idempotency_key' in call_args[1]
            assert f'pkg_{package_for_payment.id}' in call_args[1]['idempotency_key']

    @pytest.mark.asyncio
    async def test_confirm_payment(self, service, transaction, db_session):
        """Test confirming payment intent."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.PaymentIntent.confirm.return_value = MagicMock(
                id='pi_test123',
                status='succeeded',
                latest_charge='ch_confirmed'
            )

            transaction.status = TransactionStatus.REQUIRES_PAYMENT.value
            db_session.commit()

            result = await service.confirm_payment(
                db=db_session,
                transaction_id=transaction.id,
                payment_method_id='pm_confirm'
            )

            assert result.status == TransactionStatus.SUCCEEDED.value
            assert result.stripe_charge_id == 'ch_confirmed'

    @pytest.mark.asyncio
    async def test_confirm_payment_already_succeeded(self, service, transaction, db_session):
        """Test confirming already succeeded payment."""
        result = await service.confirm_payment(
            db=db_session,
            transaction_id=transaction.id
        )

        # Should return unchanged
        assert result.id == transaction.id
        assert result.status == TransactionStatus.SUCCEEDED.value

    @pytest.mark.asyncio
    async def test_confirm_payment_not_found(self, service, db_session):
        """Test confirming non-existent transaction."""
        with pytest.raises(ValueError, match="not found"):
            await service.confirm_payment(
                db=db_session,
                transaction_id=99999
            )

    @pytest.mark.asyncio
    async def test_map_intent_status(self, service):
        """Test mapping Stripe status to our status."""
        assert service._map_intent_status('requires_payment_method') == TransactionStatus.REQUIRES_PAYMENT.value
        assert service._map_intent_status('succeeded') == TransactionStatus.SUCCEEDED.value
        assert service._map_intent_status('processing') == TransactionStatus.PROCESSING.value
        assert service._map_intent_status('canceled') == TransactionStatus.CANCELLED.value


# ==================== Refund Processing ====================

class TestRefundProcessing:
    """Test refund functionality."""

    @pytest.mark.asyncio
    async def test_refund_payment_full(self, service, transaction, db_session):
        """Test full refund."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Refund.create.return_value = MagicMock(
                id='re_full',
                amount=5000,
                status='succeeded'
            )

            result = await service.refund_payment(
                db=db_session,
                transaction=transaction,
                reason="Customer request"
            )

            assert result.refund_amount_cents == 5000
            assert result.status == TransactionStatus.REFUNDED.value
            assert result.refund_reason == "Customer request"

    @pytest.mark.asyncio
    async def test_refund_payment_partial(self, service, transaction, db_session):
        """Test partial refund."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Refund.create.return_value = MagicMock(
                id='re_partial',
                amount=2000,
                status='succeeded'
            )

            result = await service.refund_payment(
                db=db_session,
                transaction=transaction,
                amount_cents=2000,
                reason="Partial refund"
            )

            assert result.refund_amount_cents == 2000
            assert result.status == TransactionStatus.PARTIALLY_REFUNDED.value

    @pytest.mark.asyncio
    async def test_refund_no_charge(self, service, transaction, db_session):
        """Test refund without charge ID."""
        transaction.stripe_charge_id = None
        db_session.commit()

        with pytest.raises(ValueError, match="No charge"):
            await service.refund_payment(
                db=db_session,
                transaction=transaction
            )

    @pytest.mark.asyncio
    async def test_refund_metadata(self, service, transaction, db_session):
        """Test refund includes metadata."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Refund.create.return_value = MagicMock(id='re_meta')

            await service.refund_payment(
                db=db_session,
                transaction=transaction,
                reason="Test refund"
            )

            call_args = mock_stripe.Refund.create.call_args
            metadata = call_args[1]['metadata']
            assert metadata['transaction_id'] == str(transaction.id)
            assert metadata['refund_reason'] == "Test refund"

    @pytest.mark.asyncio
    async def test_multiple_partial_refunds(self, service, transaction, db_session):
        """Test multiple partial refunds."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            # First refund
            mock_stripe.Refund.create.return_value = MagicMock(id='re_1', amount=2000)
            result1 = await service.refund_payment(
                db=db_session,
                transaction=transaction,
                amount_cents=2000
            )
            assert result1.refund_amount_cents == 2000
            assert result1.status == TransactionStatus.PARTIALLY_REFUNDED.value

            # Second refund
            mock_stripe.Refund.create.return_value = MagicMock(id='re_2', amount=3000)
            result2 = await service.refund_payment(
                db=db_session,
                transaction=transaction,
                amount_cents=3000
            )
            assert result2.refund_amount_cents == 5000  # Total
            assert result2.status == TransactionStatus.REFUNDED.value


# ==================== Connect Accounts ====================

class TestConnectAccounts:
    """Test Stripe Connect account management."""

    @pytest.mark.asyncio
    async def test_create_connect_account(self, service, courier_user, db_session):
        """Test creating Connect account."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Account.create.return_value = MagicMock(
                id='acct_new123',
                type='express',
                details_submitted=False
            )

            account = await service.create_connect_account(db_session, courier_user)

            assert account.stripe_account_id == 'acct_new123'
            assert account.courier_id == courier_user.id
            assert account.account_type == 'express'

            # Verify Stripe call
            call_args = mock_stripe.Account.create.call_args
            assert call_args[1]['type'] == 'express'
            assert call_args[1]['email'] == courier_user.email
            assert 'capabilities' in call_args[1]

    @pytest.mark.asyncio
    async def test_create_connect_account_already_exists(self, service, courier_user, connect_account, db_session):
        """Test creating account when it already exists."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            account = await service.create_connect_account(db_session, courier_user)

            # Should return existing
            assert account.id == connect_account.id
            mock_stripe.Account.create.assert_not_called()

    @pytest.mark.asyncio
    async def test_get_connect_onboarding_link(self, service, courier_user, connect_account, db_session):
        """Test getting onboarding link."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.AccountLink.create.return_value = MagicMock(
                url='https://connect.stripe.com/setup/xyz'
            )

            url = await service.get_connect_onboarding_link(
                db=db_session,
                courier=courier_user,
                return_url='https://example.com/return',
                refresh_url='https://example.com/refresh'
            )

            assert 'connect.stripe.com' in url
            mock_stripe.AccountLink.create.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_connect_dashboard_link(self, service, courier_user, connect_account, db_session):
        """Test getting dashboard link."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Account.create_login_link.return_value = MagicMock(
                url='https://connect.stripe.com/dashboard/xyz'
            )

            url = await service.get_connect_dashboard_link(db_session, courier_user)

            assert url is not None
            assert 'connect.stripe.com' in url

    @pytest.mark.asyncio
    async def test_get_dashboard_link_not_ready(self, service, courier_user, db_session):
        """Test dashboard link when account not ready."""
        # Create incomplete account
        incomplete = StripeConnectAccount(
            courier_id=courier_user.id,
            stripe_account_id="acct_incomplete",
            account_type="express",
            country="US",
            onboarding_complete=False
        )
        db_session.add(incomplete)
        db_session.commit()

        url = await service.get_connect_dashboard_link(db_session, courier_user)

        assert url is None

    @pytest.mark.asyncio
    async def test_refresh_connect_account_status(self, service, courier_user, db_session):
        """Test refreshing account status from Stripe."""
        # Create account
        account = StripeConnectAccount(
            courier_id=courier_user.id,
            stripe_account_id="acct_refresh",
            account_type="express",
            country="US",
            details_submitted=False,
            charges_enabled=False,
            payouts_enabled=False
        )
        db_session.add(account)
        db_session.commit()

        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Account.retrieve.return_value = MagicMock(
                id='acct_refresh',
                details_submitted=True,
                charges_enabled=True,
                payouts_enabled=True
            )

            result = await service.refresh_connect_account_status(db_session, courier_user)

            assert result.details_submitted is True
            assert result.onboarding_complete is True

    @pytest.mark.asyncio
    async def test_refresh_account_not_found(self, service, courier_user, db_session):
        """Test refresh when no account exists."""
        result = await service.refresh_connect_account_status(db_session, courier_user)

        assert result is None


# ==================== Payouts ====================

class TestPayouts:
    """Test courier payout functionality."""

    @pytest.mark.asyncio
    async def test_create_courier_payout(self, service, courier_user, connect_account, transaction, db_session):
        """Test creating courier payout."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Transfer.create.return_value = MagicMock(
                id='tr_payout',
                amount=4250,
                destination='acct_test123'
            )

            payout = await service.create_courier_payout(
                db=db_session,
                courier=courier_user,
                transaction_ids=[transaction.id]
            )

            assert payout.amount_cents == 4250
            assert payout.status == PayoutStatus.SUCCEEDED.value
            assert transaction.id in payout.transaction_ids

            # Verify transaction updated
            db_session.refresh(transaction)
            assert transaction.stripe_transfer_id == 'tr_payout'

    @pytest.mark.asyncio
    async def test_payout_without_account(self, service, courier_user, db_session):
        """Test payout without Connect account."""
        with pytest.raises(ValueError, match="not ready"):
            await service.create_courier_payout(
                db=db_session,
                courier=courier_user,
                transaction_ids=[1]
            )

    @pytest.mark.asyncio
    async def test_payout_account_not_ready(self, service, courier_user, db_session):
        """Test payout with incomplete account."""
        incomplete = StripeConnectAccount(
            courier_id=courier_user.id,
            stripe_account_id="acct_incomplete",
            account_type="express",
            country="US",
            onboarding_complete=False
        )
        db_session.add(incomplete)
        db_session.commit()

        with pytest.raises(ValueError, match="not ready"):
            await service.create_courier_payout(
                db=db_session,
                courier=courier_user,
                transaction_ids=[1]
            )

    @pytest.mark.asyncio
    async def test_payout_no_valid_transactions(self, service, courier_user, connect_account, db_session):
        """Test payout with no valid transactions."""
        with pytest.raises(ValueError, match="No valid"):
            await service.create_courier_payout(
                db=db_session,
                courier=courier_user,
                transaction_ids=[99999]
            )

    @pytest.mark.asyncio
    async def test_payout_multiple_transactions(self, service, courier_user, connect_account, sender_user, db_session):
        """Test payout with multiple transactions."""
        # Create multiple transactions
        transactions = []
        for i in range(3):
            t = Transaction(
                package_id=i+10,
                sender_id=sender_user.id,
                courier_id=courier_user.id,
                amount_cents=10000,
                platform_fee_cents=1500,
                courier_payout_cents=8500,
                currency="USD",
                status=TransactionStatus.SUCCEEDED.value
            )
            db_session.add(t)
            transactions.append(t)
        db_session.commit()

        transaction_ids = [t.id for t in transactions]

        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Transfer.create.return_value = MagicMock(
                id='tr_multi',
                amount=25500
            )

            payout = await service.create_courier_payout(
                db=db_session,
                courier=courier_user,
                transaction_ids=transaction_ids
            )

            assert payout.amount_cents == 25500  # 3 * 8500

    @pytest.mark.asyncio
    async def test_get_courier_balance(self, service, courier_user, transaction, connect_account, db_session):
        """Test getting courier balance."""
        with patch('app.services.stripe_service.stripe') as mock_stripe:
            mock_stripe.Balance.retrieve.return_value = MagicMock(
                available=[MagicMock(amount=10000, currency='usd')]
            )

            balance = await service.get_courier_balance(db_session, courier_user)

            assert balance['pending_cents'] == 4250  # From transaction
            assert balance['available_cents'] == 10000

    @pytest.mark.asyncio
    async def test_get_balance_no_connect_account(self, service, courier_user, transaction, db_session):
        """Test balance without Connect account."""
        balance = await service.get_courier_balance(db_session, courier_user)

        assert balance['pending_cents'] == 4250
        assert balance['available_cents'] == 0


# ==================== Service Singleton ====================

def test_get_stripe_service():
    """Test getting StripeService singleton."""
    service1 = get_stripe_service()
    service2 = get_stripe_service()

    assert service1 is service2  # Should be same instance
    assert isinstance(service1, StripeService)
