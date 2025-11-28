"""
Celery application configuration for background tasks.

Run worker with:
    celery -A celery_app worker --loglevel=info

Run beat scheduler (for periodic tasks) with:
    celery -A celery_app beat --loglevel=info
"""
from celery import Celery

from app.config import settings

# Create Celery application
celery_app = Celery(
    "chaski",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=[
        "app.tasks.analytics",
        "app.tasks.payments",
        "app.tasks.notifications",
    ]
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution settings
    task_acks_late=True,  # Tasks acknowledged after completion
    task_reject_on_worker_lost=True,  # Requeue if worker dies
    worker_prefetch_multiplier=1,  # Fair task distribution

    # Result settings
    result_expires=3600,  # Results expire after 1 hour

    # Queue routing
    task_routes={
        "app.tasks.payments.*": {"queue": "high_priority"},
        "app.tasks.notifications.*": {"queue": "default"},
        "app.tasks.analytics.*": {"queue": "low_priority"},
    },

    # Default queue
    task_default_queue="default",

    # Beat schedule for periodic tasks
    beat_schedule={
        "aggregate-daily-metrics": {
            "task": "app.tasks.analytics.aggregate_daily_metrics",
            "schedule": 3600.0,  # Every hour
        },
        "calculate-courier-performance": {
            "task": "app.tasks.analytics.calculate_courier_performance_batch",
            "schedule": 86400.0,  # Daily
        },
        "cleanup-old-locations": {
            "task": "app.tasks.analytics.cleanup_old_locations",
            "schedule": 86400.0,  # Daily
        },
        "send-matched-package-reminders": {
            "task": "app.tasks.notifications.send_matched_package_reminders",
            "schedule": 3600.0,  # Every hour
        },
    },
)


# Optional: Configure retry policy
celery_app.conf.task_annotations = {
    "*": {
        "rate_limit": "100/m",  # 100 tasks per minute per worker
    },
    "app.tasks.payments.*": {
        "rate_limit": "10/s",  # 10 payment tasks per second
        "max_retries": 3,
        "default_retry_delay": 60,  # Retry after 1 minute
    },
}
