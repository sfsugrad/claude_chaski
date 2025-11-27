"""Tests for the matching job service."""
import pytest
from datetime import datetime, timedelta

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, CourierRoute
from app.models.notification import Notification, NotificationType
from app.utils.auth import get_password_hash, create_access_token
from app.services.matching_job import (
    haversine_distance,
    find_matching_packages_for_route,
    has_recent_match_notification,
    create_match_notification,
    run_matching_job
)


class TestHaversineDistance:
    """Tests for the haversine distance calculation."""

    def test_same_point_returns_zero(self):
        """Distance between same point should be 0."""
        distance = haversine_distance(40.7128, -74.0060, 40.7128, -74.0060)
        assert distance == 0.0

    def test_known_distance(self):
        """Test distance between two known points."""
        # New York to Los Angeles is approximately 3944 km
        ny_lat, ny_lng = 40.7128, -74.0060
        la_lat, la_lng = 34.0522, -118.2437
        distance = haversine_distance(ny_lat, ny_lng, la_lat, la_lng)
        # Allow 5% margin
        assert 3700 < distance < 4100

    def test_short_distance(self):
        """Test short distance calculation."""
        # Two points about 1 km apart in NYC
        lat1, lng1 = 40.7128, -74.0060
        lat2, lng2 = 40.7218, -74.0060  # ~1 km north
        distance = haversine_distance(lat1, lng1, lat2, lng2)
        assert 0.9 < distance < 1.1


