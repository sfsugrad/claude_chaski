"""
Tests for route deactivation service and related functionality.

Tests cover:
- has_active_deliveries() function
- withdraw_pending_bids_for_courier() function
- cancel_selected_bids_for_courier() function
- is_route_expired() function
- Integration tests for courier endpoints with deactivation logic
- Bid creation with expired routes
- Matching endpoint with expired routes
"""

import pytest
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, CourierRoute
from app.models.bid import CourierBid, BidStatus
from app.models.notification import Notification, NotificationType
from app.utils.auth import get_password_hash, create_access_token
from app.utils.tracking_id import generate_tracking_id
from app.services.route_deactivation_service import (
    has_active_deliveries,
    withdraw_pending_bids_for_courier,
    cancel_selected_bids_for_courier,
    is_route_expired,
)


def get_auth_header(user: User):
    """Generate auth header for a user."""
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


# ============== Fixtures ==============

@pytest.fixture
def sender_user(db_session):
    """Create a sender user."""
    user = User(
        email="sender@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Sender",
        role=UserRole.SENDER,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def courier_user(db_session):
    """Create a courier user."""
    user = User(
        email="courier@test.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Courier",
        role=UserRole.COURIER,
        is_active=True,
        is_verified=True,
        max_deviation_km=10
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def active_route(db_session, courier_user):
    """Create an active courier route."""
    route = CourierRoute(
        courier_id=courier_user.id,
        start_address="123 Start St",
        start_lat=40.7128,
        start_lng=-74.0060,
        end_address="456 End St",
        end_lat=40.7580,
        end_lng=-73.9855,
        max_deviation_km=5,
        trip_date=datetime.now(timezone.utc) + timedelta(days=7),
        is_active=True
    )
    db_session.add(route)
    db_session.commit()
    db_session.refresh(route)
    return route


@pytest.fixture
def expired_route(db_session, courier_user):
    """Create an expired courier route (trip_date in the past)."""
    route = CourierRoute(
        courier_id=courier_user.id,
        start_address="123 Start St",
        start_lat=40.7128,
        start_lng=-74.0060,
        end_address="456 End St",
        end_lat=40.7580,
        end_lng=-73.9855,
        max_deviation_km=5,
        trip_date=datetime.now(timezone.utc) - timedelta(days=1),
        is_active=True
    )
    db_session.add(route)
    db_session.commit()
    db_session.refresh(route)
    return route


@pytest.fixture
def open_package(db_session, sender_user):
    """Create a package open for bids."""
    package = Package(
            tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        description="Test package",
        size="SMALL",
        weight_kg=1.0,
        pickup_address="123 Pickup St",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="456 Dropoff St",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        status=PackageStatus.OPEN_FOR_BIDS,
        is_active=True,
        bid_count=0
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def pending_pickup_package(db_session, sender_user, courier_user):
    """Create a package in PENDING_PICKUP status."""
    package = Package(
            tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        description="Pending pickup package",
        size="SMALL",
        weight_kg=1.0,
        pickup_address="123 Pickup St",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="456 Dropoff St",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        status=PackageStatus.PENDING_PICKUP,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def in_transit_package(db_session, sender_user, courier_user):
    """Create a package in IN_TRANSIT status."""
    package = Package(
            tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        description="In transit package",
        size="MEDIUM",
        weight_kg=2.0,
        pickup_address="789 Pickup St",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="012 Dropoff St",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        status=PackageStatus.IN_TRANSIT,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


# ============== Test is_route_expired ==============

class TestIsRouteExpired:
    """Tests for is_route_expired() function."""

    def test_route_with_future_trip_date_not_expired(self, db_session, courier_user):
        """Route with future trip_date is not expired."""
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address="Start",
            start_lat=40.0,
            start_lng=-74.0,
            end_address="End",
            end_lat=41.0,
            end_lng=-73.0,
            max_deviation_km=5,
            trip_date=datetime.now(timezone.utc) + timedelta(days=7),
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        assert is_route_expired(route) is False

    def test_route_with_past_trip_date_is_expired(self, db_session, courier_user):
        """Route with past trip_date is expired."""
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address="Start",
            start_lat=40.0,
            start_lng=-74.0,
            end_address="End",
            end_lat=41.0,
            end_lng=-73.0,
            max_deviation_km=5,
            trip_date=datetime.now(timezone.utc) - timedelta(days=1),
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        assert is_route_expired(route) is True

    def test_route_without_trip_date_not_expired(self, db_session, courier_user):
        """Route without trip_date (indefinite) is not expired."""
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address="Start",
            start_lat=40.0,
            start_lng=-74.0,
            end_address="End",
            end_lat=41.0,
            end_lng=-73.0,
            max_deviation_km=5,
            trip_date=None,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        assert is_route_expired(route) is False


# ============== Test has_active_deliveries ==============

class TestHasActiveDeliveries:
    """Tests for has_active_deliveries() function."""

    def test_no_active_deliveries(self, db_session, courier_user):
        """Courier with no packages has no active deliveries."""
        has_active, packages = has_active_deliveries(db_session, courier_user.id)
        assert has_active is False
        assert len(packages) == 0

    def test_has_pending_pickup_delivery(self, db_session, courier_user, pending_pickup_package):
        """Courier with PENDING_PICKUP package has active delivery."""
        has_active, packages = has_active_deliveries(db_session, courier_user.id)
        assert has_active is True
        assert len(packages) == 1
        assert packages[0].id == pending_pickup_package.id

    def test_has_in_transit_delivery(self, db_session, courier_user, in_transit_package):
        """Courier with IN_TRANSIT package has active delivery."""
        has_active, packages = has_active_deliveries(db_session, courier_user.id)
        assert has_active is True
        assert len(packages) == 1
        assert packages[0].id == in_transit_package.id

    def test_has_multiple_active_deliveries(self, db_session, courier_user, pending_pickup_package, in_transit_package):
        """Courier with multiple active packages returns all of them."""
        has_active, packages = has_active_deliveries(db_session, courier_user.id)
        assert has_active is True
        assert len(packages) == 2

    def test_delivered_package_not_active(self, db_session, sender_user, courier_user):
        """Delivered package is not considered active."""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            description="Delivered package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.DELIVERED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        has_active, packages = has_active_deliveries(db_session, courier_user.id)
        assert has_active is False
        assert len(packages) == 0


# ============== Test withdraw_pending_bids_for_courier ==============

class TestWithdrawPendingBids:
    """Tests for withdraw_pending_bids_for_courier() function."""

    def test_withdraw_pending_bids(self, db_session, courier_user, open_package, active_route):
        """Pending bids are withdrawn and package bid_count decremented."""
        # Create pending bid
        bid = CourierBid(
            package_id=open_package.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        open_package.bid_count = 1
        db_session.commit()

        withdrawn_ids = withdraw_pending_bids_for_courier(db_session, courier_user.id)
        db_session.commit()

        assert len(withdrawn_ids) == 1
        assert bid.id in withdrawn_ids

        db_session.refresh(bid)
        db_session.refresh(open_package)
        assert bid.status == BidStatus.WITHDRAWN
        assert bid.withdrawn_at is not None
        assert open_package.bid_count == 0

    def test_withdraw_only_pending_bids(self, db_session, courier_user, sender_user, active_route):
        """Only PENDING bids are withdrawn, not other statuses."""
        # Create packages
        pkg1 = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Package 1",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True,
            bid_count=1
        )
        pkg2 = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Package 2",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="789 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="012 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True,
            bid_count=1
        )
        db_session.add_all([pkg1, pkg2])
        db_session.commit()

        # Create bids with different statuses
        pending_bid = CourierBid(
            package_id=pkg1.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        rejected_bid = CourierBid(
            package_id=pkg2.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=25.0,
            status=BidStatus.REJECTED
        )
        db_session.add_all([pending_bid, rejected_bid])
        db_session.commit()

        withdrawn_ids = withdraw_pending_bids_for_courier(db_session, courier_user.id)
        db_session.commit()

        assert len(withdrawn_ids) == 1
        assert pending_bid.id in withdrawn_ids

        db_session.refresh(pending_bid)
        db_session.refresh(rejected_bid)
        assert pending_bid.status == BidStatus.WITHDRAWN
        assert rejected_bid.status == BidStatus.REJECTED  # Unchanged

    def test_withdraw_bids_for_specific_route(self, db_session, courier_user, sender_user):
        """Withdraw bids only for a specific route."""
        # Create two routes
        route1 = CourierRoute(
            courier_id=courier_user.id,
            start_address="Route 1 Start",
            start_lat=40.0,
            start_lng=-74.0,
            end_address="Route 1 End",
            end_lat=41.0,
            end_lng=-73.0,
            max_deviation_km=5,
            is_active=True
        )
        route2 = CourierRoute(
            courier_id=courier_user.id,
            start_address="Route 2 Start",
            start_lat=42.0,
            start_lng=-72.0,
            end_address="Route 2 End",
            end_lat=43.0,
            end_lng=-71.0,
            max_deviation_km=5,
            is_active=False
        )
        db_session.add_all([route1, route2])
        db_session.commit()

        # Create packages
        pkg1 = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Package 1",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True,
            bid_count=1
        )
        pkg2 = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Package 2",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="789 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="012 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True,
            bid_count=1
        )
        db_session.add_all([pkg1, pkg2])
        db_session.commit()

        # Create bids for different routes
        bid1 = CourierBid(
            package_id=pkg1.id,
            courier_id=courier_user.id,
            route_id=route1.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        bid2 = CourierBid(
            package_id=pkg2.id,
            courier_id=courier_user.id,
            route_id=route2.id,
            proposed_price=25.0,
            status=BidStatus.PENDING
        )
        db_session.add_all([bid1, bid2])
        db_session.commit()

        # Withdraw only for route1
        withdrawn_ids = withdraw_pending_bids_for_courier(db_session, courier_user.id, route1.id)
        db_session.commit()

        assert len(withdrawn_ids) == 1
        assert bid1.id in withdrawn_ids

        db_session.refresh(bid1)
        db_session.refresh(bid2)
        assert bid1.status == BidStatus.WITHDRAWN
        assert bid2.status == BidStatus.PENDING  # Unchanged


# ============== Test cancel_selected_bids_for_courier ==============

class TestCancelSelectedBids:
    """Tests for cancel_selected_bids_for_courier() function."""

    def test_cancel_selected_bid_resets_package(self, db_session, sender_user, courier_user, active_route):
        """Selected bid is cancelled and package reset to OPEN_FOR_BIDS."""
        # Create package with selected bid
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            description="Selected package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.BID_SELECTED,
            is_active=True,
            bid_deadline=datetime.now(timezone.utc) + timedelta(hours=12)
        )
        db_session.add(package)
        db_session.commit()

        bid = CourierBid(
            package_id=package.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=20.0,
            status=BidStatus.SELECTED,
            selected_at=datetime.now(timezone.utc)
        )
        db_session.add(bid)
        db_session.commit()

        package.selected_bid_id = bid.id
        package.bid_selected_at = datetime.now(timezone.utc)
        db_session.commit()

        original_deadline = package.bid_deadline

        cancelled = cancel_selected_bids_for_courier(db_session, courier_user.id)
        db_session.commit()

        assert len(cancelled) == 1
        assert cancelled[0]["package_id"] == package.id

        db_session.refresh(package)
        db_session.refresh(bid)

        assert bid.status == BidStatus.WITHDRAWN
        assert package.status == PackageStatus.OPEN_FOR_BIDS
        assert package.courier_id is None
        assert package.selected_bid_id is None
        assert package.bid_selected_at is None
        # Original bid_deadline is preserved
        assert package.bid_deadline == original_deadline

    def test_does_not_cancel_for_in_transit_package(self, db_session, sender_user, courier_user, active_route):
        """Does not cancel bids for packages already in transit."""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            courier_id=courier_user.id,
            description="In transit package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.IN_TRANSIT,  # Not BID_SELECTED
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        bid = CourierBid(
            package_id=package.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=20.0,
            status=BidStatus.SELECTED
        )
        db_session.add(bid)
        package.selected_bid_id = bid.id
        db_session.commit()

        cancelled = cancel_selected_bids_for_courier(db_session, courier_user.id)

        assert len(cancelled) == 0


# ============== Integration Tests: Courier Endpoints ==============

class TestDeleteRouteWithDeactivation:
    """Tests for DELETE /api/couriers/routes/{id} with deactivation logic."""

    def test_delete_route_blocked_by_active_delivery(self, client, db_session, courier_user, active_route, pending_pickup_package):
        """Cannot delete route when courier has active deliveries."""
        response = client.delete(
            f"/api/couriers/routes/{active_route.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 409
        assert "active deliveries" in response.json()["detail"].lower()
        assert str(pending_pickup_package.id) in response.json()["detail"]

    def test_delete_route_withdraws_pending_bids(self, client, db_session, courier_user, sender_user, active_route):
        """Deleting route withdraws pending bids."""
        # Create package and bid
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Test package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True,
            bid_count=1
        )
        db_session.add(package)
        db_session.commit()

        bid = CourierBid(
            package_id=package.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.delete(
            f"/api/couriers/routes/{active_route.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert data["bids_withdrawn"] == 1

        db_session.refresh(bid)
        assert bid.status == BidStatus.WITHDRAWN

    def test_delete_route_success_no_deliveries(self, client, db_session, courier_user, active_route):
        """Can delete route when no active deliveries."""
        response = client.delete(
            f"/api/couriers/routes/{active_route.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        assert "deactivated successfully" in response.json()["message"]

        db_session.refresh(active_route)
        assert active_route.is_active is False


class TestCreateRouteWithDeactivation:
    """Tests for POST /api/couriers/routes with deactivation logic."""

    def test_create_route_blocked_by_active_delivery(self, client, db_session, courier_user, active_route, pending_pickup_package):
        """Cannot create new route when courier has active deliveries."""
        response = client.post(
            "/api/couriers/routes",
            json={
                "start_address": "New Start",
                "start_lat": 40.0,
                "start_lng": -74.0,
                "end_address": "New End",
                "end_lat": 41.0,
                "end_lng": -73.0,
                "max_deviation_km": 5
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 409
        assert "active deliveries" in response.json()["detail"].lower()

    def test_create_route_deactivates_old_and_withdraws_bids(self, client, db_session, courier_user, sender_user, active_route):
        """Creating new route deactivates old route and withdraws its bids."""
        # Create bid on old route
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Test package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True,
            bid_count=1
        )
        db_session.add(package)
        db_session.commit()

        bid = CourierBid(
            package_id=package.id,
            courier_id=courier_user.id,
            route_id=active_route.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            "/api/couriers/routes",
            json={
                "start_address": "New Start",
                "start_lat": 42.0,
                "start_lng": -72.0,
                "end_address": "New End",
                "end_lat": 43.0,
                "end_lng": -71.0,
                "max_deviation_km": 5
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 201

        db_session.refresh(active_route)
        db_session.refresh(bid)
        assert active_route.is_active is False
        assert bid.status == BidStatus.WITHDRAWN


class TestActivateRouteWithDeactivation:
    """Tests for PUT /api/couriers/routes/{id}/activate with deactivation logic."""

    def test_activate_route_blocked_by_active_delivery(self, client, db_session, courier_user, active_route, pending_pickup_package):
        """Cannot activate route when courier has active deliveries."""
        # Create inactive route to activate
        inactive_route = CourierRoute(
            courier_id=courier_user.id,
            start_address="Inactive Start",
            start_lat=42.0,
            start_lng=-72.0,
            end_address="Inactive End",
            end_lat=43.0,
            end_lng=-71.0,
            max_deviation_km=5,
            is_active=False
        )
        db_session.add(inactive_route)
        db_session.commit()

        response = client.put(
            f"/api/couriers/routes/{inactive_route.id}/activate",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 409
        assert "active deliveries" in response.json()["detail"].lower()


# ============== Integration Tests: Bids with Expired Routes ==============

class TestBidCreationWithExpiredRoute:
    """Tests for bid creation with expired routes."""

    def test_cannot_bid_with_expired_route(self, client, db_session, courier_user, sender_user, expired_route):
        """Cannot create bid when route is expired."""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Test package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            "/api/bids",
            json={
                "tracking_id": package.tracking_id,
                "proposed_price": 20.0,
                "route_id": expired_route.id
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()

    def test_can_bid_with_valid_route(self, client, db_session, courier_user, sender_user, active_route):
        """Can create bid when route is valid (not expired)."""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Test package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 St",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            "/api/bids",
            json={
                "tracking_id": package.tracking_id,
                "proposed_price": 20.0,
                "route_id": active_route.id
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 201

    def test_cannot_bid_with_inactive_route(self, client, db_session, courier_user, sender_user):
        """Cannot create bid with an inactive route."""
        inactive_route = CourierRoute(
            courier_id=courier_user.id,
            start_address="Start",
            start_lat=40.0,
            start_lng=-74.0,
            end_address="End",
            end_lat=41.0,
            end_lng=-73.0,
            max_deviation_km=5,
            is_active=False
        )
        db_session.add(inactive_route)
        db_session.commit()

        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Test package",
            size="SMALL",
            weight_kg=1.0,
            pickup_address="123 St",
            pickup_lat=40.0,
            pickup_lng=-74.0,
            dropoff_address="456 St",
            dropoff_lat=41.0,
            dropoff_lng=-73.0,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            "/api/bids",
            json={
                "tracking_id": package.tracking_id,
                "proposed_price": 20.0,
                "route_id": inactive_route.id
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "inactive" in response.json()["detail"].lower()


# ============== Integration Tests: Matching with Expired Routes ==============

class TestMatchingWithExpiredRoutes:
    """Tests for matching endpoint with expired routes."""

    def test_cannot_match_with_expired_route(self, client, db_session, courier_user, expired_route):
        """Cannot get matching packages with expired route."""
        response = client.get(
            f"/api/matching/packages-along-route/{expired_route.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "expired" in response.json()["detail"].lower()

    def test_can_match_with_valid_route(self, client, db_session, courier_user, active_route):
        """Can get matching packages with valid route."""
        response = client.get(
            f"/api/matching/packages-along-route/{active_route.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        # No packages in test, but endpoint should succeed
        assert isinstance(response.json(), list)
