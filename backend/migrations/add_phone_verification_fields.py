"""
Migration script to add phone verification fields to users table

Run this script to add phone verification columns to existing users table.
Usage: python migrations/add_phone_verification_fields.py
"""

from sqlalchemy import create_engine, text
from app.config import settings

def upgrade():
    """Add phone verification fields to users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if columns already exist
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='users' AND column_name='phone_verified'
        """))

        if result.fetchone():
            print("Phone verification columns already exist in users table")
            return

        # Add phone_verified column with default value False
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE
        """))

        # Add phone_verification_code column
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN phone_verification_code VARCHAR
        """))

        # Add phone_verification_code_expires_at column
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN phone_verification_code_expires_at TIMESTAMP WITH TIME ZONE
        """))

        # Update existing rows to have phone_verified = False
        conn.execute(text("""
            UPDATE users
            SET phone_verified = FALSE
            WHERE phone_verified IS NULL
        """))

        conn.commit()
        print("Successfully added phone verification columns to users table")

def downgrade():
    """Remove phone verification fields from users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS phone_verified,
            DROP COLUMN IF EXISTS phone_verification_code,
            DROP COLUMN IF EXISTS phone_verification_code_expires_at
        """))

        conn.commit()
        print("Successfully removed phone verification columns from users table")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
