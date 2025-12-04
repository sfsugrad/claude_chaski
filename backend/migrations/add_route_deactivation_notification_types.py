"""
Migration script to add route deactivation notification types

This adds the following notification types needed for route deactivation:
- ROUTE_DEACTIVATED: Courier notification when their route is deactivated
- BID_AUTO_WITHDRAWN: Courier notification when their bid is auto-withdrawn
- BID_CANCELLED_BY_COURIER: Sender notification when selected bid is cancelled

Run this script from the backend directory:
    cd backend
    source venv/bin/activate
    PYTHONPATH=. python migrations/add_route_deactivation_notification_types.py
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Add route deactivation notification types to the enum"""
    engine = create_engine(settings.DATABASE_URL)

    new_types = [
        'ROUTE_DEACTIVATED',
        'BID_AUTO_WITHDRAWN',
        'BID_CANCELLED_BY_COURIER',
    ]

    with engine.connect() as conn:
        # Check which values already exist
        result = conn.execute(text("""
            SELECT enumlabel FROM pg_enum e
            JOIN pg_type t ON e.enumtypid = t.oid
            WHERE t.typname = 'notificationtype'
        """))
        existing_values = {row[0] for row in result}

        # Add each new type if it doesn't exist
        for type_value in new_types:
            if type_value in existing_values:
                print(f"Notification type '{type_value}' already exists, skipping")
            else:
                conn.execute(text(f"""
                    ALTER TYPE notificationtype ADD VALUE '{type_value}'
                """))
                print(f"Added notification type '{type_value}'")

        conn.commit()
        print("\nSuccessfully added route deactivation notification types")


def downgrade():
    """
    Note: PostgreSQL does not support removing values from an enum type.
    To remove these values, you would need to:
    1. Create a new enum without these values
    2. Update all rows to use valid values
    3. Drop the old enum and rename the new one

    For safety, this downgrade just prints a warning.
    """
    print("WARNING: PostgreSQL does not support removing enum values.")
    print("The notification types will remain in the database.")
    print("To fully remove them, manual intervention is required.")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
