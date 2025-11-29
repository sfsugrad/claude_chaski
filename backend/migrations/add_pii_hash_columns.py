"""
Migration: Add PII hash columns for secure lookup

This migration adds hash columns for email and phone_number to enable
secure database lookups without exposing plaintext PII.

Hash columns use HMAC-SHA256 with the application secret key to prevent
rainbow table attacks while still allowing deterministic lookups.

Run with: PYTHONPATH=. python migrations/add_pii_hash_columns.py
"""

import os
import sys
import hmac
import hashlib
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

load_dotenv()


def get_db_connection():
    """Create database connection from DATABASE_URL."""
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL environment variable not set")

    result = urlparse(db_url)
    return psycopg2.connect(
        database=result.path[1:],
        user=result.username,
        password=result.password,
        host=result.hostname,
        port=result.port
    )


def hash_pii(value: str, secret_key: str) -> str:
    """
    Hash PII using HMAC-SHA256 for secure lookup.
    Same algorithm as app/utils/auth.py:hash_pii()
    """
    normalized = value.lower().strip()
    return hmac.new(
        secret_key.encode('utf-8'),
        normalized.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()


def run_migration():
    """Run the migration to add PII hash columns and backfill data."""
    print("=" * 60)
    print("Migration: Add PII Hash Columns")
    print("=" * 60)

    secret_key = os.getenv('SECRET_KEY')
    if not secret_key:
        raise ValueError("SECRET_KEY environment variable not set")

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Step 1: Add new columns if they don't exist
        print("\n[Step 1] Adding new columns...")

        columns_to_add = [
            ("email_hash", "VARCHAR(64)"),
            ("phone_number_hash", "VARCHAR(64)"),
        ]

        for col_name, col_type in columns_to_add:
            cursor.execute(f"""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'users' AND column_name = '{col_name}'
            """)
            if cursor.fetchone() is None:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}")
                print(f"  Added column: {col_name}")
            else:
                print(f"  Column already exists: {col_name}")

        conn.commit()

        # Step 2: Create indexes for the new columns
        print("\n[Step 2] Creating indexes...")

        indexes_to_create = [
            ("idx_users_email_hash", "email_hash"),
            ("idx_users_phone_number_hash", "phone_number_hash"),
        ]

        for idx_name, col_name in indexes_to_create:
            cursor.execute(f"""
                SELECT indexname FROM pg_indexes
                WHERE tablename = 'users' AND indexname = '{idx_name}'
            """)
            if cursor.fetchone() is None:
                cursor.execute(f"CREATE UNIQUE INDEX {idx_name} ON users ({col_name})")
                print(f"  Created index: {idx_name}")
            else:
                print(f"  Index already exists: {idx_name}")

        conn.commit()

        # Step 3: Backfill hash columns for existing users
        print("\n[Step 3] Backfilling hash columns...")

        # Get all users with email but no email_hash
        cursor.execute("""
            SELECT id, email, phone_number
            FROM users
            WHERE email IS NOT NULL AND (email_hash IS NULL OR email_hash = '')
        """)
        users = cursor.fetchall()

        updated_count = 0
        for user_id, email, phone_number in users:
            email_hash = hash_pii(email, secret_key) if email else None
            phone_hash = hash_pii(phone_number, secret_key) if phone_number else None

            cursor.execute("""
                UPDATE users
                SET email_hash = %s, phone_number_hash = %s
                WHERE id = %s
            """, (email_hash, phone_hash, user_id))
            updated_count += 1

            if updated_count % 100 == 0:
                print(f"  Processed {updated_count} users...")
                conn.commit()

        conn.commit()
        print(f"  Backfilled {updated_count} users")

        # Step 4: Verify migration
        print("\n[Step 4] Verifying migration...")

        cursor.execute("""
            SELECT COUNT(*) FROM users
            WHERE email IS NOT NULL AND (email_hash IS NULL OR email_hash = '')
        """)
        missing_hashes = cursor.fetchone()[0]

        if missing_hashes > 0:
            print(f"  WARNING: {missing_hashes} users still missing email_hash")
        else:
            print("  All users have email_hash populated")

        cursor.execute("SELECT COUNT(*) FROM users WHERE email_hash IS NOT NULL")
        total_with_hash = cursor.fetchone()[0]
        print(f"  Total users with email_hash: {total_with_hash}")

        print("\n" + "=" * 60)
        print("Migration completed successfully!")
        print("=" * 60)

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: Migration failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


def rollback_migration():
    """Rollback the migration by dropping the hash columns."""
    print("=" * 60)
    print("Rollback: Remove PII Hash Columns")
    print("=" * 60)

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        # Drop indexes first
        print("\n[Step 1] Dropping indexes...")
        indexes = ["idx_users_email_hash", "idx_users_phone_number_hash"]
        for idx_name in indexes:
            cursor.execute(f"DROP INDEX IF EXISTS {idx_name}")
            print(f"  Dropped index: {idx_name}")

        # Drop columns
        print("\n[Step 2] Dropping columns...")
        columns = ["email_hash", "phone_number_hash"]
        for col_name in columns:
            cursor.execute(f"ALTER TABLE users DROP COLUMN IF EXISTS {col_name}")
            print(f"  Dropped column: {col_name}")

        conn.commit()
        print("\nRollback completed successfully!")

    except Exception as e:
        conn.rollback()
        print(f"\nERROR: Rollback failed: {e}")
        raise
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        rollback_migration()
    else:
        run_migration()
