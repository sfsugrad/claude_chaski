"""
Migration: Add security-related audit action enum values

This migration adds new AuditAction enum values for:
- Account security (lockout, unlock attempts)
- Session management (created, terminated, deleted)
- Profile/password changes
- Access control (unauthorized, permission denied, token blacklisted)
- File upload security

Run with: PYTHONPATH=. python migrations/add_security_audit_actions.py
"""

import os
import sys
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


def get_existing_enum_values(cursor, enum_name: str) -> set:
    """Get existing values for a PostgreSQL enum type."""
    cursor.execute(
        "SELECT enumlabel FROM pg_enum WHERE enumtypid = "
        "(SELECT oid FROM pg_type WHERE typname = %s)",
        (enum_name,)
    )
    return {row[0] for row in cursor.fetchall()}


def add_enum_value(cursor, enum_name: str, value: str) -> bool:
    """Add a value to a PostgreSQL enum type if it doesn't exist."""
    try:
        cursor.execute(
            f"ALTER TYPE {enum_name} ADD VALUE IF NOT EXISTS %s",
            (value,)
        )
        return True
    except Exception as e:
        print(f"  Error adding {value}: {e}")
        return False


def run_migration():
    """Run the migration to add new audit action enum values."""
    print("=" * 60)
    print("Migration: Add Security Audit Action Enum Values")
    print("=" * 60)

    # New enum values to add (grouped by category)
    new_values = [
        # Account Security
        ("ACCOUNT_LOCKED", "Account locked after failed login attempts"),
        ("ACCOUNT_UNLOCK_ATTEMPT", "Attempt to unlock a locked account"),

        # Session Management
        ("SESSION_CREATED", "New user session created"),
        ("SESSION_TERMINATED", "User session terminated (logout)"),
        ("SESSION_DELETED", "User session deleted (admin action)"),

        # Profile/Password Changes
        ("PASSWORD_CHANGED", "User changed their password"),
        ("PROFILE_UPDATED", "User updated their profile"),

        # Access Control
        ("UNAUTHORIZED_ACCESS", "Unauthorized access attempt"),
        ("PERMISSION_DENIED", "Permission denied for action"),
        ("TOKEN_BLACKLISTED", "JWT token added to blacklist"),

        # File Upload Security
        ("FILE_UPLOAD_SUCCESS", "File uploaded successfully"),
        ("FILE_UPLOAD_FAILED", "File upload failed"),
        ("FILE_VALIDATION_FAILED", "File failed validation checks"),
        ("SUSPICIOUS_FILE_UPLOAD", "Suspicious file upload detected"),
    ]

    conn = get_db_connection()
    conn.autocommit = True  # Required for ALTER TYPE
    cursor = conn.cursor()

    try:
        # Get existing values
        existing = get_existing_enum_values(cursor, "auditaction")
        print(f"\nExisting enum values: {len(existing)}")

        # Add new values
        added = 0
        skipped = 0

        print("\nProcessing new values:")
        for value, description in new_values:
            if value in existing:
                print(f"  [SKIP] {value} - already exists")
                skipped += 1
            else:
                if add_enum_value(cursor, "auditaction", value):
                    print(f"  [ADD]  {value} - {description}")
                    added += 1

        print(f"\nMigration complete:")
        print(f"  - Added: {added}")
        print(f"  - Skipped (already exist): {skipped}")
        print(f"  - Total enum values: {len(existing) + added}")

    finally:
        cursor.close()
        conn.close()


def rollback_migration():
    """
    Note: PostgreSQL does not support removing enum values directly.
    To rollback, you would need to:
    1. Create a new enum type without the values
    2. Update all columns using the old type
    3. Drop the old type
    4. Rename the new type

    This is rarely needed and should be done manually if required.
    """
    print("Rollback for enum additions is not supported.")
    print("PostgreSQL does not allow removing enum values.")
    print("To rollback, manual intervention is required.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--rollback":
        rollback_migration()
    else:
        run_migration()
