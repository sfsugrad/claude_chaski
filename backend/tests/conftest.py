import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.models.base import Base
from app.database import get_db
from main import app

# Use SQLite in-memory database for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

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
def authenticated_sender(client, test_user_data):
    """Create and authenticate a sender user, return token"""
    client.post("/api/auth/register", json=test_user_data)
    login_response = client.post("/api/auth/login", json={
        "email": test_user_data["email"],
        "password": test_user_data["password"]
    })
    return login_response.json()["access_token"]


@pytest.fixture
def authenticated_courier(client, test_courier_data):
    """Create and authenticate a courier user, return token"""
    client.post("/api/auth/register", json=test_courier_data)
    login_response = client.post("/api/auth/login", json={
        "email": test_courier_data["email"],
        "password": test_courier_data["password"]
    })
    return login_response.json()["access_token"]


@pytest.fixture
def authenticated_both_role(client):
    """Create and authenticate a user with 'both' role, return token"""
    user_data = {
        "email": "both@example.com",
        "password": "bothpass123",
        "full_name": "Both User",
        "role": "both"
    }
    client.post("/api/auth/register", json=user_data)
    login_response = client.post("/api/auth/login", json={
        "email": user_data["email"],
        "password": user_data["password"]
    })
    return login_response.json()["access_token"]
