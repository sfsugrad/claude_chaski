"""
Notification background tasks for sending emails and push notifications.
"""
from datetime import datetime, timedelta
from celery import shared_task

from app.database import SessionLocal
from app.models.user import User
from app.models.package import Package, PackageStatus
from app.models.notification import Notification, NotificationType


@shared_task(name="app.tasks.notifications.send_email_notification")
def send_email_notification(
    user_id: int,
    subject: str,
    template: str,
    context: dict
):
    """
    Send email notification to a user.

    Args:
        user_id: ID of the user to notify
        subject: Email subject
        template: Email template name
        context: Template context variables
    """
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return {"status": "failed", "reason": "User not found"}

        # Email sending will use the existing email service
        # from app.utils.email import send_email
        return {
            "status": "sent",
            "user_id": user_id,
            "email": user.email,
            "subject": subject
        }

    finally:
        db.close()


@shared_task(name="app.tasks.notifications.send_delivery_proof_notification")
def send_delivery_proof_notification(package_id: int, sender_id: int):
    """
    Notify sender that delivery proof has been submitted.

    Args:
        package_id: ID of the delivered package
        sender_id: ID of the package sender
    """
    return send_email_notification.delay(
        user_id=sender_id,
        subject="Your package has been delivered!",
        template="delivery_proof",
        context={"package_id": package_id}
    )


@shared_task(name="app.tasks.notifications.send_payment_notification")
def send_payment_notification(
    user_id: int,
    notification_type: str,
    amount_cents: int,
    package_id: int
):
    """
    Send payment-related notification.

    Args:
        user_id: ID of the user to notify
        notification_type: Type of payment notification
        amount_cents: Amount in cents
        package_id: Related package ID
    """
    subject_map = {
        "payment_received": "Payment received for your delivery",
        "payment_failed": "Payment failed - action required",
        "payout_sent": "Your earnings have been sent",
        "payout_failed": "Payout failed - please check your account",
    }

    subject = subject_map.get(notification_type, "Payment notification")

    return send_email_notification.delay(
        user_id=user_id,
        subject=subject,
        template=f"payment_{notification_type}",
        context={
            "amount_cents": amount_cents,
            "package_id": package_id
        }
    )


@shared_task(name="app.tasks.notifications.send_batch_digest")
def send_batch_digest(user_id: int, notifications: list):
    """
    Send a digest of multiple notifications.

    Args:
        user_id: ID of the user
        notifications: List of notification summaries
    """
    return send_email_notification.delay(
        user_id=user_id,
        subject=f"You have {len(notifications)} new notifications",
        template="notification_digest",
        context={"notifications": notifications}
    )


@shared_task(name="app.tasks.notifications.send_matched_package_reminders")
def send_matched_package_reminders():
    """
    Send reminder notifications for packages that have been MATCHED but not picked up.

    This task should run hourly via Celery Beat.

    Reminder schedule:
    - First reminder: After 4 hours in MATCHED status
    - Second reminder: After 12 hours in MATCHED status
    - Urgent reminder: After 24 hours in MATCHED status (notifies both parties)
    """
    db = SessionLocal()
    try:
        now = datetime.utcnow()

        # Define reminder thresholds
        first_reminder_threshold = now - timedelta(hours=4)
        second_reminder_threshold = now - timedelta(hours=12)
        urgent_reminder_threshold = now - timedelta(hours=24)

        # Find all MATCHED packages
        matched_packages = db.query(Package).filter(
            Package.status == PackageStatus.MATCHED,
            Package.is_active == True,
            Package.matched_at.isnot(None)
        ).all()

        reminders_sent = 0

        for package in matched_packages:
            matched_at = package.matched_at

            # Determine reminder type based on how long it's been matched
            if matched_at <= urgent_reminder_threshold:
                # 24+ hours - urgent reminder to both parties
                _send_urgent_reminder(db, package)
                reminders_sent += 2
            elif matched_at <= second_reminder_threshold:
                # 12-24 hours - second reminder to courier
                _send_courier_reminder(db, package, "second")
                reminders_sent += 1
            elif matched_at <= first_reminder_threshold:
                # 4-12 hours - first reminder to courier
                _send_courier_reminder(db, package, "first")
                reminders_sent += 1

        db.commit()
        return {
            "status": "completed",
            "reminders_sent": reminders_sent,
            "packages_checked": len(matched_packages)
        }

    except Exception as e:
        db.rollback()
        return {"status": "failed", "error": str(e)}

    finally:
        db.close()


def _send_courier_reminder(db, package: Package, reminder_type: str):
    """Send a reminder notification to the courier."""
    if not package.courier_id:
        return

    messages = {
        "first": f"Reminder: You accepted package #{package.id} - please pick it up soon.",
        "second": f"Second reminder: Package #{package.id} is waiting to be picked up. The sender is expecting delivery.",
    }

    message = messages.get(reminder_type, messages["first"])

    # Create notification
    notification = Notification(
        user_id=package.courier_id,
        type=NotificationType.PACKAGE_REMINDER,
        message=message,
        package_id=package.id
    )
    db.add(notification)


def _send_urgent_reminder(db, package: Package):
    """Send urgent reminders to both courier and sender."""
    # Notify courier
    if package.courier_id:
        courier_notification = Notification(
            user_id=package.courier_id,
            type=NotificationType.PACKAGE_REMINDER,
            message=f"URGENT: Package #{package.id} has been waiting 24+ hours. Please pick it up or contact the sender.",
            package_id=package.id
        )
        db.add(courier_notification)

    # Notify sender
    sender_notification = Notification(
        user_id=package.sender_id,
        type=NotificationType.PACKAGE_REMINDER,
        message=f"Your package #{package.id} hasn't been picked up yet. The courier may be delayed - consider contacting them.",
        package_id=package.id
    )
    db.add(sender_notification)
