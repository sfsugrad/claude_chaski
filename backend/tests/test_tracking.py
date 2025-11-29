"""
Tests for tracking API endpoints.

Coverage:
- Tracking sessions: start, end, active session, multiple sessions, authorization
- Location updates: update location, ETA calculation, Redis caching
- Location history: get history, filtering, pagination, authorization
- Tracking events & delays: report delay, ETA updates, event filtering
- Public access: sender/courier access, authorization
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import patch, MagicMock, AsyncMock
from fastapi.testclient import TestClient

from app.models.user import User
from app.models.package import Package, PackageStatus
from app.models.tracking import TrackingSession, LocationUpdate, TrackingEvent, TrackingEventType
from app.utils.tracking_id import generate_tracking_id


def get_auth_header(user: User) -> dict:
    """Helper to get authorization header for a user."""
    from app.utils.auth import create_access_token
    token = create_access_token({"sub": user.email})
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def courier_user(db_session):
    """Create a courier user."""
    user = User(
        email="courier@test.com",
        hashed_password="hashed",
        full_name="Test Courier",
        role="courier",
        is_verified=True,
        max_deviation_km=10.0
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def sender_user(db_session):
    """Create a sender user."""
    user = User(
        email="sender@test.com",
        hashed_password="hashed",
        full_name="Test Sender",
        role="sender",
        is_verified=True
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def package_in_transit(db_session, sender_user, courier_user):
    """Create a package in transit."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        description="Test Package",
        size="medium",
        weight_kg=5.0,
        price=25.00,
        status=PackageStatus.IN_TRANSIT,
        pickup_address="123 Main St",
        dropoff_address="456 Oak Ave",
        pickup_lat=37.7749,
        pickup_lng=-122.4194,
        dropoff_lat=37.7849,
        dropoff_lng=-122.4094,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def matched_package(db_session, sender_user, courier_user):
    """Create a matched package."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        description="Matched Package",
        size="medium",
        weight_kg=3.0,
        price=20.00,
        status=PackageStatus.PENDING_PICKUP,
        pickup_address="100 Start St",
        dropoff_address="200 End Ave",
        pickup_lat=37.7749,
        pickup_lng=-122.4194,
        dropoff_lat=37.7849,
        dropoff_lng=-122.4094,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture(autouse=True)
def mock_redis():
    """Mock Redis to prevent connection attempts."""
    # Create a proper async mock for Redis
    mock_redis_client = MagicMock()
    mock_redis_client.ping = AsyncMock(return_value=True)
    mock_redis_client.publish = AsyncMock(return_value=None)
    mock_redis_client.set = AsyncMock(return_value=True)
    mock_redis_client.setex = AsyncMock(return_value=True)
    mock_redis_client.get = AsyncMock(return_value=None)
    mock_redis_client.delete = AsyncMock(return_value=True)
    mock_redis_client.hset = AsyncMock(return_value=True)
    mock_redis_client.hget = AsyncMock(return_value=None)
    mock_redis_client.expire = AsyncMock(return_value=True)

    # Patch redis.Redis to return our mock
    with patch('app.services.redis_client.redis.Redis', return_value=mock_redis_client):
        yield mock_redis_client


class TestTrackingSessions:
    """Tests for tracking session management."""

    def test_start_tracking_session(self, client, courier_user, matched_package, db_session, mock_redis):
        """Test starting a tracking session as courier."""
        headers = get_auth_header(courier_user)

        response = client.post(
            f"/api/tracking/sessions/{matched_package.tracking_id}/start",
            headers=headers,
            json={
                "initial_latitude": 37.7749,
                "initial_longitude": -122.4194,
                "share_live_location": True
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["package_id"] == matched_package.id
        assert data["courier_id"] == courier_user.id
        assert data["is_active"] is True
        assert data["share_live_location"] is True
        assert data["last_latitude"] == 37.7749
        assert data["last_longitude"] == -122.4194

        # Verify session created in database
        session = db_session.query(TrackingSession).filter_by(
            package_id=matched_package.id
        ).first()
        assert session is not None
        assert session.is_active is True

    def test_start_tracking_without_initial_location(self, client, courier_user, matched_package):
        """Test starting tracking without initial coordinates."""
        headers = get_auth_header(courier_user)

        response = client.post(
            f"/api/tracking/sessions/{matched_package.tracking_id}/start",
            headers=headers,
            json={"share_live_location": True}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["last_latitude"] is None
        assert data["last_longitude"] is None

    def test_start_tracking_by_numeric_id(self, client, courier_user, matched_package):
        """Test starting tracking with numeric package ID."""
        headers = get_auth_header(courier_user)

        response = client.post(
            f"/api/tracking/sessions/{matched_package.id}/start",
            headers=headers,
            json={"share_live_location": True}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["package_id"] == matched_package.id

    def test_start_tracking_not_assigned_courier(self, client, package_in_transit, db_session):
        """Test that non-assigned courier cannot start tracking."""
        # Create another courier
        other_courier = User(
            email="other@test.com",
            hashed_password="hashed",
            full_name="Other Courier",
            role="courier",
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        headers = get_auth_header(other_courier)
        response = client.post(
            f"/api/tracking/sessions/{package_in_transit.tracking_id}/start",
            headers=headers,
            json={"share_live_location": True}
        )

        assert response.status_code == 403
        assert "not the assigned courier" in response.json()["detail"]

    def test_start_tracking_invalid_package_status(self, client, courier_user, db_session):
        """Test cannot start tracking for package with invalid status."""
        # Create package with NEW status assigned to courier
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=1,
            courier_id=courier_user.id,  # Assign to courier so we get 400 not 403
            description="New Package",
            size="medium",
            weight_kg=2.0,
            status=PackageStatus.NEW,
            pickup_address="123 St",
            dropoff_address="456 Ave",
            pickup_lat=37.7,
            pickup_lng=-122.4,
            dropoff_lat=37.8,
            dropoff_lng=-122.3,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{package.tracking_id}/start",
            headers=headers,
            json={"share_live_location": True}
        )

        assert response.status_code == 400
        assert "Cannot start tracking" in response.json()["detail"]

    def test_start_tracking_replaces_active_session(self, client, courier_user, package_in_transit, db_session):
        """Test starting new session ends existing active session."""
        # Create existing active session
        old_session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow() - timedelta(hours=1)
        )
        db_session.add(old_session)
        db_session.commit()
        old_session_id = old_session.id

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{package_in_transit.tracking_id}/start",
            headers=headers,
            json={"share_live_location": True}
        )

        assert response.status_code == 200

        # Verify old session is no longer active
        db_session.refresh(old_session)
        assert old_session.is_active is False
        assert old_session.ended_at is not None

        # Verify new session is active
        new_sessions = db_session.query(TrackingSession).filter(
            TrackingSession.package_id == package_in_transit.id,
            TrackingSession.is_active == True
        ).all()
        assert len(new_sessions) == 1
        assert new_sessions[0].id != old_session_id

    def test_end_tracking_session(self, client, courier_user, package_in_transit, db_session):
        """Test ending a tracking session."""
        # Create active session
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/end",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_active"] is False
        assert data["ended_at"] is not None

        # Verify session ended in database
        db_session.refresh(session)
        assert session.is_active is False
        assert session.ended_at is not None

    def test_end_tracking_wrong_courier(self, client, package_in_transit, db_session):
        """Test that wrong courier cannot end tracking session."""
        # Create session with original courier
        original_courier = db_session.query(User).filter_by(id=package_in_transit.courier_id).first()
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=original_courier.id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        # Try to end with different courier
        other_courier = User(
            email="other2@test.com",
            hashed_password="hashed",
            full_name="Another Courier",
            role="courier",
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        headers = get_auth_header(other_courier)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/end",
            headers=headers
        )

        assert response.status_code == 403
        assert "not authorized" in response.json()["detail"]

    def test_end_nonexistent_session(self, client, courier_user):
        """Test ending non-existent session returns 404."""
        headers = get_auth_header(courier_user)
        response = client.post(
            "/api/tracking/sessions/99999/end",
            headers=headers
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_active_session(self, client, sender_user, package_in_transit, db_session):
        """Test getting active session for a package."""
        # Create active session
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow(),
            last_latitude=37.7749,
            last_longitude=-122.4194
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/packages/{package_in_transit.tracking_id}/session",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["package_id"] == package_in_transit.id
        assert data["is_active"] is True

    def test_get_active_session_unauthorized(self, client, matched_package, db_session):
        """Test unauthorized user cannot get tracking session."""
        # Create unrelated user
        other_user = User(
            email="unauthorized@test.com",
            hashed_password="hashed",
            full_name="Unauthorized",
            role="sender",
            is_verified=True
        )
        db_session.add(other_user)
        db_session.commit()

        headers = get_auth_header(other_user)
        response = client.get(
            f"/api/tracking/packages/{matched_package.tracking_id}/session",
            headers=headers
        )

        assert response.status_code == 403
        assert "don't have access" in response.json()["detail"]


class TestLocationUpdates:
    """Tests for location update functionality."""

    def test_update_location(self, client, courier_user, package_in_transit, db_session, mock_redis):
        """Test updating courier location during tracking."""
        # Create active session
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 37.7750,
                "longitude": -122.4195,
                "accuracy_meters": 10.0,
                "heading": 45.0,
                "speed_mps": 8.3,
                "battery_level": 85.0,
                "source": "gps"
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["latitude"] == 37.7750
        assert data["longitude"] == -122.4195
        assert data["heading"] == 45.0
        assert data["speed_mps"] == 8.3

        # Verify location update stored
        location = db_session.query(LocationUpdate).filter_by(
            session_id=session.id
        ).first()
        assert location is not None
        assert location.latitude == 37.7750
        assert location.accuracy_meters == 10.0

    def test_update_location_calculates_eta(self, client, courier_user, package_in_transit, db_session):
        """Test location update calculates new ETA."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 37.7750,
                "longitude": -122.4195,
                "speed_mps": 10.0
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert "estimated_arrival" in data
        assert "distance_remaining_meters" in data

        # Verify session updated with ETA
        db_session.refresh(session)
        assert session.estimated_arrival is not None
        assert session.distance_remaining_meters is not None

    def test_update_location_inactive_session(self, client, courier_user, package_in_transit, db_session):
        """Test cannot update location for inactive session."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=False,
            started_at=datetime.utcnow() - timedelta(hours=2),
            ended_at=datetime.utcnow() - timedelta(hours=1)
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 37.7750,
                "longitude": -122.4195
            }
        )

        assert response.status_code == 400
        assert "not active" in response.json()["detail"]

    def test_update_location_validation(self, client, courier_user, package_in_transit, db_session):
        """Test location update with invalid coordinates."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)

        # Invalid latitude
        response = client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 95.0,  # Out of range
                "longitude": -122.4
            }
        )
        assert response.status_code == 422

        # Invalid longitude
        response = client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 37.7,
                "longitude": -200.0  # Out of range
            }
        )
        assert response.status_code == 422

    def test_update_location_updates_session(self, client, courier_user, package_in_transit, db_session):
        """Test location update updates session last location."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow(),
            last_latitude=None,
            last_longitude=None
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)
        client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 37.7750,
                "longitude": -122.4195
            }
        )

        # Verify session updated
        db_session.refresh(session)
        assert session.last_latitude == 37.7750
        assert session.last_longitude == -122.4195
        assert session.last_location_at is not None

    def test_get_current_location(self, client, sender_user, package_in_transit, db_session):
        """Test getting current location for a package."""
        # Create session with location
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow(),
            last_latitude=37.7750,
            last_longitude=-122.4195,
            last_location_at=datetime.utcnow(),
            distance_remaining_meters=5000.0
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/packages/{package_in_transit.tracking_id}/location",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["latitude"] == 37.7750
        assert data["longitude"] == -122.4195
        assert "timestamp" in data
        assert data["distance_remaining_meters"] == 5000.0

    def test_get_current_location_no_session(self, client, sender_user, matched_package):
        """Test getting location returns 404 when no active session."""
        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/packages/{matched_package.tracking_id}/location",
            headers=headers
        )

        assert response.status_code == 404
        assert "No active tracking" in response.json()["detail"]

    def test_location_update_wrong_courier(self, client, package_in_transit, db_session):
        """Test wrong courier cannot update location."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        # Different courier
        other_courier = User(
            email="other3@test.com",
            hashed_password="hashed",
            full_name="Wrong Courier",
            role="courier",
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        headers = get_auth_header(other_courier)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/location",
            headers=headers,
            json={
                "latitude": 37.7750,
                "longitude": -122.4195
            }
        )

        assert response.status_code == 403

    def test_sender_can_view_location(self, client, sender_user, package_in_transit, db_session):
        """Test sender can view package location."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow(),
            last_latitude=37.7750,
            last_longitude=-122.4195,
            last_location_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/packages/{package_in_transit.tracking_id}/location",
            headers=headers
        )

        assert response.status_code == 200


class TestLocationHistory:
    """Tests for location history functionality."""

    def test_get_location_history(self, client, sender_user, package_in_transit, db_session):
        """Test getting location history for a session."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.flush()

        # Add location history
        for i in range(5):
            location = LocationUpdate(
                session_id=session.id,
                latitude=37.7750 + (i * 0.001),
                longitude=-122.4195 + (i * 0.001),
                timestamp=datetime.utcnow() + timedelta(minutes=i),
                source="gps"
            )
            db_session.add(location)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/history",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5
        assert all("latitude" in loc and "longitude" in loc for loc in data)

    def test_location_history_with_limit(self, client, sender_user, package_in_transit, db_session):
        """Test location history respects limit parameter."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.flush()

        # Add 10 location updates
        for i in range(10):
            location = LocationUpdate(
                session_id=session.id,
                latitude=37.7750,
                longitude=-122.4195,
                timestamp=datetime.utcnow() + timedelta(minutes=i),
                source="gps"
            )
            db_session.add(location)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/history?limit=5",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 5

    def test_location_history_with_since_filter(self, client, sender_user, package_in_transit, db_session):
        """Test filtering location history by timestamp."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.flush()

        base_time = datetime.utcnow()

        # Add locations at different times
        for i in range(5):
            location = LocationUpdate(
                session_id=session.id,
                latitude=37.7750,
                longitude=-122.4195,
                timestamp=base_time + timedelta(minutes=i*10),
                source="gps"
            )
            db_session.add(location)
        db_session.commit()

        # Filter for locations after 20 minutes
        since_time = (base_time + timedelta(minutes=20)).isoformat()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/history?since={since_time}",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3  # Only last 3 locations

    def test_location_history_invalid_since_format(self, client, sender_user, package_in_transit, db_session):
        """Test invalid since parameter returns error."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/history?since=invalid-date",
            headers=headers
        )

        assert response.status_code == 400
        assert "Invalid datetime format" in response.json()["detail"]

    def test_location_history_unauthorized(self, client, package_in_transit, db_session):
        """Test unauthorized user cannot view location history."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        # Unrelated user
        other_user = User(
            email="unauth@test.com",
            hashed_password="hashed",
            full_name="Unauthorized",
            role="sender",
            is_verified=True
        )
        db_session.add(other_user)
        db_session.commit()

        headers = get_auth_header(other_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/history",
            headers=headers
        )

        assert response.status_code == 403


