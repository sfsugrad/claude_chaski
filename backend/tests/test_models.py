import pytest
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize, CourierRoute
from app.utils.auth import get_password_hash
from app.utils.tracking_id import generate_tracking_id


class TestUserModel:
    """Tests for User model"""

    def test_create_user_with_all_fields(self, db_session):
        """Test creating a user with all fields"""
        user = User(
            email="newuser@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="New User",
            phone_number="+1234567890",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=False,
            max_deviation_km=10
        )
        db_session.add(user)
        db_session.commit()

        assert user.id is not None
        assert user.email == "newuser@example.com"
        assert user.full_name == "New User"
        assert user.phone_number == "+1234567890"
        assert user.role == UserRole.SENDER
        assert user.is_active is True
        assert user.is_verified is False
        assert user.max_deviation_km == 10
        assert user.created_at is not None

    def test_create_user_minimal_fields(self, db_session):
        """Test creating a user with minimal required fields"""
        user = User(
            email="minimal@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Minimal User",
            role=UserRole.COURIER
        )
        db_session.add(user)
        db_session.commit()

        assert user.id is not None
        assert user.email == "minimal@example.com"
        assert user.role == UserRole.COURIER
        # Check defaults
        assert user.is_active is True
        assert user.is_verified is False
        assert user.max_deviation_km == 5

    def test_user_email_must_be_unique(self, db_session, test_verified_user):
        """Test that user email must be unique"""
        duplicate_user = User(
            email=test_verified_user.email,  # Same email
            hashed_password=get_password_hash("password123"),
            full_name="Duplicate User",
            role=UserRole.SENDER
        )
        db_session.add(duplicate_user)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()

    def test_user_email_required(self, db_session):
        """Test that email is required"""
        user = User(
            hashed_password=get_password_hash("password123"),
            full_name="No Email User",
            role=UserRole.SENDER
        )
        db_session.add(user)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()

    def test_user_hashed_password_required(self, db_session):
        """Test that hashed_password is required"""
        user = User(
            email="nopassword@example.com",
            full_name="No Password User",
            role=UserRole.SENDER
        )
        db_session.add(user)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()

    def test_user_full_name_required(self, db_session):
        """Test that full_name is required"""
        user = User(
            email="noname@example.com",
            hashed_password=get_password_hash("password123"),
            role=UserRole.SENDER
        )
        db_session.add(user)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()

    def test_user_role_required(self, db_session):
        """Test that role is required"""
        user = User(
            email="norole@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="No Role User"
        )
        db_session.add(user)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()

    def test_user_all_roles(self, db_session):
        """Test creating users with all available roles"""
        roles = [UserRole.SENDER, UserRole.COURIER, UserRole.BOTH, UserRole.ADMIN]

        for idx, role in enumerate(roles):
            user = User(
                email=f"user_{role.value}@example.com",
                hashed_password=get_password_hash("password123"),
                full_name=f"User {role.value}",
                role=role
            )
            db_session.add(user)

        db_session.commit()

        # Verify all were created
        users = db_session.query(User).filter(
            User.email.like("user_%@example.com")
        ).all()
        assert len(users) == 4

    def test_user_repr(self, test_verified_user):
        """Test user string representation"""
        repr_str = repr(test_verified_user)
        assert test_verified_user.email in repr_str

    def test_user_timestamps(self, db_session):
        """Test that timestamps are set correctly"""
        user = User(
            email="timestamps@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Timestamp User",
            role=UserRole.SENDER
        )
        db_session.add(user)
        db_session.commit()

        assert user.created_at is not None
        assert isinstance(user.created_at, datetime)

        # Update user
        original_created_at = user.created_at
        user.full_name = "Updated Name"
        db_session.commit()

        # created_at should not change
        assert user.created_at == original_created_at

    def test_user_password_reset_fields(self, db_session):
        """Test password reset token fields exist and work correctly.

        This test ensures the database schema includes password_reset_token
        and password_reset_token_expires_at columns, which are required for
        the password reset functionality.
        """
        from datetime import timedelta, timezone

        user = User(
            email="passwordreset@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Password Reset User",
            role=UserRole.SENDER
        )
        db_session.add(user)
        db_session.commit()

        # Initially these should be None
        assert user.password_reset_token is None
        assert user.password_reset_token_expires_at is None

        # Set password reset token
        reset_token = "test-reset-token-12345"
        reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)

        user.password_reset_token = reset_token
        user.password_reset_token_expires_at = reset_expires
        db_session.commit()
        db_session.refresh(user)

        # Verify the values were saved
        assert user.password_reset_token == reset_token
        assert user.password_reset_token_expires_at is not None

        # Clear the token (simulating password reset completion)
        user.password_reset_token = None
        user.password_reset_token_expires_at = None
        db_session.commit()
        db_session.refresh(user)

        assert user.password_reset_token is None
        assert user.password_reset_token_expires_at is None

    def test_user_verification_token_fields(self, db_session):
        """Test verification token fields exist and work correctly.

        This ensures the database schema includes verification_token
        and verification_token_expires_at columns for email verification.
        """
        from datetime import timedelta, timezone

        user = User(
            email="verification@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Verification User",
            role=UserRole.SENDER,
            verification_token="verify-token-12345",
            verification_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=24)
        )
        db_session.add(user)
        db_session.commit()
        db_session.refresh(user)

        assert user.verification_token == "verify-token-12345"
        assert user.verification_token_expires_at is not None

        # Simulate email verification
        user.is_verified = True
        user.verification_token = None
        user.verification_token_expires_at = None
        db_session.commit()
        db_session.refresh(user)

        assert user.is_verified is True
        assert user.verification_token is None
        assert user.verification_token_expires_at is None

    def test_user_model_all_columns_accessible(self, db_session):
        """Test that all User model columns can be queried.

        This test catches database schema mismatches where the SQLAlchemy model
        defines columns that don't exist in the actual database. If the database
        is missing columns defined in the model, this query will fail.
        """
        from datetime import timedelta, timezone

        # Create a user with all fields populated
        user = User(
            email="allcolumns@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="All Columns User",
            phone_number="+1234567890",
            role=UserRole.BOTH,
            is_active=True,
            is_verified=True,
            verification_token="verify-token",
            verification_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=24),
            password_reset_token="reset-token",
            password_reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1),
            max_deviation_km=15
        )
        db_session.add(user)
        db_session.commit()

        # Query the user back - this will fail if any model column is missing from DB
        queried_user = db_session.query(User).filter(
            User.email == "allcolumns@example.com"
        ).first()

        # Verify all columns are accessible
        assert queried_user is not None
        assert queried_user.id is not None
        assert queried_user.email == "allcolumns@example.com"
        assert queried_user.hashed_password is not None
        assert queried_user.full_name == "All Columns User"
        assert queried_user.phone_number == "+1234567890"
        assert queried_user.role == UserRole.BOTH
        assert queried_user.is_active is True
        assert queried_user.is_verified is True
        assert queried_user.verification_token == "verify-token"
        assert queried_user.verification_token_expires_at is not None
        assert queried_user.password_reset_token == "reset-token"
        assert queried_user.password_reset_token_expires_at is not None
        assert queried_user.max_deviation_km == 15
        assert queried_user.created_at is not None


