"""
Background job service for handling bid deadlines.

This service runs periodically to:
1. Send warning notifications (6 hours before deadline)
2. Extend deadlines when they expire (by 12 hours, max 2 extensions)
3. Expire all bids after max extensions and return package to PENDING
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.database import SessionLocal
from app.models.package import Package, PackageStatus
from app.models.bid import CourierBid, BidStatus
from app.models.user import User
from app.models.notification import Notification, NotificationType

logger = logging.getLogger(__name__)


# Constants
WARNING_HOURS_BEFORE = 6  # Send warning 6 hours before deadline
EXTENSION_HOURS = 12  # Extend by 12 hours when deadline passes
MAX_EXTENSIONS = 2  # Maximum number of extensions (48 hours total after initial 24)


def send_deadline_warning(db: Session, package: Package) -> None:
    """Send warning notification to sender about approaching deadline."""
    sender = db.query(User).filter(User.id == package.sender_id).first()
    if not sender:
        return

    message = (
        f"Your bid selection deadline for '{package.description[:40]}...' expires in {WARNING_HOURS_BEFORE} hours. "
        f"You have {package.bid_count} bid(s) to review."
    )

    notification = Notification(
        user_id=package.sender_id,
        type=NotificationType.BID_DEADLINE_WARNING,
        message=message,
        package_id=package.id,
        read=False
    )
    db.add(notification)

    # Mark that we've sent the warning
    package.deadline_warning_sent = True

    logger.info(f"Sent deadline warning for package {package.id} to sender {sender.email}")


def extend_deadline(db: Session, package: Package) -> None:
    """Extend the bid deadline by 12 hours."""
    now = datetime.now(timezone.utc)
    package.bid_deadline = now + timedelta(hours=EXTENSION_HOURS)
    package.deadline_extensions += 1
    package.deadline_warning_sent = False  # Reset for new warning

    # Notify sender about extension
    message = (
        f"The bid deadline for '{package.description[:40]}...' has been extended by {EXTENSION_HOURS} hours. "
        f"Extension {package.deadline_extensions} of {MAX_EXTENSIONS}. "
        f"Please select a bid to proceed with delivery."
    )

    notification = Notification(
        user_id=package.sender_id,
        type=NotificationType.BID_DEADLINE_EXTENDED,
        message=message,
        package_id=package.id,
        read=False
    )
    db.add(notification)

    logger.info(f"Extended deadline for package {package.id} (extension {package.deadline_extensions})")


def expire_all_bids(db: Session, package: Package) -> List[int]:
    """Expire all pending bids for a package and return to PENDING status."""
    # Get all pending bids
    pending_bids = db.query(CourierBid).filter(
        and_(
            CourierBid.package_id == package.id,
            CourierBid.status == BidStatus.PENDING
        )
    ).all()

    courier_ids = []
    for bid in pending_bids:
        bid.status = BidStatus.EXPIRED
        courier_ids.append(bid.courier_id)

    # Reset package to PENDING
    package.status = PackageStatus.PENDING
    package.bid_deadline = None
    package.bid_count = 0
    package.deadline_extensions = 0
    package.deadline_warning_sent = False

    # Notify sender
    message = (
        f"The bidding period for '{package.description[:40]}...' has ended without a selection. "
        f"Your package has been returned to pending status and couriers can bid again."
    )

    sender_notification = Notification(
        user_id=package.sender_id,
        type=NotificationType.BID_DEADLINE_EXPIRED,
        message=message,
        package_id=package.id,
        read=False
    )
    db.add(sender_notification)

    # Notify couriers
    for courier_id in courier_ids:
        courier_notification = Notification(
            user_id=courier_id,
            type=NotificationType.BID_DEADLINE_EXPIRED,
            message=f"The bidding period has ended for a package you bid on. The sender did not select a bid.",
            package_id=package.id,
            read=False
        )
        db.add(courier_notification)

    logger.info(f"Expired all bids for package {package.id}, notified {len(courier_ids)} couriers")

    return courier_ids


def run_bid_deadline_job(dry_run: bool = False) -> Dict[str, Any]:
    """
    Main job function that handles bid deadlines.

    Run this every 5 minutes or so.

    Args:
        dry_run: If True, don't make changes, just report what would happen

    Returns:
        Summary of job results
    """
    db = SessionLocal()

    try:
        logger.info("Starting bid deadline job...")
        now = datetime.now(timezone.utc)

        results = {
            'started_at': now.isoformat(),
            'warnings_sent': 0,
            'deadlines_extended': 0,
            'packages_expired': 0,
            'bids_expired': 0,
            'details': []
        }

        # Get all packages in BIDDING status with deadlines
        bidding_packages = db.query(Package).filter(
            and_(
                Package.status == PackageStatus.BIDDING,
                Package.bid_deadline.isnot(None),
                Package.is_active == True
            )
        ).all()

        logger.info(f"Found {len(bidding_packages)} packages in bidding status")

        for package in bidding_packages:
            package_detail = {
                'package_id': package.id,
                'deadline': package.bid_deadline.isoformat() if package.bid_deadline else None,
                'extensions': package.deadline_extensions,
                'action': None
            }

            # Check if deadline warning needed (6 hours before deadline)
            warning_time = package.bid_deadline - timedelta(hours=WARNING_HOURS_BEFORE)

            if now >= warning_time and not package.deadline_warning_sent:
                if not dry_run:
                    send_deadline_warning(db, package)
                results['warnings_sent'] += 1
                package_detail['action'] = 'warning_sent'
                logger.info(f"Package {package.id}: Sending deadline warning")

            # Check if deadline has passed
            elif now >= package.bid_deadline:
                if package.deadline_extensions < MAX_EXTENSIONS:
                    # Extend deadline
                    if not dry_run:
                        extend_deadline(db, package)
                    results['deadlines_extended'] += 1
                    package_detail['action'] = 'deadline_extended'
                    logger.info(f"Package {package.id}: Extending deadline (extension {package.deadline_extensions + 1})")
                else:
                    # Max extensions reached, expire all bids
                    if not dry_run:
                        expired_courier_ids = expire_all_bids(db, package)
                        results['bids_expired'] += len(expired_courier_ids)
                    else:
                        # Count pending bids for dry run
                        pending_count = db.query(CourierBid).filter(
                            and_(
                                CourierBid.package_id == package.id,
                                CourierBid.status == BidStatus.PENDING
                            )
                        ).count()
                        results['bids_expired'] += pending_count
                    results['packages_expired'] += 1
                    package_detail['action'] = 'bids_expired'
                    logger.info(f"Package {package.id}: Expiring all bids, returning to PENDING")

            results['details'].append(package_detail)

        if not dry_run:
            db.commit()

        results['completed_at'] = datetime.now(timezone.utc).isoformat()

        logger.info(
            f"Bid deadline job completed: "
            f"{results['warnings_sent']} warnings sent, "
            f"{results['deadlines_extended']} deadlines extended, "
            f"{results['packages_expired']} packages expired"
        )

        return results

    except Exception as e:
        logger.error(f"Error in bid deadline job: {e}")
        db.rollback()
        raise
    finally:
        db.close()


# For running directly as a script
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run bid deadline handling job")
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

    results = run_bid_deadline_job(dry_run=args.dry_run)

    print("\n=== Bid Deadline Job Results ===")
    print(f"Warnings sent: {results['warnings_sent']}")
    print(f"Deadlines extended: {results['deadlines_extended']}")
    print(f"Packages expired: {results['packages_expired']}")
    print(f"Bids expired: {results['bids_expired']}")

    if results['details']:
        print("\n--- Package Details ---")
        for detail in results['details']:
            action = detail['action'] or 'no_action'
            print(f"  Package {detail['package_id']}: {action}")
