"""
Background job service for deactivating routes with past trip dates.

This service runs periodically to deactivate courier routes whose trip_date
has passed, as they are no longer relevant for package matching.
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import SessionLocal
from app.models.package import CourierRoute
from app.services.route_deactivation_service import withdraw_pending_bids_for_courier

logger = logging.getLogger(__name__)


def run_route_cleanup_job(dry_run: bool = False, db: Optional[Session] = None) -> Dict[str, Any]:
    """
    Deactivate routes where trip_date has passed.

    Run this daily or hourly to keep routes up-to-date.

    Args:
        dry_run: If True, don't make changes, just report what would happen
        db: Optional database session (creates own if not provided)

    Returns:
        Summary of job results
    """
    own_session = db is None
    if own_session:
        db = SessionLocal()

    try:
        logger.info("Starting route cleanup job...")
        now = datetime.now(timezone.utc)

        results = {
            'started_at': now.isoformat(),
            'routes_deactivated': 0,
            'bids_withdrawn': 0,
            'dry_run': dry_run,
            'deactivated_routes': []
        }

        # Get all active routes with trip_date in the past
        expired_routes = db.query(CourierRoute).filter(
            and_(
                CourierRoute.is_active == True,
                CourierRoute.trip_date.isnot(None),
                CourierRoute.trip_date < now
            )
        ).all()

        logger.info(f"Found {len(expired_routes)} expired routes to deactivate")

        for route in expired_routes:
            # Withdraw pending bids for this route before deactivation
            withdrawn_bid_ids = []
            if not dry_run:
                withdrawn_bid_ids = withdraw_pending_bids_for_courier(
                    db, route.courier_id, route.id
                )

            route_detail = {
                'route_id': route.id,
                'courier_id': route.courier_id,
                'trip_date': route.trip_date.isoformat() if route.trip_date else None,
                'start_address': route.start_address[:50] if route.start_address else None,
                'end_address': route.end_address[:50] if route.end_address else None,
                'bids_withdrawn': len(withdrawn_bid_ids)
            }

            if not dry_run:
                route.is_active = False
                logger.info(
                    f"Deactivated route {route.id} (trip_date: {route.trip_date}), "
                    f"withdrew {len(withdrawn_bid_ids)} pending bid(s)"
                )

            results['routes_deactivated'] += 1
            results['bids_withdrawn'] += len(withdrawn_bid_ids)
            results['deactivated_routes'].append(route_detail)

        if not dry_run:
            db.commit()

        results['completed_at'] = datetime.now(timezone.utc).isoformat()

        logger.info(
            f"Route cleanup job completed: {results['routes_deactivated']} routes deactivated, "
            f"{results['bids_withdrawn']} bids withdrawn"
        )

        return results

    except Exception as e:
        logger.error(f"Error in route cleanup job: {e}")
        db.rollback()
        raise
    finally:
        if own_session:
            db.close()


# For running directly as a script
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run route cleanup job")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Don't make changes, just show what would happen"
    )

    args = parser.parse_args()

    # Configure logging
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )

    results = run_route_cleanup_job(dry_run=args.dry_run)

    print("\n=== Route Cleanup Job Results ===")
    print(f"Dry run: {results['dry_run']}")
    print(f"Routes deactivated: {results['routes_deactivated']}")
    print(f"Bids withdrawn: {results['bids_withdrawn']}")

    if results['deactivated_routes']:
        print("\n--- Deactivated Routes ---")
        for route in results['deactivated_routes']:
            print(f"  Route {route['route_id']}: {route['start_address']} → {route['end_address']} (trip_date: {route['trip_date']})")
