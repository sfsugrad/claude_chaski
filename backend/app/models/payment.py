"""
Payment models for transactions and Stripe integration.
"""
import enum
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Boolean, Text, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.models.base import Base


class TransactionStatus(str, enum.Enum):
    """Transaction status enum."""
    PENDING = "pending"              # Payment not yet initiated
    REQUIRES_PAYMENT = "requires_payment"  # Waiting for payment method
    PROCESSING = "processing"        # Payment being processed
    SUCCEEDED = "succeeded"          # Payment successful
    FAILED = "failed"                # Payment failed
    REFUNDED = "refunded"            # Payment refunded
    PARTIALLY_REFUNDED = "partially_refunded"  # Partial refund issued
    CANCELLED = "cancelled"          # Transaction cancelled


class PayoutStatus(str, enum.Enum):
    """Courier payout status enum."""
    PENDING = "pending"              # Payout not yet initiated
    PROCESSING = "processing"        # Payout being processed
    SUCCEEDED = "succeeded"          # Payout successful
    FAILED = "failed"                # Payout failed
    CANCELLED = "cancelled"          # Payout cancelled


class Transaction(Base):
    """
    Stores payment transactions for package deliveries.

    Uses Stripe PaymentIntents for payment processing.
    Amounts are stored in cents for precision.
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    # Stripe references
    stripe_payment_intent_id = Column(String(255), unique=True, nullable=True)
    stripe_charge_id = Column(String(255), nullable=True)
    stripe_transfer_id = Column(String(255), nullable=True)  # For courier payout

    # Amounts (stored in cents for precision)
    amount_cents = Column(Integer, nullable=False)  # Total amount charged
    platform_fee_cents = Column(Integer, nullable=False, default=0)  # Platform commission
    courier_payout_cents = Column(Integer, nullable=False, default=0)  # Amount for courier
    currency = Column(String(3), default="USD")

    # Refund tracking
    refund_amount_cents = Column(Integer, default=0)
    refund_reason = Column(Text, nullable=True)

    # Status
    status = Column(String(50), default=TransactionStatus.PENDING.value)

    # Idempotency key for Stripe
    idempotency_key = Column(String(255), unique=True, nullable=True)

    # Extra data
    extra_data = Column(JSON, default=dict)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    package = relationship("Package", backref="transactions")
    sender = relationship("User", foreign_keys=[sender_id], backref="sent_transactions")
    courier = relationship("User", foreign_keys=[courier_id], backref="received_transactions")

    def __repr__(self):
        return f"<Transaction {self.id} - {self.status}>"

    @property
    def amount_dollars(self) -> float:
        """Get amount in dollars."""
        return self.amount_cents / 100

    @property
    def platform_fee_dollars(self) -> float:
        """Get platform fee in dollars."""
        return self.platform_fee_cents / 100

    @property
    def courier_payout_dollars(self) -> float:
        """Get courier payout in dollars."""
        return self.courier_payout_cents / 100


class StripeConnectAccount(Base):
    """
    Stores Stripe Connect account info for couriers.

    Uses Stripe Express accounts for simplified onboarding.
    """
    __tablename__ = "stripe_connect_accounts"

    id = Column(Integer, primary_key=True, index=True)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True)

    # Stripe Connect account ID
    stripe_account_id = Column(String(255), nullable=False, unique=True)
    account_type = Column(String(50), default="express")  # express, standard, custom

    # Onboarding status
    onboarding_complete = Column(Boolean, default=False)
    details_submitted = Column(Boolean, default=False)
    charges_enabled = Column(Boolean, default=False)
    payouts_enabled = Column(Boolean, default=False)

    # Account info
    country = Column(String(2), default="US")
    default_currency = Column(String(3), default="usd")

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    courier = relationship("User", backref="stripe_connect_account", uselist=False)

    def __repr__(self):
        return f"<StripeConnectAccount {self.stripe_account_id} - Courier {self.courier_id}>"

    @property
    def is_ready_for_payouts(self) -> bool:
        """Check if account is ready to receive payouts."""
        return self.onboarding_complete and self.payouts_enabled


class PaymentMethod(Base):
    """
    Stores saved payment methods for senders.

    Uses Stripe PaymentMethods for card storage.
    """
    __tablename__ = "payment_methods"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Stripe references
    stripe_payment_method_id = Column(String(255), nullable=False, unique=True)

    # Card info (safe to store - no full card numbers)
    card_brand = Column(String(50), nullable=True)  # visa, mastercard, etc.
    card_last_four = Column(String(4), nullable=True)
    card_exp_month = Column(Integer, nullable=True)
    card_exp_year = Column(Integer, nullable=True)

    # Settings
    is_default = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", backref="payment_methods")

    def __repr__(self):
        return f"<PaymentMethod {self.card_brand} ****{self.card_last_four}>"


class CourierPayout(Base):
    """
    Tracks payouts to couriers.

    Aggregates multiple transactions into a single payout.
    """
    __tablename__ = "courier_payouts"

    id = Column(Integer, primary_key=True, index=True)
    courier_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)

    # Stripe references
    stripe_transfer_id = Column(String(255), unique=True, nullable=True)
    stripe_payout_id = Column(String(255), nullable=True)

    # Amount
    amount_cents = Column(Integer, nullable=False)
    currency = Column(String(3), default="USD")

    # Related transactions
    transaction_ids = Column(JSON, default=list)  # List of transaction IDs

    # Status
    status = Column(String(50), default=PayoutStatus.PENDING.value)
    error_message = Column(Text, nullable=True)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    courier = relationship("User", backref="payouts")

    def __repr__(self):
        return f"<CourierPayout {self.id} - ${self.amount_cents/100:.2f}>"

    @property
    def amount_dollars(self) -> float:
        """Get amount in dollars."""
        return self.amount_cents / 100
