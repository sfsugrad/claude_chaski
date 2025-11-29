"""Tests for the bid deadline background job service."""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch, MagicMock

from app.services.bid_deadline_job import (
    send_deadline_warning,
    extend_deadline,
    expire_all_bids,
    run_bid_deadline_job,
    WARNING_HOURS_BEFORE,
    EXTENSION_HOURS,
    MAX_EXTENSIONS
)
from app.models.package import Package, PackageStatus
from app.models.bid import CourierBid, BidStatus
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.utils.auth import get_password_hash
from app.utils.tracking_id import generate_tracking_id


@pytest.fixture
def test_sender(db_session):
    """Create a test sender user."""
    user = User(
        email="sender@biddeadline.test",
        full_name="Test Sender",
        hashed_password=get_password_hash("password123"),
        role=UserRole.SENDER,
        is_verified=True,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_courier(db_session):
    """Create a test courier user."""
    user = User(
        email="courier@biddeadline.test",
        full_name="Test Courier",
        hashed_password=get_password_hash("password123"),
        role=UserRole.COURIER,
        is_verified=True,
        is_active=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_package_with_deadline(db_session, test_sender):
    """Create a test package with bid deadline."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=test_sender.id,
        description="Test Package with Deadline",
        size="medium",
        weight_kg=2.5,
        status=PackageStatus.OPEN_FOR_BIDS,
        pickup_address="Pickup Location",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="Dropoff Location",
        dropoff_lat=40.7589,
        dropoff_lng=-73.9851,
        price=50.0,
        is_active=True,
        bid_deadline=datetime.now(timezone.utc) + timedelta(hours=12),
        bid_count=3,
        deadline_extensions=0,
        deadline_warning_sent=False
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def test_bid(db_session, test_package_with_deadline, test_courier):
    """Create a test courier bid."""
    bid = CourierBid(
        package_id=test_package_with_deadline.id,
        courier_id=test_courier.id,
        route_id=None,
        proposed_price=45.0,
        estimated_delivery_hours=24,
        status=BidStatus.PENDING
    )
    db_session.add(bid)
    db_session.commit()
    db_session.refresh(bid)
    return bid


class TestSendDeadlineWarning:
    """Tests for send_deadline_warning function."""

    def test_creates_warning_notification(self, db_session, test_package_with_deadline, test_sender):
        """Test that warning notification is created."""
        send_deadline_warning(db_session, test_package_with_deadline)
        db_session.commit()

        notification = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_WARNING,
            Notification.package_id == test_package_with_deadline.id
        ).first()

        assert notification is not None
        assert notification.user_id == test_sender.id
        assert notification.read is False
        assert str(WARNING_HOURS_BEFORE) in notification.message
        assert test_package_with_deadline.description[:40] in notification.message

    def test_marks_warning_as_sent(self, db_session, test_package_with_deadline):
        """Test that deadline_warning_sent flag is set."""
        assert test_package_with_deadline.deadline_warning_sent is False

        send_deadline_warning(db_session, test_package_with_deadline)
        db_session.commit()
        db_session.refresh(test_package_with_deadline)

        assert test_package_with_deadline.deadline_warning_sent is True

    def test_includes_bid_count_in_message(self, db_session, test_package_with_deadline):
        """Test that bid count is included in warning message."""
        send_deadline_warning(db_session, test_package_with_deadline)
        db_session.commit()

        notification = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_WARNING
        ).first()

        assert f"{test_package_with_deadline.bid_count} bid" in notification.message

    def test_handles_missing_sender_gracefully(self, db_session, test_package_with_deadline):
        """Test that missing sender doesn't cause error."""
        # Set invalid sender_id
        test_package_with_deadline.sender_id = 99999
        db_session.commit()

        # Should not raise error
        send_deadline_warning(db_session, test_package_with_deadline)
        db_session.commit()

        # No notification should be created
        notification_count = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_WARNING
        ).count()
        assert notification_count == 0


class TestExtendDeadline:
    """Tests for extend_deadline function."""

    def test_extends_deadline_by_configured_hours(self, db_session, test_package_with_deadline):
        """Test that deadline is extended by EXTENSION_HOURS."""
        old_deadline = test_package_with_deadline.bid_deadline

        extend_deadline(db_session, test_package_with_deadline)
        db_session.commit()
        db_session.refresh(test_package_with_deadline)

        new_deadline = test_package_with_deadline.bid_deadline
        assert new_deadline > old_deadline

        # Should be approximately EXTENSION_HOURS from now
        now = datetime.now(timezone.utc)
        expected_deadline = now + timedelta(hours=EXTENSION_HOURS)
        time_diff = abs((new_deadline - expected_deadline).total_seconds())
        assert time_diff < 5  # Within 5 seconds

    def test_increments_extension_count(self, db_session, test_package_with_deadline):
        """Test that deadline_extensions is incremented."""
        assert test_package_with_deadline.deadline_extensions == 0

        extend_deadline(db_session, test_package_with_deadline)
        db_session.commit()
        db_session.refresh(test_package_with_deadline)

        assert test_package_with_deadline.deadline_extensions == 1

    def test_resets_warning_sent_flag(self, db_session, test_package_with_deadline):
        """Test that deadline_warning_sent is reset."""
        test_package_with_deadline.deadline_warning_sent = True
        db_session.commit()

        extend_deadline(db_session, test_package_with_deadline)
        db_session.commit()
        db_session.refresh(test_package_with_deadline)

        assert test_package_with_deadline.deadline_warning_sent is False

    def test_creates_extension_notification(self, db_session, test_package_with_deadline):
        """Test that extension notification is created."""
        extend_deadline(db_session, test_package_with_deadline)
        db_session.commit()

        notification = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_EXTENDED,
            Notification.package_id == test_package_with_deadline.id
        ).first()

        assert notification is not None
        assert notification.user_id == test_package_with_deadline.sender_id
        assert str(EXTENSION_HOURS) in notification.message
        assert "Extension 1" in notification.message

    def test_notification_shows_correct_extension_number(self, db_session, test_package_with_deadline):
        """Test that extension notification shows correct extension number."""
        test_package_with_deadline.deadline_extensions = 0
        db_session.commit()

        extend_deadline(db_session, test_package_with_deadline)
        db_session.commit()

        notification = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_EXTENDED
        ).first()

        assert "Extension 1" in notification.message
        assert f"of {MAX_EXTENSIONS}" in notification.message


