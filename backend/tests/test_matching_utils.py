"""
Tests for matching_utils.py - Package-route matching utility functions.

Tests the geospatial matching logic for packages along courier routes.
"""
import pytest
from unittest.mock import MagicMock

from app.utils.matching_utils import is_package_within_route_deviation, count_matching_routes_for_package


class TestIsPackageWithinRouteDeviation:
    """Tests for is_package_within_route_deviation function."""

    def _create_mock_package(self, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng):
        """Create a mock Package object with given coordinates."""
        package = MagicMock()
        package.pickup_lat = pickup_lat
        package.pickup_lng = pickup_lng
        package.dropoff_lat = dropoff_lat
        package.dropoff_lng = dropoff_lng
        return package

    def _create_mock_route(self, start_lat, start_lng, end_lat, end_lng, max_deviation_km):
        """Create a mock CourierRoute object with given coordinates."""
        route = MagicMock()
        route.start_lat = start_lat
        route.start_lng = start_lng
        route.end_lat = end_lat
        route.end_lng = end_lng
        route.max_deviation_km = max_deviation_km
        return route

    def test_package_directly_on_route(self):
        """Package with pickup/dropoff close to the route line should match."""
        # Route from LA to San Diego (roughly)
        route = self._create_mock_route(
            start_lat=34.0522,  # LA
            start_lng=-118.2437,
            end_lat=32.7157,  # San Diego
            end_lng=-117.1611,
            max_deviation_km=50  # Use larger deviation for geographic distances
        )

        # Package pickup and dropoff near the route line
        package = self._create_mock_package(
            pickup_lat=33.5,  # Midpoint
            pickup_lng=-117.7,
            dropoff_lat=33.0,
            dropoff_lng=-117.4
        )

        assert is_package_within_route_deviation(package, route) is True

    def test_package_within_deviation(self):
        """Package within max_deviation_km should match."""
        # Route from point A to point B
        route = self._create_mock_route(
            start_lat=40.7128,  # NYC
            start_lng=-74.0060,
            end_lat=40.7580,  # Midtown
            end_lng=-73.9855,
            max_deviation_km=10  # 10km deviation allowed
        )

        # Package slightly off the route but within 10km
        package = self._create_mock_package(
            pickup_lat=40.7300,
            pickup_lng=-73.9950,
            dropoff_lat=40.7450,
            dropoff_lng=-73.9900
        )

        assert is_package_within_route_deviation(package, route) is True

    def test_package_outside_deviation_pickup(self):
        """Package with pickup outside deviation should not match."""
        # Short route
        route = self._create_mock_route(
            start_lat=40.7128,
            start_lng=-74.0060,
            end_lat=40.7300,
            end_lng=-73.9900,
            max_deviation_km=1  # Only 1km deviation
        )

        # Pickup is far from route
        package = self._create_mock_package(
            pickup_lat=40.8000,  # Far north
            pickup_lng=-73.9500,
            dropoff_lat=40.7200,  # Near route
            dropoff_lng=-74.0000
        )

        assert is_package_within_route_deviation(package, route) is False

    def test_package_outside_deviation_dropoff(self):
        """Package with dropoff outside deviation should not match."""
        # Short route
        route = self._create_mock_route(
            start_lat=40.7128,
            start_lng=-74.0060,
            end_lat=40.7300,
            end_lng=-73.9900,
            max_deviation_km=1  # Only 1km deviation
        )

        # Pickup is near route, but dropoff is far
        package = self._create_mock_package(
            pickup_lat=40.7200,  # Near route
            pickup_lng=-74.0000,
            dropoff_lat=40.8000,  # Far north
            dropoff_lng=-73.9500
        )

        assert is_package_within_route_deviation(package, route) is False

    def test_package_both_points_outside_deviation(self):
        """Package with both points outside deviation should not match."""
        route = self._create_mock_route(
            start_lat=40.7128,
            start_lng=-74.0060,
            end_lat=40.7300,
            end_lng=-73.9900,
            max_deviation_km=1
        )

        # Both pickup and dropoff are far from route
        package = self._create_mock_package(
            pickup_lat=40.8500,
            pickup_lng=-73.9000,
            dropoff_lat=40.9000,
            dropoff_lng=-73.8500
        )

        assert is_package_within_route_deviation(package, route) is False

    def test_large_deviation_includes_distant_package(self):
        """Large max_deviation_km should include more distant packages."""
        route = self._create_mock_route(
            start_lat=34.0522,  # LA
            start_lng=-118.2437,
            end_lat=32.7157,  # San Diego
            end_lng=-117.1611,
            max_deviation_km=50  # 50km deviation
        )

        # Package moderately off the route
        package = self._create_mock_package(
            pickup_lat=33.8,
            pickup_lng=-117.9,
            dropoff_lat=33.2,
            dropoff_lng=-117.0
        )

        assert is_package_within_route_deviation(package, route) is True

    def test_zero_deviation_requires_exact_route(self):
        """Zero deviation should only match packages exactly on route."""
        route = self._create_mock_route(
            start_lat=40.7128,
            start_lng=-74.0060,
            end_lat=40.7300,
            end_lng=-73.9900,
            max_deviation_km=0
        )

        # Package slightly off route
        package = self._create_mock_package(
            pickup_lat=40.7150,
            pickup_lng=-74.0000,
            dropoff_lat=40.7250,
            dropoff_lng=-73.9950
        )

        # With 0 deviation, even slight offset should fail
        assert is_package_within_route_deviation(package, route) is False


