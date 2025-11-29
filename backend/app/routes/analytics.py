"""
Analytics API endpoints for platform metrics and dashboard data.
"""
from datetime import datetime, date, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from sqlalchemy import func, and_

from app.database import get_db
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.payment import Transaction, TransactionStatus
from app.models.rating import Rating
from app.models.analytics import (
    DailyMetrics,
    CourierPerformance,
    GeographicMetrics,
    HourlyActivity,
)
from app.utils.dependencies import get_current_user, get_current_admin_user

router = APIRouter()


# Pydantic response models
class PlatformOverview(BaseModel):
    """Overview statistics for the platform."""
    total_users: int
    total_senders: int
    total_couriers: int
    total_packages: int
    packages_delivered: int
    packages_in_transit: int
    total_revenue_cents: int
    platform_fees_cents: int
    average_rating: Optional[float]


class DailyMetricsResponse(BaseModel):
    """Daily metrics response."""
    date: str
    packages_created: int
    packages_matched: int
    packages_delivered: int
    packages_cancelled: int
    new_users: int
    active_senders: int
    active_couriers: int
    total_transaction_amount: int
    total_platform_fees: int
    average_delivery_time_minutes: Optional[float]
    average_rating: Optional[float]
    successful_delivery_rate: Optional[float]

    class Config:
        from_attributes = True


class CourierPerformanceResponse(BaseModel):
    """Courier performance response."""
    courier_id: int
    courier_name: Optional[str]
    total_deliveries: int
    successful_deliveries: int
    on_time_deliveries: int
    average_delivery_time: Optional[float]
    average_rating: Optional[float]
    total_earnings: int
    earnings_this_month: int
    current_streak: int
    last_delivery_at: Optional[str]

    class Config:
        from_attributes = True


class TimeSeriesPoint(BaseModel):
    """Single point in a time series."""
    date: str
    value: float


class RevenueBreakdown(BaseModel):
    """Revenue breakdown by category."""
    total_cents: int
    platform_fees_cents: int
    courier_payouts_cents: int
    refunds_cents: int
    net_revenue_cents: int


class TopCourier(BaseModel):
    """Top performing courier."""
    courier_id: int
    name: str
    deliveries: int
    rating: Optional[float]
    earnings_cents: int


class HourlyActivityResponse(BaseModel):
    """Hourly activity pattern."""
    hour: int
    packages_created: int
    packages_delivered: int
    active_couriers: int


class MonthlyPackageCount(BaseModel):
    """Monthly package count for trend data."""
    month: str
    count: int


class SenderStatsResponse(BaseModel):
    """Sender-specific analytics response."""
    total_packages: int
    packages_this_month: int
    status_breakdown: dict[str, int]
    delivery_rate: float
    total_spent: float
    average_delivery_time_hours: Optional[float]
    packages_by_month: List[MonthlyPackageCount]


