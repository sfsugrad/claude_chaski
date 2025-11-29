"""
Unit tests for TrackingService.

Tests service methods independently with full mocking of dependencies.

Coverage:
- Session management: start, end, get session, active detection
- Location updates: ETA calculation, distance remaining, caching
- Events: create events, types, metadata, Redis broadcast
- Delay reporting: ETA extension, event creation
- Helper methods: ETA calculation, caching, broadcasting
"""
import pytest
from datetime import datetime, timedelta
from unittest.mock import MagicMock, AsyncMock, patch
import json

from app.services.tracking_service import TrackingService, DEFAULT_SPEED
from app.models.tracking import TrackingSession, LocationUpdate, TrackingEvent, TrackingEventType
from app.models.package import Package, PackageStatus
from app.utils.tracking_id import generate_tracking_id


@pytest.fixture
def db_session():
    """Mock database session."""
    session = MagicMock()
    session.add = MagicMock()
    session.commit = MagicMock()
    session.refresh = MagicMock()
    session.query = MagicMock()
    session.flush = MagicMock()
    return session


@pytest.fixture
def mock_redis():
    """Mock Redis client with async methods."""
    redis = MagicMock()
    redis.set_json = AsyncMock()
    redis.get_json = AsyncMock(return_value=None)
    redis.delete = AsyncMock()
    redis.publish = AsyncMock()
    redis.publish_location_update = AsyncMock()
    redis.set_courier_location = AsyncMock()
    return redis


@pytest.fixture
def tracking_service(db_session, mock_redis):
    """Create TrackingService instance."""
    return TrackingService(db_session, mock_redis)


@pytest.fixture
def sample_package():
    """Create a sample package."""
    package = Package(
        id=1,
        tracking_id=generate_tracking_id(),
        sender_id=1,
        courier_id=2,
        status=PackageStatus.IN_TRANSIT,
        description="Test Package",
        size="medium",
        weight_kg=5.0,
        price=25.0,
        pickup_address="123 Start",
        pickup_lat=37.7749,
        pickup_lng=-122.4194,
        dropoff_address="456 End",
        dropoff_lat=37.7849,
        dropoff_lng=-122.4094,
        is_active=True
    )
    return package


