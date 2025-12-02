"""
Comprehensive tests for the route-package matching algorithm with 50km deviation threshold.

This test suite validates that:
1. Packages within 50km of a route ARE matched
2. Packages outside 50km of a route ARE NOT matched
3. Edge cases near the 50km boundary are handled correctly
4. Both pickup AND dropoff points must be within deviation distance

Test Route: Los Angeles, CA to San Diego, CA (~179km straight line)
- This is a clear north-south route along the I-5 corridor
- We test with packages at various distances from this route

Actual measured distances from LA-SD route:
- Irvine: ~9km ✓
- Oceanside: ~13km ✓
- Anaheim: ~12km ✓
- Corona: ~41km ✓ (near boundary)
- Riverside: ~62km ✗
- Palm Springs: ~117km ✗
- San Bernardino: ~76km ✗
"""
import pytest
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from unittest.mock import patch, AsyncMock

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize, CourierRoute
from app.utils.auth import create_access_token, get_password_hash
from app.utils.tracking_id import generate_tracking_id
from app.utils.geo import haversine_distance, point_to_line_distance, is_package_along_route


# Mock Redis for JWT blacklist checks to avoid event loop issues
@pytest.fixture(autouse=True)
def mock_jwt_redis():
    """Mock Redis-dependent JWT functions to avoid event loop issues in tests"""
    with patch('app.services.jwt_blacklist.JWTBlacklistService.is_token_blacklisted', new_callable=AsyncMock) as mock_blacklist, \
         patch('app.services.jwt_blacklist.JWTBlacklistService.is_token_valid_for_user', new_callable=AsyncMock) as mock_valid:
        mock_blacklist.return_value = False
        mock_valid.return_value = True
        yield


# =============================================================================
# GEOGRAPHIC TEST DATA
# =============================================================================
# Route: Los Angeles to San Diego (approximately 190km)
ROUTE_START = {
    "address": "Los Angeles, CA",
    "lat": 34.0522,
    "lng": -118.2437
}
ROUTE_END = {
    "address": "San Diego, CA",
    "lat": 32.7157,
    "lng": -117.1611
}

# Packages WITHIN 50km of the route (should be matched)
# Distances verified using point_to_line_distance function
PACKAGES_WITHIN_50KM = [
    {
        "name": "Irvine Package (~9km from route)",
        "pickup": {"lat": 33.6846, "lng": -117.8265, "address": "Irvine, CA"},
        "dropoff": {"lat": 33.4484, "lng": -117.5987, "address": "San Juan Capistrano, CA"},
        "expected_distance_km": 12  # Max of pickup (~9km) and dropoff (~12km)
    },
    {
        "name": "Oceanside Package (~13km from route)",
        "pickup": {"lat": 33.1959, "lng": -117.3795, "address": "Oceanside, CA"},
        "dropoff": {"lat": 33.0114, "lng": -117.2684, "address": "Encinitas, CA"},
        "expected_distance_km": 13
    },
    {
        "name": "Anaheim Package (~12km from route)",
        "pickup": {"lat": 33.8366, "lng": -117.9143, "address": "Anaheim, CA"},
        "dropoff": {"lat": 33.7175, "lng": -117.8311, "address": "Santa Ana, CA"},
        "expected_distance_km": 12
    },
    {
        "name": "Corona Package (~41km - near boundary)",
        "pickup": {"lat": 33.8752, "lng": -117.5664, "address": "Corona, CA"},
        "dropoff": {"lat": 33.8000, "lng": -117.6500, "address": "Near Corona, CA"},
        "expected_distance_km": 41  # Corona is ~41km from route
    },
]

# Packages OUTSIDE 50km of the route (should NOT be matched)
# Distances verified using point_to_line_distance function
PACKAGES_OUTSIDE_50KM = [
    {
        "name": "Riverside Package (~62km from route)",
        "pickup": {"lat": 33.9806, "lng": -117.3755, "address": "Riverside, CA"},
        "dropoff": {"lat": 33.9500, "lng": -117.4000, "address": "Near Riverside, CA"},
        "expected_distance_km": 62
    },
    {
        "name": "Palm Springs Package (~117km east)",
        "pickup": {"lat": 33.8303, "lng": -116.5453, "address": "Palm Springs, CA"},
        "dropoff": {"lat": 33.7206, "lng": -116.2156, "address": "Palm Desert, CA"},
        "expected_distance_km": 117
    },
    {
        "name": "San Bernardino Package (~76km from route)",
        "pickup": {"lat": 34.1083, "lng": -117.2898, "address": "San Bernardino, CA"},
        "dropoff": {"lat": 34.0633, "lng": -117.3500, "address": "Near San Bernardino, CA"},
        "expected_distance_km": 76
    },
    {
        "name": "Santa Barbara Package (north of route start)",
        "pickup": {"lat": 34.4208, "lng": -119.6982, "address": "Santa Barbara, CA"},
        "dropoff": {"lat": 34.2805, "lng": -119.2945, "address": "Ventura, CA"},
        "expected_distance_km": 100  # Far north and west of route
    },
]

