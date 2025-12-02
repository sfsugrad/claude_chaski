"""
Utility functions for package-route matching calculations.

Extracts core matching logic for reuse across different endpoints.
"""
from typing import List
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

from app.models.package import Package, CourierRoute
from app.utils.geo import haversine_distance


def is_package_within_route_deviation(
    package: Package,
    route: CourierRoute
) -> bool:
    """
    Check if a package's pickup and dropoff points are within the route's deviation distance.

    Args:
        package: Package with pickup/dropoff coordinates
        route: CourierRoute with start/end coordinates and max_deviation_km

    Returns:
        True if both pickup and dropoff are within max_deviation_km of the route line
    """
    # Create route line (Shapely uses lng, lat order)
    route_line = LineString([
        (route.start_lng, route.start_lat),
        (route.end_lng, route.end_lat)
    ])

    pickup_point = Point(package.pickup_lng, package.pickup_lat)
    dropoff_point = Point(package.dropoff_lng, package.dropoff_lat)

    # Calculate distance from route to pickup and dropoff
    pickup_nearest = nearest_points(route_line, pickup_point)[0]
    dropoff_nearest = nearest_points(route_line, dropoff_point)[0]

    pickup_distance = haversine_distance(
        pickup_point.y, pickup_point.x,
        pickup_nearest.y, pickup_nearest.x
    )
    dropoff_distance = haversine_distance(
        dropoff_point.y, dropoff_point.x,
        dropoff_nearest.y, dropoff_nearest.x
    )

    # Check if within deviation
    max_distance = max(pickup_distance, dropoff_distance)
    return max_distance <= route.max_deviation_km


def count_matching_routes_for_package(
    package: Package,
    routes: List[CourierRoute]
) -> int:
    """
    Count how many active routes match a package within their deviation distance.

    Args:
        package: Package to check for matches
        routes: List of active CourierRoute objects to check against

    Returns:
        Number of routes that can accommodate this package
    """
    count = 0
    for route in routes:
        if is_package_within_route_deviation(package, route):
            count += 1
    return count
