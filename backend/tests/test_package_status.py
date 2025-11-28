"""
Tests for package status transition validation service.
"""
import pytest
from datetime import datetime, timedelta

from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash
from app.services.package_status import (
    validate_transition,
    get_allowed_next_statuses,
    can_mark_delivered,
    transition_package,
    get_status_progress,
    ALLOWED_TRANSITIONS,
)


class TestValidateTransition:
    """Tests for validate_transition function."""

    def test_valid_transition_pending_to_matched(self):
        """PENDING -> MATCHED should be valid."""
        is_valid, error = validate_transition(PackageStatus.PENDING, PackageStatus.MATCHED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_pending_to_cancelled(self):
        """PENDING -> CANCELLED should be valid."""
        is_valid, error = validate_transition(PackageStatus.PENDING, PackageStatus.CANCELLED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_matched_to_picked_up(self):
        """MATCHED -> PICKED_UP should be valid."""
        is_valid, error = validate_transition(PackageStatus.MATCHED, PackageStatus.PICKED_UP)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_matched_to_pending(self):
        """MATCHED -> PENDING (decline) should be valid."""
        is_valid, error = validate_transition(PackageStatus.MATCHED, PackageStatus.PENDING)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_matched_to_cancelled(self):
        """MATCHED -> CANCELLED should be valid."""
        is_valid, error = validate_transition(PackageStatus.MATCHED, PackageStatus.CANCELLED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_picked_up_to_in_transit(self):
        """PICKED_UP -> IN_TRANSIT should be valid."""
        is_valid, error = validate_transition(PackageStatus.PICKED_UP, PackageStatus.IN_TRANSIT)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_in_transit_to_delivered(self):
        """IN_TRANSIT -> DELIVERED should be valid."""
        is_valid, error = validate_transition(PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED)
        assert is_valid is True
        assert error == ""

    def test_invalid_transition_pending_to_picked_up(self):
        """PENDING -> PICKED_UP (skipping MATCHED) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.PENDING, PackageStatus.PICKED_UP)
        assert is_valid is False
        assert "Invalid status transition" in error
        assert "Cannot go from Pending to Picked Up" in error

    def test_invalid_transition_pending_to_in_transit(self):
        """PENDING -> IN_TRANSIT (skipping steps) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.PENDING, PackageStatus.IN_TRANSIT)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_pending_to_delivered(self):
        """PENDING -> DELIVERED (skipping all steps) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.PENDING, PackageStatus.DELIVERED)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_matched_to_in_transit(self):
        """MATCHED -> IN_TRANSIT (skipping PICKED_UP) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.MATCHED, PackageStatus.IN_TRANSIT)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_matched_to_delivered(self):
        """MATCHED -> DELIVERED (skipping steps) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.MATCHED, PackageStatus.DELIVERED)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_picked_up_to_delivered(self):
        """PICKED_UP -> DELIVERED (skipping IN_TRANSIT) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.PICKED_UP, PackageStatus.DELIVERED)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_from_delivered(self):
        """DELIVERED is terminal - no transitions allowed."""
        is_valid, error = validate_transition(PackageStatus.DELIVERED, PackageStatus.PENDING)
        assert is_valid is False
        assert "terminal state" in error.lower()

    def test_invalid_transition_from_cancelled(self):
        """CANCELLED is terminal - no transitions allowed."""
        is_valid, error = validate_transition(PackageStatus.CANCELLED, PackageStatus.PENDING)
        assert is_valid is False
        assert "terminal state" in error.lower()

    def test_same_status_transition(self):
        """Transitioning to same status should be invalid."""
        is_valid, error = validate_transition(PackageStatus.PENDING, PackageStatus.PENDING)
        assert is_valid is False
        assert "already in" in error.lower()


class TestGetAllowedNextStatuses:
    """Tests for get_allowed_next_statuses function."""

    def test_pending_allows_matched_and_cancelled(self):
        """PENDING allows MATCHED and CANCELLED."""
        allowed = get_allowed_next_statuses(PackageStatus.PENDING)
        assert "matched" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 2

    def test_matched_allows_picked_up_pending_cancelled(self):
        """MATCHED allows PICKED_UP, PENDING, and CANCELLED."""
        allowed = get_allowed_next_statuses(PackageStatus.MATCHED)
        assert "picked_up" in allowed
        assert "pending" in allowed
        assert "cancelled" in allowed
        assert len(allowed) == 3

    def test_picked_up_allows_only_in_transit(self):
        """PICKED_UP only allows IN_TRANSIT."""
        allowed = get_allowed_next_statuses(PackageStatus.PICKED_UP)
        assert allowed == ["in_transit"]

    def test_in_transit_allows_only_delivered(self):
        """IN_TRANSIT only allows DELIVERED."""
        allowed = get_allowed_next_statuses(PackageStatus.IN_TRANSIT)
        assert allowed == ["delivered"]

    def test_delivered_allows_nothing(self):
        """DELIVERED is terminal - no next statuses."""
        allowed = get_allowed_next_statuses(PackageStatus.DELIVERED)
        assert allowed == []

    def test_cancelled_allows_nothing(self):
        """CANCELLED is terminal - no next statuses."""
        allowed = get_allowed_next_statuses(PackageStatus.CANCELLED)
        assert allowed == []


