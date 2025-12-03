"""
Migration: Add first_name, middle_name, last_name fields to users table

This migration adds separate name columns to replace the single full_name field,
allowing for better personalization and formal/legal contexts.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def run_migration():
    """Add name fields to users table and migrate existing data."""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN (
                'first_name', 'first_name_encrypted',
                'middle_name', 'middle_name_encrypted',
                'last_name', 'last_name_encrypted'
            )
        """))
        existing_columns = {row[0] for row in result}

        # Add first_name column
        if 'first_name' not in existing_columns:
            print("Adding first_name column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN first_name VARCHAR
            """))
            print("  Done.")
        else:
            print("first_name column already exists, skipping.")

        # Add first_name_encrypted column
        if 'first_name_encrypted' not in existing_columns:
            print("Adding first_name_encrypted column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN first_name_encrypted VARCHAR
            """))
            print("  Done.")
        else:
            print("first_name_encrypted column already exists, skipping.")

        # Add middle_name column (optional)
        if 'middle_name' not in existing_columns:
            print("Adding middle_name column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN middle_name VARCHAR
            """))
            print("  Done.")
        else:
            print("middle_name column already exists, skipping.")

        # Add middle_name_encrypted column (optional)
        if 'middle_name_encrypted' not in existing_columns:
            print("Adding middle_name_encrypted column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN middle_name_encrypted VARCHAR
            """))
            print("  Done.")
        else:
            print("middle_name_encrypted column already exists, skipping.")

        # Add last_name column
        if 'last_name' not in existing_columns:
            print("Adding last_name column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN last_name VARCHAR
            """))
            print("  Done.")
        else:
            print("last_name column already exists, skipping.")

        # Add last_name_encrypted column
        if 'last_name_encrypted' not in existing_columns:
            print("Adding last_name_encrypted column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN last_name_encrypted VARCHAR
            """))
            print("  Done.")
        else:
            print("last_name_encrypted column already exists, skipping.")

        # Migrate existing full_name data to first_name and last_name
        # This assumes full_name is "First Last" format - splits on first space
        print("\nMigrating existing full_name data...")
        conn.execute(text("""
            UPDATE users
            SET
                first_name = CASE
                    WHEN full_name IS NOT NULL AND full_name != '' THEN
                        CASE
                            WHEN position(' ' in full_name) > 0 THEN
                                substring(full_name from 1 for position(' ' in full_name) - 1)
                            ELSE full_name
                        END
                    ELSE NULL
                END,
                last_name = CASE
                    WHEN full_name IS NOT NULL AND full_name != '' AND position(' ' in full_name) > 0 THEN
                        substring(full_name from position(' ' in full_name) + 1)
                    ELSE NULL
                END
            WHERE first_name IS NULL AND full_name IS NOT NULL
        """))
        print("  Done.")

        conn.commit()
        print("\nMigration completed successfully!")
        print("\nNote: You should run the encryption backfill script to encrypt the new name fields.")


def rollback_migration():
    """Remove name fields from users table."""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        columns_to_drop = [
            'first_name', 'first_name_encrypted',
            'middle_name', 'middle_name_encrypted',
            'last_name', 'last_name_encrypted'
        ]

        for column in columns_to_drop:
            try:
                print(f"Dropping {column} column...")
                conn.execute(text(f"ALTER TABLE users DROP COLUMN IF EXISTS {column}"))
                print("  Done.")
            except Exception as e:
                print(f"  Warning: Could not drop {column}: {e}")

        conn.commit()
        print("\nRollback completed!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Name fields migration")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
