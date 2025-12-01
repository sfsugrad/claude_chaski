"""
Migration script to add ID verification support for couriers using Stripe Identity.

This creates:
1. id_verifications table to track verification sessions and results
2. id_verified column on users table

Usage: PYTHONPATH=. python migrations/add_id_verification.py
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Add ID verification table and user column"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Adding ID Verification Migration")
        print(f"{'='*60}\n")

        # Step 1: Add id_verified column to users table
        print("Step 1: Adding id_verified column to users table...")
        try:
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN IF NOT EXISTS id_verified BOOLEAN DEFAULT FALSE
            """))
            print("  ✓ id_verified column added")
        except Exception as e:
            print(f"  Note: {e}")

        # Step 2: Create id_verifications table
        print("\nStep 2: Creating id_verifications table...")
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS id_verifications (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

                -- Stripe Identity fields
                stripe_verification_session_id VARCHAR(255) UNIQUE,
                stripe_verification_report_id VARCHAR(255),

                -- Status tracking
                status VARCHAR(50) NOT NULL DEFAULT 'pending',

                -- Verification result data (encrypted for PII protection)
                document_type VARCHAR(50),
                document_country VARCHAR(3),
                verified_name_encrypted TEXT,
                verified_dob_encrypted TEXT,

                -- Timestamps
                created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
                submitted_at TIMESTAMP WITH TIME ZONE,
                completed_at TIMESTAMP WITH TIME ZONE,
                expires_at TIMESTAMP WITH TIME ZONE,

                -- Admin review fields
                reviewed_by_admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                reviewed_at TIMESTAMP WITH TIME ZONE,
                admin_notes TEXT,
                rejection_reason TEXT,

                -- Stripe error info (if failed)
                failure_reason VARCHAR(255),
                failure_code VARCHAR(100)
            )
        """))
        print("  ✓ id_verifications table created")

        # Step 3: Create indexes
        print("\nStep 3: Creating indexes...")

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_id_verifications_user_id
            ON id_verifications(user_id)
        """))
        print("  ✓ Index on user_id created")

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_id_verifications_status
            ON id_verifications(status)
        """))
        print("  ✓ Index on status created")

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_id_verifications_stripe_session_id
            ON id_verifications(stripe_verification_session_id)
        """))
        print("  ✓ Index on stripe_verification_session_id created")

        conn.execute(text("""
            CREATE INDEX IF NOT EXISTS ix_id_verifications_created_at
            ON id_verifications(created_at)
        """))
        print("  ✓ Index on created_at created")

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ ID Verification migration completed successfully!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("  1. Configure STRIPE_IDENTITY_WEBHOOK_SECRET in .env")
        print("  2. Set up Stripe Identity webhook endpoint")
        print("  3. Test verification flow with test Stripe account")
        print(f"{'='*60}\n")


def downgrade():
    """Remove ID verification table and user column"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Reverting ID Verification Migration")
        print(f"{'='*60}\n")

        print("Dropping id_verifications table...")
        conn.execute(text("DROP TABLE IF EXISTS id_verifications CASCADE"))
        print("  ✓ id_verifications table dropped")

        print("\nRemoving id_verified column from users table...")
        try:
            conn.execute(text("""
                ALTER TABLE users DROP COLUMN IF EXISTS id_verified
            """))
            print("  ✓ id_verified column removed")
        except Exception as e:
            print(f"  Note: {e}")

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ ID Verification migration reverted successfully!")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
