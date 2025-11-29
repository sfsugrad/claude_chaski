"""
Script to load test data into the database.
Run this from the backend directory: python -m test_data.load_test_data
"""
import json
import sys
from pathlib import Path
from datetime import datetime
from sqlalchemy.orm import Session

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import SessionLocal, engine
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize, CourierRoute
from app.models.notification import Notification, NotificationType
from app.models.rating import Rating
from app.models.base import Base
from app.utils.auth import get_password_hash
from app.utils.tracking_id import generate_tracking_id


def load_users(db: Session, data_file: Path):
    """Load users from JSON file and return mapping of old to new IDs"""
    with open(data_file) as f:
        users_data = json.load(f)

    created_users = []
    for idx, user_data in enumerate(users_data, start=1):
        # Hash the password
        password = user_data.pop("password")
        hashed_password = get_password_hash(password)

        # Create user
        user = User(
            **user_data,
            hashed_password=hashed_password
        )
        db.add(user)
        created_users.append(user)

    # Flush to get the user IDs
    db.flush()

    # Create mapping from expected ID (1-based index) to actual ID
    id_mapping = {idx: user.id for idx, user in enumerate(created_users, start=1)}

    db.commit()
    print(f"Created {len(created_users)} users")
    return created_users, id_mapping


def load_packages(db: Session, data_file: Path, user_id_mapping: dict):
    """Load packages from JSON file with updated user IDs"""
    with open(data_file) as f:
        packages_data = json.load(f)

    created_packages = []
    for package_data in packages_data:
        # Update sender_id and courier_id to use actual IDs
        if package_data.get("sender_id"):
            package_data["sender_id"] = user_id_mapping.get(package_data["sender_id"])

        if package_data.get("courier_id"):
            package_data["courier_id"] = user_id_mapping.get(package_data["courier_id"])

        # Generate tracking_id if not present
        if "tracking_id" not in package_data:
            package_data["tracking_id"] = generate_tracking_id()

        package = Package(**package_data)
        db.add(package)
        created_packages.append(package)

    db.commit()

    # Create mapping from expected ID (1-based index) to actual ID
    package_id_mapping = {
        idx: package.id for idx, package in enumerate(created_packages, start=1)
    }

    print(f"Created {len(created_packages)} packages")
    return created_packages, package_id_mapping


def load_courier_routes(db: Session, data_file: Path, user_id_mapping: dict):
    """Load courier routes from JSON file with updated courier IDs"""
    with open(data_file) as f:
        routes_data = json.load(f)

    created_routes = []
    for route_data in routes_data:
        # Convert departure_time string to datetime
        if route_data.get("departure_time"):
            route_data["departure_time"] = datetime.fromisoformat(
                route_data["departure_time"]
            )

        # Update courier_id to use actual ID
        if route_data.get("courier_id"):
            route_data["courier_id"] = user_id_mapping.get(route_data["courier_id"])

        route = CourierRoute(**route_data)
        db.add(route)
        created_routes.append(route)

    db.commit()
    print(f"Created {len(created_routes)} courier routes")
    return created_routes


def load_notifications(
    db: Session, data_file: Path, user_id_mapping: dict, package_id_mapping: dict
):
    """Load notifications from JSON file with updated user and package IDs"""
    with open(data_file) as f:
        notifications_data = json.load(f)

    created_notifications = []
    for notification_data in notifications_data:
        # Update user_id to use actual ID
        if notification_data.get("user_id"):
            notification_data["user_id"] = user_id_mapping.get(
                notification_data["user_id"]
            )

        # Update package_id to use actual ID when present
        if notification_data.get("package_id"):
            notification_data["package_id"] = package_id_mapping.get(
                notification_data["package_id"]
            )

        # Convert type string to NotificationType enum
        notification_data["type"] = NotificationType(notification_data["type"])

        notification = Notification(**notification_data)
        db.add(notification)
        created_notifications.append(notification)

    db.commit()
    print(f"Created {len(created_notifications)} notifications")
    return created_notifications


def load_ratings(
    db: Session, data_file: Path, user_id_mapping: dict, package_id_mapping: dict
):
    """Load ratings from JSON file with updated user and package IDs"""
    with open(data_file) as f:
        ratings_data = json.load(f)

    created_ratings = []
    for rating_data in ratings_data:
        # Update rater_id to use actual ID
        if rating_data.get("rater_id"):
            rating_data["rater_id"] = user_id_mapping.get(rating_data["rater_id"])

        # Update rated_user_id to use actual ID
        if rating_data.get("rated_user_id"):
            rating_data["rated_user_id"] = user_id_mapping.get(
                rating_data["rated_user_id"]
            )

        # Update package_id to use actual ID
        if rating_data.get("package_id"):
            rating_data["package_id"] = package_id_mapping.get(
                rating_data["package_id"]
            )

        rating = Rating(**rating_data)
        db.add(rating)
        created_ratings.append(rating)

    db.commit()
    print(f"Created {len(created_ratings)} ratings")
    return created_ratings


def clear_all_data(db: Session):
    """Clear all existing data from tables"""
    try:
        db.query(Rating).delete()
        db.query(Notification).delete()
        db.query(CourierRoute).delete()
        db.query(Package).delete()
        db.query(User).delete()
        db.commit()
        print("Cleared all existing data")
    except Exception as e:
        db.rollback()
        print(f"Error clearing data: {e}")


def main():
    """Main function to load all test data"""
    # Get the test_data directory
    test_data_dir = Path(__file__).parent

    # Create tables if they don't exist
    Base.metadata.create_all(bind=engine)

    # Create database session
    db = SessionLocal()

    try:
        # Ask user if they want to clear existing data
        response = input("Do you want to clear existing data? (yes/no): ")
        if response.lower() in ["yes", "y"]:
            clear_all_data(db)

        # Load data in order (users first, then packages and routes)
        print("\nLoading test data...")
        print("-" * 50)

        users, user_id_mapping = load_users(db, test_data_dir / "users.json")
        packages, package_id_mapping = load_packages(
            db, test_data_dir / "packages.json", user_id_mapping
        )
        routes = load_courier_routes(
            db, test_data_dir / "courier_routes.json", user_id_mapping
        )
        notifications = load_notifications(
            db,
            test_data_dir / "notifications.json",
            user_id_mapping,
            package_id_mapping,
        )
        ratings = load_ratings(
            db,
            test_data_dir / "ratings.json",
            user_id_mapping,
            package_id_mapping,
        )

        print("-" * 50)
        print("Test data loaded successfully!")
        print(f"\nSummary:")
        print(f"  Users: {len(users)}")
        print(f"  Packages: {len(packages)}")
        print(f"  Courier Routes: {len(routes)}")
        print(f"  Notifications: {len(notifications)}")
        print(f"  Ratings: {len(ratings)}")

        print("\nTest credentials:")
        print("  Admin: admin@chaski.com / admin123")
        print("  Sender: john.sender@example.com / sender123")
        print("  Courier: mike.courier@example.com / courier123")
        print("  Both: alex.both@example.com / both123")

    except Exception as e:
        print(f"Error loading test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