class TestCountMatchingRoutesForPackage:
    """Tests for count_matching_routes_for_package function."""

    def _create_mock_package(self, pickup_lat, pickup_lng, dropoff_lat, dropoff_lng):
        """Create a mock Package object."""
        package = MagicMock()
        package.pickup_lat = pickup_lat
        package.pickup_lng = pickup_lng
        package.dropoff_lat = dropoff_lat
        package.dropoff_lng = dropoff_lng
        return package

    def _create_mock_route(self, start_lat, start_lng, end_lat, end_lng, max_deviation_km):
        """Create a mock CourierRoute object."""
        route = MagicMock()
        route.start_lat = start_lat
        route.start_lng = start_lng
        route.end_lat = end_lat
        route.end_lng = end_lng
        route.max_deviation_km = max_deviation_km
        return route

    def test_no_matching_routes(self):
        """Should return 0 when no routes match."""
        package = self._create_mock_package(
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_lat=40.7300,
            dropoff_lng=-73.9900
        )

        # Routes that are far from the package
        routes = [
            self._create_mock_route(50.0, -120.0, 51.0, -119.0, 5),  # Far away
            self._create_mock_route(35.0, -80.0, 36.0, -79.0, 5),  # Also far
        ]

        assert count_matching_routes_for_package(package, routes) == 0

    def test_single_matching_route(self):
        """Should return 1 when one route matches."""
        package = self._create_mock_package(
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7400,
            dropoff_lng=-73.9800
        )

        routes = [
            # This route is close to the package
            self._create_mock_route(40.7128, -74.0060, 40.7580, -73.9855, 10),
            # This route is far away
            self._create_mock_route(50.0, -120.0, 51.0, -119.0, 5),
        ]

        assert count_matching_routes_for_package(package, routes) == 1

    def test_multiple_matching_routes(self):
        """Should return count of all matching routes."""
        package = self._create_mock_package(
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7400,
            dropoff_lng=-73.9800
        )

        routes = [
            # All these routes are close to the package with large deviation
            self._create_mock_route(40.7128, -74.0060, 40.7580, -73.9855, 20),
            self._create_mock_route(40.7000, -74.0100, 40.7600, -73.9700, 20),
            self._create_mock_route(40.7050, -74.0200, 40.7500, -73.9600, 20),
        ]

        assert count_matching_routes_for_package(package, routes) == 3

    def test_empty_routes_list(self):
        """Should return 0 for empty routes list."""
        package = self._create_mock_package(
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7400,
            dropoff_lng=-73.9800
        )

        assert count_matching_routes_for_package(package, []) == 0

    def test_mixed_matching_routes(self):
        """Should correctly count when some routes match and some don't."""
        package = self._create_mock_package(
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7400,
            dropoff_lng=-73.9800
        )

        routes = [
            # Matching - close with sufficient deviation
            self._create_mock_route(40.7128, -74.0060, 40.7580, -73.9855, 10),
            # Not matching - far away
            self._create_mock_route(50.0, -120.0, 51.0, -119.0, 5),
            # Matching - close with large deviation
            self._create_mock_route(40.7000, -74.0100, 40.7600, -73.9700, 15),
            # Not matching - close but too small deviation
            self._create_mock_route(40.7100, -74.0050, 40.7500, -73.9800, 0.1),
        ]

        # Should match 2 routes
        assert count_matching_routes_for_package(package, routes) == 2
