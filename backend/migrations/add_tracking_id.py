"""
Migration script to add tracking_id column to packages table.

Run with: python -m migrations.add_tracking_id
"""
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import text
from app.database import engine
from app.utils.tracking_id import generate_tracking_id


def check_column_exists(connection) -> bool:
    """Check if tracking_id column already exists."""
    result = connection.execute(text("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'packages' AND column_name = 'tracking_id'
    """))
    return result.fetchone() is not None


def generate_unique_tracking_id(connection, existing_ids: set) -> str:
    """Generate a tracking ID that doesn't exist in the database or in this batch."""
    max_attempts = 100
    for _ in range(max_attempts):
        tracking_id = generate_tracking_id()
        if tracking_id not in existing_ids:
            # Also check database
            result = connection.execute(
                text("SELECT 1 FROM packages WHERE tracking_id = :tid"),
                {"tid": tracking_id}
            )
            if result.fetchone() is None:
                return tracking_id
    raise RuntimeError("Failed to generate unique tracking ID after max attempts")


def migrate():
    """Run the migration to add tracking_id to packages."""
    print("Starting migration: Add tracking_id to packages...")

    with engine.begin() as connection:
        # Check if column already exists
        if check_column_exists(connection):
            print("Column 'tracking_id' already exists. Skipping column creation.")
        else:
            # Step 1: Add column as nullable
            print("Adding tracking_id column (nullable)...")
            connection.execute(text("""
                ALTER TABLE packages
                ADD COLUMN tracking_id VARCHAR(19)
            """))
            print("Column added.")

        # Step 2: Generate tracking IDs for existing packages without one
        print("Checking for packages without tracking_id...")
        result = connection.execute(text("""
            SELECT id FROM packages WHERE tracking_id IS NULL
        """))
        packages_to_update = result.fetchall()

        if packages_to_update:
            print(f"Generating tracking IDs for {len(packages_to_update)} packages...")
            existing_ids = set()

            for pkg in packages_to_update:
                tracking_id = generate_unique_tracking_id(connection, existing_ids)
                existing_ids.add(tracking_id)
                connection.execute(
                    text("UPDATE packages SET tracking_id = :tid WHERE id = :id"),
                    {"tid": tracking_id, "id": pkg.id}
                )
                print(f"  Package {pkg.id} -> {tracking_id}")

            print(f"Generated {len(packages_to_update)} tracking IDs.")
        else:
            print("All packages already have tracking IDs.")

        # Step 3: Make column NOT NULL (if not already)
        print("Ensuring column is NOT NULL...")
        try:
            connection.execute(text("""
                ALTER TABLE packages
                ALTER COLUMN tracking_id SET NOT NULL
            """))
            print("Column set to NOT NULL.")
        except Exception as e:
            if "already" in str(e).lower() or "cannot" in str(e).lower():
                print("Column is already NOT NULL.")
            else:
                raise

        # Step 4: Add unique index if not exists
        print("Ensuring unique index exists...")
        try:
            connection.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS ix_packages_tracking_id
                ON packages (tracking_id)
            """))
            print("Unique index created/verified.")
        except Exception as e:
            if "already exists" in str(e).lower():
                print("Index already exists.")
            else:
                raise

    print("Migration completed successfully!")


def rollback():
    """Rollback the migration (remove tracking_id column)."""
    print("Rolling back migration: Remove tracking_id from packages...")

    with engine.begin() as connection:
        if not check_column_exists(connection):
            print("Column 'tracking_id' does not exist. Nothing to rollback.")
            return

        # Drop the index first
        print("Dropping index...")
        try:
            connection.execute(text("DROP INDEX IF EXISTS ix_packages_tracking_id"))
        except Exception:
            pass

        # Drop the column
        print("Dropping column...")
        connection.execute(text("ALTER TABLE packages DROP COLUMN tracking_id"))

    print("Rollback completed successfully!")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Migration: Add tracking_id to packages")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()

    if args.rollback:
        rollback()
    else:
        migrate()
