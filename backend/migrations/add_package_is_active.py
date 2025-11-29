"""
Migration script to add is_active column to packages table

Run this script to add the is_active column to existing packages table.
Usage: python migrations/add_package_is_active.py
"""

from sqlalchemy import create_engine, text
from app.config import settings

def upgrade():
    """Add is_active column to packages table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Check if column already exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='packages' AND column_name='is_active'
        """))

        if result.fetchone():
            print("Column 'is_active' already exists in packages table")
            return

        # Add is_active column with default value True
        conn.execute(text("""
            ALTER TABLE packages
            ADD COLUMN is_active BOOLEAN DEFAULT TRUE
        """))

        # Update existing rows to have is_active = True
        conn.execute(text("""
            UPDATE packages
            SET is_active = TRUE
            WHERE is_active IS NULL
        """))

        conn.commit()
        print("Successfully added is_active column to packages table")

def downgrade():
    """Remove is_active column from packages table"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE packages
            DROP COLUMN IF EXISTS is_active
        """))

        conn.commit()
        print("Successfully removed is_active column from packages table")

if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
