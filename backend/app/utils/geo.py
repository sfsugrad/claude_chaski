"""Geometric utility functions for matching algorithm"""
from typing import Tuple
from geopy.distance import geodesic
import math


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Calculate the great-circle distance between two points on Earth using Haversine formula.

    Args:
        lat1: Latitude of first point
        lng1: Longitude of first point
        lat2: Latitude of second point
        lng2: Longitude of second point

    Returns:
        Distance in kilometers
    """
    point1 = (lat1, lng1)
    point2 = (lat2, lng2)
    return geodesic(point1, point2).kilometers


def point_to_line_distance(
    point_lat: float,
    point_lng: float,
    line_start_lat: float,
    line_start_lng: float,
    line_end_lat: float,
    line_end_lng: float
) -> float:
    """
    Calculate the minimum distance from a point to a line segment (route).
    Uses the cross-track distance formula for spherical geometry.

    Args:
        point_lat: Latitude of the point
        point_lng: Longitude of the point
        line_start_lat: Latitude of line start
        line_start_lng: Longitude of line start
        line_end_lat: Latitude of line end
        line_end_lng: Longitude of line end

    Returns:
        Distance in kilometers from point to line
    """
    # Convert to radians
    point_lat_rad = math.radians(point_lat)
    point_lng_rad = math.radians(point_lng)
    start_lat_rad = math.radians(line_start_lat)
    start_lng_rad = math.radians(line_start_lng)
    end_lat_rad = math.radians(line_end_lat)
    end_lng_rad = math.radians(line_end_lng)

    # Earth's radius in kilometers
    R = 6371.0

    # Distance from start to point and start to end
    d_start_point = haversine_distance(line_start_lat, line_start_lng, point_lat, point_lng)
    d_start_end = haversine_distance(line_start_lat, line_start_lng, line_end_lat, line_end_lng)

    # If the route is essentially a point, return distance to that point
    if d_start_end < 0.1:  # Less than 100 meters
        return d_start_point

    # Calculate bearing from start to end
    y = math.sin(end_lng_rad - start_lng_rad) * math.cos(end_lat_rad)
    x = (math.cos(start_lat_rad) * math.sin(end_lat_rad) -
         math.sin(start_lat_rad) * math.cos(end_lat_rad) * math.cos(end_lng_rad - start_lng_rad))
    bearing_start_end = math.atan2(y, x)

    # Calculate bearing from start to point
    y = math.sin(point_lng_rad - start_lng_rad) * math.cos(point_lat_rad)
    x = (math.cos(start_lat_rad) * math.sin(point_lat_rad) -
         math.sin(start_lat_rad) * math.cos(point_lat_rad) * math.cos(point_lng_rad - start_lng_rad))
    bearing_start_point = math.atan2(y, x)

    # Calculate angle between the two bearings
    angle = bearing_start_point - bearing_start_end

    # Cross-track distance (perpendicular distance from point to route)
    cross_track_distance = abs(math.asin(math.sin(d_start_point / R) * math.sin(angle)) * R)

    # Along-track distance (distance along route to closest point)
    along_track_distance = math.acos(math.cos(d_start_point / R) / math.cos(cross_track_distance / R)) * R

    # Check if the closest point is beyond the route endpoints
    if along_track_distance > d_start_end:
        # Closest point is beyond the end, return distance to end
        return haversine_distance(line_end_lat, line_end_lng, point_lat, point_lng)
    elif along_track_distance < 0:
        # Closest point is before the start, return distance to start
        return d_start_point
    else:
        # Closest point is on the route segment
        return cross_track_distance


def calculate_detour_distance(
    route_start_lat: float,
    route_start_lng: float,
    route_end_lat: float,
    route_end_lng: float,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float
) -> Tuple[float, float]:
    """
    Calculate the detour distance if a courier picks up and delivers a package.

    The detour is calculated as:
    detour = (start→pickup + pickup→dropoff + dropoff→end) - (start→end)

    Args:
        route_start_lat: Courier route start latitude
        route_start_lng: Courier route start longitude
        route_end_lat: Courier route end latitude
        route_end_lng: Courier route end longitude
        pickup_lat: Package pickup latitude
        pickup_lng: Package pickup longitude
        dropoff_lat: Package dropoff latitude
        dropoff_lng: Package dropoff longitude

    Returns:
        Tuple of (detour_distance_km, total_distance_with_package_km)
    """
    # Direct route distance (without package)
    direct_distance = haversine_distance(
        route_start_lat, route_start_lng,
        route_end_lat, route_end_lng
    )

    # Distance with package detour
    start_to_pickup = haversine_distance(
        route_start_lat, route_start_lng,
        pickup_lat, pickup_lng
    )

    pickup_to_dropoff = haversine_distance(
        pickup_lat, pickup_lng,
        dropoff_lat, dropoff_lng
    )

    dropoff_to_end = haversine_distance(
        dropoff_lat, dropoff_lng,
        route_end_lat, route_end_lng
    )

    total_distance_with_package = start_to_pickup + pickup_to_dropoff + dropoff_to_end
    detour_distance = total_distance_with_package - direct_distance

    return detour_distance, total_distance_with_package


def is_package_along_route(
    route_start_lat: float,
    route_start_lng: float,
    route_end_lat: float,
    route_end_lng: float,
    pickup_lat: float,
    pickup_lng: float,
    dropoff_lat: float,
    dropoff_lng: float,
    max_deviation_km: float
) -> bool:
    """
    Check if a package is along a courier's route within acceptable deviation.

    A package is considered "along route" if both pickup and dropoff points
    are within max_deviation_km from the route line.

    Args:
        route_start_lat: Courier route start latitude
        route_start_lng: Courier route start longitude
        route_end_lat: Courier route end latitude
        route_end_lng: Courier route end longitude
        pickup_lat: Package pickup latitude
        pickup_lng: Package pickup longitude
        dropoff_lat: Package dropoff latitude
        dropoff_lng: Package dropoff longitude
        max_deviation_km: Maximum acceptable deviation in kilometers

    Returns:
        True if package is along route, False otherwise
    """
    # Calculate distance from pickup point to route
    pickup_distance = point_to_line_distance(
        pickup_lat, pickup_lng,
        route_start_lat, route_start_lng,
        route_end_lat, route_end_lng
    )

    # Calculate distance from dropoff point to route
    dropoff_distance = point_to_line_distance(
        dropoff_lat, dropoff_lng,
        route_start_lat, route_start_lng,
        route_end_lat, route_end_lng
    )

    # Both points must be within deviation distance
    return pickup_distance <= max_deviation_km and dropoff_distance <= max_deviation_km
