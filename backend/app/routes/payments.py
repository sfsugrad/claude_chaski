"""
Payment API endpoints.

Handles payment methods, transactions, and Stripe webhooks.
"""
import stripe
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User
from app.models.package import Package, PackageStatus
from app.models.payment import Transaction, TransactionStatus, PaymentMethod
from app.models.notification import NotificationType
from app.utils.dependencies import get_current_user
from app.services.stripe_service import get_stripe_service
from app.routes.notifications import create_notification_with_broadcast


router = APIRouter()


# ==================== Request/Response Models ====================

class SetupIntentResponse(BaseModel):
    client_secret: str
    setup_intent_id: str


class PaymentMethodCreate(BaseModel):
    payment_method_id: str
    set_as_default: bool = True


class PaymentMethodResponse(BaseModel):
    id: int
    stripe_payment_method_id: str
    card_brand: Optional[str]
    card_last_four: Optional[str]
    card_exp_month: Optional[int]
    card_exp_year: Optional[int]
    is_default: bool
    created_at: datetime

    class Config:
        from_attributes = True


class TransactionResponse(BaseModel):
    id: int
    package_id: int
    sender_id: int
    courier_id: Optional[int]
    amount_cents: int
    platform_fee_cents: int
    courier_payout_cents: int
    currency: str
    status: str
    refund_amount_cents: int
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class ChargeRequest(BaseModel):
    payment_method_id: Optional[str] = None


class RefundRequest(BaseModel):
    amount_cents: Optional[int] = None
    reason: str = ""


# ==================== Payment Methods ====================

