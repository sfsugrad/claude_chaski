"""
Analytics models for platform metrics, courier performance, and business intelligence.
"""
from datetime import datetime, date
from sqlalchemy import Column, Integer, Float, String, DateTime, Date, ForeignKey, Index, Boolean
from sqlalchemy.orm import relationship
from app.models.base import Base


class DailyMetrics(Base):
    """
    Daily aggregated platform metrics.
    Pre-computed by background jobs for fast dashboard queries.
    """
    __tablename__ = "daily_metrics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, unique=True, nullable=False, index=True)

    # Package metrics
    packages_created = Column(Integer, default=0, nullable=False)
    packages_matched = Column(Integer, default=0, nullable=False)
    packages_delivered = Column(Integer, default=0, nullable=False)
    packages_cancelled = Column(Integer, default=0, nullable=False)

    # User metrics
    new_users = Column(Integer, default=0, nullable=False)
    active_senders = Column(Integer, default=0, nullable=False)
    active_couriers = Column(Integer, default=0, nullable=False)

    # Revenue metrics (in cents)
    total_transaction_amount = Column(Integer, default=0, nullable=False)
    total_platform_fees = Column(Integer, default=0, nullable=False)
    total_courier_payouts = Column(Integer, default=0, nullable=False)
    total_refunds = Column(Integer, default=0, nullable=False)

    # Performance metrics
    average_delivery_time_minutes = Column(Float, nullable=True)  # Pickup to delivery
    average_matching_time_minutes = Column(Float, nullable=True)  # Creation to match
    average_rating = Column(Float, nullable=True)
    successful_delivery_rate = Column(Float, nullable=True)  # delivered / (delivered + cancelled)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, onupdate=datetime.utcnow, nullable=True)


class CourierPerformance(Base):
    """
    Courier performance metrics.
    Updated after each delivery for real-time insights.
    """
    __tablename__ = "courier_performance"

    id = Column(Integer, primary_key=True, index=True)
    courier_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)

    # Delivery stats
    total_deliveries = Column(Integer, default=0, nullable=False)
    successful_deliveries = Column(Integer, default=0, nullable=False)
    cancelled_deliveries = Column(Integer, default=0, nullable=False)
    on_time_deliveries = Column(Integer, default=0, nullable=False)
    late_deliveries = Column(Integer, default=0, nullable=False)

    # Time metrics (in minutes)
    average_delivery_time = Column(Float, nullable=True)
    fastest_delivery_time = Column(Float, nullable=True)
    total_active_time = Column(Float, default=0, nullable=False)  # Total hours active

    # Rating metrics
    total_ratings = Column(Integer, default=0, nullable=False)
    total_rating_sum = Column(Float, default=0, nullable=False)
    average_rating = Column(Float, nullable=True)
    five_star_ratings = Column(Integer, default=0, nullable=False)
    one_star_ratings = Column(Integer, default=0, nullable=False)

    # Earnings (in cents)
    total_earnings = Column(Integer, default=0, nullable=False)
    earnings_this_month = Column(Integer, default=0, nullable=False)
    earnings_this_week = Column(Integer, default=0, nullable=False)

    # Activity metrics
    total_distance_km = Column(Float, default=0, nullable=False)
    packages_per_hour = Column(Float, nullable=True)
    current_streak = Column(Integer, default=0, nullable=False)  # Consecutive successful deliveries

    # Last activity
    last_delivery_at = Column(DateTime, nullable=True)
    last_active_at = Column(DateTime, nullable=True)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, onupdate=datetime.utcnow, nullable=True)

    # Relationships
    courier = relationship("User", backref="performance_metrics")

    __table_args__ = (
        Index("ix_courier_performance_rating", "average_rating"),
        Index("ix_courier_performance_deliveries", "total_deliveries"),
    )


class GeographicMetrics(Base):
    """
    Geographic distribution metrics for service coverage analysis.
    """
    __tablename__ = "geographic_metrics"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)

    # Location (city/region level)
    city = Column(String(100), nullable=True)
    region = Column(String(100), nullable=True)
    country = Column(String(2), default="US", nullable=False)

    # Approximate center coordinates
    center_latitude = Column(Float, nullable=True)
    center_longitude = Column(Float, nullable=True)

    # Metrics
    packages_created = Column(Integer, default=0, nullable=False)
    packages_delivered = Column(Integer, default=0, nullable=False)
    active_couriers = Column(Integer, default=0, nullable=False)
    average_delivery_distance_km = Column(Float, nullable=True)
    coverage_radius_km = Column(Float, nullable=True)

    # Demand/supply balance
    demand_supply_ratio = Column(Float, nullable=True)  # packages / couriers

    __table_args__ = (
        Index("ix_geographic_metrics_date_region", "date", "region"),
    )


class HourlyActivity(Base):
    """
    Hourly activity patterns for capacity planning.
    """
    __tablename__ = "hourly_activity"

    id = Column(Integer, primary_key=True, index=True)
    date = Column(Date, nullable=False)
    hour = Column(Integer, nullable=False)  # 0-23

    # Activity counts
    packages_created = Column(Integer, default=0, nullable=False)
    packages_delivered = Column(Integer, default=0, nullable=False)
    active_couriers = Column(Integer, default=0, nullable=False)
    active_tracking_sessions = Column(Integer, default=0, nullable=False)

    # Response times (in minutes)
    average_response_time = Column(Float, nullable=True)

    __table_args__ = (
        Index("ix_hourly_activity_date_hour", "date", "hour", unique=True),
    )


class UserRetention(Base):
    """
    User retention and cohort analysis data.
    """
    __tablename__ = "user_retention"

    id = Column(Integer, primary_key=True, index=True)
    cohort_month = Column(Date, nullable=False)  # Month user joined
    analysis_month = Column(Date, nullable=False)  # Month being analyzed
    user_type = Column(String(20), nullable=False)  # sender, courier, both

    # Cohort size
    cohort_size = Column(Integer, default=0, nullable=False)
    active_users = Column(Integer, default=0, nullable=False)
    retention_rate = Column(Float, nullable=True)  # active / cohort_size

    # Activity levels
    high_activity_users = Column(Integer, default=0, nullable=False)  # 5+ actions
    medium_activity_users = Column(Integer, default=0, nullable=False)  # 2-4 actions
    low_activity_users = Column(Integer, default=0, nullable=False)  # 1 action

    __table_args__ = (
        Index("ix_user_retention_cohort", "cohort_month", "analysis_month", "user_type", unique=True),
    )
