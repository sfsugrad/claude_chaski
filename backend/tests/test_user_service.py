"""Tests for the user service business logic."""

import pytest
from app.services.user_service import (
    get_user_active_packages,
    can_deactivate_user,
    BLOCKING_STATUSES
)
from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash
from app.utils.tracking_id import generate_tracking_id


@pytest.fixture
def test_sender(db_session):
    """Create a test sender user."""
    user = User(
        email="sender@userservice.test",
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
        email="courier@userservice.test",
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


class TestGetUserActivePackages:
    """Tests for get_user_active_packages function."""

    def test_returns_empty_when_no_packages(self, db_session, test_sender):
        """Test returns empty lists when user has no packages."""
        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        assert as_sender == []
        assert as_courier == []

    def test_returns_packages_as_sender(self, db_session, test_sender):
        """Test returns packages where user is sender."""
        # Create package with blocking status
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Test Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup Location",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff Location",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        assert len(as_sender) == 1
        assert as_sender[0].id == package.id
        assert as_courier == []

    def test_returns_packages_as_courier(self, db_session, test_sender, test_courier):
        """Test returns packages where user is courier."""
        # Create package assigned to courier
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            courier_id=test_courier.id,
            description="Test Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="Pickup Location",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff Location",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_courier.id)

        assert as_sender == []
        assert len(as_courier) == 1
        assert as_courier[0].id == package.id

    def test_only_includes_blocking_statuses(self, db_session, test_sender):
        """Test that only packages with blocking statuses are included."""
        # Create packages with various statuses
        for status in [PackageStatus.NEW, PackageStatus.OPEN_FOR_BIDS, PackageStatus.IN_TRANSIT]:
            package = Package(
                tracking_id=generate_tracking_id(),
                sender_id=test_sender.id,
                description=f"Package {status}",
                size="small",
                weight_kg=1.0,
                status=status,
                pickup_address="Pickup",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="Dropoff",
                dropoff_lat=40.7589,
                dropoff_lng=-73.9851,
                is_active=True
            )
            db_session.add(package)

        # Create packages with non-blocking statuses
        delivered_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Delivered Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(delivered_package)

        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        # Should only return packages with blocking statuses (3)
        assert len(as_sender) == 3
        assert delivered_package not in as_sender

    def test_only_includes_active_packages(self, db_session, test_sender):
        """Test that only active packages are included."""
        # Create active package
        active_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Active Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )

        # Create inactive package
        inactive_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Inactive Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=False
        )

        db_session.add_all([active_package, inactive_package])
        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        assert len(as_sender) == 1
        assert as_sender[0].id == active_package.id

    def test_all_blocking_statuses_are_included(self, db_session, test_sender):
        """Test that all statuses in BLOCKING_STATUSES are returned."""
        # Create package for each blocking status
        for status in BLOCKING_STATUSES:
            package = Package(
                tracking_id=generate_tracking_id(),
                sender_id=test_sender.id,
                description=f"Package {status.value}",
                size="small",
                weight_kg=1.0,
                status=status,
                pickup_address="Pickup",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="Dropoff",
                dropoff_lat=40.7589,
                dropoff_lng=-73.9851,
                is_active=True
            )
            db_session.add(package)

        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        assert len(as_sender) == len(BLOCKING_STATUSES)

    def test_failed_packages_not_included(self, db_session, test_sender):
        """Test that FAILED packages are not included."""
        failed_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Failed Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.FAILED,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(failed_package)
        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        assert as_sender == []

    def test_canceled_packages_not_included(self, db_session, test_sender):
        """Test that CANCELED packages are not included."""
        canceled_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Canceled Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.CANCELED,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(canceled_package)
        db_session.commit()

        as_sender, as_courier = get_user_active_packages(db_session, test_sender.id)

        assert as_sender == []


