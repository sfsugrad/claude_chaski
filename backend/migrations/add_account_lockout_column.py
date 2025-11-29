"""
Migration script to add account_locked_until column to users table.

This column supports account lockout after failed login attempts.

Usage: PYTHONPATH=. python migrations/add_account_lockout_column.py
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Add account_locked_until column to users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Adding Account Lockout Column Migration")
        print(f"{'='*60}\n")

        # Add account_locked_until column
        print("Adding account_locked_until column to users table...")
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS account_locked_until TIMESTAMP WITH TIME ZONE
        """))

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ account_locked_until column added successfully!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("  1. Implement lockout logic in auth.py")
        print("  2. Test lockout after N failed attempts")
        print("  3. Implement unlock functionality (admin or time-based)")
        print(f"{'='*60}\n")


def downgrade():
    """Remove account_locked_until column"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Reverting Account Lockout Column Migration")
        print(f"{'='*60}\n")

        print("Dropping account_locked_until column...")
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS account_locked_until
        """))

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ account_locked_until column removed successfully!")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