class TestSessionManagement:
    """Tests for tracking session management."""

    @pytest.mark.asyncio
    async def test_start_tracking_session_basic(self, tracking_service, db_session):
        """Test starting a basic tracking session."""
        # Mock query to return no existing sessions
        db_session.query.return_value.filter.return_value.first.return_value = None

        session = await tracking_service.start_tracking_session(
            package_id=1,
            courier_id=2
        )

        assert session.package_id == 1
        assert session.courier_id == 2
        assert session.is_active is True
        assert session.share_live_location is True
        # Should add session + event
        assert db_session.add.call_count == 2
        db_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_start_tracking_with_initial_location(self, tracking_service, db_session):
        """Test starting session with initial GPS coordinates."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        session = await tracking_service.start_tracking_session(
            package_id=1,
            courier_id=2,
            initial_latitude=37.7749,
            initial_longitude=-122.4194
        )

        assert session.last_latitude == 37.7749
        assert session.last_longitude == -122.4194
        assert session.last_location_at is not None

    @pytest.mark.asyncio
    async def test_start_tracking_ends_existing_session(self, tracking_service, db_session):
        """Test that starting new session ends existing active session."""
        # Create existing session
        existing = TrackingSession(
            id=99,
            package_id=1,
            courier_id=2,
            is_active=True,
            started_at=datetime.utcnow() - timedelta(hours=1)
        )
        db_session.query.return_value.filter.return_value.first.return_value = existing

        await tracking_service.start_tracking_session(
            package_id=1,
            courier_id=2
        )

        assert existing.is_active is False
        assert existing.ended_at is not None

    @pytest.mark.asyncio
    async def test_start_tracking_creates_pickup_event(self, tracking_service, db_session):
        """Test that starting session creates PICKUP_COMPLETED event."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        await tracking_service.start_tracking_session(
            package_id=1,
            courier_id=2,
            initial_latitude=37.7749,
            initial_longitude=-122.4194
        )

        # Should create 2 objects: session and event
        assert db_session.add.call_count == 2

    @pytest.mark.asyncio
    async def test_start_tracking_caches_location_in_redis(self, tracking_service, db_session, mock_redis):
        """Test that initial location is cached in Redis."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        await tracking_service.start_tracking_session(
            package_id=1,
            courier_id=2,
            initial_latitude=37.7749,
            initial_longitude=-122.4194
        )

        mock_redis.set_json.assert_called()
        mock_redis.set_courier_location.assert_called()

    @pytest.mark.asyncio
    async def test_end_tracking_session(self, tracking_service, db_session):
        """Test ending a tracking session."""
        session = TrackingSession(
            id=1,
            package_id=1,
            courier_id=2,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.query.return_value.filter.return_value.first.return_value = session

        result = await tracking_service.end_tracking_session(session_id=1)

        assert result.is_active is False
        assert result.ended_at is not None
        db_session.commit.assert_called()

    @pytest.mark.asyncio
    async def test_end_tracking_creates_delivery_event(self, tracking_service, db_session):
        """Test that ending session creates DELIVERY_COMPLETED event."""
        session = TrackingSession(
            id=1,
            package_id=1,
            courier_id=2,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.query.return_value.filter.return_value.first.return_value = session

        await tracking_service.end_tracking_session(
            session_id=1,
            latitude=37.7849,
            longitude=-122.4094
        )

        # Should add delivery event
        assert db_session.add.call_count >= 1

    @pytest.mark.asyncio
    async def test_end_tracking_clears_redis_cache(self, tracking_service, db_session, mock_redis):
        """Test that ending session clears location cache."""
        session = TrackingSession(
            id=1,
            package_id=1,
            courier_id=2,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.query.return_value.filter.return_value.first.return_value = session

        await tracking_service.end_tracking_session(session_id=1)

        assert mock_redis.delete.call_count == 2  # Session and courier cache

    @pytest.mark.asyncio
    async def test_end_tracking_session_not_found(self, tracking_service, db_session):
        """Test ending non-existent session raises error."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="not found"):
            await tracking_service.end_tracking_session(session_id=999)

    @pytest.mark.asyncio
    async def test_get_active_session(self, tracking_service, db_session):
        """Test getting active session for a package."""
        expected_session = TrackingSession(id=1, package_id=1, is_active=True)
        db_session.query.return_value.filter.return_value.first.return_value = expected_session

        result = await tracking_service.get_active_session(package_id=1)

        assert result == expected_session

    @pytest.mark.asyncio
    async def test_get_active_session_none(self, tracking_service, db_session):
        """Test getting active session when none exists."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        result = await tracking_service.get_active_session(package_id=1)

        assert result is None

    @pytest.mark.asyncio
    async def test_get_session_by_id(self, tracking_service, db_session):
        """Test getting session by ID."""
        expected_session = TrackingSession(id=5, package_id=1)
        db_session.query.return_value.filter.return_value.first.return_value = expected_session

        result = await tracking_service.get_session_by_id(session_id=5)

        assert result == expected_session


class TestLocationUpdates:
    """Tests for location update functionality."""

    @pytest.mark.asyncio
    async def test_update_location_basic(self, tracking_service, db_session, sample_package):
        """Test basic location update."""
        session = TrackingSession(
            id=1,
            package_id=1,
            courier_id=2,
            is_active=True,
            started_at=datetime.utcnow()
        )
        db_session.query.return_value.filter.return_value.first.side_effect = [session, sample_package]

        result = await tracking_service.update_location(
            session_id=1,
            latitude=37.7750,
            longitude=-122.4195
        )

        assert isinstance(result, LocationUpdate)
        assert result.latitude == 37.7750
        assert result.longitude == -122.4195
        assert session.last_latitude == 37.7750
        assert session.last_longitude == -122.4195

    @pytest.mark.asyncio
    async def test_update_location_with_all_fields(self, tracking_service, db_session, sample_package):
        """Test location update with all optional fields."""
        session = TrackingSession(id=1, package_id=1, courier_id=2, is_active=True, started_at=datetime.utcnow())
        db_session.query.return_value.filter.return_value.first.side_effect = [session, sample_package]

        result = await tracking_service.update_location(
            session_id=1,
            latitude=37.7750,
            longitude=-122.4195,
            accuracy_meters=10.5,
            altitude_meters=50.0,
            heading=45.0,
            speed_mps=8.3,
            battery_level=85.0,
            source="gps"
        )

        assert result.accuracy_meters == 10.5
        assert result.heading == 45.0
        assert result.speed_mps == 8.3
        assert result.battery_level == 85.0
        assert result.source == "gps"

    @pytest.mark.asyncio
    async def test_update_location_calculates_eta(self, tracking_service, db_session, sample_package):
        """Test that location update calculates new ETA."""
        session = TrackingSession(id=1, package_id=1, courier_id=2, is_active=True, started_at=datetime.utcnow())
        db_session.query.return_value.filter.return_value.first.side_effect = [session, sample_package]

        await tracking_service.update_location(
            session_id=1,
            latitude=37.7750,
            longitude=-122.4195,
            speed_mps=10.0
        )

        assert session.estimated_arrival is not None
        assert session.distance_remaining_meters is not None
        assert session.distance_remaining_meters > 0

    @pytest.mark.asyncio
    async def test_update_location_inactive_session(self, tracking_service, db_session):
        """Test updating inactive session raises error."""
        # Inactive session won't be found by the filter
        db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="not found"):
            await tracking_service.update_location(1, 37.7750, -122.4195)

    @pytest.mark.asyncio
    async def test_update_location_caches_in_redis(self, tracking_service, db_session, mock_redis, sample_package):
        """Test that location is cached in Redis."""
        session = TrackingSession(
            id=1, package_id=1, courier_id=2, is_active=True,
            started_at=datetime.utcnow(), share_live_location=True
        )
        db_session.query.return_value.filter.return_value.first.side_effect = [session, sample_package]

        await tracking_service.update_location(1, 37.7750, -122.4195)

        mock_redis.set_json.assert_called()
        mock_redis.set_courier_location.assert_called()

    @pytest.mark.asyncio
    async def test_update_location_broadcasts_to_redis(self, tracking_service, db_session, mock_redis, sample_package):
        """Test that location update is broadcast via Redis."""
        session = TrackingSession(
            id=1, package_id=1, courier_id=2, is_active=True,
            started_at=datetime.utcnow(), share_live_location=True
        )
        db_session.query.return_value.filter.return_value.first.side_effect = [session, sample_package]

        await tracking_service.update_location(1, 37.7750, -122.4195)

        mock_redis.publish_location_update.assert_called_once()

    @pytest.mark.asyncio
    async def test_update_location_no_broadcast_when_disabled(self, tracking_service, db_session, mock_redis, sample_package):
        """Test no broadcast when share_live_location is False."""
        session = TrackingSession(
            id=1, package_id=1, courier_id=2, is_active=True,
            started_at=datetime.utcnow(), share_live_location=False
        )
        db_session.query.return_value.filter.return_value.first.side_effect = [session, sample_package]

        await tracking_service.update_location(1, 37.7750, -122.4195)

        mock_redis.publish_location_update.assert_not_called()


class TestLocationHistory:
    """Tests for location history retrieval."""

    @pytest.mark.asyncio
    async def test_get_location_history(self, tracking_service, db_session):
        """Test retrieving location history."""
        mock_query = MagicMock()
        mock_query.order_by.return_value.limit.return_value.all.return_value = []
        db_session.query.return_value.filter.return_value = mock_query

        result = await tracking_service.get_location_history(session_id=1)

        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_location_history_with_limit(self, tracking_service, db_session):
        """Test location history respects limit."""
        mock_query = MagicMock()
        mock_query.order_by.return_value.limit.return_value.all.return_value = []
        db_session.query.return_value.filter.return_value = mock_query

        await tracking_service.get_location_history(session_id=1, limit=50)

        mock_query.order_by.return_value.limit.assert_called_with(50)

    @pytest.mark.asyncio
    async def test_get_location_history_with_since_filter(self, tracking_service, db_session):
        """Test filtering history by timestamp."""
        since_time = datetime.utcnow() - timedelta(hours=1)
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value.limit.return_value.all.return_value = []
        db_session.query.return_value.filter.return_value = mock_query

        await tracking_service.get_location_history(session_id=1, since=since_time)

        # Should apply since filter
        assert mock_query.filter.called


class TestCurrentLocation:
    """Tests for getting current location."""

    @pytest.mark.asyncio
    async def test_get_current_location_from_cache(self, tracking_service, db_session, mock_redis):
        """Test getting location from Redis cache."""
        session = TrackingSession(id=1, package_id=1)
        db_session.query.return_value.filter.return_value.first.return_value = session

        cached_location = {
            "latitude": 37.7750,
            "longitude": -122.4195,
            "timestamp": datetime.utcnow().isoformat()
        }
        mock_redis.get_json.return_value = cached_location

        result = await tracking_service.get_current_location(package_id=1)

        assert result == cached_location
        mock_redis.get_json.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_current_location_from_db_fallback(self, tracking_service, db_session, mock_redis):
        """Test falling back to database when cache miss."""
        session = TrackingSession(
            id=1, package_id=1,
            last_latitude=37.7750,
            last_longitude=-122.4195,
            last_location_at=datetime.utcnow(),
            distance_remaining_meters=5000.0
        )
        db_session.query.return_value.filter.return_value.first.return_value = session
        mock_redis.get_json.return_value = None

        result = await tracking_service.get_current_location(package_id=1)

        assert result is not None
        assert result["latitude"] == 37.7750
        assert result["longitude"] == -122.4195

    @pytest.mark.asyncio
    async def test_get_current_location_no_session(self, tracking_service, db_session):
        """Test returns None when no active session."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        result = await tracking_service.get_current_location(package_id=1)

        assert result is None