class TestCanMarkDelivered:
    """Tests for can_mark_delivered function."""

    def test_can_deliver_when_in_transit_no_proof_required(self, db_session):
        """Package in IN_TRANSIT with requires_proof=False can be delivered."""
        # Create a package
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.IN_TRANSIT,
            requires_proof=False
        )

        can_deliver, result = can_mark_delivered(package)
        assert can_deliver is True
        assert result == ""

    def test_can_deliver_when_in_transit_proof_required(self, db_session):
        """Package in IN_TRANSIT with requires_proof=True returns proof_required."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.IN_TRANSIT,
            requires_proof=True
        )

        can_deliver, result = can_mark_delivered(package)
        assert can_deliver is True
        assert result == "proof_required"

    def test_cannot_deliver_when_picked_up(self, db_session):
        """Package in PICKED_UP cannot be directly delivered."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.PICKED_UP,
            requires_proof=False
        )

        can_deliver, result = can_mark_delivered(package)
        assert can_deliver is False
        assert "must be In Transit" in result

    def test_cannot_deliver_when_matched(self, db_session):
        """Package in MATCHED cannot be directly delivered."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.MATCHED,
            requires_proof=False
        )

        can_deliver, result = can_mark_delivered(package)
        assert can_deliver is False
        assert "must be In Transit" in result


class TestTransitionPackage:
    """Tests for transition_package function."""

    def test_transition_pending_to_matched(self, db_session):
        """Test transitioning from PENDING to MATCHED."""
        # Create sender
        sender = User(
            email="sender_trans@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Create courier
        courier = User(
            email="courier_trans@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        # Create package
        package = Package(
            sender_id=sender.id,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.PENDING,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        # Transition to MATCHED
        updated_package, error = transition_package(db_session, package, PackageStatus.MATCHED, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.MATCHED
        assert updated_package.courier_id == courier.id
        assert updated_package.matched_at is not None
        assert updated_package.status_changed_at is not None

    def test_transition_matched_to_picked_up(self, db_session):
        """Test transitioning from MATCHED to PICKED_UP."""
        # Create users
        sender = User(
            email="sender_pickup@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        courier = User(
            email="courier_pickup@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        # Create package in MATCHED status
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.MATCHED,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        # Transition to PICKED_UP
        updated_package, error = transition_package(db_session, package, PackageStatus.PICKED_UP, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.PICKED_UP
        assert updated_package.picked_up_at is not None
        assert updated_package.pickup_time is not None

    def test_transition_in_transit_to_delivered(self, db_session):
        """Test transitioning from IN_TRANSIT to DELIVERED."""
        # Create users
        sender = User(
            email="sender_deliver@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        courier = User(
            email="courier_deliver@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        # Create package in IN_TRANSIT status
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.IN_TRANSIT,
            requires_proof=False
        )
        db_session.add(package)
        db_session.commit()

        # Transition to DELIVERED
        updated_package, error = transition_package(db_session, package, PackageStatus.DELIVERED, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.DELIVERED
        assert updated_package.delivery_time is not None

    def test_transition_matched_to_pending_decline(self, db_session):
        """Test declining (MATCHED -> PENDING) clears courier."""
        # Create users
        sender = User(
            email="sender_decline@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        courier = User(
            email="courier_decline@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        # Create package in MATCHED status
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.MATCHED,
            matched_at=datetime.utcnow(),
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        # Transition back to PENDING (decline)
        updated_package, error = transition_package(db_session, package, PackageStatus.PENDING, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.PENDING
        assert updated_package.courier_id is None
        assert updated_package.matched_at is None

    def test_invalid_transition_returns_error(self, db_session):
        """Test that invalid transitions return an error."""
        # Create sender
        sender = User(
            email="sender_invalid@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Create package
        package = Package(
            sender_id=sender.id,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.PENDING,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        # Try invalid transition (PENDING -> DELIVERED)
        updated_package, error = transition_package(db_session, package, PackageStatus.DELIVERED, 1)

        assert error != ""
        assert "Invalid status transition" in error
        assert package.status == PackageStatus.PENDING  # Unchanged


class TestGetStatusProgress:
    """Tests for get_status_progress function."""

    def test_progress_pending(self, db_session):
        """Test progress calculation for PENDING status."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.PENDING,
            requires_proof=True,
            created_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == 0
        assert progress["is_terminal"] is False
        assert progress["is_cancelled"] is False
        assert progress["progress_percent"] == 0

    def test_progress_matched(self, db_session):
        """Test progress calculation for MATCHED status."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.MATCHED,
            requires_proof=True,
            created_at=datetime.utcnow(),
            matched_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == 1
        assert progress["is_terminal"] is False
        assert progress["progress_percent"] == 25

    def test_progress_delivered(self, db_session):
        """Test progress calculation for DELIVERED status."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.DELIVERED,
            requires_proof=True,
            created_at=datetime.utcnow(),
            delivery_time=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == 4
        assert progress["is_terminal"] is True
        assert progress["progress_percent"] == 100

    def test_progress_cancelled(self, db_session):
        """Test progress calculation for CANCELLED status."""
        package = Package(
            sender_id=1,
            description="Test",
            size="small",
            weight_kg=1.0,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            status=PackageStatus.CANCELLED,
            requires_proof=True,
            created_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == -1
        assert progress["is_terminal"] is True
        assert progress["is_cancelled"] is True
        assert progress["progress_percent"] == 0


class TestAllowedTransitionsComplete:
    """Comprehensive tests for all allowed transitions."""

    @pytest.mark.parametrize("from_status,to_status,expected_valid", [
        # PENDING transitions
        (PackageStatus.PENDING, PackageStatus.MATCHED, True),
        (PackageStatus.PENDING, PackageStatus.CANCELLED, True),
        (PackageStatus.PENDING, PackageStatus.PICKED_UP, False),
        (PackageStatus.PENDING, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.PENDING, PackageStatus.DELIVERED, False),

        # MATCHED transitions
        (PackageStatus.MATCHED, PackageStatus.PICKED_UP, True),
        (PackageStatus.MATCHED, PackageStatus.PENDING, True),
        (PackageStatus.MATCHED, PackageStatus.CANCELLED, True),
        (PackageStatus.MATCHED, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.MATCHED, PackageStatus.DELIVERED, False),

        # PICKED_UP transitions
        (PackageStatus.PICKED_UP, PackageStatus.IN_TRANSIT, True),
        (PackageStatus.PICKED_UP, PackageStatus.PENDING, False),
        (PackageStatus.PICKED_UP, PackageStatus.MATCHED, False),
        (PackageStatus.PICKED_UP, PackageStatus.DELIVERED, False),
        (PackageStatus.PICKED_UP, PackageStatus.CANCELLED, False),

        # IN_TRANSIT transitions
        (PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED, True),
        (PackageStatus.IN_TRANSIT, PackageStatus.PENDING, False),
        (PackageStatus.IN_TRANSIT, PackageStatus.MATCHED, False),
        (PackageStatus.IN_TRANSIT, PackageStatus.PICKED_UP, False),
        (PackageStatus.IN_TRANSIT, PackageStatus.CANCELLED, False),

        # DELIVERED transitions (terminal)
        (PackageStatus.DELIVERED, PackageStatus.PENDING, False),
        (PackageStatus.DELIVERED, PackageStatus.MATCHED, False),
        (PackageStatus.DELIVERED, PackageStatus.PICKED_UP, False),
        (PackageStatus.DELIVERED, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.DELIVERED, PackageStatus.CANCELLED, False),

        # CANCELLED transitions (terminal)
        (PackageStatus.CANCELLED, PackageStatus.PENDING, False),
        (PackageStatus.CANCELLED, PackageStatus.MATCHED, False),
        (PackageStatus.CANCELLED, PackageStatus.PICKED_UP, False),
        (PackageStatus.CANCELLED, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.CANCELLED, PackageStatus.DELIVERED, False),
    ])
    def test_transition(self, from_status, to_status, expected_valid):
        """Parameterized test for all status transitions."""
        is_valid, _ = validate_transition(from_status, to_status)
        assert is_valid == expected_valid, f"Expected {from_status.value} -> {to_status.value} to be {'valid' if expected_valid else 'invalid'}"
