"""
Package Status Lifecycle Migration

This migration refactors the package status lifecycle from the old flow to the new simplified flow.

OLD Flow:
PENDING -> MATCHED -> ACCEPTED -> PICKED_UP -> IN_TRANSIT -> DELIVERED
                                                              |
                                                           CANCELLED

NEW Flow:
NEW -> OPEN_FOR_BIDS -> BID_SELECTED -> PENDING_PICKUP -> IN_TRANSIT -> DELIVERED
                                                                  |           |
                                                               FAILED ←←← FAILED
                                                                  |
                                                            (admin only)
                                                                  |
                                                            OPEN_FOR_BIDS
                    |
                CANCELED (from NEW, OPEN_FOR_BIDS, BID_SELECTED, PENDING_PICKUP)

Migration Steps:
1. Add new enum values to PostgreSQL
2. Migrate existing data:
   - PENDING -> OPEN_FOR_BIDS
   - BIDDING -> OPEN_FOR_BIDS
   - MATCHED -> BID_SELECTED
   - ACCEPTED -> PENDING_PICKUP
   - PICKED_UP -> IN_TRANSIT
   - CANCELLED -> CANCELED
3. Remove old enum values
4. Drop deprecated columns (sender_accepted, courier_accepted, etc.)

Usage:
    # Dry run (preview changes without applying)
    python -m migrations.refactor_package_status --dry-run

    # Apply migration
    python -m migrations.refactor_package_status

    # Rollback (if needed)
    python -m migrations.refactor_package_status --rollback
"""

import argparse
import sys
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import text
from app.database import SessionLocal, engine


# Status mappings from old to new (handle both uppercase and lowercase)
STATUS_MIGRATIONS = {
    # Uppercase versions (original DB schema)
    'PENDING': 'open_for_bids',
    'MATCHED': 'bid_selected',
    'PICKED_UP': 'in_transit',
    'CANCELLED': 'canceled',
    'IN_TRANSIT': 'in_transit',
    'DELIVERED': 'delivered',
    # Lowercase versions (if they exist)
    'pending': 'open_for_bids',
    'bidding': 'open_for_bids',
    'matched': 'bid_selected',
    'accepted': 'pending_pickup',
    'picked_up': 'in_transit',
    'cancelled': 'canceled',
    'in_transit': 'in_transit',
    'delivered': 'delivered',
}

# New enum values to add (all lowercase for consistency)
NEW_ENUM_VALUES = ['new', 'open_for_bids', 'bid_selected', 'pending_pickup', 'in_transit', 'delivered', 'failed', 'canceled']

# Old enum values to remove (after migration) - uppercase versions
OLD_ENUM_VALUES = ['PENDING', 'MATCHED', 'PICKED_UP', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'pending', 'bidding', 'matched', 'accepted', 'picked_up', 'cancelled']

# Columns to drop
DEPRECATED_COLUMNS = [
    'sender_accepted',
    'courier_accepted',
    'sender_accepted_at',
    'courier_accepted_at',
    'matched_at',
    'accepted_at',
]


def get_current_enum_values(db):
    """Get current enum values from PostgreSQL."""
    result = db.execute(text("""
        SELECT enumlabel
        FROM pg_enum
        WHERE enumtypid = (
            SELECT oid FROM pg_type WHERE typname = 'packagestatus'
        )
        ORDER BY enumsortorder
    """))
    return [row[0] for row in result.fetchall()]


def add_enum_values(db, dry_run=False):
    """Add new enum values to PostgreSQL."""
    print("\n=== Adding new enum values ===")

    current_values = get_current_enum_values(db)
    print(f"Current enum values: {current_values}")

    for value in NEW_ENUM_VALUES:
        if value not in current_values:
            sql = f"ALTER TYPE packagestatus ADD VALUE IF NOT EXISTS '{value}'"
            print(f"  Adding: {value}")
            if not dry_run:
                db.execute(text(sql))

    if not dry_run:
        db.commit()
        print("New enum values added successfully.")
    else:
        print("(dry run - no changes made)")


