"""
Migration script to add verification_token_expires_at column to users table

Run this script to add the verification_token_expires_at column to existing users table.
Usage: python migrations/add_verification_token_expires_at.py
"""

from sqlalchemy import create_engine, text
from app.config import settings

def upgrade():
    """Add verification_token_expires_at column to users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='users' AND column_name='verification_token_expires_at'
        """))

        if result.fetchone():
            print("Column 'verification_token_expires_at' already exists in users table")
            return

        # Add verification_token_expires_at column (nullable, no default)
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN verification_token_expires_at TIMESTAMP WITH TIME ZONE
        """))

        conn.commit()
        print("Successfully added verification_token_expires_at column to users table")

def downgrade():
    """Remove verification_token_expires_at column from users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS verification_token_expires_at
        """))

        conn.commit()
        print("Successfully removed verification_token_expires_at column from users table")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
