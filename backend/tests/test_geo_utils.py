"""Tests for app/utils/geo.py - Geospatial utility functions"""

import pytest
import math

from app.utils.geo import (
    haversine_distance,
    point_to_line_distance,
    calculate_detour_distance,
    is_package_along_route
)


class TestHaversineDistance:
    """Tests for haversine distance calculation"""

    def test_same_point_returns_zero(self):
        """Test distance between same point is zero"""
        lat, lng = 40.7128, -74.0060  # New York
        distance = haversine_distance(lat, lng, lat, lng)
        assert distance == pytest.approx(0, abs=0.001)

    def test_known_distance_new_york_to_los_angeles(self):
        """Test known distance between New York and Los Angeles (~3940 km)"""
        ny_lat, ny_lng = 40.7128, -74.0060
        la_lat, la_lng = 34.0522, -118.2437
        distance = haversine_distance(ny_lat, ny_lng, la_lat, la_lng)
        # Distance should be approximately 3940 km
        assert distance == pytest.approx(3940, rel=0.05)

    def test_known_distance_london_to_paris(self):
        """Test known distance between London and Paris (~344 km)"""
        london_lat, london_lng = 51.5074, -0.1278
        paris_lat, paris_lng = 48.8566, 2.3522
        distance = haversine_distance(london_lat, london_lng, paris_lat, paris_lng)
        # Distance should be approximately 344 km
        assert distance == pytest.approx(344, rel=0.05)

    def test_short_distance(self):
        """Test short distance calculation (1 km)"""
        # Two points approximately 1 km apart
        lat1, lng1 = 37.7749, -122.4194  # San Francisco
        lat2, lng2 = 37.7839, -122.4194  # About 1 km north
        distance = haversine_distance(lat1, lng1, lat2, lng2)
        assert distance == pytest.approx(1.0, rel=0.1)

    def test_distance_is_symmetric(self):
        """Test that distance A to B equals B to A"""
        lat1, lng1 = 40.7128, -74.0060
        lat2, lng2 = 34.0522, -118.2437

        distance_ab = haversine_distance(lat1, lng1, lat2, lng2)
        distance_ba = haversine_distance(lat2, lng2, lat1, lng1)

        assert distance_ab == pytest.approx(distance_ba, rel=0.001)

    def test_antipodal_points(self):
        """Test distance between antipodal points (max ~20015 km)"""
        lat1, lng1 = 0, 0
        lat2, lng2 = 0, 180
        distance = haversine_distance(lat1, lng1, lat2, lng2)
        # Half of Earth's circumference
        assert distance == pytest.approx(20015, rel=0.01)

    def test_equator_distance(self):
        """Test distance along the equator"""
        lat = 0
        lng1, lng2 = 0, 1  # 1 degree apart
        distance = haversine_distance(lat, lng1, lat, lng2)
        # 1 degree at equator is ~111 km
        assert distance == pytest.approx(111, rel=0.05)


class TestPointToLineDistance:
    """Tests for point to line segment distance calculation"""

    def test_point_on_line_returns_zero(self):
        """Test point exactly on line returns zero distance"""
        # Line from (0,0) to (1,0), point at (0.5,0)
        line_start_lat, line_start_lng = 0, 0
        line_end_lat, line_end_lng = 1, 0
        point_lat, point_lng = 0.5, 0

        distance = point_to_line_distance(
            point_lat, point_lng,
            line_start_lat, line_start_lng,
            line_end_lat, line_end_lng
        )
        assert distance == pytest.approx(0, abs=1)  # Within 1 km

    def test_point_at_line_start(self):
        """Test point at line start returns zero"""
        line_start_lat, line_start_lng = 40.7128, -74.0060
        line_end_lat, line_end_lng = 34.0522, -118.2437
        point_lat, point_lng = 40.7128, -74.0060

        distance = point_to_line_distance(
            point_lat, point_lng,
            line_start_lat, line_start_lng,
            line_end_lat, line_end_lng
        )
        assert distance == pytest.approx(0, abs=0.1)

    def test_point_at_line_end(self):
        """Test point at line end returns zero"""
        line_start_lat, line_start_lng = 40.7128, -74.0060
        line_end_lat, line_end_lng = 34.0522, -118.2437
        point_lat, point_lng = 34.0522, -118.2437

        distance = point_to_line_distance(
            point_lat, point_lng,
            line_start_lat, line_start_lng,
            line_end_lat, line_end_lng
        )
        assert distance == pytest.approx(0, abs=0.1)

    def test_point_perpendicular_to_line(self):
        """Test point perpendicular to line segment"""
        # Simple case: line along latitude, point offset in longitude
        line_start_lat, line_start_lng = 37.0, -122.0
        line_end_lat, line_end_lng = 37.0, -121.0
        point_lat, point_lng = 37.1, -121.5  # Perpendicular point

        distance = point_to_line_distance(
            point_lat, point_lng,
            line_start_lat, line_start_lng,
            line_end_lat, line_end_lng
        )
        # Point is about 11 km north of the line
        assert distance == pytest.approx(11, rel=0.2)

    def test_point_beyond_line_end(self):
        """Test point beyond line endpoint returns distance to endpoint"""
        line_start_lat, line_start_lng = 37.0, -122.0
        line_end_lat, line_end_lng = 37.0, -121.0
        point_lat, point_lng = 37.0, -120.5  # Beyond end

        distance = point_to_line_distance(
            point_lat, point_lng,
            line_start_lat, line_start_lng,
            line_end_lat, line_end_lng
        )
        # Should be distance from point to line end
        expected = haversine_distance(point_lat, point_lng, line_end_lat, line_end_lng)
        assert distance == pytest.approx(expected, rel=0.1)

    def test_zero_length_line(self):
        """Test handling of zero-length line (same start and end)"""
        lat, lng = 37.7749, -122.4194
        point_lat, point_lng = 37.7850, -122.4194

        distance = point_to_line_distance(
            point_lat, point_lng,
            lat, lng,  # Start
            lat, lng   # End (same as start)
        )
        # Should return distance from point to the single point
        expected = haversine_distance(point_lat, point_lng, lat, lng)
        assert distance == pytest.approx(expected, rel=0.1)