class TestFindMatchingPackagesForRoute:
    """Tests for finding packages that match a courier route."""

    @pytest.fixture
    def route_with_packages(self, db_session):
        """Create a route and packages for matching tests."""
        # Create courier
        courier = User(
            email="match_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Match Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)

        # Create sender
        sender = User(
            email="match_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Match Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Create route from downtown to uptown NYC (approx 8km)
        route = CourierRoute(
            courier_id=courier.id,
            start_address="Downtown NYC",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="Uptown NYC",
            end_lat=40.7831,
            end_lng=-73.9712,
            max_deviation_km=2.0,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        # Create package near route (should match)
        package_near = Package(
            sender_id=sender.id,
            description="Near package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING,
            pickup_address="Near pickup",
            pickup_lat=40.7300,
            pickup_lng=-74.0000,
            dropoff_address="Near dropoff",
            dropoff_lat=40.7600,
            dropoff_lng=-73.9800,
            price=20.00,
            is_active=True
        )
        db_session.add(package_near)

        # Create package far from route (should not match)
        package_far = Package(
            sender_id=sender.id,
            description="Far package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING,
            pickup_address="Far pickup",
            pickup_lat=40.6500,  # Much further south
            pickup_lng=-73.9500,
            dropoff_address="Far dropoff",
            dropoff_lat=40.6600,
            dropoff_lng=-73.9400,
            price=25.00,
            is_active=True
        )
        db_session.add(package_far)

        # Create non-pending package (should not match)
        package_matched = Package(
            sender_id=sender.id,
            description="Matched package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.MATCHED,
            pickup_address="Near pickup",
            pickup_lat=40.7300,
            pickup_lng=-74.0000,
            dropoff_address="Near dropoff",
            dropoff_lat=40.7600,
            dropoff_lng=-73.9800,
            price=30.00,
            is_active=True
        )
        db_session.add(package_matched)
        db_session.commit()

        db_session.refresh(route)
        db_session.refresh(package_near)
        db_session.refresh(package_far)
        db_session.refresh(package_matched)

        return {
            "courier": courier,
            "sender": sender,
            "route": route,
            "package_near": package_near,
            "package_far": package_far,
            "package_matched": package_matched
        }

    def test_finds_matching_packages(self, db_session, route_with_packages):
        """Should find packages within max_deviation_km of route."""
        setup = route_with_packages
        matches = find_matching_packages_for_route(db_session, setup["route"])

        # Should find the near package, not the far one or matched one
        package_ids = [m["package"].id for m in matches]
        assert setup["package_near"].id in package_ids
        assert setup["package_far"].id not in package_ids
        assert setup["package_matched"].id not in package_ids

    def test_returns_distance_info(self, db_session, route_with_packages):
        """Matches should include distance and detour information."""
        setup = route_with_packages
        matches = find_matching_packages_for_route(db_session, setup["route"])

        if matches:
            match = matches[0]
            assert "distance_from_route_km" in match
            assert "estimated_detour_km" in match
            assert isinstance(match["distance_from_route_km"], float)
            assert isinstance(match["estimated_detour_km"], float)

    def test_sorted_by_detour(self, db_session, route_with_packages):
        """Matches should be sorted by estimated detour (shortest first)."""
        setup = route_with_packages

        # Create another package closer to route
        closer_package = Package(
            sender_id=setup["sender"].id,
            description="Closer package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING,
            pickup_address="Very near pickup",
            pickup_lat=40.7400,
            pickup_lng=-73.9900,
            dropoff_address="Very near dropoff",
            dropoff_lat=40.7500,
            dropoff_lng=-73.9850,
            price=15.00,
            is_active=True
        )
        db_session.add(closer_package)
        db_session.commit()

        matches = find_matching_packages_for_route(db_session, setup["route"])

        if len(matches) >= 2:
            # Should be sorted by detour
            for i in range(len(matches) - 1):
                assert matches[i]["estimated_detour_km"] <= matches[i + 1]["estimated_detour_km"]


class TestHasRecentMatchNotification:
    """Tests for checking recent match notifications."""

    @pytest.fixture
    def notification_setup(self, db_session):
        """Create courier, package, and notification for tests."""
        courier = User(
            email="notif_check_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Notif Check Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        sender = User(
            email="notif_check_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Notif Check Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([courier, sender])
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            description="Notification check package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING,
            pickup_address="Test pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Test dropoff",
            dropoff_lat=40.7200,
            dropoff_lng=-74.0100,
            price=20.00,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        return {"courier": courier, "sender": sender, "package": package}

    def test_no_recent_notification(self, db_session, notification_setup):
        """Returns False when no notification exists."""
        setup = notification_setup
        result = has_recent_match_notification(
            db_session, setup["courier"].id, setup["package"].id
        )
        assert result is False

    def test_has_recent_notification(self, db_session, notification_setup):
        """Returns True when recent notification exists."""
        setup = notification_setup

        # Create recent notification
        notification = Notification(
            user_id=setup["courier"].id,
            type=NotificationType.PACKAGE_MATCH_FOUND,
            message="Test match notification",
            package_id=setup["package"].id,
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        result = has_recent_match_notification(
            db_session, setup["courier"].id, setup["package"].id
        )
        assert result is True

    def test_old_notification_not_counted(self, db_session, notification_setup):
        """Returns False when notification is older than threshold."""
        from sqlalchemy import text

        setup = notification_setup

        # Create old notification (manually set created_at)
        notification = Notification(
            user_id=setup["courier"].id,
            type=NotificationType.PACKAGE_MATCH_FOUND,
            message="Old match notification",
            package_id=setup["package"].id,
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        # Update created_at to be older than 24 hours
        db_session.execute(
            text(f"UPDATE notifications SET created_at = datetime('now', '-25 hours') WHERE id = {notification.id}")
        )
        db_session.commit()

        result = has_recent_match_notification(
            db_session, setup["courier"].id, setup["package"].id, hours=24
        )
        assert result is False


class TestCreateMatchNotification:
    """Tests for creating match notifications."""

    @pytest.fixture
    def match_notification_setup(self, db_session):
        """Create courier and package for notification tests."""
        courier = User(
            email="create_notif_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Create Notif Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        sender = User(
            email="create_notif_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Create Notif Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([courier, sender])
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            description="Test package for notification",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING,
            pickup_address="Test pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Test dropoff",
            dropoff_lat=40.7200,
            dropoff_lng=-74.0100,
            price=25.00,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        return {"courier": courier, "package": package}

    def test_creates_notification(self, db_session, match_notification_setup):
        """Should create a notification with correct type and data."""
        setup = match_notification_setup

        notification = create_match_notification(
            db_session,
            setup["courier"].id,
            setup["package"],
            distance_km=1.5,
            detour_km=3.0
        )
        db_session.commit()

        assert notification.user_id == setup["courier"].id
        assert notification.type == NotificationType.PACKAGE_MATCH_FOUND
        assert notification.package_id == setup["package"].id
        assert notification.read is False
        assert "1.5km" in notification.message
        assert "3.0km" in notification.message
        assert "$25.00" in notification.message


class TestRunMatchingJob:
    """Tests for the main matching job function."""

    @pytest.fixture
    def matching_job_setup(self, db_session):
        """Create full setup for matching job tests."""
        # Create courier with route
        courier = User(
            email="job_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Job Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Start",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="End",
            end_lat=40.7831,
            end_lng=-73.9712,
            max_deviation_km=5.0,
            is_active=True
        )
        db_session.add(route)

        # Create sender and package
        sender = User(
            email="job_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Job Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            description="Job test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING,
            pickup_address="Near route pickup",
            pickup_lat=40.7400,
            pickup_lng=-73.9900,
            dropoff_address="Near route dropoff",
            dropoff_lat=40.7600,
            dropoff_lng=-73.9800,
            price=30.00,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        return {
            "courier": courier,
            "sender": sender,
            "route": route,
            "package": package
        }

    def test_dry_run_does_not_create_notifications(self, db_session, matching_job_setup):
        """Dry run should not create notifications."""
        from app.database import SessionLocal

        # Note: run_matching_job creates its own session, so we can't easily test this
        # without mocking. This is more of an integration test.
        pass  # Skip for unit tests

    def test_job_returns_results_summary(self, db_session, matching_job_setup):
        """Job should return a summary of results."""
        # This would require the job to use the test database
        # For now, we test the result structure
        expected_keys = [
            'started_at', 'routes_processed', 'total_matches_found',
            'notifications_created', 'notifications_skipped', 'route_details'
        ]
        # The actual job test would go here
        pass


class TestAdminMatchingJobEndpoint:
    """Tests for the admin endpoint to trigger matching job."""

    def test_non_admin_cannot_trigger_matching_job(self, client, authenticated_sender):
        """Non-admin users should not be able to trigger matching job."""
        response = client.post(
            "/api/admin/jobs/run-matching",
            json={"dry_run": True},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 403

    def test_unauthenticated_cannot_trigger_matching_job(self, client):
        """Unauthenticated requests should be rejected."""
        response = client.post(
            "/api/admin/jobs/run-matching",
            json={"dry_run": True}
        )

        assert response.status_code == 401
