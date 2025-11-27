"""
Migration script to create notifications table

Run this script to create the notifications table.
Usage: python migrations/create_notifications_table.py
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Create notifications table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if table already exists
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='notifications'
        """))

        if result.fetchone():
            print("Table 'notifications' already exists")
            return

        # Create the notification type enum
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notificationtype') THEN
                    CREATE TYPE notificationtype AS ENUM (
                        'package_matched',
                        'package_accepted',
                        'package_declined',
                        'package_picked_up',
                        'package_in_transit',
                        'package_delivered',
                        'package_cancelled',
                        'route_match_found',
                        'system'
                    );
                END IF;
            END
            $$;
        """))

        # Create notifications table
        conn.execute(text("""
            CREATE TABLE notifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                type notificationtype NOT NULL,
                message VARCHAR NOT NULL,
                read BOOLEAN DEFAULT FALSE,
                package_id INTEGER REFERENCES packages(id) ON DELETE SET NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            )
        """))

        # Create indexes for common queries
        conn.execute(text("""
            CREATE INDEX ix_notifications_id ON notifications(id)
        """))
        conn.execute(text("""
            CREATE INDEX ix_notifications_user_id ON notifications(user_id)
        """))
        conn.execute(text("""
            CREATE INDEX ix_notifications_read ON notifications(read)
        """))
        conn.execute(text("""
            CREATE INDEX ix_notifications_user_unread ON notifications(user_id, read)
            WHERE read = FALSE
        """))

        conn.commit()
        print("Successfully created notifications table")


def downgrade():
    """Drop notifications table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("DROP TABLE IF EXISTS notifications"))
        conn.execute(text("DROP TYPE IF EXISTS notificationtype"))

        conn.commit()
        print("Successfully dropped notifications table")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