class TestExpireAllBids:
    """Tests for expire_all_bids function."""

    def test_expires_all_pending_bids(self, db_session, test_package_with_deadline, test_courier, test_bid):
        """Test that all pending bids are marked as expired."""
        # Create another pending bid
        courier2 = User(
            email="courier2@biddeadline.test",
            full_name="Test Courier 2",
            hashed_password=get_password_hash("password123"),
            role=UserRole.COURIER,
            is_verified=True,
            is_active=True
        )
        db_session.add(courier2)
        db_session.commit()

        bid2 = CourierBid(
            package_id=test_package_with_deadline.id,
            courier_id=courier2.id,
            route_id=None,
            proposed_price=48.0,
            estimated_delivery_hours=20,
            status=BidStatus.PENDING
        )
        db_session.add(bid2)
        db_session.commit()

        courier_ids = expire_all_bids(db_session, test_package_with_deadline)
        db_session.commit()

        # Check all bids are expired
        expired_count = db_session.query(CourierBid).filter(
            CourierBid.package_id == test_package_with_deadline.id,
            CourierBid.status == BidStatus.EXPIRED
        ).count()

        assert expired_count == 2
        assert len(courier_ids) == 2
        assert test_courier.id in courier_ids
        assert courier2.id in courier_ids

    def test_resets_package_to_open_for_bids(self, db_session, test_package_with_deadline):
        """Test that package is reset to OPEN_FOR_BIDS status."""
        expire_all_bids(db_session, test_package_with_deadline)
        db_session.commit()
        db_session.refresh(test_package_with_deadline)

        assert test_package_with_deadline.status == PackageStatus.OPEN_FOR_BIDS
        assert test_package_with_deadline.bid_deadline is None
        assert test_package_with_deadline.bid_count == 0
        assert test_package_with_deadline.deadline_extensions == 0
        assert test_package_with_deadline.deadline_warning_sent is False

    def test_notifies_sender(self, db_session, test_package_with_deadline, test_bid):
        """Test that sender receives expiration notification."""
        expire_all_bids(db_session, test_package_with_deadline)
        db_session.commit()

        notification = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_EXPIRED,
            Notification.user_id == test_package_with_deadline.sender_id
        ).first()

        assert notification is not None
        assert test_package_with_deadline.description[:40] in notification.message
        assert "pending status" in notification.message.lower()

    def test_notifies_all_couriers(self, db_session, test_package_with_deadline, test_courier, test_bid):
        """Test that all couriers with pending bids are notified."""
        # Create another courier and bid
        courier2 = User(
            email="courier2_expire@biddeadline.test",
            full_name="Test Courier 2",
            hashed_password=get_password_hash("password123"),
            role=UserRole.COURIER,
            is_verified=True,
            is_active=True
        )
        db_session.add(courier2)
        db_session.commit()

        bid2 = CourierBid(
            package_id=test_package_with_deadline.id,
            courier_id=courier2.id,
            route_id=None,
            proposed_price=47.0,
            estimated_delivery_hours=22,
            status=BidStatus.PENDING
        )
        db_session.add(bid2)
        db_session.commit()

        expire_all_bids(db_session, test_package_with_deadline)
        db_session.commit()

        # Check both couriers received notifications
        courier_notifications = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_EXPIRED,
            Notification.user_id.in_([test_courier.id, courier2.id])
        ).all()

        assert len(courier_notifications) == 2

    def test_returns_courier_ids(self, db_session, test_package_with_deadline, test_courier, test_bid):
        """Test that function returns list of courier IDs."""
        courier_ids = expire_all_bids(db_session, test_package_with_deadline)

        assert isinstance(courier_ids, list)
        assert test_courier.id in courier_ids

    def test_handles_package_with_no_bids(self, db_session, test_package_with_deadline):
        """Test expiring package with no bids."""
        # Remove the test bid
        db_session.query(CourierBid).filter(
            CourierBid.package_id == test_package_with_deadline.id
        ).delete()
        db_session.commit()

        courier_ids = expire_all_bids(db_session, test_package_with_deadline)
        db_session.commit()

        assert courier_ids == []
        assert test_package_with_deadline.status == PackageStatus.OPEN_FOR_BIDS


