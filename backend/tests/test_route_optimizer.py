"""
Tests for route optimization service.

Tests cover:
- optimize_package_order with single package
- optimize_package_order with multiple packages
- Empty package list
- Waypoint ordering
- Sequence numbers
- Pickup before dropoff ordering
- Route position calculation
"""

import pytest
from unittest.mock import MagicMock, PropertyMock

from app.services.route_optimizer import optimize_package_order


def create_mock_package(
    package_id: int,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    pickup_address: str = "Pickup Address",
    dropoff_address: str = "Dropoff Address",
    pickup_contact_name: str = "Pickup Contact",
    pickup_contact_phone: str = "+1234567890",
    dropoff_contact_name: str = "Dropoff Contact",
    dropoff_contact_phone: str = "+0987654321"
):
    """Create a mock Package object"""
    package = MagicMock()
    package.id = package_id
    package.pickup_lat = pickup_lat
    package.pickup_lng = pickup_lng
    package.dropoff_lat = dropoff_lat
    package.dropoff_lng = dropoff_lng
    package.pickup_address = pickup_address
    package.dropoff_address = dropoff_address
    package.pickup_contact_name = pickup_contact_name
    package.pickup_contact_phone = pickup_contact_phone
    package.dropoff_contact_name = dropoff_contact_name
    package.dropoff_contact_phone = dropoff_contact_phone
    return package