class TestCalculateDetourDistance:
    """Tests for detour distance calculation"""

    def test_package_on_route_no_detour(self):
        """Test package exactly on route has minimal detour"""
        # Route from A to B, package pickup and dropoff on the route
        route_start = (37.0, -122.0)
        route_end = (37.0, -121.0)
        pickup = (37.0, -121.8)  # On the route
        dropoff = (37.0, -121.2)  # On the route

        detour, total = calculate_detour_distance(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1]
        )

        # Detour should be minimal (close to 0)
        assert detour == pytest.approx(0, abs=5)

    def test_package_off_route_has_detour(self):
        """Test package off route has positive detour"""
        route_start = (37.0, -122.0)
        route_end = (37.0, -121.0)
        pickup = (37.5, -121.8)  # Off route (north)
        dropoff = (37.5, -121.2)  # Off route (north)

        detour, total = calculate_detour_distance(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1]
        )

        # Detour should be positive
        assert detour > 0

    def test_total_includes_all_segments(self):
        """Test total distance includes all route segments"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -122.0)
        pickup = (37.3, -122.0)
        dropoff = (37.7, -122.0)

        detour, total = calculate_detour_distance(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1]
        )

        # Calculate expected total
        start_to_pickup = haversine_distance(
            route_start[0], route_start[1],
            pickup[0], pickup[1]
        )
        pickup_to_dropoff = haversine_distance(
            pickup[0], pickup[1],
            dropoff[0], dropoff[1]
        )
        dropoff_to_end = haversine_distance(
            dropoff[0], dropoff[1],
            route_end[0], route_end[1]
        )

        expected_total = start_to_pickup + pickup_to_dropoff + dropoff_to_end
        assert total == pytest.approx(expected_total, rel=0.01)

    def test_detour_is_difference(self):
        """Test detour equals total minus direct distance"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -121.0)
        pickup = (37.5, -121.5)
        dropoff = (37.8, -121.2)

        detour, total = calculate_detour_distance(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1]
        )

        direct = haversine_distance(
            route_start[0], route_start[1],
            route_end[0], route_end[1]
        )

        assert detour == pytest.approx(total - direct, rel=0.01)


class TestIsPackageAlongRoute:
    """Tests for package along route detection"""

    def test_package_on_route_is_along(self):
        """Test package directly on route is detected as along"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -122.0)
        pickup = (37.3, -122.0)
        dropoff = (37.7, -122.0)

        result = is_package_along_route(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1],
            max_deviation_km=5.0
        )

        assert result is True

    def test_package_far_off_route_not_along(self):
        """Test package far from route is not along"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -122.0)
        pickup = (37.3, -121.0)  # 1 degree east (~85 km)
        dropoff = (37.7, -121.0)

        result = is_package_along_route(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1],
            max_deviation_km=5.0
        )

        assert result is False

    def test_pickup_along_dropoff_not_along(self):
        """Test mixed case: pickup along route but dropoff not"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -122.0)
        pickup = (37.3, -122.0)  # On route
        dropoff = (37.7, -121.0)  # Far off route

        result = is_package_along_route(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1],
            max_deviation_km=5.0
        )

        assert result is False

    def test_large_deviation_allows_distant_points(self):
        """Test large max deviation allows distant points"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -122.0)
        pickup = (37.3, -121.9)  # Slightly off route
        dropoff = (37.7, -121.9)

        # Small deviation should fail
        result_small = is_package_along_route(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1],
            max_deviation_km=5.0
        )

        # Large deviation should pass
        result_large = is_package_along_route(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1],
            max_deviation_km=50.0
        )

        assert result_small is False
        assert result_large is True

    def test_zero_deviation_requires_exact_match(self):
        """Test zero deviation requires points on route"""
        route_start = (37.0, -122.0)
        route_end = (38.0, -122.0)
        pickup = (37.3, -122.001)  # Very slightly off
        dropoff = (37.7, -122.001)

        result = is_package_along_route(
            route_start[0], route_start[1],
            route_end[0], route_end[1],
            pickup[0], pickup[1],
            dropoff[0], dropoff[1],
            max_deviation_km=0.0
        )

        assert result is False
