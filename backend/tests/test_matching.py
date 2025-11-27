"""Tests for matching algorithm endpoints"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize, CourierRoute
from app.utils.auth import create_access_token, get_password_hash


class TestMatchingAlgorithm:
    """Tests for the package matching algorithm"""

    @pytest.fixture
    def courier_user(self, db_session):
        """Create a courier user for testing"""
        user = User(
            email="courier@test.com",
            hashed_password=get_password_hash("testpass123"),
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
    def sender_user(self, db_session):
        """Create a sender user for testing"""
        user = User(
            email="sender@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Test Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def courier_route(self, db_session, courier_user):
        """Create a courier route for testing"""
        # Route from San Francisco to San Jose (approximately)
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address="San Francisco, CA",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="San Jose, CA",
            end_lat=37.3382,
            end_lng=-121.8863,
            max_deviation_km=10,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)
        return route

    @pytest.fixture
    def package_along_route(self, db_session, sender_user):
        """Create a package along the route (Palo Alto area)"""
        package = Package(
            sender_id=sender_user.id,
            description="Test package along route",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="Palo Alto, CA",
            pickup_lat=37.4419,
            pickup_lng=-122.1430,
            dropoff_address="Mountain View, CA",
            dropoff_lat=37.3861,
            dropoff_lng=-122.0839,
            status=PackageStatus.PENDING,
            price=25.0,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)
        return package

    @pytest.fixture
    def package_far_from_route(self, db_session, sender_user):
        """Create a package far from the route (Sacramento area)"""
        package = Package(
            sender_id=sender_user.id,
            description="Test package far from route",
            size=PackageSize.MEDIUM,
            weight_kg=5.0,
            pickup_address="Sacramento, CA",
            pickup_lat=38.5816,
            pickup_lng=-121.4944,
            dropoff_address="Davis, CA",
            dropoff_lat=38.5449,
            dropoff_lng=-121.7405,
            status=PackageStatus.PENDING,
            price=30.0,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)
        return package

    @pytest.fixture
    def courier_token(self, courier_user):
        """Create JWT token for courier"""
        return create_access_token(data={"sub": courier_user.email})

    @pytest.fixture
    def sender_token(self, sender_user):
        """Create JWT token for sender"""
        return create_access_token(data={"sub": sender_user.email})

    def test_get_packages_along_route_success(
        self, client, courier_token, courier_route, package_along_route, package_far_from_route
    ):
        """Test getting packages along a route"""
        response = client.get(
            f"/api/matching/packages-along-route/{courier_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should only return the package along the route
        assert len(data) == 1
        assert data[0]["package_id"] == package_along_route.id
        assert data[0]["description"] == package_along_route.description
        assert "distance_from_route_km" in data[0]
        assert "estimated_detour_km" in data[0]
        assert data[0]["price"] == 25.0

    def test_get_packages_along_route_unauthorized(self, client, sender_token, courier_route):
        """Test that senders cannot view packages along routes"""
        response = client.get(
            f"/api/matching/packages-along-route/{courier_route.id}",
            headers={"Authorization": f"Bearer {sender_token}"}
        )

        assert response.status_code == 403
        assert "Only couriers" in response.json()["detail"]

    def test_get_packages_along_route_not_found(self, client, courier_token):
        """Test getting packages for non-existent route"""
        response = client.get(
            "/api/matching/packages-along-route/999",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_get_packages_along_route_other_courier(
        self, client, db_session, courier_route, package_along_route
    ):
        """Test that couriers cannot view packages for other couriers' routes"""
        # Create another courier
        other_courier = User(
            email="other@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Other Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        other_token = create_access_token(data={"sub": other_courier.email})

        response = client.get(
            f"/api/matching/packages-along-route/{courier_route.id}",
            headers={"Authorization": f"Bearer {other_token}"}
        )

        # Returns 404 instead of 403 for security (doesn't reveal route exists)
        assert response.status_code == 404
        assert "not found" in response.json()["detail"].lower()

    def test_accept_package_success(
        self, client, courier_token, package_along_route, db_session
    ):
        """Test courier accepting a package"""
        response = client.post(
            f"/api/matching/accept-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Package accepted successfully"
        assert data["package_id"] == package_along_route.id
        assert data["status"] == "matched"

        # Verify database was updated
        db_session.refresh(package_along_route)
        assert package_along_route.status == PackageStatus.MATCHED
        assert package_along_route.courier_id is not None

    def test_accept_package_sender_forbidden(
        self, client, sender_token, package_along_route
    ):
        """Test that senders cannot accept packages"""
        response = client.post(
            f"/api/matching/accept-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {sender_token}"}
        )

        assert response.status_code == 403
        assert "Only couriers" in response.json()["detail"]

    def test_accept_package_not_found(self, client, courier_token):
        """Test accepting non-existent package"""
        response = client.post(
            "/api/matching/accept-package/999",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 404

    def test_accept_package_already_matched(
        self, client, courier_token, package_along_route, db_session
    ):
        """Test accepting already matched package"""
        # First acceptance
        client.post(
            f"/api/matching/accept-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        # Create another courier and token
        other_courier = User(
            email="other@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Other Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()
        other_token = create_access_token(data={"sub": other_courier.email})

        # Try to accept again with different courier
        response = client.post(
            f"/api/matching/accept-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {other_token}"}
        )

        assert response.status_code == 400
        assert "already matched" in response.json()["detail"].lower()

    def test_decline_package_success(
        self, client, courier_token, package_along_route, courier_user, db_session
    ):
        """Test courier declining a matched package"""
        # First accept the package
        package_along_route.courier_id = courier_user.id
        package_along_route.status = PackageStatus.MATCHED
        db_session.commit()

        response = client.post(
            f"/api/matching/decline-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Package declined successfully"
        assert data["status"] == "pending"

        # Verify database was updated
        db_session.refresh(package_along_route)
        assert package_along_route.status == PackageStatus.PENDING
        assert package_along_route.courier_id is None

    def test_decline_package_not_assigned(
        self, client, courier_token, package_along_route, db_session
    ):
        """Test declining package not assigned to courier"""
        # Create another courier and assign package to them
        other_courier = User(
            email="other@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Other Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(other_courier)
        db_session.commit()

        package_along_route.courier_id = other_courier.id
        package_along_route.status = PackageStatus.MATCHED
        db_session.commit()

        response = client.post(
            f"/api/matching/decline-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 403
        assert "assigned to you" in response.json()["detail"]

    def test_decline_package_wrong_status(
        self, client, courier_token, package_along_route, courier_user, db_session
    ):
        """Test declining package that is not in matched status"""
        # Set package to picked up status
        package_along_route.courier_id = courier_user.id
        package_along_route.status = PackageStatus.PICKED_UP
        db_session.commit()

        response = client.post(
            f"/api/matching/decline-package/{package_along_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 400
        assert "cannot be declined" in response.json()["detail"]

    def test_packages_sorted_by_detour(
        self, client, courier_token, courier_route, sender_user, db_session
    ):
        """Test that packages are sorted by detour distance"""
        # Create multiple packages with different detour distances
        # Package 1: Close to start (smaller detour)
        package1 = Package(
            sender_id=sender_user.id,
            description="Close to start",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Millbrae, CA",
            pickup_lat=37.5985,
            pickup_lng=-122.3866,
            dropoff_address="Burlingame, CA",
            dropoff_lat=37.5847,
            dropoff_lng=-122.3660,
            status=PackageStatus.PENDING,
            price=15.0,
            is_active=True
        )

        # Package 2: In the middle (medium detour)
        package2 = Package(
            sender_id=sender_user.id,
            description="In the middle",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Palo Alto, CA",
            pickup_lat=37.4419,
            pickup_lng=-122.1430,
            dropoff_address="Mountain View, CA",
            dropoff_lat=37.3861,
            dropoff_lng=-122.0839,
            status=PackageStatus.PENDING,
            price=20.0,
            is_active=True
        )

        db_session.add_all([package1, package2])
        db_session.commit()

        response = client.get(
            f"/api/matching/packages-along-route/{courier_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify packages are sorted by detour (ascending)
        for i in range(len(data) - 1):
            assert data[i]["estimated_detour_km"] <= data[i + 1]["estimated_detour_km"]

    def test_inactive_packages_not_matched(
        self, client, courier_token, courier_route, sender_user, db_session
    ):
        """Test that inactive packages are not included in matches"""
        # Create inactive package
        inactive_package = Package(
            sender_id=sender_user.id,
            description="Inactive package",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Palo Alto, CA",
            pickup_lat=37.4419,
            pickup_lng=-122.1430,
            dropoff_address="Mountain View, CA",
            dropoff_lat=37.3861,
            dropoff_lng=-122.0839,
            status=PackageStatus.PENDING,
            price=20.0,
            is_active=False  # Inactive
        )
        db_session.add(inactive_package)
        db_session.commit()

        response = client.get(
            f"/api/matching/packages-along-route/{courier_route.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()

        # Should not include the inactive package
        package_ids = [p["package_id"] for p in data]
        assert inactive_package.id not in package_ids


class TestGeoUtils:
    """Tests for geometric utility functions"""

    def test_haversine_distance(self):
        """Test haversine distance calculation"""
        from app.utils.geo import haversine_distance

        # Distance from San Francisco to San Jose (approximately 67-68 km)
        distance = haversine_distance(37.7749, -122.4194, 37.3382, -121.8863)

        assert 65 < distance < 70  # Allow some tolerance

    def test_point_to_line_distance(self):
        """Test point to line distance calculation"""
        from app.utils.geo import point_to_line_distance

        # Point close to the line
        distance = point_to_line_distance(
            37.5,  # Point on approximate route
            -122.0,
            37.7749, -122.4194,  # SF
            37.3382, -121.8863   # SJ
        )

        assert distance >= 0  # Distance should be non-negative

    def test_calculate_detour_distance(self):
        """Test detour distance calculation"""
        from app.utils.geo import calculate_detour_distance

        # Calculate detour for a package
        detour, total = calculate_detour_distance(
            37.7749, -122.4194,  # Route start (SF)
            37.3382, -121.8863,  # Route end (SJ)
            37.4419, -122.1430,  # Pickup (Palo Alto)
            37.3861, -122.0839   # Dropoff (Mountain View)
        )

        assert detour >= 0  # Detour should be positive
        assert total > 0    # Total distance should be positive

    def test_is_package_along_route(self):
        """Test package along route check"""
        from app.utils.geo import is_package_along_route

        # Package along route (Palo Alto to Mountain View on SF-SJ route)
        along_route = is_package_along_route(
            37.7749, -122.4194,  # Route start (SF)
            37.3382, -121.8863,  # Route end (SJ)
            37.4419, -122.1430,  # Pickup (Palo Alto)
            37.3861, -122.0839,  # Dropoff (Mountain View)
            10  # Max deviation 10 km
        )

        assert along_route is True

        # Package far from route (Sacramento area)
        not_along_route = is_package_along_route(
            37.7749, -122.4194,  # Route start (SF)
            37.3382, -121.8863,  # Route end (SJ)
            38.5816, -121.4944,  # Pickup (Sacramento)
            38.5449, -121.7405,  # Dropoff (Davis)
            10  # Max deviation 10 km
        )

        assert not_along_route is False