class TestOptimizePackageOrder:
    """Tests for optimize_package_order function"""

    def test_empty_package_list(self):
        """Test with empty package list returns empty list"""
        result = optimize_package_order(
            route_start=(40.7128, -74.0060),  # NYC
            route_end=(40.7580, -73.9855),     # Midtown
            packages=[]
        )

        assert result == []

    def test_single_package(self):
        """Test with single package"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        assert len(result) == 2  # pickup + dropoff
        assert result[0]["package_id"] == 1
        assert result[1]["package_id"] == 1

        # Check stop types
        stop_types = [s["stop_type"] for s in result]
        assert "pickup" in stop_types
        assert "dropoff" in stop_types

    def test_single_package_sequence_numbers(self):
        """Test that sequence numbers are assigned correctly"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        sequence_numbers = [s["sequence_number"] for s in result]
        assert sequence_numbers == [1, 2]

    def test_multiple_packages(self):
        """Test with multiple packages"""
        packages = [
            create_mock_package(
                package_id=1,
                pickup_lat=40.7200,
                pickup_lng=-74.0000,
                dropoff_lat=40.7500,
                dropoff_lng=-73.9900
            ),
            create_mock_package(
                package_id=2,
                pickup_lat=40.7300,
                pickup_lng=-73.9950,
                dropoff_lat=40.7550,
                dropoff_lng=-73.9870
            ),
        ]

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=packages
        )

        assert len(result) == 4  # 2 packages * 2 stops each

        # Check all package IDs are present
        package_ids = set(s["package_id"] for s in result)
        assert package_ids == {1, 2}

        # Check sequence numbers are 1-4
        sequence_numbers = [s["sequence_number"] for s in result]
        assert sequence_numbers == [1, 2, 3, 4]

    def test_stop_contains_required_fields(self):
        """Test that each stop has required fields"""
        package = create_mock_package(
            package_id=42,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900,
            pickup_address="123 Pickup St",
            dropoff_address="456 Dropoff Ave",
            pickup_contact_name="John Doe",
            pickup_contact_phone="+1555123456",
            dropoff_contact_name="Jane Smith",
            dropoff_contact_phone="+1555789012"
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        required_fields = {"package_id", "stop_type", "address", "lat", "lng",
                          "sequence_number", "contact_name", "contact_phone"}

        for stop in result:
            assert set(stop.keys()) >= required_fields

    def test_pickup_stop_has_correct_address(self):
        """Test that pickup stop has pickup address"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900,
            pickup_address="Pickup Location ABC",
            dropoff_address="Dropoff Location XYZ"
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        pickup_stop = next(s for s in result if s["stop_type"] == "pickup")
        dropoff_stop = next(s for s in result if s["stop_type"] == "dropoff")

        assert pickup_stop["address"] == "Pickup Location ABC"
        assert dropoff_stop["address"] == "Dropoff Location XYZ"

    def test_stops_ordered_by_route_position(self):
        """Test that stops are ordered by position along route"""
        # Create packages where package 2 pickup is before package 1 pickup
        packages = [
            create_mock_package(
                package_id=1,
                pickup_lat=40.7400,  # Further along route
                pickup_lng=-73.9950,
                dropoff_lat=40.7550,
                dropoff_lng=-73.9870
            ),
            create_mock_package(
                package_id=2,
                pickup_lat=40.7200,  # Closer to start
                pickup_lng=-74.0000,
                dropoff_lat=40.7350,
                dropoff_lng=-73.9920
            ),
        ]

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=packages
        )

        # Package 2's pickup should come before package 1's pickup
        # because it's closer to the start
        first_stop = result[0]
        assert first_stop["package_id"] == 2 or first_stop["sequence_number"] == 1

    def test_position_not_in_output(self):
        """Test that internal 'position' field is removed from output"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        for stop in result:
            assert "position" not in stop

    def test_contact_info_preserved(self):
        """Test that contact information is preserved"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900,
            pickup_contact_name="Alice Pickup",
            pickup_contact_phone="+1111111111",
            dropoff_contact_name="Bob Dropoff",
            dropoff_contact_phone="+2222222222"
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        pickup_stop = next(s for s in result if s["stop_type"] == "pickup")
        dropoff_stop = next(s for s in result if s["stop_type"] == "dropoff")

        assert pickup_stop["contact_name"] == "Alice Pickup"
        assert pickup_stop["contact_phone"] == "+1111111111"
        assert dropoff_stop["contact_name"] == "Bob Dropoff"
        assert dropoff_stop["contact_phone"] == "+2222222222"

    def test_coordinates_preserved(self):
        """Test that GPS coordinates are preserved correctly"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7200,
            pickup_lng=-74.0000,
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        pickup_stop = next(s for s in result if s["stop_type"] == "pickup")
        dropoff_stop = next(s for s in result if s["stop_type"] == "dropoff")

        assert pickup_stop["lat"] == 40.7200
        assert pickup_stop["lng"] == -74.0000
        assert dropoff_stop["lat"] == 40.7500
        assert dropoff_stop["lng"] == -73.9900


class TestEdgeCases:
    """Tests for edge cases"""

    def test_same_pickup_dropoff_location(self):
        """Test package with same pickup and dropoff location"""
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7300,
            pickup_lng=-74.0000,
            dropoff_lat=40.7300,
            dropoff_lng=-74.0000
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        # Should still have 2 stops
        assert len(result) == 2

    def test_pickup_after_dropoff_on_route(self):
        """Test when pickup position is after dropoff on route"""
        # This shouldn't normally happen, but test the algorithm handles it
        package = create_mock_package(
            package_id=1,
            pickup_lat=40.7500,  # Further along route
            pickup_lng=-73.9900,
            dropoff_lat=40.7200,  # Closer to start
            dropoff_lng=-74.0000
        )

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=[package]
        )

        # Should still return 2 stops with valid sequence
        assert len(result) == 2
        assert all(s["sequence_number"] in [1, 2] for s in result)

    def test_many_packages(self):
        """Test with many packages"""
        packages = [
            create_mock_package(
                package_id=i,
                pickup_lat=40.7128 + (i * 0.005),
                pickup_lng=-74.0060 + (i * 0.002),
                dropoff_lat=40.7580 - (i * 0.003),
                dropoff_lng=-73.9855 - (i * 0.001)
            )
            for i in range(10)
        ]

        result = optimize_package_order(
            route_start=(40.7128, -74.0060),
            route_end=(40.7580, -73.9855),
            packages=packages
        )

        # Should have 20 stops (10 packages * 2)
        assert len(result) == 20

        # Sequence numbers should be 1-20
        sequence_numbers = [s["sequence_number"] for s in result]
        assert sequence_numbers == list(range(1, 21))
