import pytest
from fastapi import HTTPException, status
from unittest.mock import MagicMock, Mock
from fastapi.security import HTTPAuthorizationCredentials

from app.utils.dependencies import (
    get_current_user,
    get_current_active_user,
    get_current_admin_user,
)
from app.models.user import User, UserRole
from app.utils.auth import create_access_token


def create_mock_request(cookies=None):
    """Create a mock request object with cookies"""
    mock_request = MagicMock()
    mock_request.cookies = cookies or {}
    return mock_request


class TestGetCurrentUser:
    """Tests for get_current_user dependency"""

    def test_get_current_user_success(self, db_session, test_verified_user):
        """Test successful user authentication via cookie"""
        # Create a valid token
        token = create_access_token(data={"sub": test_verified_user.email})

        # Mock request with cookie
        mock_request = create_mock_request(cookies={"access_token": token})

        # Get current user
        user = get_current_user(request=mock_request, credentials=None, db=db_session)

        assert user is not None
        assert user.email == test_verified_user.email
        assert user.id == test_verified_user.id

    def test_get_current_user_invalid_token(self, db_session):
        """Test authentication with invalid token"""
        mock_request = create_mock_request(cookies={"access_token": "invalid-token"})

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request=mock_request, credentials=None, db=db_session)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Could not validate credentials" in exc_info.value.detail

    def test_get_current_user_expired_token(self, db_session, test_verified_user):
        """Test authentication with expired token"""
        from datetime import timedelta

        # Create an expired token
        token = create_access_token(
            data={"sub": test_verified_user.email},
            expires_delta=timedelta(minutes=-30)  # Expired 30 minutes ago
        )

        mock_request = create_mock_request(cookies={"access_token": token})

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request=mock_request, credentials=None, db=db_session)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_nonexistent_user(self, db_session):
        """Test authentication with token for non-existent user"""
        # Create token for user that doesn't exist
        token = create_access_token(data={"sub": "nonexistent@example.com"})

        mock_request = create_mock_request(cookies={"access_token": token})

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request=mock_request, credentials=None, db=db_session)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED
        assert "Could not validate credentials" in exc_info.value.detail

    def test_get_current_user_inactive_user(self, db_session, test_verified_user):
        """Test authentication with inactive user"""
        # Deactivate the user
        test_verified_user.is_active = False
        db_session.commit()

        token = create_access_token(data={"sub": test_verified_user.email})

        mock_request = create_mock_request(cookies={"access_token": token})

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request=mock_request, credentials=None, db=db_session)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Inactive user" in exc_info.value.detail

        # Reactivate for other tests
        test_verified_user.is_active = True
        db_session.commit()

    def test_get_current_user_token_without_sub(self, db_session):
        """Test authentication with token missing 'sub' claim"""
        from jose import jwt
        from app.config import settings

        # Create a token without 'sub' claim
        token_data = {"user_id": 123}  # Wrong claim
        token = jwt.encode(token_data, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

        mock_request = create_mock_request(cookies={"access_token": token})

        with pytest.raises(HTTPException) as exc_info:
            get_current_user(request=mock_request, credentials=None, db=db_session)

        assert exc_info.value.status_code == status.HTTP_401_UNAUTHORIZED


class TestGetCurrentActiveUser:
    """Tests for get_current_active_user dependency"""

    def test_get_current_active_user_success(self, test_verified_user):
        """Test getting current active user"""
        user = get_current_active_user(current_user=test_verified_user)

        assert user is not None
        assert user.email == test_verified_user.email
        assert user.is_active is True

    def test_get_current_active_user_returns_same_user(self, test_verified_user):
        """Test that get_current_active_user returns the same user object"""
        user = get_current_active_user(current_user=test_verified_user)

        assert user is test_verified_user


class TestGetCurrentAdminUser:
    """Tests for get_current_admin_user dependency"""

    def test_get_current_admin_user_success(self, test_admin):
        """Test getting current user when user is admin"""
        user = get_current_admin_user(current_user=test_admin)

        assert user is not None
        assert user.email == test_admin.email
        assert user.role == UserRole.ADMIN

    def test_get_current_admin_user_sender_fails(self, test_verified_user):
        """Test that sender cannot access admin-only endpoint"""
        # test_verified_user is a sender by default
        assert test_verified_user.role == UserRole.SENDER

        with pytest.raises(HTTPException) as exc_info:
            get_current_admin_user(current_user=test_verified_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin privileges required" in exc_info.value.detail

    def test_get_current_admin_user_courier_fails(self, db_session):
        """Test that courier cannot access admin-only endpoint"""
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

        with pytest.raises(HTTPException) as exc_info:
            get_current_admin_user(current_user=courier)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin privileges required" in exc_info.value.detail

    def test_get_current_admin_user_both_role_fails(self, db_session):
        """Test that user with 'both' role cannot access admin-only endpoint"""
        from app.utils.auth import get_password_hash

        both_user = User(
            email="both@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Test Both",
            role=UserRole.BOTH,
            is_active=True,
            is_verified=True
        )
        db_session.add(both_user)
        db_session.commit()

        with pytest.raises(HTTPException) as exc_info:
            get_current_admin_user(current_user=both_user)

        assert exc_info.value.status_code == status.HTTP_403_FORBIDDEN
        assert "Admin privileges required" in exc_info.value.detail


class TestDependenciesIntegration:
    """Integration tests for dependencies"""

    def test_dependency_chain_admin(self, test_admin):
        """Test dependency chain works for admin users"""
        # get_current_active_user uses get_current_user
        active_user = get_current_active_user(current_user=test_admin)
        assert active_user is test_admin

        # get_current_admin_user uses get_current_user
        admin_user = get_current_admin_user(current_user=test_admin)
        assert admin_user is test_admin

    def test_multiple_tokens_for_same_user(self, db_session, test_verified_user):
        """Test that multiple tokens work for the same user"""
        token1 = create_access_token(data={"sub": test_verified_user.email})
        token2 = create_access_token(data={"sub": test_verified_user.email})

        mock_request1 = create_mock_request(cookies={"access_token": token1})
        mock_request2 = create_mock_request(cookies={"access_token": token2})

        user1 = get_current_user(request=mock_request1, credentials=None, db=db_session)
        user2 = get_current_user(request=mock_request2, credentials=None, db=db_session)

        assert user1.email == user2.email
        assert user1.id == user2.id