class TestPackageModel:
    """Tests for Package model"""

    def test_create_package_with_all_fields(self, db_session, test_verified_user):
        """Test creating a package with all fields"""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_verified_user.id,
            description="Test package",
            size=PackageSize.MEDIUM,
            weight_kg=5.5,
            pickup_address="123 Main St",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            pickup_contact_name="John Doe",
            pickup_contact_phone="+1234567890",
            dropoff_address="456 Market St",
            dropoff_lat=37.7897,
            dropoff_lng=-122.4010,
            dropoff_contact_name="Jane Smith",
            dropoff_contact_phone="+0987654321",
            status=PackageStatus.OPEN_FOR_BIDS,
            price=25.50
        )
        db_session.add(package)
        db_session.commit()

        assert package.id is not None
        assert package.sender_id == test_verified_user.id
        assert package.description == "Test package"
        assert package.size == PackageSize.MEDIUM
        assert package.weight_kg == 5.5
        assert package.status == PackageStatus.OPEN_FOR_BIDS
        assert package.price == 25.50
        assert package.created_at is not None

    def test_create_package_minimal_fields(self, db_session, test_verified_user):
        """Test creating a package with minimal required fields"""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_verified_user.id,
            description="Minimal package",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Pickup Location",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_address="Dropoff Location",
            dropoff_lat=37.7897,
            dropoff_lng=-122.4010
        )
        db_session.add(package)
        db_session.commit()

        assert package.id is not None
        assert package.status == PackageStatus.NEW  # Default status when created directly (API auto-transitions to OPEN_FOR_BIDS)
        assert package.courier_id is None  # No courier assigned yet

    def test_package_all_statuses(self, db_session, test_verified_user):
        """Test creating packages with all available statuses"""
        statuses = [
            PackageStatus.OPEN_FOR_BIDS,
            PackageStatus.BID_SELECTED,
            PackageStatus.IN_TRANSIT,
            PackageStatus.IN_TRANSIT,
            PackageStatus.DELIVERED,
            PackageStatus.CANCELED
        ]

        for idx, status in enumerate(statuses):
            package = Package(
            tracking_id=generate_tracking_id(),
                sender_id=test_verified_user.id,
                description=f"Package {status.value}",
                size=PackageSize.SMALL,
                weight_kg=1.0,
                pickup_address="Pickup",
                pickup_lat=37.7749,
                pickup_lng=-122.4194,
                dropoff_address="Dropoff",
                dropoff_lat=37.7897,
                dropoff_lng=-122.4010,
                status=status
            )
            db_session.add(package)

        db_session.commit()

        # Verify all were created
        packages = db_session.query(Package).filter(
            Package.sender_id == test_verified_user.id
        ).all()
        assert len(packages) == 6

    def test_package_all_sizes(self, db_session, test_verified_user):
        """Test creating packages with all available sizes"""
        sizes = [
            (PackageSize.SMALL, 2.0),
            (PackageSize.MEDIUM, 10.0),
            (PackageSize.LARGE, 30.0),
            (PackageSize.EXTRA_LARGE, 60.0)
        ]

        for size, weight in sizes:
            package = Package(
            tracking_id=generate_tracking_id(),
                sender_id=test_verified_user.id,
                description=f"Package {size.value}",
                size=size,
                weight_kg=weight,
                pickup_address="Pickup",
                pickup_lat=37.7749,
                pickup_lng=-122.4194,
                dropoff_address="Dropoff",
                dropoff_lat=37.7897,
                dropoff_lng=-122.4010
            )
            db_session.add(package)

        db_session.commit()

        packages = db_session.query(Package).all()
        assert len(packages) >= 4

    def test_package_sender_required(self, db_session):
        """Test that sender_id is required"""
        package = Package(
            tracking_id=generate_tracking_id(),
            description="No sender package",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Pickup",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_address="Dropoff",
            dropoff_lat=37.7897,
            dropoff_lng=-122.4010
        )
        db_session.add(package)

        with pytest.raises(IntegrityError):
            db_session.commit()

        db_session.rollback()

    def test_package_with_courier(self, db_session, test_verified_user):
        """Test assigning a courier to a package"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="courier@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Test Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_verified_user.id,
            courier_id=courier.id,
            description="Package with courier",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Pickup",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_address="Dropoff",
            dropoff_lat=37.7897,
            dropoff_lng=-122.4010,
            status=PackageStatus.BID_SELECTED
        )
        db_session.add(package)
        db_session.commit()

        assert package.courier_id == courier.id

    def test_package_repr(self, db_session, test_verified_user):
        """Test package string representation"""
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=test_verified_user.id,
            description="Test repr package",
            size=PackageSize.SMALL,
            weight_kg=1.0,
            pickup_address="Pickup",
            pickup_lat=37.7749,
            pickup_lng=-122.4194,
            dropoff_address="Dropoff",
            dropoff_lat=37.7897,
            dropoff_lng=-122.4010
        )
        db_session.add(package)
        db_session.commit()

        repr_str = repr(package)
        assert package.tracking_id in repr_str
        assert package.status.value.lower() in repr_str.lower()


class TestCourierRouteModel:
    """Tests for CourierRoute model"""

    def test_create_courier_route(self, db_session):
        """Test creating a courier route"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="routecourier@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Route Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Start Location",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="End Location",
            end_lat=37.7897,
            end_lng=-122.4010,
            max_deviation_km=10,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        assert route.id is not None
        assert route.courier_id == courier.id
        assert route.start_address == "Start Location"
        assert route.end_address == "End Location"
        assert route.max_deviation_km == 10
        assert route.is_active is True
        assert route.created_at is not None

    def test_courier_route_with_departure_time(self, db_session):
        """Test creating a route with departure time"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="timecourier@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Time Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        departure_time = datetime(2025, 12, 1, 14, 30)

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Start",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="End",
            end_lat=37.7897,
            end_lng=-122.4010,
            departure_time=departure_time
        )
        db_session.add(route)
        db_session.commit()

        assert route.departure_time == departure_time

    def test_courier_route_default_max_deviation(self, db_session):
        """Test that max_deviation_km has default value"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="defaultcourier@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Default Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Start",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="End",
            end_lat=37.7897,
            end_lng=-122.4010
        )
        db_session.add(route)
        db_session.commit()

        assert route.max_deviation_km == 5  # Default value

    def test_courier_route_inactive(self, db_session):
        """Test creating an inactive route"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="inactivecourier@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Inactive Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Start",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="End",
            end_lat=37.7897,
            end_lng=-122.4010,
            is_active=False
        )
        db_session.add(route)
        db_session.commit()

        assert route.is_active is False

    def test_courier_route_repr(self, db_session):
        """Test courier route string representation"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="reprcourier@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Repr Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Start",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="End",
            end_lat=37.7897,
            end_lng=-122.4010
        )
        db_session.add(route)
        db_session.commit()

        repr_str = repr(route)
        assert str(route.id) in repr_str
        assert str(courier.id) in repr_str

    def test_multiple_routes_for_courier(self, db_session):
        """Test that a courier can have multiple routes"""
        from app.utils.auth import get_password_hash

        courier = User(
            email="multiroute@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Multi Route Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True
        )
        db_session.add(courier)
        db_session.commit()

        route1 = CourierRoute(
            courier_id=courier.id,
            start_address="Start 1",
            start_lat=37.7749,
            start_lng=-122.4194,
            end_address="End 1",
            end_lat=37.7897,
            end_lng=-122.4010
        )
        route2 = CourierRoute(
            courier_id=courier.id,
            start_address="Start 2",
            start_lat=37.8000,
            start_lng=-122.4300,
            end_address="End 2",
            end_lat=37.8100,
            end_lng=-122.4400
        )
        db_session.add_all([route1, route2])
        db_session.commit()

        routes = db_session.query(CourierRoute).filter(
            CourierRoute.courier_id == courier.id
        ).all()
        assert len(routes) == 2
