from typing import List, Tuple
from shapely.geometry import LineString, Point
from app.models.package import Package


def optimize_package_order(
    route_start: Tuple[float, float],  # (lat, lng)
    route_end: Tuple[float, float],    # (lat, lng)
    packages: List[Package]
) -> List[dict]:
    """
    Optimize the order of package pickups and dropoffs along a route.

    Algorithm:
    1. Create route line
    2. For each package, calculate position along route (0-1) for pickup and dropoff
    3. Create ordered list of stops (pickups and dropoffs)
    4. Sort by position along route
    5. Return optimized order

    Args:
        route_start: Tuple of (latitude, longitude) for route start
        route_end: Tuple of (latitude, longitude) for route end
        packages: List of Package objects to optimize

    Returns:
        List of stops with:
        - package_id: ID of the package
        - stop_type: 'pickup' or 'dropoff'
        - address: Full address string
        - lat, lng: GPS coordinates
        - sequence_number: Order in optimized route (1, 2, 3, ...)
        - contact_name, contact_phone: Contact information
    """
    if not packages:
        return []

    # Create route line (shapely expects lng, lat order)
    route_line = LineString([
        (route_start[1], route_start[0]),  # (lng, lat)
        (route_end[1], route_end[0])
    ])

    stops = []

    for package in packages:
        pickup_point = Point(package.pickup_lng, package.pickup_lat)
        dropoff_point = Point(package.dropoff_lng, package.dropoff_lat)

        # Calculate position along route (0.0 = start, 1.0 = end)
        # project() returns normalized distance along the line
        pickup_position = route_line.project(pickup_point, normalized=True)
        dropoff_position = route_line.project(dropoff_point, normalized=True)

        stops.append({
            "package_id": package.id,
            "stop_type": "pickup",
            "address": package.pickup_address,
            "lat": package.pickup_lat,
            "lng": package.pickup_lng,
            "position": pickup_position,
            "contact_name": package.pickup_contact_name,
            "contact_phone": package.pickup_contact_phone,
        })

        stops.append({
            "package_id": package.id,
            "stop_type": "dropoff",
            "address": package.dropoff_address,
            "lat": package.dropoff_lat,
            "lng": package.dropoff_lng,
            "position": dropoff_position,
            "contact_name": package.dropoff_contact_name,
            "contact_phone": package.dropoff_contact_phone,
        })

    # Sort by position along route
    stops.sort(key=lambda x: x["position"])

    # Add sequence numbers and remove internal position value
    for i, stop in enumerate(stops, 1):
        stop["sequence_number"] = i
        del stop["position"]

    return stops
