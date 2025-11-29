"""
Migration script to add encrypted PII columns

This script adds new columns for encrypted storage of PII data:
- email_encrypted (for email addresses)
- full_name_encrypted (for user names)
- phone_number_encrypted (for phone numbers)

The strategy is dual-write: keep both plain text and encrypted versions during migration,
then eventually drop plain text columns after successful validation.

Run this migration after add_token_hash_columns.py
Usage: PYTHONPATH=. python migrations/add_encrypted_pii_columns.py
"""

from sqlalchemy import create_engine, text
from app.config import settings

def upgrade():
    """Add encrypted PII columns to users table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Adding Encrypted PII Columns Migration")
        print(f"{'='*60}\n")

        # Add email_encrypted column
        print("Adding email_encrypted column...")
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS email_encrypted VARCHAR
        """))
        print("✓ Added email_encrypted column")

        # Add full_name_encrypted column
        print("Adding full_name_encrypted column...")
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS full_name_encrypted VARCHAR
        """))
        print("✓ Added full_name_encrypted column")

        # Add phone_number_encrypted column
        print("Adding phone_number_encrypted column...")
        conn.execute(text("""
            ALTER TABLE users
            ADD COLUMN IF NOT EXISTS phone_number_encrypted VARCHAR
        """))
        print("✓ Added phone_number_encrypted column")

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ Encrypted PII columns added successfully!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("  1. Run backfill script to encrypt existing PII data")
        print("  2. Update application code to use encrypted columns (dual-write)")
        print("  3. After validation period, plain text columns can be dropped")
        print(f"{'='*60}\n")


def downgrade():
    """Remove encrypted PII columns (revert migration)"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Reverting Encrypted PII Columns Migration")
        print(f"{'='*60}\n")

        # Drop encrypted columns
        print("Dropping email_encrypted column...")
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS email_encrypted
        """))

        print("Dropping full_name_encrypted column...")
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS full_name_encrypted
        """))

        print("Dropping phone_number_encrypted column...")
        conn.execute(text("""
            ALTER TABLE users
            DROP COLUMN IF EXISTS phone_number_encrypted
        """))

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ Encrypted PII columns removed successfully!")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