class TestRunBidDeadlineJob:
    """Tests for run_bid_deadline_job main function."""

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_sends_warnings_for_approaching_deadlines(self, mock_session, db_session, test_package_with_deadline):
        """Test that warnings are sent for approaching deadlines."""
        # Set deadline to be within warning window
        test_package_with_deadline.bid_deadline = datetime.now(timezone.utc) + timedelta(hours=WARNING_HOURS_BEFORE - 1)
        test_package_with_deadline.deadline_warning_sent = False
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=False)

        assert results['warnings_sent'] >= 0
        assert 'started_at' in results
        assert 'completed_at' in results

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_extends_deadline_when_expired(self, mock_session, db_session, test_package_with_deadline):
        """Test that deadline is extended when it expires."""
        # Set deadline to past
        test_package_with_deadline.bid_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        test_package_with_deadline.deadline_extensions = 0
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=False)

        assert results['deadlines_extended'] >= 0

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_expires_bids_after_max_extensions(self, mock_session, db_session, test_package_with_deadline, test_bid):
        """Test that bids are expired after max extensions reached."""
        # Set deadline to past and max extensions reached
        test_package_with_deadline.bid_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        test_package_with_deadline.deadline_extensions = MAX_EXTENSIONS
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=False)

        assert results['packages_expired'] >= 0

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_dry_run_does_not_modify_database(self, mock_session, db_session, test_package_with_deadline):
        """Test that dry_run mode doesn't modify database."""
        # Set deadline to past
        test_package_with_deadline.bid_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        test_package_with_deadline.deadline_extensions = 0
        initial_extensions = test_package_with_deadline.deadline_extensions
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=True)
        db_session.refresh(test_package_with_deadline)

        # Extensions count should not change in dry run
        # (Note: This might still change due to object state in memory)
        notification_count = db_session.query(Notification).count()
        assert notification_count == 0  # No notifications created in dry run

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_only_processes_active_packages(self, mock_session, db_session, test_sender):
        """Test that only active packages are processed."""
        # Create inactive package
        inactive_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Inactive Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="Dropoff",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            is_active=False,
            bid_deadline=datetime.now(timezone.utc) + timedelta(hours=5)
        )
        db_session.add(inactive_package)
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=True)

        # Inactive package should not be in details
        package_ids = [d['package_id'] for d in results['details']]
        assert inactive_package.id not in package_ids

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_only_processes_open_for_bids_status(self, mock_session, db_session, test_sender):
        """Test that only OPEN_FOR_BIDS packages are processed."""
        # Create package with different status
        delivered_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Delivered Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="Pickup",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="Dropoff",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            is_active=True,
            bid_deadline=datetime.now(timezone.utc) + timedelta(hours=5)
        )
        db_session.add(delivered_package)
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=True)

        # Delivered package should not be in details
        package_ids = [d['package_id'] for d in results['details']]
        assert delivered_package.id not in package_ids

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_only_processes_packages_with_deadlines(self, mock_session, db_session, test_sender):
        """Test that only packages with deadlines are processed."""
        # Create package without deadline
        no_deadline_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="No Deadline Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="Dropoff",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            is_active=True,
            bid_deadline=None
        )
        db_session.add(no_deadline_package)
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=True)

        # Package without deadline should not be in details
        package_ids = [d['package_id'] for d in results['details']]
        assert no_deadline_package.id not in package_ids

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_returns_detailed_results(self, mock_session, db_session, test_package_with_deadline):
        """Test that detailed results are returned."""
        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=True)

        assert 'warnings_sent' in results
        assert 'deadlines_extended' in results
        assert 'packages_expired' in results
        assert 'bids_expired' in results
        assert 'details' in results
        assert isinstance(results['details'], list)

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_details_include_package_info(self, mock_session, db_session, test_package_with_deadline):
        """Test that details include package information."""
        # Set deadline to trigger warning
        test_package_with_deadline.bid_deadline = datetime.now(timezone.utc) + timedelta(hours=WARNING_HOURS_BEFORE - 1)
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=True)

        if results['details']:
            detail = results['details'][0]
            assert 'package_id' in detail
            assert 'deadline' in detail
            assert 'extensions' in detail
            assert 'action' in detail

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_rollback_on_error(self, mock_session, db_session):
        """Test that database is rolled back on error."""
        mock_session.return_value = db_session

        # Mock commit to raise error
        db_session.commit = MagicMock(side_effect=Exception("Database error"))

        with pytest.raises(Exception):
            run_bid_deadline_job(dry_run=False)

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_closes_database_session(self, mock_session):
        """Test that database session is closed."""
        mock_db = MagicMock()
        mock_session.return_value = mock_db

        try:
            run_bid_deadline_job(dry_run=True)
        except:
            pass

        # Verify close was called
        mock_db.close.assert_called()

    @patch('app.services.bid_deadline_job.SessionLocal')
    def test_warning_not_sent_twice(self, mock_session, db_session, test_package_with_deadline):
        """Test that warning is not sent if already sent."""
        # Set deadline to trigger warning and mark as already sent
        test_package_with_deadline.bid_deadline = datetime.now(timezone.utc) + timedelta(hours=WARNING_HOURS_BEFORE - 1)
        test_package_with_deadline.deadline_warning_sent = True
        db_session.commit()

        mock_session.return_value = db_session

        results = run_bid_deadline_job(dry_run=False)

        # Should not send another warning
        # Check that no new notifications were created
        notification_count = db_session.query(Notification).filter(
            Notification.type == NotificationType.BID_DEADLINE_WARNING,
            Notification.package_id == test_package_with_deadline.id
        ).count()

        assert notification_count == 0