class TestTrackingEvents:
    """Tests for tracking events and delay reporting."""

    def test_report_delay(self, client, courier_user, package_in_transit, db_session):
        """Test reporting a delivery delay."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow(),
            estimated_arrival=datetime.utcnow() + timedelta(minutes=30)
        )
        db_session.add(session)
        db_session.commit()
        original_eta = session.estimated_arrival

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/delay",
            headers=headers,
            json={
                "reason": "Heavy traffic on highway, expecting 15 minute delay",
                "estimated_delay_minutes": 15,
                "latitude": 37.7750,
                "longitude": -122.4195
            }
        )

        assert response.status_code == 200
        data = response.json()
        assert data["event_type"] == "delay_reported"
        assert "traffic" in data["description"].lower()

        # Verify ETA updated
        db_session.refresh(session)
        assert session.estimated_arrival > original_eta

        # Verify event created
        event = db_session.query(TrackingEvent).filter_by(
            session_id=session.id,
            event_type=TrackingEventType.DELAY_REPORTED
        ).first()
        assert event is not None

    def test_report_delay_inactive_session(self, client, courier_user, package_in_transit, db_session):
        """Test cannot report delay for inactive session."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=False,
            started_at=datetime.utcnow() - timedelta(hours=1),
            ended_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)
        response = client.post(
            f"/api/tracking/sessions/{session.id}/delay",
            headers=headers,
            json={
                "reason": "Delay reason here",
                "estimated_delay_minutes": 10
            }
        )

        assert response.status_code == 400
        assert "not active" in response.json()["detail"]

    def test_report_delay_validation(self, client, courier_user, package_in_transit, db_session):
        """Test delay reporting validates input."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=courier_user.id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        headers = get_auth_header(courier_user)

        # Reason too short
        response = client.post(
            f"/api/tracking/sessions/{session.id}/delay",
            headers=headers,
            json={
                "reason": "Nope",  # Less than 5 chars
                "estimated_delay_minutes": 10
            }
        )
        assert response.status_code == 422

        # Delay minutes too high
        response = client.post(
            f"/api/tracking/sessions/{session.id}/delay",
            headers=headers,
            json={
                "reason": "Valid delay reason here",
                "estimated_delay_minutes": 500  # Max is 480
            }
        )
        assert response.status_code == 422

    def test_get_tracking_events(self, client, sender_user, package_in_transit, db_session):
        """Test getting all tracking events for a session."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.flush()

        # Create multiple events
        events_data = [
            (TrackingEventType.PICKUP_COMPLETED, "Picked up package"),
            (TrackingEventType.IN_TRANSIT, "Package in transit"),
            (TrackingEventType.DELAY_REPORTED, "Traffic delay")
        ]

        for event_type, description in events_data:
            event = TrackingEvent(
                session_id=session.id,
                event_type=event_type,
                description=description,
                created_at=datetime.utcnow()
            )
            db_session.add(event)
        db_session.commit()

        headers = get_auth_header(sender_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/events",
            headers=headers
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert all("event_type" in event and "description" in event for event in data)

    def test_get_tracking_events_unauthorized(self, client, package_in_transit, db_session):
        """Test unauthorized user cannot view tracking events."""
        session = TrackingSession(
            package_id=package_in_transit.id,
            courier_id=package_in_transit.courier_id,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.add(session)
        db_session.commit()

        # Unrelated user
        other_user = User(
            email="noauth@test.com",
            hashed_password="hashed",
            full_name="No Auth",
            role="courier",
            is_verified=True
        )
        db_session.add(other_user)
        db_session.commit()

        headers = get_auth_header(other_user)
        response = client.get(
            f"/api/tracking/sessions/{session.id}/events",
            headers=headers
        )

        assert response.status_code == 403
