"""
Migration script to add USER_VERIFY and USER_UNVERIFY to auditaction enum

Run this script to add the new audit action values to the PostgreSQL enum.
Usage: python migrations/add_audit_action_verify_unverify.py
"""

from sqlalchemy import create_engine, text
from app.config import settings


def upgrade():
    """Add USER_VERIFY and USER_UNVERIFY to auditaction enum"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if USER_VERIFY already exists in the enum
        # Note: SQLAlchemy uses enum names (uppercase) by default, not values
        result = conn.execute(text("""
            SELECT enumlabel
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'auditaction')
            AND enumlabel = 'USER_VERIFY'
        """))

        if result.fetchone():
            print("Value 'USER_VERIFY' already exists in auditaction enum")
        else:
            # Add USER_VERIFY to the enum (uppercase to match existing convention)
            conn.execute(text("""
                ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'USER_VERIFY'
            """))
            print("Added 'USER_VERIFY' to auditaction enum")

        # Check if USER_UNVERIFY already exists in the enum
        result = conn.execute(text("""
            SELECT enumlabel
            FROM pg_enum
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'auditaction')
            AND enumlabel = 'USER_UNVERIFY'
        """))

        if result.fetchone():
            print("Value 'USER_UNVERIFY' already exists in auditaction enum")
        else:
            # Add USER_UNVERIFY to the enum (uppercase to match existing convention)
            conn.execute(text("""
                ALTER TYPE auditaction ADD VALUE IF NOT EXISTS 'USER_UNVERIFY'
            """))
            print("Added 'USER_UNVERIFY' to auditaction enum")

        conn.commit()
        print("Successfully updated auditaction enum")


def downgrade():
    """
    Note: PostgreSQL does not support removing values from enums directly.
    To remove enum values, you would need to:
    1. Create a new enum without the values
    2. Update the column to use the new enum
    3. Drop the old enum
    4. Rename the new enum

    This is a destructive operation and is not recommended for production.
    """
    print("Downgrade not supported for enum value removal in PostgreSQL")
    print("To remove enum values, manual intervention is required")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
