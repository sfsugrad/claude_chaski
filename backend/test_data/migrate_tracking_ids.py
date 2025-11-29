"""
Script to migrate tracking IDs from old format (CHS-XXXXXXXX) to new format (xxxx-xxxx-xxxx-xxxx).
Run this from the backend directory: python -m test_data.migrate_tracking_ids
"""
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.models.package import Package
from app.utils.tracking_id import generate_tracking_id, is_valid_tracking_id


def migrate_tracking_ids():
    """Update all packages with old-format tracking IDs to use the new format."""
    db = SessionLocal()

    try:
        # Find all packages
        packages = db.query(Package).all()

        updated_count = 0
        skipped_count = 0

        for package in packages:
            # Check if tracking_id is in old format (not matching xxxx-xxxx-xxxx-xxxx)
            if not is_valid_tracking_id(package.tracking_id):
                old_id = package.tracking_id
                new_id = generate_tracking_id()
                package.tracking_id = new_id
                updated_count += 1
                print(f"Package {package.id}: {old_id} -> {new_id}")
            else:
                skipped_count += 1

        if updated_count > 0:
            db.commit()
            print(f"\nMigration complete:")
            print(f"  Updated: {updated_count} packages")
            print(f"  Skipped (already valid): {skipped_count} packages")
        else:
            print("No packages need migration - all tracking IDs are already in the correct format.")

    except Exception as e:
        print(f"Error during migration: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    response = input("This will update all packages with old-format tracking IDs. Continue? (yes/no): ")
    if response.lower() in ["yes", "y"]:
        migrate_tracking_ids()
    else:
        print("Migration cancelled.")
