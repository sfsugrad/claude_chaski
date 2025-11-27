#!/usr/bin/env python3
"""
CLI script to run the package-route matching job.

Usage:
    # Run the job normally
    python run_matching_job.py

    # Dry run (don't create notifications)
    python run_matching_job.py --dry-run

    # Set custom notification threshold (default: 24 hours)
    python run_matching_job.py --hours 12

    # Run with verbose output
    python run_matching_job.py -v

Scheduling with cron (every hour):
    0 * * * * cd /path/to/backend && /path/to/venv/bin/python run_matching_job.py >> /var/log/chaski/matching.log 2>&1

Scheduling with systemd timer:
    See matching-job.service and matching-job.timer in the systemd directory.
"""

import argparse
import logging
import sys
import json
from datetime import datetime

# Add the app to the path
sys.path.insert(0, '.')

from app.services.matching_job import run_matching_job


def setup_logging(verbose: bool = False):
    """Configure logging for the job."""
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.StreamHandler(sys.stdout)
        ]
    )


def main():
    parser = argparse.ArgumentParser(
        description="Run package-route matching job",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
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
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="Enable verbose/debug output"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON (useful for monitoring)"
    )

    args = parser.parse_args()

    setup_logging(args.verbose)
    logger = logging.getLogger(__name__)

    logger.info(f"Starting matching job at {datetime.utcnow().isoformat()}")
    if args.dry_run:
        logger.info("DRY RUN MODE - No notifications will be created")

    try:
        results = run_matching_job(
            notify_hours_threshold=args.hours,
            dry_run=args.dry_run
        )

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            print("\n" + "=" * 50)
            print("MATCHING JOB RESULTS")
            print("=" * 50)
            print(f"Started at:            {results['started_at']}")
            print(f"Completed at:          {results['completed_at']}")
            print(f"Routes processed:      {results['routes_processed']}")
            print(f"Total matches found:   {results['total_matches_found']}")
            print(f"Notifications created: {results['notifications_created']}")
            print(f"Notifications skipped: {results['notifications_skipped']}")

            if results['route_details']:
                print("\n" + "-" * 50)
                print("ROUTE DETAILS")
                print("-" * 50)
                for rd in results['route_details']:
                    print(f"\nRoute {rd['route_id']} - {rd['courier_name']}")
                    print(f"  Path: {rd['route']}")
                    print(f"  Matches found: {rd['matches_found']}")
                    print(f"  Notifications sent: {rd['notifications_sent']}")

        logger.info("Matching job completed successfully")
        return 0

    except Exception as e:
        logger.error(f"Matching job failed: {e}", exc_info=True)
        return 1


if __name__ == "__main__":
    sys.exit(main())