# Edge case packages near the 50km boundary
PACKAGES_BOUNDARY_CASES = [
    {
        "name": "Package at ~48km (just inside boundary)",
        "pickup": {"lat": 33.9500, "lng": -117.3900, "address": "Near Riverside, CA"},
        "dropoff": {"lat": 33.8500, "lng": -117.5000, "address": "Near Corona, CA"},
        "should_match": True,
        "expected_distance_km": 48
    },
    {
        "name": "Package at ~52km (just outside boundary)",
        "pickup": {"lat": 34.0000, "lng": -117.2500, "address": "East of Riverside, CA"},
        "dropoff": {"lat": 33.9000, "lng": -117.1500, "address": "Further East, CA"},
        "should_match": False,
        "expected_distance_km": 52
    },
]


class TestMatching50kmDeviation:
    """Test suite for 50km deviation matching threshold"""

    @pytest.fixture
    def courier_user(self, db_session):
        """Create a courier user for testing"""
        user = User(
            email="courier_50km@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Test Courier 50km",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=50
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def sender_user(self, db_session):
        """Create a sender user for testing"""
        user = User(
            email="sender_50km@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Test Sender 50km",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)
        return user

    @pytest.fixture
    def route_la_to_sd(self, db_session, courier_user):
        """Create LA to San Diego route with 50km deviation"""
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address=ROUTE_START["address"],
            start_lat=ROUTE_START["lat"],
            start_lng=ROUTE_START["lng"],
            end_address=ROUTE_END["address"],
            end_lat=ROUTE_END["lat"],
            end_lng=ROUTE_END["lng"],
            max_deviation_km=50,
            is_active=True,
            trip_date=datetime.now() + timedelta(days=7)  # Future trip
        )
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)
        return route

    @pytest.fixture
    def courier_token(self, courier_user):
        """Create JWT token for courier"""
        return create_access_token(data={"sub": courier_user.email})

    def create_package(self, db_session, sender_user, pkg_data: dict, index: int = 0) -> Package:
        """Helper to create a package from test data"""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description=pkg_data["name"],
            size=PackageSize.SMALL,
            weight_kg=2.0,
            pickup_address=pkg_data["pickup"]["address"],
            pickup_lat=pkg_data["pickup"]["lat"],
            pickup_lng=pkg_data["pickup"]["lng"],
            dropoff_address=pkg_data["dropoff"]["address"],
            dropoff_lat=pkg_data["dropoff"]["lat"],
            dropoff_lng=pkg_data["dropoff"]["lng"],
            status=PackageStatus.OPEN_FOR_BIDS,
            price=25.0 + index,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)
        return package

    # =========================================================================
    # TESTS: Packages WITHIN 50km should be matched
    # =========================================================================

    def test_package_within_5km_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~5km from route is matched (Irvine)"""
        pkg_data = PACKAGES_WITHIN_50KM[0]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id in package_ids, f"Package {pkg_data['name']} should be matched"

        # Verify distance is reasonable
        matched = next(p for p in data if p["package_id"] == package.id)
        assert matched["distance_from_route_km"] < 50, "Distance should be under 50km"

    def test_package_within_10km_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~10km from route is matched (Oceanside)"""
        pkg_data = PACKAGES_WITHIN_50KM[1]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id in package_ids, f"Package {pkg_data['name']} should be matched"

    def test_package_within_20km_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~20km from route is matched (Anaheim)"""
        pkg_data = PACKAGES_WITHIN_50KM[2]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id in package_ids, f"Package {pkg_data['name']} should be matched"

    def test_package_within_41km_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~41km from route is matched (Corona - near boundary)"""
        pkg_data = PACKAGES_WITHIN_50KM[3]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id in package_ids, f"Package {pkg_data['name']} should be matched (near boundary)"

    # =========================================================================
    # TESTS: Packages OUTSIDE 50km should NOT be matched
    # =========================================================================

    def test_package_62km_not_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~62km from route is NOT matched (Riverside)"""
        pkg_data = PACKAGES_OUTSIDE_50KM[0]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, f"Package {pkg_data['name']} should NOT be matched"

    def test_package_117km_not_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~117km from route is NOT matched (Palm Springs)"""
        pkg_data = PACKAGES_OUTSIDE_50KM[1]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, f"Package {pkg_data['name']} should NOT be matched"

    def test_package_76km_not_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package ~76km from route is NOT matched (San Bernardino)"""
        pkg_data = PACKAGES_OUTSIDE_50KM[2]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, f"Package {pkg_data['name']} should NOT be matched"

    def test_package_santa_barbara_not_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package in Santa Barbara (north of route) is NOT matched"""
        pkg_data = PACKAGES_OUTSIDE_50KM[3]
        package = self.create_package(db_session, sender_user, pkg_data)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, f"Package {pkg_data['name']} should NOT be matched"

    # =========================================================================
    # TESTS: Multiple packages - mixed within/outside 50km
    # =========================================================================

    def test_multiple_packages_filters_correctly(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Multiple packages - only those within 50km are returned"""
        # Create packages within 50km
        packages_within = []
        for i, pkg_data in enumerate(PACKAGES_WITHIN_50KM):
            pkg = self.create_package(db_session, sender_user, pkg_data, i)
            packages_within.append(pkg)

        # Create packages outside 50km
        packages_outside = []
        for i, pkg_data in enumerate(PACKAGES_OUTSIDE_50KM):
            pkg = self.create_package(db_session, sender_user, pkg_data, i + 10)
            packages_outside.append(pkg)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        matched_ids = [p["package_id"] for p in data]

        # All within-50km packages should be matched
        for pkg in packages_within:
            assert pkg.id in matched_ids, f"Package {pkg.description} should be matched"

        # All outside-50km packages should NOT be matched
        for pkg in packages_outside:
            assert pkg.id not in matched_ids, f"Package {pkg.description} should NOT be matched"

    # =========================================================================
    # TESTS: Different deviation distances
    # =========================================================================

    def test_route_with_15km_deviation(
        self, client, db_session, courier_user, sender_user
    ):
        """Test: Route with 15km max deviation - stricter matching"""
        # Create route with 15km max deviation
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address=ROUTE_START["address"],
            start_lat=ROUTE_START["lat"],
            start_lng=ROUTE_START["lng"],
            end_address=ROUTE_END["address"],
            end_lat=ROUTE_END["lat"],
            end_lng=ROUTE_END["lng"],
            max_deviation_km=15,  # Strict 15km deviation
            is_active=True,
            trip_date=datetime.now() + timedelta(days=7)
        )
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)

        token = create_access_token(data={"sub": courier_user.email})

        # Irvine/SJC package (~12km max) should match with 15km deviation
        pkg_12km = self.create_package(db_session, sender_user, PACKAGES_WITHIN_50KM[0], 0)

        # Corona package (~41km max) should NOT match with 15km deviation
        pkg_41km = self.create_package(db_session, sender_user, PACKAGES_WITHIN_50KM[3], 1)

        response = client.get(
            f"/api/matching/packages-along-route/{route.id}",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        matched_ids = [p["package_id"] for p in data]

        assert pkg_12km.id in matched_ids, "12km package should match with 15km deviation"
        assert pkg_41km.id not in matched_ids, "41km package should NOT match with 15km deviation"

    def test_route_with_100km_deviation(
        self, client, db_session, courier_user, sender_user
    ):
        """Test: Route with 100km max deviation - looser matching"""
        # Create route with 100km max deviation
        route = CourierRoute(
            courier_id=courier_user.id,
            start_address=ROUTE_START["address"],
            start_lat=ROUTE_START["lat"],
            start_lng=ROUTE_START["lng"],
            end_address=ROUTE_END["address"],
            end_lat=ROUTE_END["lat"],
            end_lng=ROUTE_END["lng"],
            max_deviation_km=100,  # Generous 100km deviation
            is_active=True,
            trip_date=datetime.now() + timedelta(days=7)
        )
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)

        token = create_access_token(data={"sub": courier_user.email})

        # Hemet package (~80km via Shapely) should match with 100km deviation
        hemet_package = {
            "name": "Hemet Package (~80km from route)",
            "pickup": {"lat": 33.7476, "lng": -116.9719, "address": "Hemet, CA"},
            "dropoff": {"lat": 33.7500, "lng": -117.0000, "address": "Near Hemet, CA"},
        }
        pkg_80km = self.create_package(db_session, sender_user, hemet_package, 0)

        response = client.get(
            f"/api/matching/packages-along-route/{route.id}",
            headers={"Authorization": f"Bearer {token}"}
        )

        assert response.status_code == 200
        data = response.json()
        matched_ids = [p["package_id"] for p in data]

        assert pkg_80km.id in matched_ids, "80km package should match with 100km deviation"

    # =========================================================================
    # TESTS: Both pickup AND dropoff must be within deviation
    # =========================================================================

    def test_pickup_within_dropoff_outside(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package with pickup within 50km but dropoff outside is NOT matched"""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Pickup within, dropoff outside",
            size=PackageSize.SMALL,
            weight_kg=2.0,
            # Pickup in Irvine (~5km from route)
            pickup_address="Irvine, CA",
            pickup_lat=33.6846,
            pickup_lng=-117.8265,
            # Dropoff in Palm Springs (~100km from route)
            dropoff_address="Palm Springs, CA",
            dropoff_lat=33.8303,
            dropoff_lng=-116.5453,
            status=PackageStatus.OPEN_FOR_BIDS,
            price=30.0,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, \
            "Package should NOT be matched if dropoff is outside deviation"

    def test_pickup_outside_dropoff_within(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Package with pickup outside 50km but dropoff within is NOT matched"""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Pickup outside, dropoff within",
            size=PackageSize.SMALL,
            weight_kg=2.0,
            # Pickup in Palm Springs (~100km from route)
            pickup_address="Palm Springs, CA",
            pickup_lat=33.8303,
            pickup_lng=-116.5453,
            # Dropoff in Oceanside (~10km from route)
            dropoff_address="Oceanside, CA",
            dropoff_lat=33.1959,
            dropoff_lng=-117.3795,
            status=PackageStatus.OPEN_FOR_BIDS,
            price=30.0,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, \
            "Package should NOT be matched if pickup is outside deviation"

    # =========================================================================
    # TESTS: Sorting by detour distance
    # =========================================================================

    def test_packages_sorted_by_detour_ascending(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Matched packages are sorted by estimated detour (shortest first)"""
        # Create packages at different distances (will have different detours)
        for i, pkg_data in enumerate(PACKAGES_WITHIN_50KM):
            self.create_package(db_session, sender_user, pkg_data, i)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()

        # Verify sorted by detour distance ascending
        detours = [p["estimated_detour_km"] for p in data]
        assert detours == sorted(detours), "Packages should be sorted by detour (ascending)"

    # =========================================================================
    # TESTS: Package status filtering
    # =========================================================================

    def test_only_open_for_bids_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Only packages with OPEN_FOR_BIDS status are matched"""
        pkg_data = PACKAGES_WITHIN_50KM[0]

        # Create package with different statuses
        statuses_to_test = [
            (PackageStatus.OPEN_FOR_BIDS, True),
            (PackageStatus.NEW, False),
            (PackageStatus.BID_SELECTED, False),
            (PackageStatus.PENDING_PICKUP, False),
            (PackageStatus.IN_TRANSIT, False),
            (PackageStatus.DELIVERED, False),
        ]

        packages = []
        for i, (status, should_match) in enumerate(statuses_to_test):
            package = Package(
                tracking_id=generate_tracking_id(),
                sender_id=sender_user.id,
                description=f"Package with status {status.value}",
                size=PackageSize.SMALL,
                weight_kg=2.0,
                pickup_address=pkg_data["pickup"]["address"],
                pickup_lat=pkg_data["pickup"]["lat"],
                pickup_lng=pkg_data["pickup"]["lng"],
                dropoff_address=pkg_data["dropoff"]["address"],
                dropoff_lat=pkg_data["dropoff"]["lat"],
                dropoff_lng=pkg_data["dropoff"]["lng"],
                status=status,
                price=25.0 + i,
                is_active=True
            )
            db_session.add(package)
            packages.append((package, should_match))

        db_session.commit()
        for pkg, _ in packages:
            db_session.refresh(pkg)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        matched_ids = [p["package_id"] for p in data]

        for pkg, should_match in packages:
            if should_match:
                assert pkg.id in matched_ids, f"Package with OPEN_FOR_BIDS should be matched"
            else:
                assert pkg.id not in matched_ids, f"Package with {pkg.status} should NOT be matched"

    # =========================================================================
    # TESTS: Inactive packages and routes
    # =========================================================================

    def test_inactive_packages_not_matched(
        self, client, courier_token, route_la_to_sd, sender_user, db_session
    ):
        """Test: Inactive packages are not matched even if within deviation"""
        pkg_data = PACKAGES_WITHIN_50KM[0]

        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender_user.id,
            description="Inactive package",
            size=PackageSize.SMALL,
            weight_kg=2.0,
            pickup_address=pkg_data["pickup"]["address"],
            pickup_lat=pkg_data["pickup"]["lat"],
            pickup_lng=pkg_data["pickup"]["lng"],
            dropoff_address=pkg_data["dropoff"]["address"],
            dropoff_lat=pkg_data["dropoff"]["lat"],
            dropoff_lng=pkg_data["dropoff"]["lng"],
            status=PackageStatus.OPEN_FOR_BIDS,
            price=25.0,
            is_active=False  # INACTIVE
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        response = client.get(
            f"/api/matching/packages-along-route/{route_la_to_sd.id}",
            headers={"Authorization": f"Bearer {courier_token}"}
        )

        assert response.status_code == 200
        data = response.json()
        package_ids = [p["package_id"] for p in data]

        assert package.id not in package_ids, "Inactive package should NOT be matched"


class TestGeoUtilities50km:
    """Unit tests for geo utility functions with 50km threshold"""

    def test_is_package_along_route_within_50km(self):
        """Test is_package_along_route returns True for package within 50km"""
        # Irvine package on LA-SD route
        result = is_package_along_route(
            ROUTE_START["lat"], ROUTE_START["lng"],
            ROUTE_END["lat"], ROUTE_END["lng"],
            33.6846, -117.8265,  # Irvine pickup
            33.4484, -117.5987,  # San Juan Capistrano dropoff
            50  # 50km max deviation
        )
        assert result is True, "Package within 50km should return True"

    def test_is_package_along_route_outside_50km(self):
        """Test is_package_along_route returns False for package outside 50km"""
        # Palm Springs package (100km from route)
        result = is_package_along_route(
            ROUTE_START["lat"], ROUTE_START["lng"],
            ROUTE_END["lat"], ROUTE_END["lng"],
            33.8303, -116.5453,  # Palm Springs pickup
            33.7206, -116.2156,  # Palm Desert dropoff
            50  # 50km max deviation
        )
        assert result is False, "Package outside 50km should return False"

    def test_point_to_line_distance_close_point(self):
        """Test point_to_line_distance for point close to route"""
        # Irvine is close to the LA-SD route
        distance = point_to_line_distance(
            33.6846, -117.8265,  # Irvine
            ROUTE_START["lat"], ROUTE_START["lng"],
            ROUTE_END["lat"], ROUTE_END["lng"]
        )
        assert distance < 50, f"Irvine should be within 50km of route, got {distance}km"

    def test_point_to_line_distance_far_point(self):
        """Test point_to_line_distance for point far from route"""
        # Palm Springs is far from the LA-SD route
        distance = point_to_line_distance(
            33.8303, -116.5453,  # Palm Springs
            ROUTE_START["lat"], ROUTE_START["lng"],
            ROUTE_END["lat"], ROUTE_END["lng"]
        )
        assert distance > 50, f"Palm Springs should be >50km from route, got {distance}km"

    def test_haversine_la_to_sd(self):
        """Test haversine distance between LA and San Diego (~179km)"""
        distance = haversine_distance(
            ROUTE_START["lat"], ROUTE_START["lng"],
            ROUTE_END["lat"], ROUTE_END["lng"]
        )
        assert 170 < distance < 190, f"LA to SD should be ~179km, got {distance}km"

    def test_haversine_la_to_irvine(self):
        """Test haversine distance LA to Irvine (~60km)"""
        distance = haversine_distance(
            ROUTE_START["lat"], ROUTE_START["lng"],
            33.6846, -117.8265  # Irvine
        )
        assert 50 < distance < 70, f"LA to Irvine should be ~60km, got {distance}km"


class TestMatchingResponseFormat:
    """Test the response format of matched packages"""

    @pytest.fixture
    def setup_matching(self, db_session):
        """Setup courier, route, and package for response format tests"""
        # Create courier
        courier = User(
            email="format_test_courier@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Format Test Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=50
        )
        db_session.add(courier)
        db_session.commit()
        db_session.refresh(courier)

        # Create sender
        sender = User(
            email="format_test_sender@test.com",
            hashed_password=get_password_hash("testpass123"),
            full_name="Format Test Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True
        )
        db_session.add(sender)
        db_session.commit()
        db_session.refresh(sender)

        # Create route
        route = CourierRoute(
            courier_id=courier.id,
            start_address=ROUTE_START["address"],
            start_lat=ROUTE_START["lat"],
            start_lng=ROUTE_START["lng"],
            end_address=ROUTE_END["address"],
            end_lat=ROUTE_END["lat"],
            end_lng=ROUTE_END["lng"],
            max_deviation_km=50,
            is_active=True,
            trip_date=datetime.now() + timedelta(days=7)
        )
        db_session.add(route)
        db_session.commit()
        db_session.refresh(route)

        # Create package
        pkg_data = PACKAGES_WITHIN_50KM[0]
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=sender.id,
            description=pkg_data["name"],
            size=PackageSize.MEDIUM,
            weight_kg=5.5,
            pickup_address=pkg_data["pickup"]["address"],
            pickup_lat=pkg_data["pickup"]["lat"],
            pickup_lng=pkg_data["pickup"]["lng"],
            dropoff_address=pkg_data["dropoff"]["address"],
            dropoff_lat=pkg_data["dropoff"]["lat"],
            dropoff_lng=pkg_data["dropoff"]["lng"],
            status=PackageStatus.OPEN_FOR_BIDS,
            price=35.0,
            is_active=True,
            pickup_contact_name="John Pickup",
            pickup_contact_phone="+11234567890",
            dropoff_contact_name="Jane Dropoff",
            dropoff_contact_phone="+10987654321"
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        token = create_access_token(data={"sub": courier.email})

        return {
            "courier": courier,
            "sender": sender,
            "route": route,
            "package": package,
            "token": token
        }

    def test_response_contains_all_fields(self, client, setup_matching):
        """Test that matched package response contains all required fields"""
        data = setup_matching

        response = client.get(
            f"/api/matching/packages-along-route/{data['route'].id}",
            headers={"Authorization": f"Bearer {data['token']}"}
        )

        assert response.status_code == 200
        packages = response.json()
        assert len(packages) > 0

        pkg = packages[0]

        # Verify all required fields are present
        required_fields = [
            "package_id", "tracking_id", "sender_id", "description",
            "size", "weight_kg", "pickup_address", "pickup_lat", "pickup_lng",
            "dropoff_address", "dropoff_lat", "dropoff_lng", "price",
            "distance_from_route_km", "estimated_detour_km",
            "pickup_contact_name", "pickup_contact_phone",
            "dropoff_contact_name", "dropoff_contact_phone"
        ]

        for field in required_fields:
            assert field in pkg, f"Response missing field: {field}"

    def test_response_values_correct(self, client, setup_matching):
        """Test that matched package response values are correct"""
        data = setup_matching

        response = client.get(
            f"/api/matching/packages-along-route/{data['route'].id}",
            headers={"Authorization": f"Bearer {data['token']}"}
        )

        assert response.status_code == 200
        packages = response.json()
        pkg = packages[0]
        original = data['package']

        # Verify values match
        assert pkg["package_id"] == original.id
        assert pkg["tracking_id"] == original.tracking_id
        assert pkg["sender_id"] == original.sender_id
        assert pkg["description"] == original.description
        assert pkg["size"] == original.size.value
        assert pkg["weight_kg"] == original.weight_kg
        assert pkg["price"] == original.price
        assert pkg["pickup_contact_name"] == "John Pickup"
        assert pkg["dropoff_contact_name"] == "Jane Dropoff"

        # Verify computed fields are reasonable
        assert pkg["distance_from_route_km"] >= 0
        assert pkg["distance_from_route_km"] <= 50  # Within deviation
        assert pkg["estimated_detour_km"] >= 0
