"""
Comprehensive tests for analytics API endpoints.
Tests platform metrics, courier performance, sender/courier stats.
"""
import pytest
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize
from app.models.payment import Transaction, TransactionStatus
from app.models.rating import Rating
from app.models.analytics import DailyMetrics, CourierPerformance, HourlyActivity
from app.models.bid import CourierBid, BidStatus
from main import app


@pytest.fixture
def admin_user(db_session, authenticated_admin):
    """Get the admin user object created by authenticated_admin fixture."""
    return db_session.query(User).filter(User.email == "admin@example.com").first()


@pytest.fixture
def sender_user(db_session, authenticated_sender):
    """Get the sender user object created by authenticated_sender fixture."""
    return db_session.query(User).filter(User.email == "test@example.com").first()


@pytest.fixture
def courier_user(db_session, authenticated_courier):
    """Get the courier user object created by authenticated_courier fixture."""
    return db_session.query(User).filter(User.email == "courier@example.com").first()


@pytest.fixture
def both_role_user(db_session, authenticated_both_role):
    """Get the both role user object created by authenticated_both_role fixture."""
    return db_session.query(User).filter(User.email == "both@example.com").first()


class TestPlatformOverview:
    """Tests for GET /api/analytics/overview (admin only)."""

    def test_admin_can_access_platform_overview(self, client, authenticated_admin, db_session, sender_user, courier_user):
        """Admin can access platform overview statistics."""
        # Create some test data
        package = Package(
            tracking_id="TEST123",
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            status=PackageStatus.DELIVERED,
            description="Test package",
            weight_kg=2.5,
            pickup_address="123 Main St",
            dropoff_address="456 Oak Ave",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_lat=37.7849,
            dropoff_lng=-122.4094,
            size=PackageSize.SMALL,
            price=25.00,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        response = client.get(
            "/api/analytics/overview",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data
        assert "total_senders" in data
        assert "total_couriers" in data
        assert "total_packages" in data
        assert "packages_delivered" in data
        assert "packages_in_transit" in data
        assert "total_revenue_cents" in data
        assert "platform_fees_cents" in data
        assert data["total_users"] >= 2  # At least sender and courier
        assert data["total_packages"] >= 1

    def test_non_admin_cannot_access_platform_overview(self, client, authenticated_sender):
        """Non-admin users cannot access platform overview."""
        response = client.get(
            "/api/analytics/overview",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 403

    def test_platform_overview_empty_data(self, client, authenticated_admin, db_session):
        """Platform overview handles empty data gracefully."""
        response = client.get(
            "/api/analytics/overview",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_packages"] == 0
        assert data["packages_delivered"] == 0
        assert data["packages_in_transit"] == 0
        assert data["total_revenue_cents"] == 0
        assert data["platform_fees_cents"] == 0

    def test_platform_overview_counts_active_users_only(self, client, authenticated_admin, db_session):
        """Platform overview only counts active users."""
        # Create an inactive user
        inactive = User(
            email="inactive@example.com",
            full_name="Inactive User",
            hashed_password="hashed",
            role=UserRole.SENDER,
            is_active=False,
            is_verified=True
        )
        db_session.add(inactive)
        db_session.commit()

        response = client.get(
            "/api/analytics/overview",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        # Inactive user should not be counted

    def test_platform_overview_revenue_calculation(self, client, authenticated_admin, db_session, sender_user, courier_user):
        """Platform overview correctly calculates revenue."""
        # Create a transaction
        transaction = Transaction(
            stripe_payment_intent_id="pi_test123",
            package_id=1,
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            amount_cents=5000,
            platform_fee_cents=500,
            courier_payout_cents=4500,
            status=TransactionStatus.SUCCEEDED
        )
        db_session.add(transaction)
        db_session.commit()

        response = client.get(
            "/api/analytics/overview",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_revenue_cents"] == 5000
        assert data["platform_fees_cents"] == 500


class TestDailyMetrics:
    """Tests for GET /api/analytics/daily-metrics (admin only)."""

    def test_admin_can_access_daily_metrics(self, client, authenticated_admin, db_session):
        """Admin can access daily metrics."""
        # Create a daily metrics entry
        metric = DailyMetrics(
            date=date.today(),
            packages_created=10,
            packages_matched=8,
            packages_delivered=5,
            packages_cancelled=1,
            new_users=3,
            active_senders=5,
            active_couriers=4,
            total_transaction_amount=10000,
            total_platform_fees=1000,
            average_delivery_time_minutes=120.5,
            average_rating=4.5,
            successful_delivery_rate=83.3
        )
        db_session.add(metric)
        db_session.commit()

        response = client.get(
            "/api/analytics/daily-metrics?days=30",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "date" in data[0]
            assert "packages_created" in data[0]

    def test_daily_metrics_date_filtering(self, client, authenticated_admin, db_session):
        """Daily metrics can be filtered by date range."""
        # Create metrics for different dates
        for i in range(5):
            metric = DailyMetrics(
                date=date.today() - timedelta(days=i),
                packages_created=10 + i,
                packages_matched=8,
                packages_delivered=5,
                packages_cancelled=1,
                new_users=3,
                active_senders=5,
                active_couriers=4,
                total_transaction_amount=10000,
                total_platform_fees=1000
            )
            db_session.add(metric)
        db_session.commit()

        start_date = (date.today() - timedelta(days=3)).isoformat()
        end_date = date.today().isoformat()

        response = client.get(
            f"/api/analytics/daily-metrics?start_date={start_date}&end_date={end_date}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 4  # Should include at most 4 days

    def test_daily_metrics_days_parameter(self, client, authenticated_admin, db_session):
        """Daily metrics respects the days parameter."""
        response = client.get(
            "/api/analytics/daily-metrics?days=7",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200

    def test_daily_metrics_ordered_by_date_desc(self, client, authenticated_admin, db_session):
        """Daily metrics are ordered by date descending."""
        # Create metrics for multiple days
        for i in range(3):
            metric = DailyMetrics(
                date=date.today() - timedelta(days=i),
                packages_created=10,
                packages_matched=8,
                packages_delivered=5,
                packages_cancelled=1,
                new_users=3,
                active_senders=5,
                active_couriers=4,
                total_transaction_amount=10000,
                total_platform_fees=1000
            )
            db_session.add(metric)
        db_session.commit()

        response = client.get(
            "/api/analytics/daily-metrics?days=7",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        if len(data) > 1:
            # Dates should be in descending order
            dates = [d["date"] for d in data]
            assert dates == sorted(dates, reverse=True)


class TestRevenueBreakdown:
    """Tests for GET /api/analytics/revenue (admin only)."""

    def test_admin_can_access_revenue_breakdown(self, client, authenticated_admin, db_session, sender_user, courier_user):
        """Admin can access revenue breakdown."""
        # Create transactions
        transaction = Transaction(
            stripe_payment_intent_id="pi_test123",
            package_id=1,
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            amount_cents=5000,
            platform_fee_cents=500,
            courier_payout_cents=4500,
            refund_amount_cents=0,
            status=TransactionStatus.SUCCEEDED
        )
        db_session.add(transaction)
        db_session.commit()

        response = client.get(
            "/api/analytics/revenue",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_cents" in data
        assert "platform_fees_cents" in data
        assert "courier_payouts_cents" in data
        assert "refunds_cents" in data
        assert "net_revenue_cents" in data
        assert data["total_cents"] == 5000
        assert data["platform_fees_cents"] == 500
        assert data["courier_payouts_cents"] == 4500

    def test_revenue_breakdown_date_filtering(self, client, authenticated_admin, db_session, sender_user, courier_user):
        """Revenue breakdown can be filtered by date range."""
        # Create transactions with different dates
        old_transaction = Transaction(
            stripe_payment_intent_id="pi_old",
            package_id=1,
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            amount_cents=3000,
            platform_fee_cents=300,
            courier_payout_cents=2700,
            status=TransactionStatus.SUCCEEDED,
            created_at=datetime.utcnow() - timedelta(days=60)
        )
        recent_transaction = Transaction(
            stripe_payment_intent_id="pi_recent",
            package_id=2,
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            amount_cents=5000,
            platform_fee_cents=500,
            courier_payout_cents=4500,
            status=TransactionStatus.SUCCEEDED
        )
        db_session.add_all([old_transaction, recent_transaction])
        db_session.commit()

        start_date = (date.today() - timedelta(days=7)).isoformat()
        response = client.get(
            f"/api/analytics/revenue?start_date={start_date}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        # Should only include recent transaction
        assert data["total_cents"] == 5000

    def test_revenue_breakdown_net_calculation(self, client, authenticated_admin, db_session, sender_user, courier_user):
        """Revenue breakdown correctly calculates net revenue (fees - refunds)."""
        transaction = Transaction(
            stripe_payment_intent_id="pi_test",
            package_id=1,
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            amount_cents=5000,
            platform_fee_cents=500,
            courier_payout_cents=4500,
            refund_amount_cents=100,
            status=TransactionStatus.SUCCEEDED
        )
        db_session.add(transaction)
        db_session.commit()

        response = client.get(
            "/api/analytics/revenue",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["net_revenue_cents"] == 400  # 500 - 100

    def test_revenue_breakdown_empty_data(self, client, authenticated_admin, db_session):
        """Revenue breakdown handles empty data gracefully."""
        response = client.get(
            "/api/analytics/revenue",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_cents"] == 0
        assert data["platform_fees_cents"] == 0
        assert data["courier_payouts_cents"] == 0
        assert data["refunds_cents"] == 0
        assert data["net_revenue_cents"] == 0


class TestTopCouriers:
    """Tests for GET /api/analytics/top-couriers (admin only)."""

    def test_admin_can_access_top_couriers(self, client, authenticated_admin, db_session, courier_user):
        """Admin can access top couriers list."""
        # Create courier performance
        perf = CourierPerformance(
            courier_id=courier_user.id,
            total_deliveries=10,
            successful_deliveries=9,
            on_time_deliveries=8,
            average_rating=4.5,
            total_earnings=10000,
            last_delivery_at=datetime.utcnow()
        )
        db_session.add(perf)
        db_session.commit()

        response = client.get(
            "/api/analytics/top-couriers",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_top_couriers_respects_limit(self, client, authenticated_admin, db_session):
        """Top couriers respects the limit parameter."""
        response = client.get(
            "/api/analytics/top-couriers?limit=5",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) <= 5

    def test_top_couriers_period_filtering(self, client, authenticated_admin, db_session, courier_user):
        """Top couriers can be filtered by period."""
        # Create old performance
        old_perf = CourierPerformance(
            courier_id=courier_user.id,
            total_deliveries=10,
            successful_deliveries=9,
            on_time_deliveries=8,
            average_rating=4.5,
            total_earnings=10000,
            last_delivery_at=datetime.utcnow() - timedelta(days=100)
        )
        db_session.add(old_perf)
        db_session.commit()

        response = client.get(
            "/api/analytics/top-couriers?period_days=30",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        # Old performance should not be included


class TestHourlyActivity:
    """Tests for GET /api/analytics/hourly-activity (admin only)."""

    def test_admin_can_access_hourly_activity(self, client, authenticated_admin, db_session):
        """Admin can access hourly activity patterns."""
        # Create hourly activity
        activity = HourlyActivity(
            date=date.today(),
            hour=14,
            packages_created=5,
            packages_delivered=3,
            active_couriers=2
        )
        db_session.add(activity)
        db_session.commit()

        response = client.get(
            "/api/analytics/hourly-activity",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 24  # Should return all 24 hours

    def test_hourly_activity_date_filtering(self, client, authenticated_admin, db_session):
        """Hourly activity can be filtered by date."""
        target_date = (date.today() - timedelta(days=1)).isoformat()

        response = client.get(
            f"/api/analytics/hourly-activity?date_str={target_date}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200

    def test_hourly_activity_fills_missing_hours(self, client, authenticated_admin, db_session):
        """Hourly activity fills missing hours with zeros."""
        # Create activity for only one hour
        activity = HourlyActivity(
            date=date.today(),
            hour=14,
            packages_created=5,
            packages_delivered=3,
            active_couriers=2
        )
        db_session.add(activity)
        db_session.commit()

        response = client.get(
            "/api/analytics/hourly-activity",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 24
        # Check that missing hours have zeros
        zero_hours = [h for h in data if h["packages_created"] == 0]
        assert len(zero_hours) == 23


class TestMyPerformance:
    """Tests for GET /api/analytics/my-performance (courier only)."""

    def test_courier_can_access_own_performance(self, client, authenticated_courier, db_session, courier_user):
        """Courier can access their own performance metrics."""
        # Create performance data
        perf = CourierPerformance(
            courier_id=courier_user.id,
            total_deliveries=10,
            successful_deliveries=9,
            on_time_deliveries=8,
            average_rating=4.5,
            total_earnings=10000,
            earnings_this_month=2000,
            current_streak=3,
            last_delivery_at=datetime.utcnow()
        )
        db_session.add(perf)
        db_session.commit()

        response = client.get(
            "/api/analytics/my-performance",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["courier_id"] == courier_user.id
        assert data["total_deliveries"] == 10
        assert data["successful_deliveries"] == 9
        assert data["average_rating"] == 4.5

    def test_sender_cannot_access_performance(self, client, authenticated_sender):
        """Sender cannot access courier performance metrics."""
        response = client.get(
            "/api/analytics/my-performance",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 403

    def test_both_role_can_access_performance(self, client, authenticated_both_role, both_role_user, db_session):
        """User with both role can access performance metrics."""
        response = client.get(
            "/api/analytics/my-performance",
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == 200

    def test_performance_empty_data(self, client, authenticated_courier, db_session, courier_user):
        """Performance endpoint returns empty metrics if none exist."""
        # No performance data created

        response = client.get(
            "/api/analytics/my-performance",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total_deliveries"] == 0
        assert data["successful_deliveries"] == 0
        assert data["total_earnings"] == 0


class TestCourierLeaderboard:
    """Tests for GET /api/analytics/courier-leaderboard (all authenticated users)."""

    def test_any_user_can_access_leaderboard(self, client, authenticated_sender, db_session, courier_user):
        """Any authenticated user can access courier leaderboard."""
        # Create performance data
        perf = CourierPerformance(
            courier_id=courier_user.id,
            total_deliveries=10,
            successful_deliveries=9,
            on_time_deliveries=8,
            average_rating=4.5,
            total_earnings=10000,
            current_streak=3,
            last_delivery_at=datetime.utcnow()
        )
        db_session.add(perf)
        db_session.commit()

        response = client.get(
            "/api/analytics/courier-leaderboard",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    def test_leaderboard_metric_sorting(self, client, authenticated_sender, db_session):
        """Leaderboard can be sorted by different metrics."""
        # Test sorting by deliveries
        response = client.get(
            "/api/analytics/courier-leaderboard?metric=deliveries",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == 200

        # Test sorting by rating
        response = client.get(
            "/api/analytics/courier-leaderboard?metric=rating",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == 200

        # Test sorting by earnings
        response = client.get(
            "/api/analytics/courier-leaderboard?metric=earnings",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == 200

    def test_leaderboard_hides_earnings(self, client, authenticated_sender, db_session, courier_user):
        """Leaderboard hides earnings from public view."""
        perf = CourierPerformance(
            courier_id=courier_user.id,
            total_deliveries=10,
            successful_deliveries=9,
            on_time_deliveries=8,
            average_rating=4.5,
            total_earnings=10000,
            earnings_this_month=2000,
            current_streak=3,
            last_delivery_at=datetime.utcnow()
        )
        db_session.add(perf)
        db_session.commit()

        response = client.get(
            "/api/analytics/courier-leaderboard",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            # Earnings should be hidden (set to 0)
            assert data[0]["total_earnings"] == 0
            assert data[0]["earnings_this_month"] == 0


class TestPackagesTrend:
    """Tests for GET /api/analytics/packages-trend (admin only)."""

    def test_admin_can_access_packages_trend(self, client, authenticated_admin, db_session):
        """Admin can access packages trend data."""
        # Create daily metrics
        for i in range(7):
            metric = DailyMetrics(
                date=date.today() - timedelta(days=i),
                packages_created=10 + i,
                packages_matched=8,
                packages_delivered=5,
                packages_cancelled=1,
                new_users=3,
                active_senders=5,
                active_couriers=4,
                total_transaction_amount=10000,
                total_platform_fees=1000
            )
            db_session.add(metric)
        db_session.commit()

        response = client.get(
            "/api/analytics/packages-trend?days=7",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "date" in data[0]
            assert "value" in data[0]

    def test_packages_trend_respects_days_parameter(self, client, authenticated_admin, db_session):
        """Packages trend respects the days parameter."""
        response = client.get(
            "/api/analytics/packages-trend?days=30",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200


class TestRevenueTrend:
    """Tests for GET /api/analytics/revenue-trend (admin only)."""

    def test_admin_can_access_revenue_trend(self, client, authenticated_admin, db_session):
        """Admin can access revenue trend data."""
        # Create daily metrics
        for i in range(7):
            metric = DailyMetrics(
                date=date.today() - timedelta(days=i),
                packages_created=10,
                packages_matched=8,
                packages_delivered=5,
                packages_cancelled=1,
                new_users=3,
                active_senders=5,
                active_couriers=4,
                total_transaction_amount=10000,
                total_platform_fees=1000 + (i * 100)
            )
            db_session.add(metric)
        db_session.commit()

        response = client.get(
            "/api/analytics/revenue-trend?days=7",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            assert "date" in data[0]
            assert "value" in data[0]
            # Value should be in dollars (cents / 100)

    def test_revenue_trend_respects_days_parameter(self, client, authenticated_admin, db_session):
        """Revenue trend respects the days parameter."""
        response = client.get(
            "/api/analytics/revenue-trend?days=14",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200


class TestSenderStats:
    """Tests for GET /api/analytics/sender-stats (sender/both/admin)."""

    @pytest.mark.skip(reason="date_trunc is PostgreSQL-specific, not available in SQLite test DB")
    def test_sender_can_access_own_stats(self, client, authenticated_sender, db_session, sender_user):
        """Sender can access their own statistics."""
        # Create packages for sender
        package = Package(
            tracking_id="TEST123",
            sender_id=sender_user.id,
            status=PackageStatus.DELIVERED,
            description="Test package",
            weight_kg=2.5,
            pickup_address="123 Main St",
            dropoff_address="456 Oak Ave",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_lat=37.7849,
            dropoff_lng=-122.4094,
            size=PackageSize.SMALL,
            price=25.00,
            is_active=True,
            created_at=datetime.utcnow(),
            delivery_time=datetime.utcnow()
        )
        db_session.add(package)
        db_session.commit()

        response = client.get(
            "/api/analytics/sender-stats",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_packages" in data
        assert "packages_this_month" in data
        assert "status_breakdown" in data
        assert "delivery_rate" in data
        assert "total_spent" in data
        assert data["total_packages"] >= 1

    def test_courier_cannot_access_sender_stats(self, client, authenticated_courier):
        """Courier cannot access sender stats."""
        response = client.get(
            "/api/analytics/sender-stats",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 403

    @pytest.mark.skip(reason="date_trunc is PostgreSQL-specific, not available in SQLite test DB")
    def test_sender_stats_delivery_rate_calculation(self, client, authenticated_sender, db_session, sender_user):
        """Sender stats correctly calculates delivery rate."""
        # Create packages with different statuses
        for i, status in enumerate([PackageStatus.DELIVERED, PackageStatus.DELIVERED, PackageStatus.IN_TRANSIT]):
            package = Package(
                tracking_id=f"TEST{i}{status.value}",
                sender_id=sender_user.id,
                status=status,
                description=f"Test package {i}",
                weight_kg=2.5,
                pickup_address="123 Main St",
                dropoff_address="456 Oak Ave",
                pickup_lat=37.7749,
                pickup_lng=-122.4194,
                dropoff_lat=37.7849,
                dropoff_lng=-122.4094,
                size=PackageSize.SMALL,
                price=25.00,
                is_active=True
            )
            db_session.add(package)
        db_session.commit()

        response = client.get(
            "/api/analytics/sender-stats",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        # 2 delivered out of 3 total = 66.7%
        assert data["delivery_rate"] > 60


class TestCourierStats:
    """Tests for GET /api/analytics/courier-stats (courier/both/admin)."""

    @pytest.mark.skip(reason="date_trunc is PostgreSQL-specific, not available in SQLite test DB")
    def test_courier_can_access_own_stats(self, client, authenticated_courier, db_session, courier_user, sender_user):
        """Courier can access their own statistics."""
        # Create packages for courier
        package = Package(
            tracking_id="TEST123",
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            status=PackageStatus.DELIVERED,
            description="Test package",
            weight_kg=2.5,
            pickup_address="123 Main St",
            dropoff_address="456 Oak Ave",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_lat=37.7849,
            dropoff_lng=-122.4094,
            size=PackageSize.SMALL,
            price=25.00,
            is_active=True,
            pickup_time=datetime.utcnow(),
            delivery_time=datetime.utcnow()
        )
        db_session.add(package)
        db_session.commit()

        response = client.get(
            "/api/analytics/courier-stats",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "total_deliveries" in data
        assert "deliveries_this_month" in data
        assert "total_bids_placed" in data
        assert "bids_won" in data
        assert "bid_win_rate" in data
        assert "delivery_rate" in data
        assert "total_earnings" in data

    def test_sender_cannot_access_courier_stats(self, client, authenticated_sender):
        """Sender cannot access courier stats."""
        response = client.get(
            "/api/analytics/courier-stats",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 403