def migrate_status_data(db, dry_run=False):
    """Migrate existing package status values."""
    print("\n=== Migrating package status data ===")

    # Get current enum values from database
    current_enum_values = get_current_enum_values(db)
    print(f"  Current enum values in DB: {current_enum_values}")

    for old_status, new_status in STATUS_MIGRATIONS.items():
        if old_status == new_status:
            continue

        # Only query for status values that exist in the enum
        if old_status not in current_enum_values:
            continue

        # Count packages with this status
        try:
            count_result = db.execute(text(f"""
                SELECT COUNT(*) FROM packages WHERE status = '{old_status}'
            """))
            count = count_result.scalar()
        except Exception as e:
            print(f"  Skipping {old_status} (not in enum or error: {e})")
            continue

        if count > 0:
            print(f"  {old_status} -> {new_status}: {count} packages")

            if not dry_run:
                db.execute(text(f"""
                    UPDATE packages
                    SET status = '{new_status}',
                        status_changed_at = NOW()
                    WHERE status = '{old_status}'
                """))

    if not dry_run:
        db.commit()
        print("Status data migrated successfully.")
    else:
        print("(dry run - no changes made)")


def migrate_timestamp_columns(db, dry_run=False):
    """Migrate timestamp columns to new names."""
    print("\n=== Migrating timestamp columns ===")

    # Check if old columns exist and new columns need data
    column_migrations = [
        ('matched_at', 'bid_selected_at'),
        ('accepted_at', 'pending_pickup_at'),
        ('picked_up_at', 'in_transit_at'),
    ]

    for old_col, new_col in column_migrations:
        # Check if old column exists
        check_old = db.execute(text(f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = '{old_col}'
        """))
        old_exists = check_old.fetchone() is not None

        # Check if new column exists
        check_new = db.execute(text(f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = '{new_col}'
        """))
        new_exists = check_new.fetchone() is not None

        if old_exists and new_exists:
            print(f"  Copying {old_col} -> {new_col}")
            if not dry_run:
                db.execute(text(f"""
                    UPDATE packages
                    SET {new_col} = {old_col}
                    WHERE {old_col} IS NOT NULL AND {new_col} IS NULL
                """))
        elif old_exists and not new_exists:
            print(f"  Renaming {old_col} -> {new_col}")
            if not dry_run:
                db.execute(text(f"""
                    ALTER TABLE packages
                    RENAME COLUMN {old_col} TO {new_col}
                """))
        else:
            print(f"  {old_col} not found or {new_col} already populated, skipping")

    if not dry_run:
        db.commit()
        print("Timestamp columns migrated successfully.")
    else:
        print("(dry run - no changes made)")


def drop_deprecated_columns(db, dry_run=False):
    """Drop deprecated columns from packages table."""
    print("\n=== Dropping deprecated columns ===")

    for column in DEPRECATED_COLUMNS:
        # Check if column exists
        check = db.execute(text(f"""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'packages' AND column_name = '{column}'
        """))

        if check.fetchone():
            print(f"  Dropping: {column}")
            if not dry_run:
                db.execute(text(f"""
                    ALTER TABLE packages DROP COLUMN IF EXISTS {column}
                """))
        else:
            print(f"  Column {column} not found, skipping")

    if not dry_run:
        db.commit()
        print("Deprecated columns dropped successfully.")
    else:
        print("(dry run - no changes made)")