# Admin endpoints
@router.get("/overview", response_model=PlatformOverview)
async def get_platform_overview(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get platform overview statistics.
    Admin only.
    """
    # User counts
    total_users = db.query(User).filter(User.is_active == True).count()
    total_senders = db.query(User).filter(
        User.is_active == True,
        User.role.in_([UserRole.SENDER, UserRole.BOTH])
    ).count()
    total_couriers = db.query(User).filter(
        User.is_active == True,
        User.role.in_([UserRole.COURIER, UserRole.BOTH])
    ).count()

    # Package counts
    total_packages = db.query(Package).filter(Package.is_deleted == False).count()
    packages_delivered = db.query(Package).filter(
        Package.is_deleted == False,
        Package.status == PackageStatus.DELIVERED
    ).count()
    packages_in_transit = db.query(Package).filter(
        Package.is_deleted == False,
        Package.status.in_([PackageStatus.PICKED_UP, PackageStatus.IN_TRANSIT])
    ).count()

    # Revenue
    revenue_data = db.query(
        func.coalesce(func.sum(Transaction.amount_cents), 0),
        func.coalesce(func.sum(Transaction.platform_fee_cents), 0)
    ).filter(
        Transaction.status == TransactionStatus.SUCCEEDED
    ).first()

    total_revenue_cents = revenue_data[0] or 0
    platform_fees_cents = revenue_data[1] or 0

    # Average rating
    avg_rating = db.query(func.avg(Rating.rating)).scalar()

    return PlatformOverview(
        total_users=total_users,
        total_senders=total_senders,
        total_couriers=total_couriers,
        total_packages=total_packages,
        packages_delivered=packages_delivered,
        packages_in_transit=packages_in_transit,
        total_revenue_cents=total_revenue_cents,
        platform_fees_cents=platform_fees_cents,
        average_rating=round(avg_rating, 2) if avg_rating else None
    )


@router.get("/daily-metrics", response_model=List[DailyMetricsResponse])
async def get_daily_metrics(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    days: int = Query(30, ge=1, le=365, description="Number of days if no dates specified"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get daily metrics for the specified date range.
    Admin only.
    """
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d").date()
    else:
        end = date.today()

    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d").date()
    else:
        start = end - timedelta(days=days - 1)

    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.date >= start,
        DailyMetrics.date <= end
    ).order_by(DailyMetrics.date.desc()).all()

    return [
        DailyMetricsResponse(
            date=m.date.isoformat(),
            packages_created=m.packages_created,
            packages_matched=m.packages_matched,
            packages_delivered=m.packages_delivered,
            packages_cancelled=m.packages_cancelled,
            new_users=m.new_users,
            active_senders=m.active_senders,
            active_couriers=m.active_couriers,
            total_transaction_amount=m.total_transaction_amount,
            total_platform_fees=m.total_platform_fees,
            average_delivery_time_minutes=m.average_delivery_time_minutes,
            average_rating=m.average_rating,
            successful_delivery_rate=m.successful_delivery_rate
        )
        for m in metrics
    ]