@router.post("/setup-intent", response_model=SetupIntentResponse)
async def create_setup_intent(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a SetupIntent for saving a payment method.

    Returns client_secret for Stripe Elements on frontend.
    """
    stripe_service = get_stripe_service()

    try:
        result = await stripe_service.create_setup_intent(db, current_user)
        return SetupIntentResponse(**result)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/methods", response_model=PaymentMethodResponse)
async def add_payment_method(
    data: PaymentMethodCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Save a payment method after SetupIntent succeeds.

    Called from frontend after Stripe Elements completes.
    """
    stripe_service = get_stripe_service()

    try:
        payment_method = await stripe_service.save_payment_method(
            db=db,
            user=current_user,
            payment_method_id=data.payment_method_id,
            set_as_default=data.set_as_default
        )
        return payment_method
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/methods", response_model=List[PaymentMethodResponse])
async def list_payment_methods(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's saved payment methods."""
    stripe_service = get_stripe_service()
    return await stripe_service.list_payment_methods(db, current_user)


@router.delete("/methods/{method_id}")
async def delete_payment_method(
    method_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a saved payment method."""
    stripe_service = get_stripe_service()

    success = await stripe_service.delete_payment_method(db, current_user, method_id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found"
        )

    return {"message": "Payment method deleted"}


@router.put("/methods/{method_id}/default")
async def set_default_payment_method(
    method_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Set a payment method as default."""
    # Get the payment method
    pm = db.query(PaymentMethod).filter(
        PaymentMethod.id == method_id,
        PaymentMethod.user_id == current_user.id
    ).first()

    if not pm:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payment method not found"
        )

    # Clear other defaults
    db.query(PaymentMethod).filter(
        PaymentMethod.user_id == current_user.id,
        PaymentMethod.id != method_id
    ).update({"is_default": False})

    pm.is_default = True
    db.commit()

    # Update in Stripe
    if current_user.stripe_customer_id:
        try:
            stripe.Customer.modify(
                current_user.stripe_customer_id,
                invoice_settings={"default_payment_method": pm.stripe_payment_method_id}
            )
        except stripe.error.StripeError:
            pass  # Non-critical

    return {"message": "Default payment method updated"}


# ==================== Transactions ====================

@router.post("/charge/{package_id}", response_model=TransactionResponse)
async def charge_for_delivery(
    package_id: int,
    data: ChargeRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Charge sender for package delivery.

    Called after delivery proof is submitted.
    """
    # Get package
    package = db.query(Package).filter(
        Package.id == package_id,
        Package.sender_id == current_user.id
    ).first()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )

    # Check if already charged
    existing = db.query(Transaction).filter(
        Transaction.package_id == package_id,
        Transaction.status.in_([
            TransactionStatus.SUCCEEDED.value,
            TransactionStatus.PROCESSING.value
        ])
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment already processed for this package"
        )

    stripe_service = get_stripe_service()

    try:
        transaction = await stripe_service.create_payment_intent(
            db=db,
            package=package,
            sender=current_user
        )

        # If payment requires confirmation with specific method
        if (transaction.status == TransactionStatus.REQUIRES_PAYMENT.value and
            data.payment_method_id):
            transaction = await stripe_service.confirm_payment(
                db=db,
                transaction_id=transaction.id,
                payment_method_id=data.payment_method_id
            )

        # If payment succeeded, notify courier
        if transaction.status == TransactionStatus.SUCCEEDED.value:
            await create_notification_with_broadcast(
                db=db,
                user_id=package.courier_id,
                notification_type=NotificationType.PAYMENT_RECEIVED,
                message=f"Payment of ${transaction.amount_cents/100:.2f} received for delivery",
                package_id=package_id
            )

        return transaction

    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List user's transactions (as sender or courier)."""
    from sqlalchemy import or_

    transactions = db.query(Transaction).filter(
        or_(
            Transaction.sender_id == current_user.id,
            Transaction.courier_id == current_user.id
        )
    ).order_by(
        Transaction.created_at.desc()
    ).offset(skip).limit(limit).all()

    return transactions


@router.get("/transactions/{transaction_id}", response_model=TransactionResponse)
async def get_transaction(
    transaction_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get transaction details."""
    from sqlalchemy import or_

    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        or_(
            Transaction.sender_id == current_user.id,
            Transaction.courier_id == current_user.id
        )
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found"
        )

    return transaction


@router.post("/transactions/{transaction_id}/refund", response_model=TransactionResponse)
async def refund_transaction(
    transaction_id: int,
    data: RefundRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Request a refund for a transaction.

    Only sender can request refund.
    """
    transaction = db.query(Transaction).filter(
        Transaction.id == transaction_id,
        Transaction.sender_id == current_user.id,
        Transaction.status == TransactionStatus.SUCCEEDED.value
    ).first()

    if not transaction:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transaction not found or not eligible for refund"
        )

    stripe_service = get_stripe_service()

    try:
        transaction = await stripe_service.refund_payment(
            db=db,
            transaction=transaction,
            amount_cents=data.amount_cents,
            reason=data.reason
        )
        return transaction
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ==================== Stripe Webhooks ====================

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    stripe_signature: str = Header(None, alias="stripe-signature"),
    db: Session = Depends(get_db)
):
    """
    Handle Stripe webhook events.

    Processes payment_intent and account events.
    """
    if not stripe_signature:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing Stripe signature"
        )

    payload = await request.body()

    try:
        event = stripe.Webhook.construct_event(
            payload,
            stripe_signature,
            settings.STRIPE_WEBHOOK_SECRET
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

    # Handle event types
    if event.type == "payment_intent.succeeded":
        await _handle_payment_succeeded(db, event.data.object)
    elif event.type == "payment_intent.payment_failed":
        await _handle_payment_failed(db, event.data.object)
    elif event.type == "account.updated":
        await _handle_account_updated(db, event.data.object)

    return {"status": "received"}


async def _handle_payment_succeeded(db: Session, payment_intent):
    """Handle successful payment."""
    transaction = db.query(Transaction).filter(
        Transaction.stripe_payment_intent_id == payment_intent.id
    ).first()

    if transaction:
        transaction.status = TransactionStatus.SUCCEEDED.value
        transaction.completed_at = datetime.utcnow()
        transaction.stripe_charge_id = payment_intent.latest_charge
        db.commit()

        # Notify courier
        if transaction.courier_id:
            await create_notification_with_broadcast(
                db=db,
                user_id=transaction.courier_id,
                notification_type=NotificationType.PAYMENT_RECEIVED,
                message=f"Payment of ${transaction.amount_cents/100:.2f} received",
                package_id=transaction.package_id
            )


async def _handle_payment_failed(db: Session, payment_intent):
    """Handle failed payment."""
    transaction = db.query(Transaction).filter(
        Transaction.stripe_payment_intent_id == payment_intent.id
    ).first()

    if transaction:
        transaction.status = TransactionStatus.FAILED.value
        transaction.error_message = payment_intent.last_payment_error.message if payment_intent.last_payment_error else "Payment failed"
        db.commit()

        # Notify sender
        await create_notification_with_broadcast(
            db=db,
            user_id=transaction.sender_id,
            notification_type=NotificationType.PAYMENT_FAILED,
            message="Payment failed. Please update your payment method.",
            package_id=transaction.package_id
        )


async def _handle_account_updated(db: Session, account):
    """Handle Connect account updates."""
    from app.models.payment import StripeConnectAccount

    connect_account = db.query(StripeConnectAccount).filter(
        StripeConnectAccount.stripe_account_id == account.id
    ).first()

    if connect_account:
        connect_account.details_submitted = account.details_submitted
        connect_account.charges_enabled = account.charges_enabled
        connect_account.payouts_enabled = account.payouts_enabled
        connect_account.onboarding_complete = (
            account.details_submitted and
            account.charges_enabled and
            account.payouts_enabled
        )
        db.commit()