def remove_old_enum_values(db, dry_run=False):
    """Remove old enum values from PostgreSQL.

    Note: PostgreSQL doesn't directly support removing enum values.
    This requires recreating the enum type.
    """
    print("\n=== Removing old enum values ===")
    print("  Note: PostgreSQL requires recreating enum type to remove values.")
    print("  This step should be done manually after verifying no data uses old values.")

    # Get current enum values from database
    current_enum_values = get_current_enum_values(db)
    print(f"  Current enum values in DB: {current_enum_values}")

    # Verify no data uses old values (only check values that exist in the enum)
    for old_value in OLD_ENUM_VALUES:
        # Only query for status values that exist in the enum
        if old_value not in current_enum_values:
            continue

        try:
            count_result = db.execute(text(f"""
                SELECT COUNT(*) FROM packages WHERE status = '{old_value}'
            """))
            count = count_result.scalar()

            if count > 0:
                print(f"  WARNING: {count} packages still use '{old_value}' status!")
                print(f"  Cannot remove enum value until these are migrated.")
                return False
        except Exception as e:
            print(f"  Skipping {old_value} (error: {e})")
            continue

    print("  All old enum values are unused. Safe to recreate enum type.")
    print("  Manual SQL to remove old values:")
    print("""
    -- Create new enum type with only new values
    CREATE TYPE packagestatus_new AS ENUM (
        'new', 'open_for_bids', 'bid_selected', 'pending_pickup',
        'in_transit', 'delivered', 'canceled', 'failed'
    );

    -- Update column to use new type
    ALTER TABLE packages
        ALTER COLUMN status TYPE packagestatus_new
        USING status::text::packagestatus_new;

    -- Drop old type and rename new type
    DROP TYPE packagestatus;
    ALTER TYPE packagestatus_new RENAME TO packagestatus;
    """)

    return True


def run_migration(dry_run=False):
    """Run the full migration."""
    print("=" * 60)
    print("Package Status Lifecycle Migration")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY CHANGES'}")
    print(f"Started at: {datetime.now().isoformat()}")

    db = SessionLocal()

    try:
        # Step 1: Add new enum values
        add_enum_values(db, dry_run)

        # Step 2: Migrate status data
        migrate_status_data(db, dry_run)

        # Step 3: Migrate timestamp columns
        migrate_timestamp_columns(db, dry_run)

        # Step 4: Drop deprecated columns
        drop_deprecated_columns(db, dry_run)

        # Step 5: Remove old enum values (manual step)
        remove_old_enum_values(db, dry_run)

        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)

    except Exception as e:
        print(f"\nERROR: Migration failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def run_rollback(dry_run=False):
    """Rollback the migration (restore old status values).

    Note: This is a best-effort rollback. Some data may be lost.
    """
    print("=" * 60)
    print("Package Status Lifecycle Rollback")
    print("=" * 60)
    print(f"Mode: {'DRY RUN' if dry_run else 'APPLY CHANGES'}")
    print("WARNING: Rollback may result in data loss!")

    # Reverse status mappings
    REVERSE_MIGRATIONS = {
        'open_for_bids': 'pending',
        'bid_selected': 'matched',
        'pending_pickup': 'accepted',
        # Note: in_transit -> picked_up would lose data distinction
        'canceled': 'cancelled',
        'failed': 'pending',  # Best effort - failed packages go back to pending
    }

    db = SessionLocal()

    try:
        for new_status, old_status in REVERSE_MIGRATIONS.items():
            count_result = db.execute(text(f"""
                SELECT COUNT(*) FROM packages WHERE status = '{new_status}'
            """))
            count = count_result.scalar()

            if count > 0:
                print(f"  {new_status} -> {old_status}: {count} packages")

                if not dry_run:
                    db.execute(text(f"""
                        UPDATE packages
                        SET status = '{old_status}'
                        WHERE status = '{new_status}'
                    """))

        if not dry_run:
            db.commit()
            print("Rollback completed.")
        else:
            print("(dry run - no changes made)")

    except Exception as e:
        print(f"\nERROR: Rollback failed: {e}")
        db.rollback()
        raise
    finally:
        db.close()


def main():
    parser = argparse.ArgumentParser(
        description='Package Status Lifecycle Migration',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without applying them'
    )
    parser.add_argument(
        '--rollback',
        action='store_true',
        help='Rollback the migration (restore old status values)'
    )

    args = parser.parse_args()

    if args.rollback:
        run_rollback(dry_run=args.dry_run)
    else:
        run_migration(dry_run=args.dry_run)


if __name__ == '__main__':
    main()
