"""
Migration: Add legal agreement acceptance fields to users table

This migration adds columns to track when users accept Terms of Service,
Privacy Policy, and Courier Agreement, along with the versions accepted.
"""

import os
import sys

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import create_engine, text
from app.config import settings


def run_migration():
    """Add legal agreement fields to users table."""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'users'
            AND column_name IN (
                'terms_accepted_at', 'privacy_accepted_at', 'courier_agreement_accepted_at',
                'terms_version', 'privacy_version', 'courier_agreement_version'
            )
        """))
        existing_columns = {row[0] for row in result}

        # Add terms_accepted_at column
        if 'terms_accepted_at' not in existing_columns:
            print("Adding terms_accepted_at column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN terms_accepted_at TIMESTAMP WITH TIME ZONE
            """))
            print("  Done.")
        else:
            print("terms_accepted_at column already exists, skipping.")

        # Add privacy_accepted_at column
        if 'privacy_accepted_at' not in existing_columns:
            print("Adding privacy_accepted_at column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN privacy_accepted_at TIMESTAMP WITH TIME ZONE
            """))
            print("  Done.")
        else:
            print("privacy_accepted_at column already exists, skipping.")

        # Add courier_agreement_accepted_at column
        if 'courier_agreement_accepted_at' not in existing_columns:
            print("Adding courier_agreement_accepted_at column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN courier_agreement_accepted_at TIMESTAMP WITH TIME ZONE
            """))
            print("  Done.")
        else:
            print("courier_agreement_accepted_at column already exists, skipping.")

        # Add terms_version column
        if 'terms_version' not in existing_columns:
            print("Adding terms_version column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN terms_version VARCHAR(20)
            """))
            print("  Done.")
        else:
            print("terms_version column already exists, skipping.")

        # Add privacy_version column
        if 'privacy_version' not in existing_columns:
            print("Adding privacy_version column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN privacy_version VARCHAR(20)
            """))
            print("  Done.")
        else:
            print("privacy_version column already exists, skipping.")

        # Add courier_agreement_version column
        if 'courier_agreement_version' not in existing_columns:
            print("Adding courier_agreement_version column...")
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN courier_agreement_version VARCHAR(20)
            """))
            print("  Done.")
        else:
            print("courier_agreement_version column already exists, skipping.")

        conn.commit()
        print("\nMigration completed successfully!")


def rollback_migration():
    """Remove legal agreement fields from users table."""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        columns_to_drop = [
            'terms_accepted_at', 'privacy_accepted_at', 'courier_agreement_accepted_at',
            'terms_version', 'privacy_version', 'courier_agreement_version'
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
    parser = argparse.ArgumentParser(description="Legal agreement fields migration")
    parser.add_argument("--rollback", action="store_true", help="Rollback the migration")
    args = parser.parse_args()

    if args.rollback:
        rollback_migration()
    else:
        run_migration()