@router.get("/revenue", response_model=RevenueBreakdown)
async def get_revenue_breakdown(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get revenue breakdown for the specified period.
    Admin only.
    """
    query = db.query(
        func.coalesce(func.sum(Transaction.amount_cents), 0),
        func.coalesce(func.sum(Transaction.platform_fee_cents), 0),
        func.coalesce(func.sum(Transaction.courier_payout_cents), 0),
        func.coalesce(func.sum(Transaction.refund_amount_cents), 0)
    ).filter(Transaction.status == TransactionStatus.SUCCEEDED)

    if start_date:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        query = query.filter(Transaction.created_at >= start)
    if end_date:
        end = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
        query = query.filter(Transaction.created_at < end)

    result = query.first()

    total = result[0] or 0
    platform_fees = result[1] or 0
    courier_payouts = result[2] or 0
    refunds = result[3] or 0

    return RevenueBreakdown(
        total_cents=total,
        platform_fees_cents=platform_fees,
        courier_payouts_cents=courier_payouts,
        refunds_cents=refunds,
        net_revenue_cents=platform_fees - refunds
    )


@router.get("/top-couriers", response_model=List[TopCourier])
async def get_top_couriers(
    limit: int = Query(10, ge=1, le=50),
    period_days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get top performing couriers.
    Admin only.
    """
    since = datetime.utcnow() - timedelta(days=period_days)

    # Query courier performance with user info
    results = db.query(
        CourierPerformance,
        User.full_name
    ).join(
        User, CourierPerformance.courier_id == User.id
    ).filter(
        CourierPerformance.last_delivery_at >= since
    ).order_by(
        CourierPerformance.successful_deliveries.desc()
    ).limit(limit).all()

    return [
        TopCourier(
            courier_id=perf.courier_id,
            name=name,
            deliveries=perf.successful_deliveries,
            rating=perf.average_rating,
            earnings_cents=perf.total_earnings
        )
        for perf, name in results
    ]


@router.get("/hourly-activity", response_model=List[HourlyActivityResponse])
async def get_hourly_activity(
    date_str: Optional[str] = Query(None, description="Date (YYYY-MM-DD)"),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get hourly activity pattern for a specific date.
    Admin only.
    """
    if date_str:
        target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    else:
        target_date = date.today()

    activity = db.query(HourlyActivity).filter(
        HourlyActivity.date == target_date
    ).order_by(HourlyActivity.hour).all()

    # Fill in missing hours with zeros
    activity_map = {a.hour: a for a in activity}
    result = []
    for hour in range(24):
        if hour in activity_map:
            a = activity_map[hour]
            result.append(HourlyActivityResponse(
                hour=hour,
                packages_created=a.packages_created,
                packages_delivered=a.packages_delivered,
                active_couriers=a.active_couriers
            ))
        else:
            result.append(HourlyActivityResponse(
                hour=hour,
                packages_created=0,
                packages_delivered=0,
                active_couriers=0
            ))

    return result


# Courier-specific endpoints
@router.get("/my-performance", response_model=CourierPerformanceResponse)
async def get_my_performance(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get performance metrics for the current courier.
    """
    if current_user.role not in [UserRole.COURIER, UserRole.BOTH]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only couriers can access performance metrics"
        )

    perf = db.query(CourierPerformance).filter(
        CourierPerformance.courier_id == current_user.id
    ).first()

    if not perf:
        # Return empty metrics if none exist yet
        return CourierPerformanceResponse(
            courier_id=current_user.id,
            courier_name=current_user.full_name,
            total_deliveries=0,
            successful_deliveries=0,
            on_time_deliveries=0,
            average_delivery_time=None,
            average_rating=None,
            total_earnings=0,
            earnings_this_month=0,
            current_streak=0,
            last_delivery_at=None
        )

    return CourierPerformanceResponse(
        courier_id=perf.courier_id,
        courier_name=current_user.full_name,
        total_deliveries=perf.total_deliveries,
        successful_deliveries=perf.successful_deliveries,
        on_time_deliveries=perf.on_time_deliveries,
        average_delivery_time=perf.average_delivery_time,
        average_rating=perf.average_rating,
        total_earnings=perf.total_earnings,
        earnings_this_month=perf.earnings_this_month,
        current_streak=perf.current_streak,
        last_delivery_at=perf.last_delivery_at.isoformat() if perf.last_delivery_at else None
    )


@router.get("/courier-leaderboard", response_model=List[CourierPerformanceResponse])
async def get_courier_leaderboard(
    metric: str = Query("deliveries", description="Metric to rank by (deliveries, rating, earnings)"),
    limit: int = Query(10, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get courier leaderboard.
    Available to all authenticated users.
    """
    # Determine sort order
    if metric == "rating":
        order_by = CourierPerformance.average_rating.desc().nullslast()
    elif metric == "earnings":
        order_by = CourierPerformance.total_earnings.desc()
    else:
        order_by = CourierPerformance.successful_deliveries.desc()

    results = db.query(
        CourierPerformance,
        User.full_name
    ).join(
        User, CourierPerformance.courier_id == User.id
    ).filter(
        CourierPerformance.total_deliveries > 0
    ).order_by(order_by).limit(limit).all()

    return [
        CourierPerformanceResponse(
            courier_id=perf.courier_id,
            courier_name=name,
            total_deliveries=perf.total_deliveries,
            successful_deliveries=perf.successful_deliveries,
            on_time_deliveries=perf.on_time_deliveries,
            average_delivery_time=perf.average_delivery_time,
            average_rating=perf.average_rating,
            total_earnings=0,  # Hide earnings from public view
            earnings_this_month=0,
            current_streak=perf.current_streak,
            last_delivery_at=perf.last_delivery_at.isoformat() if perf.last_delivery_at else None
        )
        for perf, name in results
    ]


@router.get("/packages-trend", response_model=List[TimeSeriesPoint])
async def get_packages_trend(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get package creation trend over time.
    Admin only.
    """
    end = date.today()
    start = end - timedelta(days=days - 1)

    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.date >= start,
        DailyMetrics.date <= end
    ).order_by(DailyMetrics.date).all()

    return [
        TimeSeriesPoint(
            date=m.date.isoformat(),
            value=m.packages_created
        )
        for m in metrics
    ]


@router.get("/revenue-trend", response_model=List[TimeSeriesPoint])
async def get_revenue_trend(
    days: int = Query(30, ge=7, le=365),
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get revenue trend over time.
    Admin only.
    """
    end = date.today()
    start = end - timedelta(days=days - 1)

    metrics = db.query(DailyMetrics).filter(
        DailyMetrics.date >= start,
        DailyMetrics.date <= end
    ).order_by(DailyMetrics.date).all()

    return [
        TimeSeriesPoint(
            date=m.date.isoformat(),
            value=m.total_platform_fees / 100  # Convert to dollars
        )
        for m in metrics
    ]


# Sender-specific endpoints
@router.get("/sender-stats", response_model=SenderStatsResponse)
async def get_sender_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get analytics for the current sender's packages.
    Available to senders and users with both role.
    """
    if current_user.role not in [UserRole.SENDER, UserRole.BOTH, UserRole.ADMIN]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only senders can access sender analytics"
        )

    # Get all packages for this sender
    sender_packages = db.query(Package).filter(
        Package.sender_id == current_user.id,
        Package.is_active == True
    )

    # Total packages
    total_packages = sender_packages.count()

    # Packages this month
    first_of_month = date.today().replace(day=1)
    packages_this_month = sender_packages.filter(
        Package.created_at >= first_of_month
    ).count()

    # Status breakdown
    status_counts = db.query(
        Package.status,
        func.count(Package.id)
    ).filter(
        Package.sender_id == current_user.id,
        Package.is_active == True
    ).group_by(Package.status).all()

    status_breakdown = {status.value: count for status, count in status_counts}

    # Delivery rate (delivered / total)
    delivered_count = status_breakdown.get(PackageStatus.DELIVERED.value, 0)
    delivery_rate = (delivered_count / total_packages * 100) if total_packages > 0 else 0

    # Total spent (sum of prices for delivered packages)
    total_spent_result = db.query(
        func.coalesce(func.sum(Package.price), 0)
    ).filter(
        Package.sender_id == current_user.id,
        Package.is_active == True,
        Package.status == PackageStatus.DELIVERED
    ).scalar()
    total_spent = float(total_spent_result or 0)

    # Average delivery time (for delivered packages with timestamps)
    avg_delivery_time = None
    delivered_with_times = db.query(Package).filter(
        Package.sender_id == current_user.id,
        Package.is_active == True,
        Package.status == PackageStatus.DELIVERED,
        Package.created_at.isnot(None),
        Package.delivery_time.isnot(None)
    ).all()

    if delivered_with_times:
        total_hours = 0
        count = 0
        for pkg in delivered_with_times:
            if pkg.delivery_time and pkg.created_at:
                diff = pkg.delivery_time - pkg.created_at
                total_hours += diff.total_seconds() / 3600
                count += 1
        if count > 0:
            avg_delivery_time = round(total_hours / count, 1)

    # Packages by month (last 6 months)
    six_months_ago = date.today() - timedelta(days=180)
    monthly_data = db.query(
        func.date_trunc('month', Package.created_at).label('month'),
        func.count(Package.id).label('count')
    ).filter(
        Package.sender_id == current_user.id,
        Package.is_active == True,
        Package.created_at >= six_months_ago
    ).group_by(
        func.date_trunc('month', Package.created_at)
    ).order_by('month').all()

    packages_by_month = [
        MonthlyPackageCount(
            month=m.strftime('%b %Y') if m else 'Unknown',
            count=c
        )
        for m, c in monthly_data
    ]

    return SenderStatsResponse(
        total_packages=total_packages,
        packages_this_month=packages_this_month,
        status_breakdown=status_breakdown,
        delivery_rate=round(delivery_rate, 1),
        total_spent=total_spent,
        average_delivery_time_hours=avg_delivery_time,
        packages_by_month=packages_by_month
    )
