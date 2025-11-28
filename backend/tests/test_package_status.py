"""
Tests for package status transition validation service.

New Status Flow:
NEW → OPEN_FOR_BIDS → BID_SELECTED → PENDING_PICKUP → IN_TRANSIT → DELIVERED
                                                              ↓           ↓
                                                           FAILED ←←← FAILED
                                                              ↓
                                                        (admin only)
                                                              ↓
                                                        OPEN_FOR_BIDS

CANCELED can occur from NEW, OPEN_FOR_BIDS, BID_SELECTED, PENDING_PICKUP (not after)
"""
import pytest
from datetime import datetime

from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.utils.auth import get_password_hash
from app.services.package_status import (
    validate_transition,
    get_allowed_next_statuses,
    can_mark_delivered,
    transition_package,
    get_status_progress,
    can_cancel,
    ALLOWED_TRANSITIONS,
)


class TestValidateTransition:
    """Tests for validate_transition function."""

    def test_valid_transition_new_to_open_for_bids(self):
        """NEW -> OPEN_FOR_BIDS should be valid."""
        is_valid, error = validate_transition(PackageStatus.NEW, PackageStatus.OPEN_FOR_BIDS)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_new_to_canceled(self):
        """NEW -> CANCELED should be valid."""
        is_valid, error = validate_transition(PackageStatus.NEW, PackageStatus.CANCELED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_open_for_bids_to_bid_selected(self):
        """OPEN_FOR_BIDS -> BID_SELECTED should be valid."""
        is_valid, error = validate_transition(PackageStatus.OPEN_FOR_BIDS, PackageStatus.BID_SELECTED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_open_for_bids_to_canceled(self):
        """OPEN_FOR_BIDS -> CANCELED should be valid."""
        is_valid, error = validate_transition(PackageStatus.OPEN_FOR_BIDS, PackageStatus.CANCELED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_bid_selected_to_pending_pickup(self):
        """BID_SELECTED -> PENDING_PICKUP should be valid."""
        is_valid, error = validate_transition(PackageStatus.BID_SELECTED, PackageStatus.PENDING_PICKUP)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_bid_selected_to_open_for_bids(self):
        """BID_SELECTED -> OPEN_FOR_BIDS (courier declined) should be valid."""
        is_valid, error = validate_transition(PackageStatus.BID_SELECTED, PackageStatus.OPEN_FOR_BIDS)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_bid_selected_to_canceled(self):
        """BID_SELECTED -> CANCELED should be valid."""
        is_valid, error = validate_transition(PackageStatus.BID_SELECTED, PackageStatus.CANCELED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_pending_pickup_to_in_transit(self):
        """PENDING_PICKUP -> IN_TRANSIT should be valid."""
        is_valid, error = validate_transition(PackageStatus.PENDING_PICKUP, PackageStatus.IN_TRANSIT)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_pending_pickup_to_failed(self):
        """PENDING_PICKUP -> FAILED should be valid."""
        is_valid, error = validate_transition(PackageStatus.PENDING_PICKUP, PackageStatus.FAILED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_pending_pickup_to_canceled(self):
        """PENDING_PICKUP -> CANCELED should be valid."""
        is_valid, error = validate_transition(PackageStatus.PENDING_PICKUP, PackageStatus.CANCELED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_in_transit_to_delivered(self):
        """IN_TRANSIT -> DELIVERED should be valid."""
        is_valid, error = validate_transition(PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_in_transit_to_failed(self):
        """IN_TRANSIT -> FAILED should be valid."""
        is_valid, error = validate_transition(PackageStatus.IN_TRANSIT, PackageStatus.FAILED)
        assert is_valid is True
        assert error == ""

    def test_valid_transition_failed_to_open_for_bids_admin(self):
        """FAILED -> OPEN_FOR_BIDS (admin only) should be valid when is_admin=True."""
        is_valid, error = validate_transition(PackageStatus.FAILED, PackageStatus.OPEN_FOR_BIDS, is_admin=True)
        assert is_valid is True
        assert error == ""

    def test_invalid_transition_failed_to_open_for_bids_non_admin(self):
        """FAILED -> OPEN_FOR_BIDS should be invalid for non-admins."""
        is_valid, error = validate_transition(PackageStatus.FAILED, PackageStatus.OPEN_FOR_BIDS, is_admin=False)
        assert is_valid is False
        assert "admin" in error.lower()

    def test_invalid_transition_new_to_in_transit(self):
        """NEW -> IN_TRANSIT (skipping steps) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.NEW, PackageStatus.IN_TRANSIT)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_open_for_bids_to_in_transit(self):
        """OPEN_FOR_BIDS -> IN_TRANSIT (skipping BID_SELECTED) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.OPEN_FOR_BIDS, PackageStatus.IN_TRANSIT)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_open_for_bids_to_delivered(self):
        """OPEN_FOR_BIDS -> DELIVERED (skipping all steps) should be invalid."""
        is_valid, error = validate_transition(PackageStatus.OPEN_FOR_BIDS, PackageStatus.DELIVERED)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_in_transit_to_canceled(self):
        """IN_TRANSIT -> CANCELED should be invalid (can only FAIL or DELIVER)."""
        is_valid, error = validate_transition(PackageStatus.IN_TRANSIT, PackageStatus.CANCELED)
        assert is_valid is False
        assert "Invalid status transition" in error

    def test_invalid_transition_from_delivered(self):
        """DELIVERED is terminal - no transitions allowed."""
        is_valid, error = validate_transition(PackageStatus.DELIVERED, PackageStatus.OPEN_FOR_BIDS)
        assert is_valid is False
        assert "terminal state" in error.lower()

    def test_invalid_transition_from_canceled(self):
        """CANCELED is terminal - no transitions allowed."""
        is_valid, error = validate_transition(PackageStatus.CANCELED, PackageStatus.OPEN_FOR_BIDS)
        assert is_valid is False
        assert "terminal state" in error.lower()

    def test_same_status_transition(self):
        """Transitioning to same status should be invalid."""
        is_valid, error = validate_transition(PackageStatus.OPEN_FOR_BIDS, PackageStatus.OPEN_FOR_BIDS)
        assert is_valid is False
        assert "already in" in error.lower()


class TestGetAllowedNextStatuses:
    """Tests for get_allowed_next_statuses function."""

    def test_new_allows_open_for_bids_and_canceled(self):
        """NEW allows OPEN_FOR_BIDS and CANCELED."""
        allowed = get_allowed_next_statuses(PackageStatus.NEW)
        assert "open_for_bids" in allowed
        assert "canceled" in allowed
        assert len(allowed) == 2

    def test_open_for_bids_allows_bid_selected_and_canceled(self):
        """OPEN_FOR_BIDS allows BID_SELECTED and CANCELED."""
        allowed = get_allowed_next_statuses(PackageStatus.OPEN_FOR_BIDS)
        assert "bid_selected" in allowed
        assert "canceled" in allowed
        assert len(allowed) == 2

    def test_bid_selected_allows_pending_pickup_open_for_bids_canceled(self):
        """BID_SELECTED allows PENDING_PICKUP, OPEN_FOR_BIDS, and CANCELED."""
        allowed = get_allowed_next_statuses(PackageStatus.BID_SELECTED)
        assert "pending_pickup" in allowed
        assert "open_for_bids" in allowed
        assert "canceled" in allowed
        assert len(allowed) == 3

    def test_pending_pickup_allows_in_transit_failed_canceled(self):
        """PENDING_PICKUP allows IN_TRANSIT, FAILED, and CANCELED."""
        allowed = get_allowed_next_statuses(PackageStatus.PENDING_PICKUP)
        assert "in_transit" in allowed
        assert "failed" in allowed
        assert "canceled" in allowed
        assert len(allowed) == 3

    def test_in_transit_allows_delivered_and_failed(self):
        """IN_TRANSIT allows DELIVERED and FAILED."""
        allowed = get_allowed_next_statuses(PackageStatus.IN_TRANSIT)
        assert "delivered" in allowed
        assert "failed" in allowed
        assert len(allowed) == 2

    def test_delivered_allows_nothing(self):
        """DELIVERED is terminal - no next statuses."""
        allowed = get_allowed_next_statuses(PackageStatus.DELIVERED)
        assert allowed == []

    def test_canceled_allows_nothing(self):
        """CANCELED is terminal - no next statuses."""
        allowed = get_allowed_next_statuses(PackageStatus.CANCELED)
        assert allowed == []

    def test_failed_allows_open_for_bids(self):
        """FAILED allows OPEN_FOR_BIDS (admin only)."""
        allowed = get_allowed_next_statuses(PackageStatus.FAILED, is_admin=True)
        assert "open_for_bids" in allowed
        assert len(allowed) == 1

    def test_failed_allows_nothing_for_non_admin(self):
        """FAILED allows nothing for non-admins."""
        allowed = get_allowed_next_statuses(PackageStatus.FAILED, is_admin=False)
        assert allowed == []


class TestCanMarkDelivered:
    """Tests for can_mark_delivered function."""

    def test_can_deliver_when_in_transit_no_proof_required(self, db_session):
        """Package in IN_TRANSIT with requires_proof=False can be delivered."""
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

    def test_cannot_deliver_when_pending_pickup(self, db_session):
        """Package in PENDING_PICKUP cannot be directly delivered."""
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
            status=PackageStatus.PENDING_PICKUP,
            requires_proof=False
        )

        can_deliver, result = can_mark_delivered(package)
        assert can_deliver is False
        assert "must be In Transit" in result

    def test_cannot_deliver_when_open_for_bids(self, db_session):
        """Package in OPEN_FOR_BIDS cannot be directly delivered."""
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
            status=PackageStatus.OPEN_FOR_BIDS,
            requires_proof=False
        )

        can_deliver, result = can_mark_delivered(package)
        assert can_deliver is False
        assert "must be In Transit" in result


class TestCanCancel:
    """Tests for can_cancel function."""

    def test_can_cancel_new(self):
        """NEW packages can be canceled."""
        assert can_cancel(PackageStatus.NEW) is True

    def test_can_cancel_open_for_bids(self):
        """OPEN_FOR_BIDS packages can be canceled."""
        assert can_cancel(PackageStatus.OPEN_FOR_BIDS) is True

    def test_can_cancel_bid_selected(self):
        """BID_SELECTED packages can be canceled."""
        assert can_cancel(PackageStatus.BID_SELECTED) is True

    def test_can_cancel_pending_pickup(self):
        """PENDING_PICKUP packages can be canceled."""
        assert can_cancel(PackageStatus.PENDING_PICKUP) is True

    def test_cannot_cancel_in_transit(self):
        """IN_TRANSIT packages cannot be canceled (can only FAIL or DELIVER)."""
        assert can_cancel(PackageStatus.IN_TRANSIT) is False

    def test_cannot_cancel_delivered(self):
        """DELIVERED packages cannot be canceled."""
        assert can_cancel(PackageStatus.DELIVERED) is False

    def test_cannot_cancel_canceled(self):
        """Already CANCELED packages cannot be canceled."""
        assert can_cancel(PackageStatus.CANCELED) is False

    def test_cannot_cancel_failed(self):
        """FAILED packages cannot be canceled."""
        assert can_cancel(PackageStatus.FAILED) is False


class TestTransitionPackage:
    """Tests for transition_package function."""

    def test_transition_new_to_open_for_bids(self, db_session):
        """Test transitioning from NEW to OPEN_FOR_BIDS."""
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
            status=PackageStatus.NEW,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        updated_package, error = transition_package(db_session, package, PackageStatus.OPEN_FOR_BIDS, actor_id=sender.id)

        assert error == ""
        assert updated_package.status == PackageStatus.OPEN_FOR_BIDS
        assert updated_package.status_changed_at is not None

    def test_transition_bid_selected_to_pending_pickup(self, db_session):
        """Test transitioning from BID_SELECTED to PENDING_PICKUP."""
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
            status=PackageStatus.BID_SELECTED,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        updated_package, error = transition_package(db_session, package, PackageStatus.PENDING_PICKUP, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.PENDING_PICKUP
        assert updated_package.pending_pickup_at is not None

    def test_transition_pending_pickup_to_in_transit(self, db_session):
        """Test transitioning from PENDING_PICKUP to IN_TRANSIT."""
        sender = User(
            email="sender_intransit@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        courier = User(
            email="courier_intransit@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

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
            status=PackageStatus.PENDING_PICKUP,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        updated_package, error = transition_package(db_session, package, PackageStatus.IN_TRANSIT, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.IN_TRANSIT
        assert updated_package.in_transit_at is not None
        assert updated_package.pickup_time is not None

    def test_transition_in_transit_to_delivered(self, db_session):
        """Test transitioning from IN_TRANSIT to DELIVERED."""
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

        updated_package, error = transition_package(db_session, package, PackageStatus.DELIVERED, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.DELIVERED
        assert updated_package.delivery_time is not None

    def test_transition_to_failed(self, db_session):
        """Test transitioning from IN_TRANSIT to FAILED."""
        sender = User(
            email="sender_fail@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        courier = User(
            email="courier_fail@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

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

        updated_package, error = transition_package(db_session, package, PackageStatus.FAILED, courier.id)

        assert error == ""
        assert updated_package.status == PackageStatus.FAILED
        assert updated_package.failed_at is not None

    def test_invalid_transition_returns_error(self, db_session):
        """Test that invalid transitions return an error."""
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
            status=PackageStatus.OPEN_FOR_BIDS,
            requires_proof=True
        )
        db_session.add(package)
        db_session.commit()

        # Try invalid transition (OPEN_FOR_BIDS -> DELIVERED)
        updated_package, error = transition_package(db_session, package, PackageStatus.DELIVERED, 1)

        assert error != ""
        assert "Invalid status transition" in error
        assert package.status == PackageStatus.OPEN_FOR_BIDS  # Unchanged


class TestGetStatusProgress:
    """Tests for get_status_progress function."""

    def test_progress_new(self, db_session):
        """Test progress calculation for NEW status."""
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
            status=PackageStatus.NEW,
            requires_proof=True,
            created_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == 0
        assert progress["is_terminal"] is False
        assert progress["is_canceled"] is False

    def test_progress_open_for_bids(self, db_session):
        """Test progress calculation for OPEN_FOR_BIDS status."""
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
            status=PackageStatus.OPEN_FOR_BIDS,
            requires_proof=True,
            created_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == 1
        assert progress["is_terminal"] is False

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

        assert progress["current_step"] == 5
        assert progress["is_terminal"] is True
        assert progress["progress_percent"] == 100

    def test_progress_canceled(self, db_session):
        """Test progress calculation for CANCELED status."""
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
            status=PackageStatus.CANCELED,
            requires_proof=True,
            created_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        assert progress["current_step"] == -1
        assert progress["is_terminal"] is True
        assert progress["is_canceled"] is True
        assert progress["progress_percent"] == 0

    def test_progress_failed(self, db_session):
        """Test progress calculation for FAILED status."""
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
            status=PackageStatus.FAILED,
            requires_proof=True,
            created_at=datetime.utcnow()
        )

        progress = get_status_progress(package)

        # FAILED is not terminal because admin can retry
        assert progress["is_terminal"] is False
        assert progress["is_failed"] is True


class TestAllowedTransitionsComplete:
    """Comprehensive tests for all allowed transitions."""

    @pytest.mark.parametrize("from_status,to_status,expected_valid", [
        # NEW transitions
        (PackageStatus.NEW, PackageStatus.OPEN_FOR_BIDS, True),
        (PackageStatus.NEW, PackageStatus.CANCELED, True),
        (PackageStatus.NEW, PackageStatus.BID_SELECTED, False),
        (PackageStatus.NEW, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.NEW, PackageStatus.DELIVERED, False),

        # OPEN_FOR_BIDS transitions
        (PackageStatus.OPEN_FOR_BIDS, PackageStatus.BID_SELECTED, True),
        (PackageStatus.OPEN_FOR_BIDS, PackageStatus.CANCELED, True),
        (PackageStatus.OPEN_FOR_BIDS, PackageStatus.NEW, False),
        (PackageStatus.OPEN_FOR_BIDS, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.OPEN_FOR_BIDS, PackageStatus.DELIVERED, False),

        # BID_SELECTED transitions
        (PackageStatus.BID_SELECTED, PackageStatus.PENDING_PICKUP, True),
        (PackageStatus.BID_SELECTED, PackageStatus.OPEN_FOR_BIDS, True),
        (PackageStatus.BID_SELECTED, PackageStatus.CANCELED, True),
        (PackageStatus.BID_SELECTED, PackageStatus.IN_TRANSIT, False),
        (PackageStatus.BID_SELECTED, PackageStatus.DELIVERED, False),

        # PENDING_PICKUP transitions
        (PackageStatus.PENDING_PICKUP, PackageStatus.IN_TRANSIT, True),
        (PackageStatus.PENDING_PICKUP, PackageStatus.FAILED, True),
        (PackageStatus.PENDING_PICKUP, PackageStatus.CANCELED, True),
        (PackageStatus.PENDING_PICKUP, PackageStatus.DELIVERED, False),
        (PackageStatus.PENDING_PICKUP, PackageStatus.NEW, False),

        # IN_TRANSIT transitions
        (PackageStatus.IN_TRANSIT, PackageStatus.DELIVERED, True),
        (PackageStatus.IN_TRANSIT, PackageStatus.FAILED, True),
        (PackageStatus.IN_TRANSIT, PackageStatus.CANCELED, False),
        (PackageStatus.IN_TRANSIT, PackageStatus.PENDING_PICKUP, False),
        (PackageStatus.IN_TRANSIT, PackageStatus.NEW, False),

        # DELIVERED transitions (terminal)
        (PackageStatus.DELIVERED, PackageStatus.NEW, False),
        (PackageStatus.DELIVERED, PackageStatus.OPEN_FOR_BIDS, False),
        (PackageStatus.DELIVERED, PackageStatus.CANCELED, False),
        (PackageStatus.DELIVERED, PackageStatus.FAILED, False),

        # CANCELED transitions (terminal)
        (PackageStatus.CANCELED, PackageStatus.NEW, False),
        (PackageStatus.CANCELED, PackageStatus.OPEN_FOR_BIDS, False),
        (PackageStatus.CANCELED, PackageStatus.DELIVERED, False),

        # FAILED transitions (admin retry)
        (PackageStatus.FAILED, PackageStatus.NEW, False),
        (PackageStatus.FAILED, PackageStatus.DELIVERED, False),
        (PackageStatus.FAILED, PackageStatus.CANCELED, False),
    ])
    def test_transition(self, from_status, to_status, expected_valid):
        """Parameterized test for all status transitions."""
        is_valid, _ = validate_transition(from_status, to_status)
        assert is_valid == expected_valid, f"Expected {from_status.value} -> {to_status.value} to be {'valid' if expected_valid else 'invalid'}"
