"""
Migration script to add login_attempts table for account lockout tracking.

This table tracks login attempts for rate limiting and account lockout enforcement.

Usage: PYTHONPATH=. python migrations/add_login_attempts_table.py
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Create login_attempts table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Adding login_attempts Table Migration")
        print(f"{'='*60}\n")

        # Create login_attempts table
        print("Creating login_attempts table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS login_attempts (
                id SERIAL PRIMARY KEY,
                email VARCHAR NOT NULL,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                ip_address VARCHAR NOT NULL,
                user_agent VARCHAR,
                successful BOOLEAN NOT NULL DEFAULT FALSE,
                failure_reason VARCHAR,
                attempted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
            )
        """))

        # Create indexes for efficient querying
        print("Creating indexes on login_attempts...")

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_login_attempts_email
            ON login_attempts(email)
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_login_attempts_user_id
            ON login_attempts(user_id)
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_login_attempts_ip_address
            ON login_attempts(ip_address)
        """))

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_login_attempts_attempted_at
            ON login_attempts(attempted_at)
        """))

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ login_attempts table created successfully!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("  1. Add account_locked_until column to users table")
        print("  2. Implement lockout logic in auth.py")
        print("  3. Create cleanup job for old login attempts")
        print(f"{'='*60}\n")


def downgrade():
    """Drop login_attempts table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Reverting login_attempts Table Migration")
        print(f"{'='*60}\n")

        print("Dropping login_attempts table...")
        conn.execute(text("DROP TABLE IF EXISTS login_attempts CASCADE"))

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ login_attempts table dropped successfully!")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