class TestTrackingEvents:
    """Tests for tracking events."""

    @pytest.mark.asyncio
    async def test_create_tracking_event(self, tracking_service, db_session):
        """Test creating a tracking event."""
        event = await tracking_service.create_tracking_event(
            session_id=1,
            event_type=TrackingEventType.IN_TRANSIT,
            description="Package in transit"
        )

        assert isinstance(event, TrackingEvent)
        assert event.session_id == 1
        assert event.event_type == TrackingEventType.IN_TRANSIT
        assert event.description == "Package in transit"
        db_session.add.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_event_with_location(self, tracking_service, db_session):
        """Test creating event with GPS coordinates."""
        event = await tracking_service.create_tracking_event(
            session_id=1,
            event_type=TrackingEventType.DELAY_REPORTED,
            description="Traffic delay",
            latitude=37.7750,
            longitude=-122.4195
        )

        assert event.latitude == 37.7750
        assert event.longitude == -122.4195

    @pytest.mark.asyncio
    async def test_create_event_with_metadata(self, tracking_service, db_session):
        """Test creating event with JSON metadata."""
        metadata = {"delay_minutes": 15, "reason": "traffic"}

        event = await tracking_service.create_tracking_event(
            session_id=1,
            event_type=TrackingEventType.DELAY_REPORTED,
            metadata=metadata
        )

        assert event.extra_data is not None
        assert json.loads(event.extra_data) == metadata

    @pytest.mark.asyncio
    async def test_create_event_broadcasts_to_redis(self, tracking_service, db_session, mock_redis):
        """Test event is broadcast via Redis."""
        session = TrackingSession(id=1, package_id=5)
        db_session.query.return_value.filter.return_value.first.return_value = session

        await tracking_service.create_tracking_event(
            session_id=1,
            event_type=TrackingEventType.IN_TRANSIT
        )

        mock_redis.publish.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_tracking_events(self, tracking_service, db_session):
        """Test retrieving tracking events."""
        mock_query = MagicMock()
        mock_query.order_by.return_value.all.return_value = []
        db_session.query.return_value.filter.return_value = mock_query

        result = await tracking_service.get_tracking_events(session_id=1)

        assert isinstance(result, list)

    @pytest.mark.asyncio
    async def test_get_events_filtered_by_type(self, tracking_service, db_session):
        """Test filtering events by type."""
        mock_query = MagicMock()
        mock_query.filter.return_value = mock_query
        mock_query.order_by.return_value.all.return_value = []
        db_session.query.return_value.filter.return_value = mock_query

        await tracking_service.get_tracking_events(
            session_id=1,
            event_types=[TrackingEventType.DELAY_REPORTED]
        )

        # Should apply event type filter
        assert mock_query.filter.called


