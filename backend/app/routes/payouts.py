"""
Payout API endpoints for couriers.

Handles Stripe Connect accounts and courier payouts.
"""
import stripe
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.config import settings
from app.models.user import User, UserRole
from app.models.payment import (
    Transaction, TransactionStatus,
    StripeConnectAccount,
    CourierPayout, PayoutStatus
)
from app.utils.dependencies import get_current_user
from app.services.stripe_service import get_stripe_service


router = APIRouter()


# ==================== Request/Response Models ====================

class ConnectAccountResponse(BaseModel):
    id: int
    stripe_account_id: str
    onboarding_complete: bool
    details_submitted: bool
    charges_enabled: bool
    payouts_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True


class OnboardingLinkRequest(BaseModel):
    return_url: str
    refresh_url: str


class OnboardingLinkResponse(BaseModel):
    url: str


class BalanceResponse(BaseModel):
    pending_cents: int
    available_cents: int
    pending_dollars: float
    available_dollars: float


class PayoutResponse(BaseModel):
    id: int
    courier_id: int
    amount_cents: int
    currency: str
    status: str
    transaction_ids: list
    created_at: datetime
    completed_at: Optional[datetime]

    class Config:
        from_attributes = True


class PayoutRequest(BaseModel):
    transaction_ids: Optional[List[int]] = None  # If None, payout all pending


class EarningsSummary(BaseModel):
    total_earnings_cents: int
    total_deliveries: int
    pending_payout_cents: int
    last_payout_at: Optional[datetime]


# ==================== Helper Functions ====================

def _require_courier_role(user: User):
    """Ensure user has courier capabilities."""
    if user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Courier role required"
        )


# ==================== Connect Account ====================

@router.post("/connect-account", response_model=ConnectAccountResponse)
async def create_connect_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a Stripe Connect Express account for courier.

    Required before courier can receive payouts.
    """
    _require_courier_role(current_user)

    stripe_service = get_stripe_service()

    try:
        account = await stripe_service.create_connect_account(db, current_user)
        return account
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/connect-account", response_model=Optional[ConnectAccountResponse])
async def get_connect_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get courier's Stripe Connect account status."""
    _require_courier_role(current_user)

    account = db.query(StripeConnectAccount).filter(
        StripeConnectAccount.courier_id == current_user.id
    ).first()

    return account


@router.post("/connect-account/refresh", response_model=Optional[ConnectAccountResponse])
async def refresh_connect_account(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Refresh Connect account status from Stripe."""
    _require_courier_role(current_user)

    stripe_service = get_stripe_service()

    account = await stripe_service.refresh_connect_account_status(db, current_user)

    if not account:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Connect account not found"
        )

    return account


@router.post("/connect-onboarding", response_model=OnboardingLinkResponse)
async def get_onboarding_link(
    data: OnboardingLinkRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get Stripe Connect onboarding link.

    Courier will be redirected to Stripe to complete account setup.
    """
    _require_courier_role(current_user)

    stripe_service = get_stripe_service()

    try:
        url = await stripe_service.get_connect_onboarding_link(
            db=db,
            courier=current_user,
            return_url=data.return_url,
            refresh_url=data.refresh_url
        )
        return OnboardingLinkResponse(url=url)
    except stripe.error.StripeError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/connect-dashboard")
async def get_dashboard_link(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get Stripe Express dashboard link.

    Allows courier to manage their payout settings.
    """
    _require_courier_role(current_user)

    stripe_service = get_stripe_service()

    url = await stripe_service.get_connect_dashboard_link(db, current_user)

    if not url:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account not ready. Complete onboarding first."
        )

    return {"url": url}


# ==================== Balance & Earnings ====================

@router.get("/balance", response_model=BalanceResponse)
async def get_balance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get courier's pending and available balance."""
    _require_courier_role(current_user)

    stripe_service = get_stripe_service()

    balance = await stripe_service.get_courier_balance(db, current_user)

    return BalanceResponse(
        pending_cents=balance["pending_cents"],
        available_cents=balance["available_cents"],
        pending_dollars=balance["pending_cents"] / 100,
        available_dollars=balance["available_cents"] / 100
    )


@router.get("/earnings", response_model=EarningsSummary)
async def get_earnings_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get courier's earnings summary."""
    _require_courier_role(current_user)

    from sqlalchemy import func

    # Total earnings from completed transactions
    total = db.query(
        func.coalesce(func.sum(Transaction.courier_payout_cents), 0),
        func.count(Transaction.id)
    ).filter(
        Transaction.courier_id == current_user.id,
        Transaction.status == TransactionStatus.SUCCEEDED.value
    ).first()

    total_earnings_cents = total[0] or 0
    total_deliveries = total[1] or 0

    # Pending payout (not yet transferred)
    pending = db.query(
        func.coalesce(func.sum(Transaction.courier_payout_cents), 0)
    ).filter(
        Transaction.courier_id == current_user.id,
        Transaction.status == TransactionStatus.SUCCEEDED.value,
        Transaction.stripe_transfer_id == None
    ).scalar() or 0

    # Last payout
    last_payout = db.query(CourierPayout).filter(
        CourierPayout.courier_id == current_user.id,
        CourierPayout.status == PayoutStatus.SUCCEEDED.value
    ).order_by(CourierPayout.completed_at.desc()).first()

    return EarningsSummary(
        total_earnings_cents=total_earnings_cents,
        total_deliveries=total_deliveries,
        pending_payout_cents=pending,
        last_payout_at=last_payout.completed_at if last_payout else None
    )


# ==================== Payouts ====================

@router.post("/request", response_model=PayoutResponse)
async def request_payout(
    data: PayoutRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Request payout of earnings.

    Transfers funds to courier's connected bank account.
    """
    _require_courier_role(current_user)

    # Check if account is ready
    account = db.query(StripeConnectAccount).filter(
        StripeConnectAccount.courier_id == current_user.id
    ).first()

    if not account or not account.is_ready_for_payouts:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Please complete account setup before requesting payout"
        )

    # Get transaction IDs
    if data.transaction_ids:
        transaction_ids = data.transaction_ids
    else:
        # Get all pending transactions
        transactions = db.query(Transaction).filter(
            Transaction.courier_id == current_user.id,
            Transaction.status == TransactionStatus.SUCCEEDED.value,
            Transaction.stripe_transfer_id == None
        ).all()
        transaction_ids = [t.id for t in transactions]

    if not transaction_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No pending earnings to pay out"
        )

    stripe_service = get_stripe_service()

    try:
        payout = await stripe_service.create_courier_payout(
            db=db,
            courier=current_user,
            transaction_ids=transaction_ids
        )
        return payout
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


@router.get("/history", response_model=List[PayoutResponse])
async def get_payout_history(
    skip: int = 0,
    limit: int = 20,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get courier's payout history."""
    _require_courier_role(current_user)

    payouts = db.query(CourierPayout).filter(
        CourierPayout.courier_id == current_user.id
    ).order_by(
        CourierPayout.created_at.desc()
    ).offset(skip).limit(limit).all()

    return payouts


@router.get("/history/{payout_id}", response_model=PayoutResponse)
async def get_payout(
    payout_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get payout details."""
    _require_courier_role(current_user)

    payout = db.query(CourierPayout).filter(
        CourierPayout.id == payout_id,
        CourierPayout.courier_id == current_user.id
    ).first()

    if not payout:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Payout not found"
        )

    return payout
