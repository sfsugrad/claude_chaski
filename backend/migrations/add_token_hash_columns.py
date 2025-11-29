"""
Migration script to add token hash columns to users table

This migration adds hashed token columns alongside existing plain text tokens
to support a gradual migration from plain text to hashed tokens.

Run this script to add token hash columns to existing users table.
Usage: python migrations/add_token_hash_columns.py
"""

from sqlalchemy import create_engine, text
from app.config import settings

def upgrade():
    """Add token hash columns to users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='users' AND column_name='verification_token_hash'
        """))

        if result.fetchone():
            print("Token hash columns already exist in users table")
            return

        # Add verification_token_hash column (nullable for transition period)
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN verification_token_hash VARCHAR
        """))

        # Add password_reset_token_hash column (nullable for transition period)
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN password_reset_token_hash VARCHAR
        """))

        conn.commit()
        print("Successfully added token hash columns to users table")
        print("Next steps:")
        print("  1. Update User model to include these columns")
        print("  2. Update auth.py to hash new tokens before storing")
        print("  3. Run backfill migration to hash existing tokens")
        print("  4. After validation, drop plain text token columns")

def downgrade():
    """Remove token hash columns from users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS verification_token_hash,
            DROP COLUMN IF EXISTS password_reset_token_hash
        """))

        conn.commit()
        print("Successfully removed token hash columns from users table")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
