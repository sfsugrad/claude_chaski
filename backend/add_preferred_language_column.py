"""
Migration script to add preferred_language column to users table
"""
from app.database import engine, SessionLocal
from sqlalchemy import text

def add_preferred_language_column():
    """Add preferred_language column to users table if it doesn't exist"""
    with engine.connect() as conn:
        # Check if column exists
        result = conn.execute(text("""
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name='users' AND column_name='preferred_language'
        """))

        if result.fetchone() is None:
            # Column doesn't exist, add it
            conn.execute(text("""
                ALTER TABLE users
                ADD COLUMN preferred_language VARCHAR(5) DEFAULT 'en' NOT NULL
            """))
            conn.commit()
            print("✅ Successfully added preferred_language column to users table")
        else:
            print("ℹ️  preferred_language column already exists")

if __name__ == "__main__":
    add_preferred_language_column()
