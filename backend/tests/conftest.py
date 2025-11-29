import os

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from unittest.mock import patch, AsyncMock

from app.utils.tracking_id import generate_tracking_id

# Ensure the application uses the in-memory SQLite database during tests
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
os.environ.setdefault("DATABASE_URL", SQLALCHEMY_DATABASE_URL)
os.environ.setdefault("ENVIRONMENT", "test")

from app.models.base import Base
from app.database import get_db
from main import app

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test"""
    # Create all tables
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        # Drop all tables after test
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """Create a test client with dependency override"""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()


@pytest.fixture
def test_user_data():
    """Sample user data for testing"""
    return {
        "email": "test@example.com",
        "password": "testpassword123",
        "full_name": "Test User",
        "role": "sender",
        "phone_number": "+1234567890",
        "max_deviation_km": 10
    }


@pytest.fixture
def test_courier_data():
    """Sample courier data for testing"""
    return {
        "email": "courier@example.com",
        "password": "courierpass123",
        "full_name": "Courier User",
        "role": "courier",
        "phone_number": "+9876543210",
        "max_deviation_km": 15
    }


@pytest.fixture
def test_package_data():
    """Sample package data for testing"""
    return {
        "description": "Test package with documents",
        "size": "small",
        "weight_kg": 2.5,
        "pickup_address": "123 Main St, New York, NY 10001",
        "pickup_lat": 40.7128,
        "pickup_lng": -74.0060,
        "dropoff_address": "456 Broadway, New York, NY 10013",
        "dropoff_lat": 40.7204,
        "dropoff_lng": -74.0014,
        "pickup_contact_name": "John Doe",
        "pickup_contact_phone": "+1234567890",
        "dropoff_contact_name": "Jane Smith",
        "dropoff_contact_phone": "+0987654321",
        "price": 15.50
    }


@pytest.fixture
def authenticated_sender(client, db_session, test_user_data):
    """Create and authenticate a sender user, return token"""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash, create_access_token

    # Create user directly in database to avoid rate limiting
    user = User(
        email=test_user_data["email"],
        hashed_password=get_password_hash(test_user_data["password"]),
        full_name=test_user_data["full_name"],
        role=UserRole.SENDER,
        phone_number=test_user_data.get("phone_number"),
        is_active=True,
        is_verified=True,
        max_deviation_km=test_user_data.get("max_deviation_km", 5)
    )
    db_session.add(user)
    db_session.commit()

    # Create token directly
    return create_access_token(data={"sub": user.email})


@pytest.fixture
def authenticated_courier(client, db_session, test_courier_data):
    """Create and authenticate a courier user, return token"""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash, create_access_token

    # Create user directly in database to avoid rate limiting
    user = User(
        email=test_courier_data["email"],
        hashed_password=get_password_hash(test_courier_data["password"]),
        full_name=test_courier_data["full_name"],
        role=UserRole.COURIER,
        phone_number=test_courier_data.get("phone_number"),
        is_active=True,
        is_verified=True,
        max_deviation_km=test_courier_data.get("max_deviation_km", 5)
    )
    db_session.add(user)
    db_session.commit()

    # Create token directly
    return create_access_token(data={"sub": user.email})


@pytest.fixture
def authenticated_both_role(client, db_session):
    """Create and authenticate a user with 'both' role, return token"""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash, create_access_token

    # Create user directly in database to avoid rate limiting
    user = User(
        email="both@example.com",
        hashed_password=get_password_hash("bothpass123"),
        full_name="Both User",
        role=UserRole.BOTH,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(user)
    db_session.commit()

    # Create token directly
    return create_access_token(data={"sub": user.email})


@pytest.fixture
def test_admin_data():
    """Sample admin user data for testing"""
    return {
        "email": "admin@example.com",
        "password": "adminpass123",
        "full_name": "Admin User",
        "role": "admin"
    }


@pytest.fixture
def authenticated_admin(client, db_session, test_admin_data):
    """Create and authenticate an admin user, return token"""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash, create_access_token

    # Create admin user directly in database (since registration doesn't allow admin role)
    admin_user = User(
        email=test_admin_data["email"],
        hashed_password=get_password_hash(test_admin_data["password"]),
        full_name=test_admin_data["full_name"],
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(admin_user)
    db_session.commit()

    # Create token directly to avoid rate limiting
    return create_access_token(data={"sub": admin_user.email})


@pytest.fixture
def test_verified_user(db_session):
    """Create a verified user and return the User object"""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash

    user = User(
        email="verified@example.com",
        hashed_password=get_password_hash("password123"),
        full_name="Verified User",
        role=UserRole.SENDER,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_admin(db_session):
    """Create an admin user and return the User object"""
    from app.models.user import User, UserRole
    from app.utils.auth import get_password_hash

    admin = User(
        email="testadmin@example.com",
        hashed_password=get_password_hash("adminpass123"),
        full_name="Test Admin",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
        max_deviation_km=5
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture(autouse=True)
def mock_geo_restriction_default(request):
    """
    Auto-mock geo-restriction for all tests to return 'US' by default.
    Tests in test_geo_restriction.py are skipped via marker.
    Individual tests can override by using the patch decorator directly.
    """
    # Skip this fixture for geo-restriction tests
    if 'test_geo_restriction.py' in str(request.fspath):
        yield
        return

    # Skip for tests that explicitly mock geo-restriction themselves
    if request.node.get_closest_marker('skip_geo_mock'):
        yield
        return

    # Mock get_country_from_ip to return "US" for all tests
    with patch('app.routes.auth.get_country_from_ip', new_callable=AsyncMock) as mock_geo:
        mock_geo.return_value = "US"
        yield mock_geo