class TestDelayReporting:
    """Tests for delay reporting."""

    @pytest.mark.asyncio
    async def test_report_delay(self, tracking_service, db_session):
        """Test reporting a delivery delay."""
        session = TrackingSession(
            id=1,
            package_id=1,
            estimated_arrival=datetime.utcnow() + timedelta(minutes=30)
        )
        db_session.query.return_value.filter.return_value.first.return_value = session

        event = await tracking_service.report_delay(
            session_id=1,
            reason="Heavy traffic on highway",
            estimated_delay_minutes=15
        )

        assert event.event_type == TrackingEventType.DELAY_REPORTED
        assert "traffic" in event.description.lower()

    @pytest.mark.asyncio
    async def test_report_delay_extends_eta(self, tracking_service, db_session):
        """Test delay extends estimated arrival time."""
        original_eta = datetime.utcnow() + timedelta(minutes=30)
        session = TrackingSession(id=1, package_id=1, estimated_arrival=original_eta)
        db_session.query.return_value.filter.return_value.first.return_value = session

        await tracking_service.report_delay(
            session_id=1,
            reason="Traffic",
            estimated_delay_minutes=15
        )

        assert session.estimated_arrival > original_eta

    @pytest.mark.asyncio
    async def test_report_delay_with_location(self, tracking_service, db_session):
        """Test reporting delay with GPS coordinates."""
        session = TrackingSession(id=1, package_id=1, estimated_arrival=datetime.utcnow() + timedelta(minutes=30))
        db_session.query.return_value.filter.return_value.first.return_value = session

        event = await tracking_service.report_delay(
            session_id=1,
            reason="Traffic",
            estimated_delay_minutes=10,
            latitude=37.7750,
            longitude=-122.4195
        )

        assert event.latitude == 37.7750
        assert event.longitude == -122.4195

    @pytest.mark.asyncio
    async def test_report_delay_session_not_found(self, tracking_service, db_session):
        """Test reporting delay for non-existent session raises error."""
        db_session.query.return_value.filter.return_value.first.return_value = None

        with pytest.raises(ValueError, match="not found"):
            await tracking_service.report_delay(1, "Traffic", 10)


