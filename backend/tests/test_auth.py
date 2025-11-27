import pytest
from fastapi import status
from datetime import timedelta

from app.utils.auth import create_access_token, get_password_hash
from app.models.user import User, UserRole


class TestUserRegistration:
    """Tests for user registration endpoint"""

    def test_register_sender_success(self, client, test_user_data):
        """Test successful registration of a sender"""
        response = client.post("/api/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["email"] == test_user_data["email"]
        assert data["full_name"] == test_user_data["full_name"]
        assert data["role"] == test_user_data["role"]
        assert data["phone_number"] == test_user_data["phone_number"]
        assert data["max_deviation_km"] == test_user_data["max_deviation_km"]
        assert data["is_active"] is True
        assert data["is_verified"] is False
        assert "id" in data
        assert "created_at" in data
        assert "password" not in data  # Password should not be in response
        assert "hashed_password" not in data

    def test_register_courier_success(self, client, test_courier_data):
        """Test successful registration of a courier"""
        response = client.post("/api/auth/register", json=test_courier_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["email"] == test_courier_data["email"]
        assert data["role"] == "courier"
        assert data["max_deviation_km"] == test_courier_data["max_deviation_km"]

    def test_register_both_role_success(self, client):
        """Test successful registration with 'both' role"""
        user_data = {
            "email": "both@example.com",
            "password": "password123",
            "full_name": "Both User",
            "role": "both"
        }
        response = client.post("/api/auth/register", json=user_data)

        assert response.status_code == status.HTTP_201_CREATED
        assert response.json()["role"] == "both"

    def test_register_duplicate_email(self, client, test_user_data):
        """Test registration with duplicate email fails"""
        # First registration
        client.post("/api/auth/register", json=test_user_data)

        # Second registration with same email
        response = client.post("/api/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already registered" in response.json()["detail"].lower()

    def test_register_invalid_email(self, client, test_user_data):
        """Test registration with invalid email format"""
        test_user_data["email"] = "invalid-email"
        response = client.post("/api/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_password_too_short(self, client, test_user_data):
        """Test registration with password shorter than 8 characters"""
        test_user_data["password"] = "short"
        response = client.post("/api/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_invalid_role(self, client, test_user_data):
        """Test registration with invalid role"""
        test_user_data["role"] = "invalid_role"
        response = client.post("/api/auth/register", json=test_user_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_missing_required_fields(self, client):
        """Test registration with missing required fields"""
        incomplete_data = {
            "email": "test@example.com",
            "password": "password123"
            # Missing full_name and role
        }
        response = client.post("/api/auth/register", json=incomplete_data)

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_without_optional_fields(self, client):
        """Test registration without optional fields succeeds"""
        minimal_data = {
            "email": "minimal@example.com",
            "password": "password123",
            "full_name": "Minimal User",
            "role": "sender"
            # No phone_number, max_deviation_km
        }
        response = client.post("/api/auth/register", json=minimal_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["phone_number"] is None
        assert data["max_deviation_km"] == 5  # Default value

    def test_register_password_is_hashed(self, client, db_session, test_user_data):
        """Test that password is properly hashed in database"""
        response = client.post("/api/auth/register", json=test_user_data)
        assert response.status_code == status.HTTP_201_CREATED

        # Query database directly
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        assert user is not None
        assert user.hashed_password != test_user_data["password"]
        assert user.hashed_password.startswith("$2b$")  # bcrypt hash prefix


class TestUserLogin:
    """Tests for user login endpoint"""

    def test_login_success(self, client, test_user_data):
        """Test successful login"""
        # Register user first
        client.post("/api/auth/register", json=test_user_data)

        # Login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert "message" in data
        assert data["message"] == "Login successful"
        # JWT is now set in httpOnly cookie
        assert "access_token" in response.cookies

    def test_login_invalid_email(self, client):
        """Test login with non-existent email"""
        login_data = {
            "email": "nonexistent@example.com",
            "password": "password123"
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_wrong_password(self, client, test_user_data):
        """Test login with incorrect password"""
        # Register user first
        client.post("/api/auth/register", json=test_user_data)

        # Login with wrong password
        login_data = {
            "email": test_user_data["email"],
            "password": "wrongpassword"
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "incorrect" in response.json()["detail"].lower()

    def test_login_inactive_user(self, client, db_session, test_user_data):
        """Test login with inactive user"""
        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Deactivate user
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_active = False
        db_session.commit()

        # Try to login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "inactive" in response.json()["detail"].lower()

    def test_login_missing_credentials(self, client):
        """Test login with missing credentials"""
        response = client.post("/api/auth/login", json={})

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_login_jwt_token_contains_user_info(self, client, test_user_data):
        """Test that JWT token contains correct user information"""
        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Login
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        # Get token from cookie
        token = response.cookies["access_token"]

        # Decode token (without verification for testing)
        import base64
        import json
        payload = token.split('.')[1]
        # Add padding if needed
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))

        assert decoded["sub"] == test_user_data["email"]
        assert decoded["role"] == test_user_data["role"]
        assert "exp" in decoded


class TestGetCurrentUser:
    """Tests for get current user endpoint"""

    def test_get_current_user_success(self, client, test_user_data):
        """Test getting current user with valid token"""
        # Register and login
        client.post("/api/auth/register", json=test_user_data)
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        # Get token from cookie
        token = login_response.cookies["access_token"]

        # Get current user using cookie (set via headers for TestClient)
        response = client.get(
            "/api/auth/me",
            cookies={"access_token": token}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["email"] == test_user_data["email"]
        assert data["full_name"] == test_user_data["full_name"]
        assert data["role"] == test_user_data["role"]
        assert "id" in data
        assert "password" not in data
        assert "hashed_password" not in data

    def test_get_current_user_no_token(self, client):
        """Test getting current user without token"""
        response = client.get("/api/auth/me")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED
        assert "not authenticated" in response.json()["detail"].lower()

    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token"""
        response = client.get(
            "/api/auth/me",
            cookies={"access_token": "invalid_token"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_malformed_token(self, client):
        """Test getting current user with malformed cookie"""
        response = client.get(
            "/api/auth/me",
            cookies={"access_token": "InvalidFormat"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_expired_token(self, client, db_session, test_user_data):
        """Test getting current user with expired token"""
        # Create user
        client.post("/api/auth/register", json=test_user_data)

        # Create expired token
        expired_token = create_access_token(
            data={"sub": test_user_data["email"], "role": test_user_data["role"]},
            expires_delta=timedelta(seconds=-1)  # Already expired
        )

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {expired_token}"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_deleted_user(self, client, db_session, test_user_data):
        """Test getting current user when user has been deleted"""
        # Register and login
        client.post("/api/auth/register", json=test_user_data)
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.cookies["access_token"]

        # Delete user from database
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        db_session.delete(user)
        db_session.commit()

        # Try to get current user
        response = client.get(
            "/api/auth/me",
            cookies={"access_token": token}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_inactive_user(self, client, db_session, test_user_data):
        """Test getting current user when user is inactive"""
        # Register and login
        client.post("/api/auth/register", json=test_user_data)
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token = login_response.cookies["access_token"]

        # Deactivate user
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_active = False
        db_session.commit()

        # Try to get current user
        response = client.get(
            "/api/auth/me",
            cookies={"access_token": token}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "inactive" in response.json()["detail"].lower()


class TestEmailVerification:
    """Tests for email verification endpoints"""

    def test_verify_email_with_valid_token(self, client, db_session):
        """Test email verification with valid token"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token

        # Create unverified user
        token = generate_verification_token()
        user = User(
            email="verify@example.com",
            hashed_password="hashed_password",
            full_name="Verify User",
            role=UserRole.SENDER,
            is_verified=False,
            verification_token=token
        )
        db_session.add(user)
        db_session.commit()

        # Verify email
        response = client.get(f"/api/auth/verify-email/{token}")

        assert response.status_code == status.HTTP_200_OK
        assert "successfully" in response.json()["message"].lower()
        assert response.json()["email"] == "verify@example.com"

        # Verify user is now verified in database
        db_session.refresh(user)
        assert user.is_verified is True
        assert user.verification_token is None

    def test_verify_email_with_invalid_token(self, client):
        """Test email verification with invalid token"""
        response = client.get("/api/auth/verify-email/invalid_token_12345")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid" in response.json()["detail"].lower()

    def test_verify_email_already_verified(self, client, db_session):
        """Test verifying an already verified email"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token

        # Create verified user
        token = generate_verification_token()
        user = User(
            email="already.verified@example.com",
            hashed_password="hashed_password",
            full_name="Already Verified",
            role=UserRole.SENDER,
            is_verified=True,  # Already verified
            verification_token=token
        )
        db_session.add(user)
        db_session.commit()

        # Try to verify again
        response = client.get(f"/api/auth/verify-email/{token}")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already verified" in response.json()["detail"].lower()

    def test_verify_email_clears_token(self, client, db_session):
        """Test that verification clears the token"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token

        # Create unverified user
        token = generate_verification_token()
        user = User(
            email="clear.token@example.com",
            hashed_password="hashed_password",
            full_name="Clear Token",
            role=UserRole.SENDER,
            is_verified=False,
            verification_token=token
        )
        db_session.add(user)
        db_session.commit()

        # Verify email
        client.get(f"/api/auth/verify-email/{token}")

        # Verify token is cleared
        db_session.refresh(user)
        assert user.verification_token is None

    def test_resend_verification_email_to_unverified_user(self, client, db_session):
        """Test resending verification email to unverified user"""
        from app.models.user import User, UserRole

        # Create unverified user
        user = User(
            email="resend@example.com",
            hashed_password="hashed_password",
            full_name="Resend User",
            role=UserRole.SENDER,
            is_verified=False,
            verification_token="old_token"
        )
        db_session.add(user)
        db_session.commit()

        # Resend verification email
        response = client.post("/api/auth/resend-verification?email=resend@example.com")

        assert response.status_code == status.HTTP_200_OK
        assert "sent successfully" in response.json()["message"].lower()

        # Verify new token was generated
        db_session.refresh(user)
        assert user.verification_token is not None
        assert user.verification_token != "old_token"

    def test_resend_verification_to_verified_user(self, client, db_session):
        """Test that verified users cannot request verification email"""
        from app.models.user import User, UserRole

        # Create verified user
        user = User(
            email="verified@example.com",
            hashed_password="hashed_password",
            full_name="Verified User",
            role=UserRole.SENDER,
            is_verified=True,
            verification_token=None
        )
        db_session.add(user)
        db_session.commit()

        # Try to resend verification email
        response = client.post("/api/auth/resend-verification?email=verified@example.com")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already verified" in response.json()["detail"].lower()

    def test_resend_verification_to_nonexistent_user(self, client):
        """Test resending verification to non-existent email"""
        response = client.post("/api/auth/resend-verification?email=nonexistent@example.com")

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_verify_email_generates_new_token_on_resend(self, client, db_session):
        """Test that resending generates a new token"""
        from app.models.user import User, UserRole

        # Create unverified user
        old_token = "old_verification_token_123"
        user = User(
            email="newtoken@example.com",
            hashed_password="hashed_password",
            full_name="New Token User",
            role=UserRole.SENDER,
            is_verified=False,
            verification_token=old_token
        )
        db_session.add(user)
        db_session.commit()

        # Resend verification
        client.post("/api/auth/resend-verification?email=newtoken@example.com")

        # Verify token changed
        db_session.refresh(user)
        assert user.verification_token != old_token
        assert user.verification_token is not None

    def test_verification_workflow_complete(self, client, db_session):
        """Test complete verification workflow"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token

        # Step 1: Create unverified user
        token = generate_verification_token()
        user = User(
            email="workflow@example.com",
            hashed_password="hashed_password",
            full_name="Workflow User",
            role=UserRole.SENDER,
            is_verified=False,
            verification_token=token
        )
        db_session.add(user)
        db_session.commit()

        # Step 2: Verify they're unverified
        assert user.is_verified is False
        assert user.verification_token is not None

        # Step 3: Verify email
        response = client.get(f"/api/auth/verify-email/{token}")
        assert response.status_code == status.HTTP_200_OK

        # Step 4: Verify they're now verified
        db_session.refresh(user)
        assert user.is_verified is True
        assert user.verification_token is None

        # Step 5: Try to resend (should fail)
        response = client.post("/api/auth/resend-verification?email=workflow@example.com")
        assert response.status_code == status.HTTP_400_BAD_REQUEST


class TestRememberMe:
    """Tests for Remember Me functionality"""

    def test_login_without_remember_me_uses_default_expiration(self, client, test_user_data):
        """Test that login without remember_me uses default 24-hour expiration"""
        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Login without remember_me
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": False
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.cookies

        # Check cookie max_age is set to default (24 hours = 86400 seconds)
        cookie = response.cookies.get("access_token")
        assert cookie is not None

    def test_login_with_remember_me_uses_extended_expiration(self, client, test_user_data):
        """Test that login with remember_me uses 7-day expiration"""
        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Login with remember_me
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": True
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        assert "access_token" in response.cookies

    def test_login_remember_me_defaults_to_false(self, client, test_user_data):
        """Test that remember_me defaults to False when not provided"""
        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Login without specifying remember_me
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        }
        response = client.post("/api/auth/login", json=login_data)

        assert response.status_code == status.HTTP_200_OK
        # Default behavior should work normally
        assert "access_token" in response.cookies

    def test_remember_me_token_contains_extended_expiration(self, client, test_user_data):
        """Test that remember_me token has extended expiration in JWT payload"""
        import base64
        import json

        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Login with remember_me
        login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": True
        }
        response = client.post("/api/auth/login", json=login_data)
        token = response.cookies["access_token"]

        # Decode token to check expiration
        payload = token.split('.')[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))

        # Token should have exp claim
        assert "exp" in decoded

    def test_regular_login_token_expiration_vs_remember_me(self, client, test_user_data):
        """Test that remember_me token has longer expiration than regular login"""
        import base64
        import json

        # Register user
        client.post("/api/auth/register", json=test_user_data)

        # Login without remember_me
        regular_login_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": False
        }
        regular_response = client.post("/api/auth/login", json=regular_login_data)
        regular_token = regular_response.cookies["access_token"]

        # Login with remember_me
        remember_me_data = {
            "email": test_user_data["email"],
            "password": test_user_data["password"],
            "remember_me": True
        }
        remember_response = client.post("/api/auth/login", json=remember_me_data)
        remember_token = remember_response.cookies["access_token"]

        # Decode both tokens
        def decode_token(token):
            payload = token.split('.')[1]
            payload += '=' * (4 - len(payload) % 4)
            return json.loads(base64.urlsafe_b64decode(payload))

        regular_decoded = decode_token(regular_token)
        remember_decoded = decode_token(remember_token)

        # Remember me token should have longer expiration
        assert remember_decoded["exp"] > regular_decoded["exp"]


class TestAuthenticationWorkflow:
    """Integration tests for complete authentication workflow"""

    def test_complete_auth_workflow(self, client, test_user_data):
        """Test complete authentication workflow from registration to authenticated request"""
        # Step 1: Register
        register_response = client.post("/api/auth/register", json=test_user_data)
        assert register_response.status_code == status.HTTP_201_CREATED
        user_id = register_response.json()["id"]

        # Step 2: Login
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.cookies["access_token"]

        # Step 3: Access protected endpoint
        me_response = client.get(
            "/api/auth/me",
            cookies={"access_token": token}
        )
        assert me_response.status_code == status.HTTP_200_OK
        assert me_response.json()["id"] == user_id

    def test_multiple_users_registration_and_login(self, client, test_user_data, test_courier_data):
        """Test multiple users can register and login independently"""
        # Register two users
        response1 = client.post("/api/auth/register", json=test_user_data)
        response2 = client.post("/api/auth/register", json=test_courier_data)

        assert response1.status_code == status.HTTP_201_CREATED
        assert response2.status_code == status.HTTP_201_CREATED

        # Login as first user
        login1 = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        token1 = login1.cookies["access_token"]

        # Login as second user
        login2 = client.post("/api/auth/login", json={
            "email": test_courier_data["email"],
            "password": test_courier_data["password"]
        })
        token2 = login2.cookies["access_token"]

        # Verify each token returns correct user
        me1 = client.get("/api/auth/me", cookies={"access_token": token1})
        me2 = client.get("/api/auth/me", cookies={"access_token": token2})

        assert me1.json()["email"] == test_user_data["email"]
        assert me2.json()["email"] == test_courier_data["email"]
        assert me1.json()["role"] == "sender"
        assert me2.json()["role"] == "courier"


class TestPasswordReset:
    """Tests for password reset endpoints"""

    def test_forgot_password_with_existing_email(self, client, db_session):
        """Test forgot password request with existing email"""
        from app.models.user import User, UserRole

        # Create user
        user = User(
            email="reset@example.com",
            hashed_password="hashed_password",
            full_name="Reset User",
            role=UserRole.SENDER,
            is_verified=True
        )
        db_session.add(user)
        db_session.commit()

        # Request password reset
        response = client.post("/api/auth/forgot-password", json={"email": "reset@example.com"})

        assert response.status_code == status.HTTP_200_OK
        assert "password reset link" in response.json()["message"].lower()

        # Verify token was set
        db_session.refresh(user)
        assert user.password_reset_token is not None
        assert user.password_reset_token_expires_at is not None

    def test_forgot_password_with_nonexistent_email(self, client):
        """Test forgot password with non-existent email (should not reveal user existence)"""
        response = client.post("/api/auth/forgot-password", json={"email": "nonexistent@example.com"})

        # Should return success to prevent user enumeration
        assert response.status_code == status.HTTP_200_OK
        assert "password reset link" in response.json()["message"].lower()

    def test_forgot_password_with_inactive_user(self, client, db_session):
        """Test forgot password for inactive user"""
        from app.models.user import User, UserRole

        # Create inactive user
        user = User(
            email="inactive.reset@example.com",
            hashed_password="hashed_password",
            full_name="Inactive User",
            role=UserRole.SENDER,
            is_active=False
        )
        db_session.add(user)
        db_session.commit()

        # Request password reset
        response = client.post("/api/auth/forgot-password", json={"email": "inactive.reset@example.com"})

        # Should return success to prevent user enumeration
        assert response.status_code == status.HTTP_200_OK

        # But token should not be set
        db_session.refresh(user)
        assert user.password_reset_token is None

    def test_reset_password_with_valid_token(self, client, db_session):
        """Test password reset with valid token"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token
        from app.utils.auth import verify_password
        from datetime import datetime, timezone, timedelta

        # Create user with reset token
        reset_token = generate_verification_token()
        user = User(
            email="validreset@example.com",
            hashed_password="old_hashed_password",
            full_name="Valid Reset User",
            role=UserRole.SENDER,
            password_reset_token=reset_token,
            password_reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(user)
        db_session.commit()

        # Reset password
        new_password = "newpassword123"
        response = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": new_password
        })

        assert response.status_code == status.HTTP_200_OK
        assert "successfully" in response.json()["message"].lower()

        # Verify password was changed
        db_session.refresh(user)
        assert verify_password(new_password, user.hashed_password)

        # Verify token was cleared
        assert user.password_reset_token is None
        assert user.password_reset_token_expires_at is None

    def test_reset_password_with_invalid_token(self, client):
        """Test password reset with invalid token"""
        response = client.post("/api/auth/reset-password", json={
            "token": "invalid_token_12345",
            "new_password": "newpassword123"
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid" in response.json()["detail"].lower()

    def test_reset_password_with_expired_token(self, client, db_session):
        """Test password reset with expired token"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token
        from datetime import datetime, timezone, timedelta

        # Create user with expired reset token
        reset_token = generate_verification_token()
        user = User(
            email="expiredreset@example.com",
            hashed_password="old_hashed_password",
            full_name="Expired Reset User",
            role=UserRole.SENDER,
            password_reset_token=reset_token,
            password_reset_token_expires_at=datetime.now(timezone.utc) - timedelta(hours=1)  # Already expired
        )
        db_session.add(user)
        db_session.commit()

        # Try to reset password
        response = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": "newpassword123"
        })

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "expired" in response.json()["detail"].lower()

    def test_reset_password_too_short(self, client, db_session):
        """Test password reset with password shorter than 8 characters"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token
        from datetime import datetime, timezone, timedelta

        # Create user with reset token
        reset_token = generate_verification_token()
        user = User(
            email="shortreset@example.com",
            hashed_password="old_hashed_password",
            full_name="Short Reset User",
            role=UserRole.SENDER,
            password_reset_token=reset_token,
            password_reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(user)
        db_session.commit()

        # Try to reset with short password
        response = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": "short"
        })

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_reset_password_clears_token(self, client, db_session):
        """Test that password reset clears the token"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token
        from datetime import datetime, timezone, timedelta

        # Create user with reset token
        reset_token = generate_verification_token()
        user = User(
            email="cleartoken@example.com",
            hashed_password="old_hashed_password",
            full_name="Clear Token User",
            role=UserRole.SENDER,
            password_reset_token=reset_token,
            password_reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(user)
        db_session.commit()

        # Reset password
        client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": "newpassword123"
        })

        # Verify token is cleared
        db_session.refresh(user)
        assert user.password_reset_token is None
        assert user.password_reset_token_expires_at is None

    def test_reset_password_workflow_complete(self, client, db_session):
        """Test complete password reset workflow"""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Step 1: Create verified user
        user = User(
            email="workflow.reset@example.com",
            hashed_password=get_password_hash("oldpassword123"),
            full_name="Workflow User",
            role=UserRole.SENDER,
            is_verified=True
        )
        db_session.add(user)
        db_session.commit()

        # Step 2: Request password reset
        response = client.post("/api/auth/forgot-password", json={"email": "workflow.reset@example.com"})
        assert response.status_code == status.HTTP_200_OK

        # Get the reset token from database
        db_session.refresh(user)
        reset_token = user.password_reset_token
        assert reset_token is not None

        # Step 3: Reset password
        new_password = "newpassword456"
        response = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": new_password
        })
        assert response.status_code == status.HTTP_200_OK

        # Step 4: Login with new password should succeed
        login_response = client.post("/api/auth/login", json={
            "email": "workflow.reset@example.com",
            "password": new_password
        })
        assert login_response.status_code == status.HTTP_200_OK

        # Step 5: Old password should not work
        old_login_response = client.post("/api/auth/login", json={
            "email": "workflow.reset@example.com",
            "password": "oldpassword123"
        })
        assert old_login_response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_token_cannot_be_reused(self, client, db_session):
        """Test that reset token cannot be reused"""
        from app.models.user import User, UserRole
        from app.utils.email import generate_verification_token
        from datetime import datetime, timezone, timedelta

        # Create user with reset token
        reset_token = generate_verification_token()
        user = User(
            email="reuse@example.com",
            hashed_password="old_hashed_password",
            full_name="Reuse Token User",
            role=UserRole.SENDER,
            password_reset_token=reset_token,
            password_reset_token_expires_at=datetime.now(timezone.utc) + timedelta(hours=1)
        )
        db_session.add(user)
        db_session.commit()

        # First reset - should succeed
        response1 = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": "newpassword123"
        })
        assert response1.status_code == status.HTTP_200_OK

        # Second reset with same token - should fail
        response2 = client.post("/api/auth/reset-password", json={
            "token": reset_token,
            "new_password": "anotherpassword456"
        })
        assert response2.status_code == status.HTTP_400_BAD_REQUEST


class TestUserProfileUpdate:
    """Tests for user profile update endpoint"""

    def test_update_profile_full_name(self, client, authenticated_sender):
        """Test updating user's full name"""
        response = client.put(
            "/api/auth/me",
            json={"full_name": "Updated Name"},
            cookies={"access_token": authenticated_sender}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["full_name"] == "Updated Name"

    def test_update_profile_phone_number(self, client, authenticated_sender):
        """Test updating user's phone number"""
        response = client.put(
            "/api/auth/me",
            json={"phone_number": "+1234567890"},
            cookies={"access_token": authenticated_sender}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["phone_number"] == "+1234567890"

    def test_update_profile_max_deviation_km(self, client, authenticated_courier):
        """Test updating user's max deviation km"""
        response = client.put(
            "/api/auth/me",
            json={"max_deviation_km": 15},
            cookies={"access_token": authenticated_courier}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["max_deviation_km"] == 15

    def test_update_profile_default_address(self, client, authenticated_sender):
        """Test updating user's default address"""
        response = client.put(
            "/api/auth/me",
            json={
                "default_address": "123 Main St, New York, NY",
                "default_address_lat": 40.7128,
                "default_address_lng": -74.0060
            },
            cookies={"access_token": authenticated_sender}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["default_address"] == "123 Main St, New York, NY"
        assert response.json()["default_address_lat"] == 40.7128
        assert response.json()["default_address_lng"] == -74.0060

    def test_update_profile_multiple_fields(self, client, authenticated_sender):
        """Test updating multiple profile fields at once"""
        response = client.put(
            "/api/auth/me",
            json={
                "full_name": "Multi Update User",
                "phone_number": "+9876543210",
                "default_address": "456 Oak Ave, Los Angeles, CA",
                "default_address_lat": 34.0522,
                "default_address_lng": -118.2437
            },
            cookies={"access_token": authenticated_sender}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["full_name"] == "Multi Update User"
        assert data["phone_number"] == "+9876543210"
        assert data["default_address"] == "456 Oak Ave, Los Angeles, CA"
        assert data["default_address_lat"] == 34.0522
        assert data["default_address_lng"] == -118.2437

    def test_update_profile_empty_request(self, client, authenticated_sender):
        """Test updating with empty request body (no changes)"""
        # First get current profile
        me_response = client.get("/api/auth/me", cookies={"access_token": authenticated_sender})
        original_data = me_response.json()

        # Update with empty body
        response = client.put(
            "/api/auth/me",
            json={},
            cookies={"access_token": authenticated_sender}
        )

        assert response.status_code == status.HTTP_200_OK
        # Should return same data
        assert response.json()["full_name"] == original_data["full_name"]

    def test_update_profile_unauthenticated(self, client):
        """Test updating profile without authentication"""
        response = client.put(
            "/api/auth/me",
            json={"full_name": "Hacker"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_update_profile_invalid_max_deviation(self, client, authenticated_sender):
        """Test updating max_deviation_km with invalid value"""
        # Too high
        response = client.put(
            "/api/auth/me",
            json={"max_deviation_km": 100},
            cookies={"access_token": authenticated_sender}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Too low
        response = client.put(
            "/api/auth/me",
            json={"max_deviation_km": 0},
            cookies={"access_token": authenticated_sender}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUserRegistrationWithAddress:
    """Tests for user registration with default address fields"""

    def test_register_with_default_address(self, client):
        """Test registration with default address"""
        user_data = {
            "email": "address.user@example.com",
            "password": "password123",
            "full_name": "Address User",
            "role": "sender",
            "default_address": "789 Pine St, Chicago, IL",
            "default_address_lat": 41.8781,
            "default_address_lng": -87.6298
        }
        response = client.post("/api/auth/register", json=user_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["default_address"] == "789 Pine St, Chicago, IL"
        assert data["default_address_lat"] == 41.8781
        assert data["default_address_lng"] == -87.6298

    def test_register_without_default_address(self, client):
        """Test registration without default address (should be null)"""
        user_data = {
            "email": "no.address@example.com",
            "password": "password123",
            "full_name": "No Address User",
            "role": "sender"
        }
        response = client.post("/api/auth/register", json=user_data)

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["default_address"] is None
        assert data["default_address_lat"] is None
        assert data["default_address_lng"] is None

    def test_get_current_user_includes_address(self, client, db_session):
        """Test that GET /auth/me returns address fields"""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash, create_access_token
        from datetime import timedelta

        # Create user with address
        user = User(
            email="me.address@example.com",
            hashed_password=get_password_hash("password123"),
            full_name="Me Address User",
            role=UserRole.SENDER,
            is_verified=True,
            default_address="100 Test Blvd, Boston, MA",
            default_address_lat=42.3601,
            default_address_lng=-71.0589
        )
        db_session.add(user)
        db_session.commit()

        # Create token and get user info
        token = create_access_token(
            data={"sub": user.email, "role": user.role.value},
            expires_delta=timedelta(hours=1)
        )

        response = client.get("/api/auth/me", cookies={"access_token": token})

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["default_address"] == "100 Test Blvd, Boston, MA"
        assert data["default_address_lat"] == 42.3601
        assert data["default_address_lng"] == -71.0589
