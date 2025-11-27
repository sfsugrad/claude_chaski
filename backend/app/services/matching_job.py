"""
Background job service for automatic package-route matching.

This service runs periodically to find and notify couriers about packages
that match their active routes.
"""

import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_
from math import radians, cos, sin, asin, sqrt
from shapely.geometry import LineString, Point
from shapely.ops import nearest_points

from app.database import SessionLocal
from app.models.package import Package, PackageStatus, CourierRoute
from app.models.user import User
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great circle distance between two points
    on the earth (specified in decimal degrees) in kilometers.
    """
    lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
    dlon = lon2 - lon1
    dlat = lat2 - lat1
    a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
    c = 2 * asin(sqrt(a))
    r = 6371  # Radius of earth in kilometers
    return c * r


def calculate_detour(route_line: LineString, pickup_point: Point, dropoff_point: Point) -> float:
    """
    Calculate the detour distance required to pickup and deliver a package.
    Returns the additional distance in km compared to the direct route.
    """
    pickup_on_route = nearest_points(route_line, pickup_point)[0]
    dropoff_on_route = nearest_points(route_line, dropoff_point)[0]

    pickup_detour = haversine_distance(
        pickup_point.y, pickup_point.x,
        pickup_on_route.y, pickup_on_route.x
    )
    dropoff_detour = haversine_distance(
        dropoff_point.y, dropoff_point.x,
        dropoff_on_route.y, dropoff_on_route.x
    )
    delivery_distance = haversine_distance(
        pickup_point.y, pickup_point.x,
        dropoff_point.y, dropoff_point.x
    )

    return pickup_detour + dropoff_detour + delivery_distance


def find_matching_packages_for_route(
    db: Session,
    route: CourierRoute
) -> List[Dict[str, Any]]:
    """
    Find all pending packages that match a courier's route.

    Returns a list of matching package info with distance/detour metrics.
    """
    # Create route line (Shapely uses lng, lat order)
    route_line = LineString([
        (route.start_lng, route.start_lat),
        (route.end_lng, route.end_lat)
    ])

    # Get all pending packages
    pending_packages = db.query(Package).filter(
        and_(
            Package.status == PackageStatus.PENDING,
            Package.is_active == True
        )
    ).all()

    matched_packages = []

    for package in pending_packages:
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

        max_distance = max(pickup_distance, dropoff_distance)

        if max_distance <= route.max_deviation_km:
            detour = calculate_detour(route_line, pickup_point, dropoff_point)
            matched_packages.append({
                'package': package,
                'distance_from_route_km': round(max_distance, 2),
                'estimated_detour_km': round(detour, 2)
            })

    # Sort by detour distance (shortest first)
    matched_packages.sort(key=lambda x: x['estimated_detour_km'])
    return matched_packages


def has_recent_match_notification(
    db: Session,
    courier_id: int,
    package_id: int,
    hours: int = 24
) -> bool:
    """
    Check if courier has received a match notification for this package recently.
    Prevents spamming couriers with duplicate notifications.
    """
    cutoff_time = datetime.utcnow() - timedelta(hours=hours)

    existing = db.query(Notification).filter(
        and_(
            Notification.user_id == courier_id,
            Notification.package_id == package_id,
            Notification.type == NotificationType.PACKAGE_MATCH_FOUND,
            Notification.created_at >= cutoff_time
        )
    ).first()

    return existing is not None


def create_match_notification(
    db: Session,
    courier_id: int,
    package: Package,
    distance_km: float,
    detour_km: float
) -> Notification:
    """Create a notification for a courier about a matching package."""
    message = (
        f"New package match found! '{package.description[:40]}' "
        f"is {distance_km}km from your route with ~{detour_km}km detour. "
        f"Price: ${package.price:.2f}" if package.price else f"Price: TBD"
    )

    notification = Notification(
        user_id=courier_id,
        type=NotificationType.PACKAGE_MATCH_FOUND,
        message=message,
        package_id=package.id,
        read=False
    )

    db.add(notification)
    return notification


def run_matching_job(
    notify_hours_threshold: int = 24,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Main job function that matches packages with courier routes.

    Args:
        notify_hours_threshold: Don't re-notify about same package within this many hours
        dry_run: If True, don't create notifications, just report what would happen

    Returns:
        Summary of matching results
    """
    db = SessionLocal()

    try:
        logger.info("Starting package-route matching job...")

        # Get all active courier routes
        active_routes = db.query(CourierRoute).filter(
            CourierRoute.is_active == True
        ).all()

        logger.info(f"Found {len(active_routes)} active courier routes")

        results = {
            'started_at': datetime.utcnow().isoformat(),
            'routes_processed': 0,
            'total_matches_found': 0,
            'notifications_created': 0,
            'notifications_skipped': 0,
            'route_details': []
        }

        for route in active_routes:
            courier = db.query(User).filter(User.id == route.courier_id).first()
            if not courier:
                logger.warning(f"Courier not found for route {route.id}")
                continue

            matches = find_matching_packages_for_route(db, route)

            route_result = {
                'route_id': route.id,
                'courier_id': courier.id,
                'courier_name': courier.full_name,
                'route': f"{route.start_address} -> {route.end_address}",
                'matches_found': len(matches),
                'notifications_sent': 0,
                'matched_packages': []
            }

            for match in matches:
                package = match['package']

                # Check if we've already notified recently
                was_skipped = has_recent_match_notification(
                    db, courier.id, package.id, notify_hours_threshold
                )

                package_info = {
                    'package_id': package.id,
                    'description': package.description[:50],
                    'distance_km': match['distance_from_route_km'],
                    'detour_km': match['estimated_detour_km'],
                    'notified': False
                }

                if was_skipped:
                    results['notifications_skipped'] += 1
                    package_info['notified'] = False
                elif not dry_run:
                    create_match_notification(
                        db,
                        courier.id,
                        package,
                        match['distance_from_route_km'],
                        match['estimated_detour_km']
                    )
                    route_result['notifications_sent'] += 1
                    results['notifications_created'] += 1
                    package_info['notified'] = True
                else:
                    logger.info(
                        f"[DRY RUN] Would notify {courier.full_name} about "
                        f"package {package.id}: {package.description[:30]}"
                    )
                    route_result['notifications_sent'] += 1
                    results['notifications_created'] += 1
                    package_info['notified'] = True

                route_result['matched_packages'].append(package_info)

            results['total_matches_found'] += len(matches)
            results['routes_processed'] += 1
            results['route_details'].append(route_result)

        if not dry_run:
            db.commit()

        results['completed_at'] = datetime.utcnow().isoformat()

        logger.info(
            f"Matching job completed: {results['routes_processed']} routes processed, "
            f"{results['total_matches_found']} matches found, "
            f"{results['notifications_created']} notifications created"
        )

        return results

    except Exception as e:
        logger.error(f"Error in matching job: {e}")
        db.rollback()
        raise
    finally:
        db.close()


# For running directly as a script
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run package-route matching job")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't create notifications, just show what would happen"
    )
    parser.add_argument(
        "--hours",
        type=int,
        default=24,
        help="Don't re-notify about same package within this many hours (default: 24)"
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    results = run_matching_job(
        notify_hours_threshold=args.hours,
        dry_run=args.dry_run
    )

    print("\n=== Matching Job Results ===")
    print(f"Routes processed: {results['routes_processed']}")
    print(f"Total matches found: {results['total_matches_found']}")
    print(f"Notifications created: {results['notifications_created']}")
    print(f"Notifications skipped (recent): {results['notifications_skipped']}")

    if results['route_details']:
        print("\n--- Route Details ---")
        for rd in results['route_details']:
            print(f"  Route {rd['route_id']} ({rd['courier_name']}): "
                  f"{rd['matches_found']} matches, {rd['notifications_sent']} notifications")