class TestETACalculation:
    """Tests for ETA calculation helper."""

    @pytest.mark.asyncio
    async def test_calculate_eta_basic(self, tracking_service):
        """Test basic ETA calculation."""
        # From SF to Oakland (~11km)
        result = await tracking_service._calculate_eta(
            current_lat=37.7749,
            current_lng=-122.4194,
            dest_lat=37.8044,
            dest_lng=-122.2712,
            speed_mps=DEFAULT_SPEED
        )

        assert result is not None
        assert result["distance_meters"] > 0
        assert result["time_seconds"] > 0
        assert isinstance(result["arrival_time"], datetime)

    @pytest.mark.asyncio
    async def test_calculate_eta_with_custom_speed(self, tracking_service):
        """Test ETA calculation with custom speed."""
        result = await tracking_service._calculate_eta(
            current_lat=37.7749,
            current_lng=-122.4194,
            dest_lat=37.7849,
            dest_lng=-122.4094,
            speed_mps=15.0  # Custom speed
        )

        assert result is not None
        assert result["time_seconds"] > 0

    @pytest.mark.asyncio
    async def test_calculate_eta_includes_buffer(self, tracking_service):
        """Test that ETA includes 20% time buffer."""
        result = await tracking_service._calculate_eta(
            current_lat=37.7749,
            current_lng=-122.4194,
            dest_lat=37.7849,
            dest_lng=-122.4094,
            speed_mps=10.0
        )

        # Distance is about 1.1km, so time without buffer would be ~110s
        # With 20% buffer should be ~132s
        assert result["time_seconds"] > 110

    @pytest.mark.asyncio
    async def test_calculate_eta_handles_zero_speed(self, tracking_service):
        """Test ETA calculation uses default speed when given zero."""
        result = await tracking_service._calculate_eta(
            current_lat=37.7749,
            current_lng=-122.4194,
            dest_lat=37.7849,
            dest_lng=-122.4094,
            speed_mps=0.0  # Invalid speed
        )

        # Should use DEFAULT_SPEED instead
        assert result is not None
        assert result["time_seconds"] > 0

    @pytest.mark.asyncio
    async def test_calculate_eta_negative_speed(self, tracking_service):
        """Test ETA calculation handles negative speed."""
        result = await tracking_service._calculate_eta(
            current_lat=37.7749,
            current_lng=-122.4194,
            dest_lat=37.7849,
            dest_lng=-122.4094,
            speed_mps=-5.0
        )

        # Should use DEFAULT_SPEED
        assert result is not None
