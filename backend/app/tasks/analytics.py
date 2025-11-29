"""
Analytics background tasks for aggregating metrics.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from celery import shared_task
from sqlalchemy import func, and_, distinct

from app.database import SessionLocal
from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.models.rating import Rating
from app.models.payment import Transaction, TransactionStatus
from app.models.analytics import DailyMetrics, CourierPerformance, HourlyActivity
from app.models.tracking import LocationUpdate, TrackingSession


@shared_task(name="app.tasks.analytics.aggregate_daily_metrics")
def aggregate_daily_metrics(target_date: Optional[str] = None):
    """
    Aggregate daily metrics for the analytics dashboard.
    Saves results to DailyMetrics table.

    Args:
        target_date: Date string (YYYY-MM-DD) to aggregate. Defaults to yesterday.
    """
    db = SessionLocal()
    try:
        if target_date:
            metric_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        else:
            metric_date = date.today() - timedelta(days=1)

        start_of_day = datetime.combine(metric_date, datetime.min.time())
        end_of_day = datetime.combine(metric_date, datetime.max.time())

        # Package metrics
        packages_created = db.query(func.count(Package.id)).filter(
            and_(
                Package.created_at >= start_of_day,
                Package.created_at <= end_of_day
            )
        ).scalar() or 0

        packages_matched = db.query(func.count(Package.id)).filter(
            and_(
                Package.status == PackageStatus.MATCHED,
                Package.updated_at >= start_of_day,
                Package.updated_at <= end_of_day
            )
        ).scalar() or 0

        packages_delivered = db.query(func.count(Package.id)).filter(
            and_(
                Package.status == PackageStatus.DELIVERED,
                Package.updated_at >= start_of_day,
                Package.updated_at <= end_of_day
            )
        ).scalar() or 0

        packages_cancelled = db.query(func.count(Package.id)).filter(
            and_(
                Package.status == PackageStatus.CANCELLED,
                Package.updated_at >= start_of_day,
                Package.updated_at <= end_of_day
            )
        ).scalar() or 0

        # User metrics
        new_users = db.query(func.count(User.id)).filter(
            and_(
                User.created_at >= start_of_day,
                User.created_at <= end_of_day
            )
        ).scalar() or 0

        active_senders = db.query(func.count(distinct(Package.sender_id))).filter(
            and_(
                Package.created_at >= start_of_day,
                Package.created_at <= end_of_day
            )
        ).scalar() or 0

        active_couriers = db.query(func.count(distinct(Package.courier_id))).filter(
            and_(
                Package.courier_id.isnot(None),
                Package.updated_at >= start_of_day,
                Package.updated_at <= end_of_day
            )
        ).scalar() or 0

        # Revenue metrics from transactions
        transaction_data = db.query(
            func.coalesce(func.sum(Transaction.amount_cents), 0),
            func.coalesce(func.sum(Transaction.platform_fee_cents), 0),
            func.coalesce(func.sum(Transaction.courier_payout_cents), 0),
            func.coalesce(func.sum(Transaction.refund_amount_cents), 0)
        ).filter(
            and_(
                Transaction.status == TransactionStatus.SUCCEEDED,
                Transaction.completed_at >= start_of_day,
                Transaction.completed_at <= end_of_day
            )
        ).first()

        total_transaction_amount = transaction_data[0] or 0
        total_platform_fees = transaction_data[1] or 0
        total_courier_payouts = transaction_data[2] or 0
        total_refunds = transaction_data[3] or 0

        # Average rating for the day
        avg_rating = db.query(func.avg(Rating.rating)).filter(
            and_(
                Rating.created_at >= start_of_day,
                Rating.created_at <= end_of_day
            )
        ).scalar()

        # Successful delivery rate
        total_completed = packages_delivered + packages_cancelled
        successful_delivery_rate = (
            packages_delivered / total_completed if total_completed > 0 else None
        )

        # Check for existing record and update or create
        existing = db.query(DailyMetrics).filter(
            DailyMetrics.date == metric_date
        ).first()

        if existing:
            # Update existing record
            existing.packages_created = packages_created
            existing.packages_matched = packages_matched
            existing.packages_delivered = packages_delivered
            existing.packages_cancelled = packages_cancelled
            existing.new_users = new_users
            existing.active_senders = active_senders
            existing.active_couriers = active_couriers
            existing.total_transaction_amount = total_transaction_amount
            existing.total_platform_fees = total_platform_fees
            existing.total_courier_payouts = total_courier_payouts
            existing.total_refunds = total_refunds
            existing.average_rating = float(avg_rating) if avg_rating else None
            existing.successful_delivery_rate = successful_delivery_rate
        else:
            # Create new record
            metrics = DailyMetrics(
                date=metric_date,
                packages_created=packages_created,
                packages_matched=packages_matched,
                packages_delivered=packages_delivered,
                packages_cancelled=packages_cancelled,
                new_users=new_users,
                active_senders=active_senders,
                active_couriers=active_couriers,
                total_transaction_amount=total_transaction_amount,
                total_platform_fees=total_platform_fees,
                total_courier_payouts=total_courier_payouts,
                total_refunds=total_refunds,
                average_rating=float(avg_rating) if avg_rating else None,
                successful_delivery_rate=successful_delivery_rate
            )
            db.add(metrics)

        db.commit()

        return {
            "date": metric_date.isoformat(),
            "packages_created": packages_created,
            "packages_delivered": packages_delivered,
            "packages_cancelled": packages_cancelled,
            "new_users": new_users,
            "total_platform_fees_cents": total_platform_fees,
            "avg_rating": float(avg_rating) if avg_rating else None,
            "successful_delivery_rate": successful_delivery_rate
        }

    finally:
        db.close()


@shared_task(name="app.tasks.analytics.calculate_courier_performance_batch")
def calculate_courier_performance_batch(period_days: int = 30):
    """
    Calculate performance metrics for all active couriers.

    Args:
        period_days: Number of days to analyze
    """
    db = SessionLocal()
    try:
        end_date = date.today()
        start_date = end_date - timedelta(days=period_days)

        # Get all couriers
        couriers = db.query(User).filter(
            User.role.in_([UserRole.COURIER, UserRole.BOTH])
        ).all()

        results = []
        for courier in couriers:
            performance = calculate_courier_performance(
                courier.id,
                start_date.isoformat(),
                end_date.isoformat()
            )
            results.append(performance)

        return {
            "period_start": start_date.isoformat(),
            "period_end": end_date.isoformat(),
            "couriers_processed": len(results)
        }

    finally:
        db.close()


@shared_task(name="app.tasks.analytics.calculate_courier_performance")
def calculate_courier_performance(
    courier_id: int,
    start_date: str,
    end_date: str
):
    """
    Calculate performance metrics for a single courier.

    Args:
        courier_id: ID of the courier
        start_date: Start date (YYYY-MM-DD)
        end_date: End date (YYYY-MM-DD)
    """
    db = SessionLocal()
    try:
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")

        # Deliveries completed
        deliveries = db.query(func.count(Package.id)).filter(
            and_(
                Package.courier_id == courier_id,
                Package.status == PackageStatus.DELIVERED,
                Package.delivery_time >= start,
                Package.delivery_time <= end
            )
        ).scalar() or 0

        # Total earnings
        earnings = db.query(func.sum(Package.price)).filter(
            and_(
                Package.courier_id == courier_id,
                Package.status == PackageStatus.DELIVERED,
                Package.delivery_time >= start,
                Package.delivery_time <= end
            )
        ).scalar() or 0

        # Average rating
        avg_rating = db.query(func.avg(Rating.score)).filter(
            and_(
                Rating.rated_user_id == courier_id,
                Rating.created_at >= start,
                Rating.created_at <= end
            )
        ).scalar()

        # Total ratings received
        total_ratings = db.query(func.count(Rating.id)).filter(
            and_(
                Rating.rated_user_id == courier_id,
                Rating.created_at >= start,
                Rating.created_at <= end
            )
        ).scalar() or 0

        return {
            "courier_id": courier_id,
            "period_start": start_date,
            "period_end": end_date,
            "deliveries_completed": deliveries,
            "total_earnings_cents": int(earnings * 100) if earnings else 0,
            "avg_rating": float(avg_rating) if avg_rating else None,
            "total_ratings": total_ratings
        }

    finally:
        db.close()


@shared_task(name="app.tasks.analytics.cleanup_old_locations")
def cleanup_old_locations(retention_days: int = 30):
    """
    Clean up old location tracking data.

    Args:
        retention_days: Number of days to retain location data
    """
    db = SessionLocal()
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=retention_days)

        # Delete old location updates from completed sessions
        deleted_locations = db.query(LocationUpdate).filter(
            LocationUpdate.timestamp < cutoff_date
        ).delete(synchronize_session=False)

        # Delete old completed tracking sessions (keep active ones)
        deleted_sessions = db.query(TrackingSession).filter(
            and_(
                TrackingSession.is_active == False,
                TrackingSession.ended_at < cutoff_date
            )
        ).delete(synchronize_session=False)

        db.commit()

        return {
            "status": "completed",
            "cutoff_date": cutoff_date.isoformat(),
            "deleted_locations": deleted_locations,
            "deleted_sessions": deleted_sessions
        }

    finally:
        db.close()


@shared_task(name="app.tasks.analytics.update_courier_performance")
def update_courier_performance(courier_id: int):
    """
    Update performance metrics for a single courier after a delivery.

    Args:
        courier_id: ID of the courier to update
    """
    db = SessionLocal()
    try:
        # Get or create performance record
        perf = db.query(CourierPerformance).filter(
            CourierPerformance.courier_id == courier_id
        ).first()

        if not perf:
            perf = CourierPerformance(courier_id=courier_id)
            db.add(perf)

        # Calculate all-time stats
        delivery_stats = db.query(
            func.count(Package.id),
            func.sum(
                func.case((Package.status == PackageStatus.DELIVERED, 1), else_=0)
            ),
            func.sum(
                func.case((Package.status == PackageStatus.CANCELLED, 1), else_=0)
            )
        ).filter(
            Package.courier_id == courier_id
        ).first()

        perf.total_deliveries = delivery_stats[0] or 0
        perf.successful_deliveries = delivery_stats[1] or 0
        perf.cancelled_deliveries = delivery_stats[2] or 0

        # Rating stats
        rating_stats = db.query(
            func.count(Rating.id),
            func.sum(Rating.rating),
            func.avg(Rating.rating),
            func.sum(func.case((Rating.rating == 5, 1), else_=0)),
            func.sum(func.case((Rating.rating == 1, 1), else_=0))
        ).filter(
            Rating.rated_user_id == courier_id
        ).first()

        perf.total_ratings = rating_stats[0] or 0
        perf.total_rating_sum = rating_stats[1] or 0
        perf.average_rating = float(rating_stats[2]) if rating_stats[2] else None
        perf.five_star_ratings = rating_stats[3] or 0
        perf.one_star_ratings = rating_stats[4] or 0

        # Earnings stats from transactions
        earnings_stats = db.query(
            func.coalesce(func.sum(Transaction.courier_payout_cents), 0)
        ).filter(
            and_(
                Transaction.courier_id == courier_id,
                Transaction.status == TransactionStatus.SUCCEEDED
            )
        ).scalar()

        perf.total_earnings = earnings_stats or 0

        # This month's earnings
        start_of_month = datetime.utcnow().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        month_earnings = db.query(
            func.coalesce(func.sum(Transaction.courier_payout_cents), 0)
        ).filter(
            and_(
                Transaction.courier_id == courier_id,
                Transaction.status == TransactionStatus.SUCCEEDED,
                Transaction.completed_at >= start_of_month
            )
        ).scalar()

        perf.earnings_this_month = month_earnings or 0

        # This week's earnings
        start_of_week = datetime.utcnow() - timedelta(days=datetime.utcnow().weekday())
        start_of_week = start_of_week.replace(hour=0, minute=0, second=0, microsecond=0)
        week_earnings = db.query(
            func.coalesce(func.sum(Transaction.courier_payout_cents), 0)
        ).filter(
            and_(
                Transaction.courier_id == courier_id,
                Transaction.status == TransactionStatus.SUCCEEDED,
                Transaction.completed_at >= start_of_week
            )
        ).scalar()

        perf.earnings_this_week = week_earnings or 0

        # Last delivery time
        last_delivery = db.query(Package.updated_at).filter(
            and_(
                Package.courier_id == courier_id,
                Package.status == PackageStatus.DELIVERED
            )
        ).order_by(Package.updated_at.desc()).first()

        if last_delivery:
            perf.last_delivery_at = last_delivery[0]

        perf.last_active_at = datetime.utcnow()

        db.commit()

        return {
            "courier_id": courier_id,
            "total_deliveries": perf.total_deliveries,
            "average_rating": perf.average_rating,
            "total_earnings_cents": perf.total_earnings
        }

    finally:
        db.close()


@shared_task(name="app.tasks.analytics.aggregate_hourly_activity")
def aggregate_hourly_activity(target_date: Optional[str] = None):
    """
    Aggregate hourly activity patterns for capacity planning.

    Args:
        target_date: Date string (YYYY-MM-DD) to aggregate. Defaults to yesterday.
    """
    db = SessionLocal()
    try:
        if target_date:
            metric_date = datetime.strptime(target_date, "%Y-%m-%d").date()
        else:
            metric_date = date.today() - timedelta(days=1)

        # Delete existing hourly data for this date
        db.query(HourlyActivity).filter(
            HourlyActivity.date == metric_date
        ).delete()

        # Aggregate for each hour
        for hour in range(24):
            start_hour = datetime.combine(metric_date, datetime.min.time()) + timedelta(hours=hour)
            end_hour = start_hour + timedelta(hours=1)

            packages_created = db.query(func.count(Package.id)).filter(
                and_(
                    Package.created_at >= start_hour,
                    Package.created_at < end_hour
                )
            ).scalar() or 0

            packages_delivered = db.query(func.count(Package.id)).filter(
                and_(
                    Package.status == PackageStatus.DELIVERED,
                    Package.updated_at >= start_hour,
                    Package.updated_at < end_hour
                )
            ).scalar() or 0

            active_couriers = db.query(func.count(distinct(Package.courier_id))).filter(
                and_(
                    Package.courier_id.isnot(None),
                    Package.updated_at >= start_hour,
                    Package.updated_at < end_hour
                )
            ).scalar() or 0

            active_sessions = db.query(func.count(TrackingSession.id)).filter(
                and_(
                    TrackingSession.is_active == True,
                    TrackingSession.started_at <= end_hour,
                    func.coalesce(TrackingSession.ended_at, datetime.max) >= start_hour
                )
            ).scalar() or 0

            # Only create record if there's activity
            if packages_created > 0 or packages_delivered > 0 or active_couriers > 0:
                activity = HourlyActivity(
                    date=metric_date,
                    hour=hour,
                    packages_created=packages_created,
                    packages_delivered=packages_delivered,
                    active_couriers=active_couriers,
                    active_tracking_sessions=active_sessions
                )
                db.add(activity)

        db.commit()

        return {
            "date": metric_date.isoformat(),
            "status": "completed"
        }

    finally:
        db.close()
