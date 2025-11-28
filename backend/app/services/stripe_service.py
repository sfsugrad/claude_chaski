"""
Stripe service for payment processing.

Handles:
- Customer management
- Payment intents
- Connect accounts for couriers
- Transfers and payouts
"""
import uuid
from typing import Optional, Dict, Any
from datetime import datetime

import stripe
from sqlalchemy.orm import Session

from app.config import settings
from app.models.user import User
from app.models.package import Package
from app.models.payment import (
    Transaction, TransactionStatus,
    StripeConnectAccount,
    PaymentMethod,
    CourierPayout, PayoutStatus
)


class StripeService:
    """Service for Stripe payment operations."""

    def __init__(self):
        stripe.api_key = settings.STRIPE_SECRET_KEY

    # ==================== Customer Management ====================

    async def get_or_create_customer(
        self,
        db: Session,
        user: User
    ) -> str:
        """Get existing or create new Stripe customer for user."""
        if user.stripe_customer_id:
            return user.stripe_customer_id

        # Create new customer
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
            metadata={
                "user_id": str(user.id),
                "platform": "chaski"
            }
        )

        # Save to user
        user.stripe_customer_id = customer.id
        db.commit()

        return customer.id

    async def get_customer(self, customer_id: str) -> Optional[Dict[str, Any]]:
        """Get Stripe customer by ID."""
        try:
            return stripe.Customer.retrieve(customer_id)
        except stripe.error.StripeError:
            return None

    # ==================== Payment Methods ====================

    async def create_setup_intent(
        self,
        db: Session,
        user: User
    ) -> Dict[str, Any]:
        """
        Create a SetupIntent for saving a payment method.

        Returns client_secret for frontend Stripe Elements.
        """
        customer_id = await self.get_or_create_customer(db, user)

        setup_intent = stripe.SetupIntent.create(
            customer=customer_id,
            payment_method_types=["card"],
            metadata={
                "user_id": str(user.id)
            }
        )

        return {
            "client_secret": setup_intent.client_secret,
            "setup_intent_id": setup_intent.id
        }

    async def save_payment_method(
        self,
        db: Session,
        user: User,
        payment_method_id: str,
        set_as_default: bool = True
    ) -> PaymentMethod:
        """Save a payment method after SetupIntent succeeds."""
        customer_id = await self.get_or_create_customer(db, user)

        # Attach payment method to customer
        stripe.PaymentMethod.attach(
            payment_method_id,
            customer=customer_id
        )

        # Get payment method details
        pm = stripe.PaymentMethod.retrieve(payment_method_id)

        # If setting as default, update others
        if set_as_default:
            db.query(PaymentMethod).filter(
                PaymentMethod.user_id == user.id,
                PaymentMethod.is_default == True
            ).update({"is_default": False})

            # Also set as default in Stripe
            stripe.Customer.modify(
                customer_id,
                invoice_settings={"default_payment_method": payment_method_id}
            )

        # Save to database
        payment_method = PaymentMethod(
            user_id=user.id,
            stripe_payment_method_id=payment_method_id,
            card_brand=pm.card.brand if pm.card else None,
            card_last_four=pm.card.last4 if pm.card else None,
            card_exp_month=pm.card.exp_month if pm.card else None,
            card_exp_year=pm.card.exp_year if pm.card else None,
            is_default=set_as_default
        )
        db.add(payment_method)
        db.commit()
        db.refresh(payment_method)

        return payment_method

    async def list_payment_methods(
        self,
        db: Session,
        user: User
    ) -> list:
        """List user's saved payment methods."""
        return db.query(PaymentMethod).filter(
            PaymentMethod.user_id == user.id
        ).order_by(PaymentMethod.is_default.desc()).all()

    async def delete_payment_method(
        self,
        db: Session,
        user: User,
        payment_method_id: int
    ) -> bool:
        """Delete a saved payment method."""
        pm = db.query(PaymentMethod).filter(
            PaymentMethod.id == payment_method_id,
            PaymentMethod.user_id == user.id
        ).first()

        if not pm:
            return False

        # Detach from Stripe
        try:
            stripe.PaymentMethod.detach(pm.stripe_payment_method_id)
        except stripe.error.StripeError:
            pass  # May already be detached

        db.delete(pm)
        db.commit()
        return True

    # ==================== Payment Processing ====================

    async def create_payment_intent(
        self,
        db: Session,
        package: Package,
        sender: User
    ) -> Transaction:
        """
        Create a PaymentIntent for package delivery payment.

        Called after delivery proof is submitted.
        """
        if not package.price:
            raise ValueError("Package has no price set")

        customer_id = await self.get_or_create_customer(db, sender)

        # Calculate amounts
        amount_cents = int(package.price * 100)
        platform_fee_cents = int(amount_cents * settings.PLATFORM_FEE_PERCENT / 100)
        courier_payout_cents = amount_cents - platform_fee_cents

        # Generate idempotency key
        idempotency_key = f"pkg_{package.id}_{uuid.uuid4().hex[:8]}"

        # Get default payment method
        default_pm = db.query(PaymentMethod).filter(
            PaymentMethod.user_id == sender.id,
            PaymentMethod.is_default == True
        ).first()

        # Create PaymentIntent
        intent_params = {
            "amount": amount_cents,
            "currency": "usd",
            "customer": customer_id,
            "metadata": {
                "package_id": str(package.id),
                "sender_id": str(sender.id),
                "courier_id": str(package.courier_id) if package.courier_id else "",
                "platform": "chaski"
            },
            "description": f"Delivery payment for package #{package.id}",
        }

        # If default payment method exists, use it for automatic charge
        if default_pm:
            intent_params["payment_method"] = default_pm.stripe_payment_method_id
            intent_params["confirm"] = True
            intent_params["off_session"] = True

        payment_intent = stripe.PaymentIntent.create(
            **intent_params,
            idempotency_key=idempotency_key
        )

        # Create transaction record
        transaction = Transaction(
            package_id=package.id,
            sender_id=sender.id,
            courier_id=package.courier_id,
            stripe_payment_intent_id=payment_intent.id,
            amount_cents=amount_cents,
            platform_fee_cents=platform_fee_cents,
            courier_payout_cents=courier_payout_cents,
            currency="USD",
            status=self._map_intent_status(payment_intent.status),
            idempotency_key=idempotency_key
        )

        if payment_intent.status == "succeeded":
            transaction.completed_at = datetime.utcnow()
            transaction.stripe_charge_id = payment_intent.latest_charge

        db.add(transaction)
        db.commit()
        db.refresh(transaction)

        return transaction

    async def confirm_payment(
        self,
        db: Session,
        transaction_id: int,
        payment_method_id: Optional[str] = None
    ) -> Transaction:
        """Confirm a payment that requires action."""
        transaction = db.query(Transaction).filter(
            Transaction.id == transaction_id
        ).first()

        if not transaction:
            raise ValueError("Transaction not found")

        if transaction.status == TransactionStatus.SUCCEEDED.value:
            return transaction

        confirm_params = {}
        if payment_method_id:
            confirm_params["payment_method"] = payment_method_id

        intent = stripe.PaymentIntent.confirm(
            transaction.stripe_payment_intent_id,
            **confirm_params
        )

        transaction.status = self._map_intent_status(intent.status)
        if intent.status == "succeeded":
            transaction.completed_at = datetime.utcnow()
            transaction.stripe_charge_id = intent.latest_charge

        db.commit()
        db.refresh(transaction)

        return transaction

    async def refund_payment(
        self,
        db: Session,
        transaction: Transaction,
        amount_cents: Optional[int] = None,
        reason: str = ""
    ) -> Transaction:
        """Refund a payment (full or partial)."""
        if not transaction.stripe_charge_id:
            raise ValueError("No charge to refund")

        refund_amount = amount_cents or transaction.amount_cents

        refund = stripe.Refund.create(
            charge=transaction.stripe_charge_id,
            amount=refund_amount,
            reason="requested_by_customer",
            metadata={
                "transaction_id": str(transaction.id),
                "refund_reason": reason
            }
        )

        transaction.refund_amount_cents += refund_amount
        transaction.refund_reason = reason

        if transaction.refund_amount_cents >= transaction.amount_cents:
            transaction.status = TransactionStatus.REFUNDED.value
        else:
            transaction.status = TransactionStatus.PARTIALLY_REFUNDED.value

        db.commit()
        db.refresh(transaction)

        return transaction

    def _map_intent_status(self, stripe_status: str) -> str:
        """Map Stripe PaymentIntent status to our status."""
        mapping = {
            "requires_payment_method": TransactionStatus.REQUIRES_PAYMENT.value,
            "requires_confirmation": TransactionStatus.PENDING.value,
            "requires_action": TransactionStatus.PENDING.value,
            "processing": TransactionStatus.PROCESSING.value,
            "succeeded": TransactionStatus.SUCCEEDED.value,
            "canceled": TransactionStatus.CANCELLED.value,
        }
        return mapping.get(stripe_status, TransactionStatus.PENDING.value)

    # ==================== Connect Accounts (Couriers) ====================

    async def create_connect_account(
        self,
        db: Session,
        courier: User,
        country: str = "US"
    ) -> StripeConnectAccount:
        """Create a Stripe Connect Express account for courier."""
        # Check if already exists
        existing = db.query(StripeConnectAccount).filter(
            StripeConnectAccount.courier_id == courier.id
        ).first()

        if existing:
            return existing

        # Create Express account
        account = stripe.Account.create(
            type="express",
            country=country,
            email=courier.email,
            capabilities={
                "card_payments": {"requested": True},
                "transfers": {"requested": True},
            },
            business_type="individual",
            metadata={
                "courier_id": str(courier.id),
                "platform": "chaski"
            }
        )

        # Save to database
        connect_account = StripeConnectAccount(
            courier_id=courier.id,
            stripe_account_id=account.id,
            account_type="express",
            country=country
        )
        db.add(connect_account)
        db.commit()
        db.refresh(connect_account)

        return connect_account

    async def get_connect_onboarding_link(
        self,
        db: Session,
        courier: User,
        return_url: str,
        refresh_url: str
    ) -> str:
        """Get Stripe Connect onboarding link for courier."""
        connect_account = db.query(StripeConnectAccount).filter(
            StripeConnectAccount.courier_id == courier.id
        ).first()

        if not connect_account:
            connect_account = await self.create_connect_account(db, courier)

        link = stripe.AccountLink.create(
            account=connect_account.stripe_account_id,
            refresh_url=refresh_url,
            return_url=return_url,
            type="account_onboarding"
        )

        return link.url

    async def get_connect_dashboard_link(
        self,
        db: Session,
        courier: User
    ) -> Optional[str]:
        """Get Stripe Connect Express dashboard link."""
        connect_account = db.query(StripeConnectAccount).filter(
            StripeConnectAccount.courier_id == courier.id
        ).first()

        if not connect_account or not connect_account.onboarding_complete:
            return None

        link = stripe.Account.create_login_link(
            connect_account.stripe_account_id
        )

        return link.url

    async def refresh_connect_account_status(
        self,
        db: Session,
        courier: User
    ) -> Optional[StripeConnectAccount]:
        """Refresh Connect account status from Stripe."""
        connect_account = db.query(StripeConnectAccount).filter(
            StripeConnectAccount.courier_id == courier.id
        ).first()

        if not connect_account:
            return None

        account = stripe.Account.retrieve(connect_account.stripe_account_id)

        connect_account.details_submitted = account.details_submitted
        connect_account.charges_enabled = account.charges_enabled
        connect_account.payouts_enabled = account.payouts_enabled
        connect_account.onboarding_complete = (
            account.details_submitted and
            account.charges_enabled and
            account.payouts_enabled
        )

        db.commit()
        db.refresh(connect_account)

        return connect_account

    # ==================== Payouts ====================

    async def create_courier_payout(
        self,
        db: Session,
        courier: User,
        transaction_ids: list[int]
    ) -> CourierPayout:
        """Create a payout to courier for completed deliveries."""
        connect_account = db.query(StripeConnectAccount).filter(
            StripeConnectAccount.courier_id == courier.id
        ).first()

        if not connect_account or not connect_account.is_ready_for_payouts:
            raise ValueError("Courier account not ready for payouts")

        # Get transactions
        transactions = db.query(Transaction).filter(
            Transaction.id.in_(transaction_ids),
            Transaction.courier_id == courier.id,
            Transaction.status == TransactionStatus.SUCCEEDED.value
        ).all()

        if not transactions:
            raise ValueError("No valid transactions for payout")

        # Calculate total
        total_cents = sum(t.courier_payout_cents for t in transactions)

        # Create transfer to connected account
        transfer = stripe.Transfer.create(
            amount=total_cents,
            currency="usd",
            destination=connect_account.stripe_account_id,
            metadata={
                "courier_id": str(courier.id),
                "transaction_ids": ",".join(str(t.id) for t in transactions),
                "platform": "chaski"
            }
        )

        # Create payout record
        payout = CourierPayout(
            courier_id=courier.id,
            stripe_transfer_id=transfer.id,
            amount_cents=total_cents,
            currency="USD",
            transaction_ids=[t.id for t in transactions],
            status=PayoutStatus.SUCCEEDED.value,
            completed_at=datetime.utcnow()
        )

        # Update transaction records
        for t in transactions:
            t.stripe_transfer_id = transfer.id

        db.add(payout)
        db.commit()
        db.refresh(payout)

        return payout

    async def get_courier_balance(
        self,
        db: Session,
        courier: User
    ) -> Dict[str, int]:
        """Get courier's pending and available balance."""
        # Pending = sum of succeeded transactions without transfer
        pending_cents = db.query(Transaction).filter(
            Transaction.courier_id == courier.id,
            Transaction.status == TransactionStatus.SUCCEEDED.value,
            Transaction.stripe_transfer_id == None
        ).with_entities(
            func.coalesce(func.sum(Transaction.courier_payout_cents), 0)
        ).scalar()

        # Get from Stripe Connect if account exists
        connect_account = db.query(StripeConnectAccount).filter(
            StripeConnectAccount.courier_id == courier.id
        ).first()

        available_cents = 0
        if connect_account:
            try:
                balance = stripe.Balance.retrieve(
                    stripe_account=connect_account.stripe_account_id
                )
                available_cents = sum(
                    b.amount for b in balance.available
                    if b.currency == "usd"
                )
            except stripe.error.StripeError:
                pass

        return {
            "pending_cents": pending_cents or 0,
            "available_cents": available_cents
        }


# Import func for SQL operations
from sqlalchemy import func

# Singleton instance
_stripe_service: Optional[StripeService] = None


def get_stripe_service() -> StripeService:
    """Get singleton StripeService instance."""
    global _stripe_service
    if _stripe_service is None:
        _stripe_service = StripeService()
    return _stripe_service
