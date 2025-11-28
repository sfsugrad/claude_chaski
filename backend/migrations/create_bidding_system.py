"""
Migration script to create bidding system tables and enums

This migration:
1. Creates bidstatus enum type
2. Creates courier_bids table
3. Adds new values to packagestatus enum
4. Adds new values to notificationtype enum
5. Adds bidding columns to packages table
6. Creates indexes for performance

Run this script to apply the migration:
Usage: python migrations/create_bidding_system.py

To rollback:
Usage: python migrations/create_bidding_system.py downgrade
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Create bidding system tables and enums"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # 1. Create bidstatus enum type
        print("Creating bidstatus enum...")
        conn.execute(text("""
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'bidstatus') THEN
                    CREATE TYPE bidstatus AS ENUM (
                        'pending',
                        'selected',
                        'rejected',
                        'withdrawn',
                        'expired'
                    );
                END IF;
            END
            $$;
        """))

        # 2. Add new values to packagestatus enum (if they don't exist)
        print("Adding new package statuses...")
        new_package_statuses = ['bidding', 'bid_selected', 'pending_pickup']
        for status in new_package_statuses:
            conn.execute(text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum
                        WHERE enumlabel = '{status}'
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'packagestatus')
                    ) THEN
                        ALTER TYPE packagestatus ADD VALUE IF NOT EXISTS '{status}';
                    END IF;
                END
                $$;
            """))

        # 3. Add new values to notificationtype enum (if they don't exist)
        print("Adding new notification types...")
        new_notification_types = [
            'new_bid_received',
            'bid_selected',
            'bid_rejected',
            'bid_withdrawn',
            'bid_deadline_warning',
            'bid_deadline_extended',
            'bid_deadline_expired'
        ]
        for ntype in new_notification_types:
            conn.execute(text(f"""
                DO $$
                BEGIN
                    IF NOT EXISTS (
                        SELECT 1 FROM pg_enum
                        WHERE enumlabel = '{ntype}'
                        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'notificationtype')
                    ) THEN
                        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS '{ntype}';
                    END IF;
                END
                $$;
            """))

        conn.commit()

        # 4. Create courier_bids table
        print("Creating courier_bids table...")
        result = conn.execute(text("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_name='courier_bids'
        """))

        if result.fetchone():
            print("Table 'courier_bids' already exists")
        else:
            conn.execute(text("""
                CREATE TABLE courier_bids (
                    id SERIAL PRIMARY KEY,
                    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
                    courier_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                    route_id INTEGER REFERENCES courier_routes(id) ON DELETE SET NULL,
                    proposed_price FLOAT NOT NULL CHECK (proposed_price > 0),
                    estimated_delivery_hours INTEGER,
                    estimated_pickup_time TIMESTAMP WITH TIME ZONE,
                    message TEXT,
                    status bidstatus NOT NULL DEFAULT 'pending',
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                    selected_at TIMESTAMP WITH TIME ZONE,
                    withdrawn_at TIMESTAMP WITH TIME ZONE,
                    CONSTRAINT unique_bid_per_courier_package UNIQUE (package_id, courier_id)
                )
            """))

            # Create indexes
            conn.execute(text("CREATE INDEX ix_courier_bids_id ON courier_bids(id)"))
            conn.execute(text("CREATE INDEX ix_courier_bids_package_id ON courier_bids(package_id)"))
            conn.execute(text("CREATE INDEX ix_courier_bids_courier_id ON courier_bids(courier_id)"))
            conn.execute(text("CREATE INDEX ix_courier_bids_status ON courier_bids(status)"))
            conn.execute(text("""
                CREATE INDEX ix_courier_bids_package_pending
                ON courier_bids(package_id, status)
                WHERE status = 'pending'
            """))

            print("Successfully created courier_bids table")

        # 5. Add bidding columns to packages table
        print("Adding bidding columns to packages table...")

        # Check and add bid_deadline column
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = 'bid_deadline'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE packages ADD COLUMN bid_deadline TIMESTAMP WITH TIME ZONE
            """))
            print("Added bid_deadline column")

        # Check and add bid_count column
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = 'bid_count'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE packages ADD COLUMN bid_count INTEGER NOT NULL DEFAULT 0
            """))
            print("Added bid_count column")

        # Check and add deadline_extensions column
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = 'deadline_extensions'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE packages ADD COLUMN deadline_extensions INTEGER NOT NULL DEFAULT 0
            """))
            print("Added deadline_extensions column")

        # Check and add deadline_warning_sent column
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = 'deadline_warning_sent'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE packages ADD COLUMN deadline_warning_sent BOOLEAN NOT NULL DEFAULT FALSE
            """))
            print("Added deadline_warning_sent column")

        # Check and add selected_bid_id column (with deferred foreign key)
        result = conn.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = 'selected_bid_id'
        """))
        if not result.fetchone():
            conn.execute(text("""
                ALTER TABLE packages ADD COLUMN selected_bid_id INTEGER
            """))
            conn.execute(text("""
                ALTER TABLE packages
                ADD CONSTRAINT fk_packages_selected_bid
                FOREIGN KEY (selected_bid_id)
                REFERENCES courier_bids(id)
                ON DELETE SET NULL
            """))
            print("Added selected_bid_id column")

        # Create index for bidding packages
        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_packages_bidding
            ON packages(status, bid_deadline)
            WHERE status = 'bidding'
        """))

        conn.commit()
        print("Migration completed successfully!")


def downgrade():
    """Rollback bidding system migration"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Remove foreign key constraint first
        print("Removing foreign key constraint...")
        conn.execute(text("""
            ALTER TABLE packages DROP CONSTRAINT IF EXISTS fk_packages_selected_bid
        """))

        # Remove columns from packages table
        print("Removing bidding columns from packages...")
        conn.execute(text("ALTER TABLE packages DROP COLUMN IF EXISTS selected_bid_id"))
        conn.execute(text("ALTER TABLE packages DROP COLUMN IF EXISTS deadline_warning_sent"))
        conn.execute(text("ALTER TABLE packages DROP COLUMN IF EXISTS deadline_extensions"))
        conn.execute(text("ALTER TABLE packages DROP COLUMN IF EXISTS bid_count"))
        conn.execute(text("ALTER TABLE packages DROP COLUMN IF EXISTS bid_deadline"))

        # Drop index
        conn.execute(text("DROP INDEX IF EXISTS ix_packages_bidding"))

        # Drop courier_bids table
        print("Dropping courier_bids table...")
        conn.execute(text("DROP TABLE IF EXISTS courier_bids"))

        # Drop bidstatus enum
        print("Dropping bidstatus enum...")
        conn.execute(text("DROP TYPE IF EXISTS bidstatus"))

        # Note: We don't remove enum values as PostgreSQL doesn't support
        # removing values from enums. The new package statuses and
        # notification types will remain but won't cause issues.

        conn.commit()
        print("Rollback completed successfully!")
        print("Note: New enum values (package statuses, notification types) were not removed")
        print("as PostgreSQL doesn't support removing enum values.")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