class TestCanDeactivateUser:
    """Tests for can_deactivate_user function."""

    def test_can_deactivate_user_with_no_packages(self, db_session, test_sender):
        """Test that user with no packages can be deactivated."""
        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is True
        assert error_msg == ""
        assert details == {}

    def test_cannot_deactivate_user_with_sender_packages(self, db_session, test_sender):
        """Test that user with active sender packages cannot be deactivated."""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Active Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is False
        assert "Cannot deactivate user" in error_msg
        assert "as sender" in error_msg
        assert len(details["as_sender"]) == 1
        assert package.id in details["as_sender"]

    def test_cannot_deactivate_user_with_courier_packages(self, db_session, test_sender, test_courier):
        """Test that user with active courier packages cannot be deactivated."""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            courier_id=test_courier.id,
            description="In Transit Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_courier.id)

        assert can_deactivate is False
        assert "Cannot deactivate user" in error_msg
        assert "as courier" in error_msg
        assert len(details["as_courier"]) == 1
        assert package.id in details["as_courier"]

    def test_cannot_deactivate_user_with_both_types(self, db_session, test_sender, test_courier):
        """Test error message when user has packages as both sender and courier."""
        # Create package as sender
        sender_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Sender Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )

        # Create package as courier (assign to sender for this test)
        courier_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_courier.id,
            courier_id=test_sender.id,  # Sender is also courier for this package
            description="Courier Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )

        db_session.add_all([sender_package, courier_package])
        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is False
        assert "as sender" in error_msg
        assert "as courier" in error_msg
        assert " and " in error_msg
        assert len(details["as_sender"]) == 1
        assert len(details["as_courier"]) == 1

    def test_can_deactivate_user_with_terminal_packages(self, db_session, test_sender):
        """Test that user with only terminal state packages can be deactivated."""
        # Create delivered package
        delivered_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Delivered Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )

        # Create canceled package
        canceled_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Canceled Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.CANCELED,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )

        db_session.add_all([delivered_package, canceled_package])
        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is True
        assert error_msg == ""
        assert details == {}

    def test_details_include_correct_package_ids(self, db_session, test_sender):
        """Test that details include all package IDs."""
        # Create multiple packages
        packages = []
        for i in range(3):
            package = Package(
                tracking_id=generate_tracking_id(),
                sender_id=test_sender.id,
                description=f"Package {i}",
                size="small",
                weight_kg=1.0,
                status=PackageStatus.OPEN_FOR_BIDS,
                pickup_address="Pickup",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="Dropoff",
                dropoff_lat=40.7589,
                dropoff_lng=-73.9851,
                is_active=True
            )
            packages.append(package)
            db_session.add(package)

        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is False
        assert len(details["as_sender"]) == 3
        for package in packages:
            assert package.id in details["as_sender"]

    def test_error_message_shows_count(self, db_session, test_sender):
        """Test that error message shows correct package count."""
        # Create 5 packages
        for i in range(5):
            package = Package(
                tracking_id=generate_tracking_id(),
                sender_id=test_sender.id,
                description=f"Package {i}",
                size="small",
                weight_kg=1.0,
                status=PackageStatus.OPEN_FOR_BIDS,
                pickup_address="Pickup",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="Dropoff",
                dropoff_lat=40.7589,
                dropoff_lng=-73.9851,
                is_active=True
            )
            db_session.add(package)

        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert "5 package(s)" in error_msg

    def test_can_deactivate_user_with_failed_packages(self, db_session, test_sender):
        """Test that user with only failed packages can be deactivated."""
        failed_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Failed Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.FAILED,
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=True
        )
        db_session.add(failed_package)
        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is True
        assert error_msg == ""

    def test_inactive_packages_do_not_block_deactivation(self, db_session, test_sender):
        """Test that inactive packages don't block user deactivation."""
        # Create inactive package with blocking status
        inactive_package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_sender.id,
            description="Inactive Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.OPEN_FOR_BIDS,  # Blocking status
            pickup_address="Pickup",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Dropoff",
            dropoff_lat=40.7589,
            dropoff_lng=-73.9851,
            is_active=False  # But inactive
        )
        db_session.add(inactive_package)
        db_session.commit()

        can_deactivate, error_msg, details = can_deactivate_user(db_session, test_sender.id)

        assert can_deactivate is True
