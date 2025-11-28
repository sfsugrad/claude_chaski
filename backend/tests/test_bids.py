"""
Tests for the bidding system routes.

Tests cover:
- Creating bids on packages
- Withdrawing bids
- Selecting bids (sender)
- Getting courier's bids
- Getting package bids
- Confirming pickup
"""

import pytest
from datetime import datetime, timezone, timedelta

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.bid import CourierBid, BidStatus
from app.utils.auth import get_password_hash, create_access_token


@pytest.fixture
def sender_user(db_session):
    """Create a sender user."""
    user = User(
        email="sender@example.com",
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
        email="courier@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Courier",
        role=UserRole.COURIER,
        is_active=True,
        is_verified=True,
        max_deviation_km=15
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def courier_user_2(db_session):
    """Create a second courier user."""
    user = User(
        email="courier2@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Test Courier 2",
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
def both_role_user(db_session):
    """Create a user with both role."""
    user = User(
        email="both@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Both Role User",
        role=UserRole.BOTH,
        is_active=True,
        is_verified=True,
        max_deviation_km=10
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def pending_package(db_session, sender_user):
    """Create a pending package."""
    package = Package(
        sender_id=sender_user.id,
        description="Test package for bidding",
        size="medium",
        weight_kg=5.0,
        pickup_address="123 Start St",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="456 End Ave",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        price=25.0,
        status=PackageStatus.PENDING,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def bidding_package(db_session, sender_user):
    """Create a package already in bidding status."""
    package = Package(
        sender_id=sender_user.id,
        description="Package in bidding phase",
        size="small",
        weight_kg=2.0,
        pickup_address="123 Start St",
        pickup_lat=40.7128,
        pickup_lng=-74.0060,
        dropoff_address="456 End Ave",
        dropoff_lat=40.7580,
        dropoff_lng=-73.9855,
        price=15.0,
        status=PackageStatus.BIDDING,
        bid_deadline=datetime.now(timezone.utc) + timedelta(hours=24),
        bid_count=1,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


def get_auth_header(user: User):
    """Generate auth header for a user."""
    token = create_access_token(data={"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


class TestCreateBid:
    """Tests for POST /api/bids"""

    def test_create_bid_success(self, client, db_session, courier_user, pending_package):
        """Courier successfully creates a bid on a pending package."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": pending_package.id,
                "proposed_price": 20.0,
                "estimated_delivery_hours": 12,
                "message": "I can deliver this quickly!"
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 201
        data = response.json()
        assert data["package_id"] == pending_package.id
        assert data["courier_id"] == courier_user.id
        assert data["proposed_price"] == 20.0
        assert data["estimated_delivery_hours"] == 12
        assert data["message"] == "I can deliver this quickly!"
        assert data["status"] == "pending"
        assert data["courier_name"] == courier_user.full_name

        # Verify package status changed to BIDDING
        db_session.refresh(pending_package)
        assert pending_package.status == PackageStatus.BIDDING
        assert pending_package.bid_deadline is not None
        assert pending_package.bid_count == 1

    def test_create_bid_both_role(self, client, db_session, both_role_user, pending_package):
        """User with 'both' role can create a bid."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": pending_package.id,
                "proposed_price": 22.0
            },
            headers=get_auth_header(both_role_user)
        )

        assert response.status_code == 201
        data = response.json()
        assert data["proposed_price"] == 22.0

    def test_create_bid_on_bidding_package(self, client, db_session, courier_user, bidding_package):
        """Courier can bid on a package already in bidding status."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": bidding_package.id,
                "proposed_price": 18.0
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 201
        db_session.refresh(bidding_package)
        assert bidding_package.bid_count == 2  # Was 1, now 2

    def test_create_bid_sender_forbidden(self, client, sender_user, pending_package):
        """Sender cannot create a bid."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": pending_package.id,
                "proposed_price": 20.0
            },
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 403
        assert "Only couriers can place bids" in response.json()["detail"]

    def test_create_bid_own_package_forbidden(self, client, db_session, both_role_user):
        """Cannot bid on own package."""
        # Create a package owned by the both-role user
        package = Package(
            sender_id=both_role_user.id,
            description="Own package",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Start",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 End",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            "/api/bids",
            json={
                "package_id": package.id,
                "proposed_price": 20.0
            },
            headers=get_auth_header(both_role_user)
        )

        assert response.status_code == 400
        assert "Cannot bid on your own package" in response.json()["detail"]

    def test_create_bid_duplicate_forbidden(self, client, db_session, courier_user, pending_package):
        """Cannot place duplicate bid on same package."""
        # Create first bid
        bid = CourierBid(
            package_id=pending_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        # Try to create second bid
        response = client.post(
            "/api/bids",
            json={
                "package_id": pending_package.id,
                "proposed_price": 18.0
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "already placed a bid" in response.json()["detail"]

    def test_create_bid_on_delivered_package(self, client, db_session, courier_user, sender_user):
        """Cannot bid on a delivered package."""
        package = Package(
            sender_id=sender_user.id,
            description="Delivered package",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Start",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 End",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.DELIVERED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            "/api/bids",
            json={
                "package_id": package.id,
                "proposed_price": 20.0
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "Cannot bid on package with status" in response.json()["detail"]

    def test_create_bid_package_not_found(self, client, courier_user):
        """Cannot bid on non-existent package."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": 99999,
                "proposed_price": 20.0
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 404
        assert "Package not found" in response.json()["detail"]

    def test_create_bid_invalid_price(self, client, courier_user, pending_package):
        """Cannot create bid with invalid price."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": pending_package.id,
                "proposed_price": -5.0  # Invalid negative price
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 422


class TestWithdrawBid:
    """Tests for DELETE /api/bids/{bid_id}"""

    def test_withdraw_bid_success(self, client, db_session, courier_user, bidding_package):
        """Courier successfully withdraws a pending bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.delete(
            f"/api/bids/{bid.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        assert "Bid withdrawn successfully" in response.json()["message"]

        db_session.refresh(bid)
        assert bid.status == BidStatus.WITHDRAWN
        assert bid.withdrawn_at is not None

    def test_withdraw_bid_not_found(self, client, courier_user):
        """Cannot withdraw non-existent bid."""
        response = client.delete(
            "/api/bids/99999",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 404
        assert "Bid not found" in response.json()["detail"]

    def test_withdraw_bid_not_owner(self, client, db_session, courier_user, courier_user_2, bidding_package):
        """Cannot withdraw another user's bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.delete(
            f"/api/bids/{bid.id}",
            headers=get_auth_header(courier_user_2)  # Different user
        )

        assert response.status_code == 403
        assert "You can only withdraw your own bids" in response.json()["detail"]

    def test_withdraw_selected_bid_forbidden(self, client, db_session, courier_user, bidding_package):
        """Cannot withdraw a selected bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.SELECTED
        )
        db_session.add(bid)
        db_session.commit()

        response = client.delete(
            f"/api/bids/{bid.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "Cannot withdraw bid with status" in response.json()["detail"]


class TestSelectBid:
    """Tests for POST /api/bids/{bid_id}/select"""

    def test_select_bid_success(self, client, db_session, sender_user, courier_user, bidding_package):
        """Sender successfully selects a bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/select",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "selected"
        assert data["selected_at"] is not None

        db_session.refresh(bid)
        assert bid.status == BidStatus.SELECTED

        db_session.refresh(bidding_package)
        assert bidding_package.status == PackageStatus.BID_SELECTED
        assert bidding_package.courier_id == courier_user.id
        assert bidding_package.selected_bid_id == bid.id
        assert bidding_package.price == 20.0

    def test_select_bid_rejects_others(self, client, db_session, sender_user, courier_user, courier_user_2, bidding_package):
        """Selecting a bid rejects other pending bids."""
        bid1 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        bid2 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user_2.id,
            proposed_price=22.0,
            status=BidStatus.PENDING
        )
        db_session.add_all([bid1, bid2])
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid1.id}/select",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 200

        db_session.refresh(bid1)
        db_session.refresh(bid2)
        assert bid1.status == BidStatus.SELECTED
        assert bid2.status == BidStatus.REJECTED

    def test_select_bid_not_sender(self, client, db_session, courier_user, courier_user_2, bidding_package):
        """Non-sender cannot select a bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/select",
            headers=get_auth_header(courier_user_2)
        )

        assert response.status_code == 403
        assert "Only the package sender can select a bid" in response.json()["detail"]

    def test_select_bid_not_pending(self, client, db_session, sender_user, courier_user, bidding_package):
        """Cannot select a non-pending bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.WITHDRAWN
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/select",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 400
        assert "Cannot select bid with status" in response.json()["detail"]

    def test_select_bid_package_not_bidding(self, client, db_session, sender_user, courier_user):
        """Cannot select bid if package is not in bidding status."""
        package = Package(
            sender_id=sender_user.id,
            description="Pending package",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Start",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 End",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,  # Not BIDDING
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        bid = CourierBid(
            package_id=package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/select",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 400
        assert "Cannot select bid for package with status" in response.json()["detail"]


class TestGetMyBids:
    """Tests for GET /api/bids/my-bids"""

    def test_get_my_bids_success(self, client, db_session, courier_user, bidding_package, sender_user):
        """Courier gets their bids."""
        bid1 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid1)
        db_session.commit()

        response = client.get(
            "/api/bids/my-bids",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["proposed_price"] == 20.0

    def test_get_my_bids_with_filter(self, client, db_session, courier_user, bidding_package, sender_user):
        """Courier can filter bids by status."""
        bid1 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )

        # Create another package for second bid
        package2 = Package(
            sender_id=sender_user.id,
            description="Another package",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Start",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 End",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.BIDDING,
            is_active=True
        )
        db_session.add(package2)
        db_session.commit()

        bid2 = CourierBid(
            package_id=package2.id,
            courier_id=courier_user.id,
            proposed_price=25.0,
            status=BidStatus.WITHDRAWN
        )
        db_session.add_all([bid1, bid2])
        db_session.commit()

        # Get only pending bids
        response = client.get(
            "/api/bids/my-bids?status_filter=pending",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["status"] == "pending"

    def test_get_my_bids_sender_forbidden(self, client, sender_user):
        """Sender cannot access my-bids endpoint."""
        response = client.get(
            "/api/bids/my-bids",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 403
        assert "Only couriers can view their bids" in response.json()["detail"]


class TestGetPackageBids:
    """Tests for GET /api/bids/package/{package_id}"""

    def test_sender_sees_all_bids(self, client, db_session, sender_user, courier_user, courier_user_2, bidding_package):
        """Package sender sees all bids."""
        bid1 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        bid2 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user_2.id,
            proposed_price=22.0,
            status=BidStatus.PENDING
        )
        db_session.add_all([bid1, bid2])
        bidding_package.bid_count = 2
        db_session.commit()

        response = client.get(
            f"/api/bids/package/{bidding_package.id}",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["bids"]) == 2
        assert data["bid_count"] == 2

    def test_courier_sees_only_own_bid(self, client, db_session, sender_user, courier_user, courier_user_2, bidding_package):
        """Courier sees only their own bid."""
        bid1 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        bid2 = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user_2.id,
            proposed_price=22.0,
            status=BidStatus.PENDING
        )
        db_session.add_all([bid1, bid2])
        db_session.commit()

        response = client.get(
            f"/api/bids/package/{bidding_package.id}",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["bids"]) == 1
        assert data["bids"][0]["courier_id"] == courier_user.id

    def test_package_not_found(self, client, sender_user):
        """Returns 404 for non-existent package."""
        response = client.get(
            "/api/bids/package/99999",
            headers=get_auth_header(sender_user)
        )

        assert response.status_code == 404


class TestConfirmPickup:
    """Tests for POST /api/bids/{bid_id}/confirm-pickup"""

    def test_confirm_pickup_success(self, client, db_session, sender_user, courier_user, bidding_package):
        """Courier confirms pickup on selected bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.SELECTED
        )
        db_session.add(bid)
        bidding_package.status = PackageStatus.BID_SELECTED
        bidding_package.courier_id = courier_user.id
        bidding_package.selected_bid_id = bid.id
        db_session.commit()
        db_session.refresh(bid)

        response = client.post(
            f"/api/bids/{bid.id}/confirm-pickup",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Pickup confirmed"
        assert data["status"] == "pending_pickup"

        db_session.refresh(bidding_package)
        assert bidding_package.status == PackageStatus.PENDING_PICKUP

    def test_confirm_pickup_not_owner(self, client, db_session, sender_user, courier_user, courier_user_2, bidding_package):
        """Non-owner cannot confirm pickup."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.SELECTED
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/confirm-pickup",
            headers=get_auth_header(courier_user_2)
        )

        assert response.status_code == 403
        assert "Only the bid owner can confirm pickup" in response.json()["detail"]

    def test_confirm_pickup_not_selected(self, client, db_session, courier_user, bidding_package):
        """Cannot confirm pickup on non-selected bid."""
        bid = CourierBid(
            package_id=bidding_package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.PENDING
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/confirm-pickup",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "Only selected bids can be confirmed" in response.json()["detail"]

    def test_confirm_pickup_wrong_package_status(self, client, db_session, courier_user, sender_user):
        """Cannot confirm pickup if package is not in BID_SELECTED status."""
        package = Package(
            sender_id=sender_user.id,
            description="Package not in right status",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Start",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 End",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.BIDDING,  # Not BID_SELECTED
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        bid = CourierBid(
            package_id=package.id,
            courier_id=courier_user.id,
            proposed_price=20.0,
            status=BidStatus.SELECTED
        )
        db_session.add(bid)
        db_session.commit()

        response = client.post(
            f"/api/bids/{bid.id}/confirm-pickup",
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 400
        assert "not in the correct state" in response.json()["detail"]


class TestBidDeadline:
    """Tests for bid deadline behavior."""

    def test_first_bid_sets_deadline(self, client, db_session, courier_user, pending_package):
        """First bid sets 24-hour deadline."""
        response = client.post(
            "/api/bids",
            json={
                "package_id": pending_package.id,
                "proposed_price": 20.0
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 201

        db_session.refresh(pending_package)
        assert pending_package.bid_deadline is not None
        # Verify deadline is approximately 24 hours from now
        # Handle both naive and aware datetimes (SQLite returns naive)
        deadline = pending_package.bid_deadline
        if deadline.tzinfo is None:
            deadline = deadline.replace(tzinfo=timezone.utc)
        time_diff = deadline - datetime.now(timezone.utc)
        assert 23 < time_diff.total_seconds() / 3600 < 25  # Between 23-25 hours

    def test_subsequent_bid_does_not_change_deadline(self, client, db_session, courier_user, courier_user_2, bidding_package):
        """Subsequent bids don't change the deadline."""
        original_deadline = bidding_package.bid_deadline

        response = client.post(
            "/api/bids",
            json={
                "package_id": bidding_package.id,
                "proposed_price": 20.0
            },
            headers=get_auth_header(courier_user)
        )

        assert response.status_code == 201

        db_session.refresh(bidding_package)
        assert bidding_package.bid_deadline == original_deadline
