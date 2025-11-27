"""Tests for app/utils/auth.py - Password hashing and JWT token utilities"""

import pytest
from datetime import timedelta
from unittest.mock import patch
from jose import jwt

from app.utils.auth import (
    verify_password,
    get_password_hash,
    create_access_token,
    verify_token
)
from app.config import settings


class TestPasswordHashing:
    """Tests for password hashing functions"""

    def test_get_password_hash_returns_hashed_string(self):
        """Test that password hashing returns a hashed string"""
        password = "mysecretpassword123"
        hashed = get_password_hash(password)

        assert hashed != password
        assert len(hashed) > 0
        assert hashed.startswith("$2b$")  # bcrypt hash prefix

    def test_get_password_hash_different_for_same_password(self):
        """Test that same password produces different hashes (due to salt)"""
        password = "mysecretpassword123"
        hash1 = get_password_hash(password)
        hash2 = get_password_hash(password)

        assert hash1 != hash2

    def test_verify_password_correct_password(self):
        """Test that correct password verifies successfully"""
        password = "mysecretpassword123"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_incorrect_password(self):
        """Test that incorrect password fails verification"""
        password = "mysecretpassword123"
        wrong_password = "wrongpassword"
        hashed = get_password_hash(password)

        assert verify_password(wrong_password, hashed) is False

    def test_verify_password_empty_password(self):
        """Test verification with empty password"""
        password = "mysecretpassword123"
        hashed = get_password_hash(password)

        assert verify_password("", hashed) is False

    def test_get_password_hash_empty_password(self):
        """Test hashing empty password (should still work)"""
        password = ""
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_verify_password_special_characters(self):
        """Test password with special characters"""
        password = "P@$$w0rd!#$%^&*()"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True

    def test_verify_password_unicode_characters(self):
        """Test password with unicode characters"""
        password = "密码123パスワード"
        hashed = get_password_hash(password)

        assert verify_password(password, hashed) is True


class TestJWTToken:
    """Tests for JWT token creation and verification"""

    def test_create_access_token_basic(self):
        """Test basic token creation"""
        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_create_access_token_with_custom_expiry(self):
        """Test token creation with custom expiry"""
        data = {"sub": "test@example.com"}
        expires_delta = timedelta(minutes=30)
        token = create_access_token(data, expires_delta=expires_delta)

        assert token is not None
        decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert decoded["sub"] == "test@example.com"

    def test_create_access_token_preserves_data(self):
        """Test that token preserves additional data"""
        data = {"sub": "test@example.com", "role": "admin", "user_id": 123}
        token = create_access_token(data)

        decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert decoded["sub"] == "test@example.com"
        assert decoded["role"] == "admin"
        assert decoded["user_id"] == 123

    def test_create_access_token_has_expiry(self):
        """Test that token includes expiry claim"""
        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        assert "exp" in decoded

    def test_verify_token_valid_token(self):
        """Test verification of valid token"""
        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        payload = verify_token(token)
        assert payload is not None
        assert payload["sub"] == "test@example.com"

    def test_verify_token_invalid_token(self):
        """Test verification of invalid token"""
        invalid_token = "invalid.token.string"

        payload = verify_token(invalid_token)
        assert payload is None

    def test_verify_token_tampered_token(self):
        """Test verification of tampered token"""
        data = {"sub": "test@example.com"}
        token = create_access_token(data)

        # Tamper with the token
        tampered_token = token[:-5] + "XXXXX"

        payload = verify_token(tampered_token)
        assert payload is None

    def test_verify_token_wrong_secret(self):
        """Test verification with wrong secret key"""
        data = {"sub": "test@example.com"}
        # Create token with a different secret
        wrong_token = jwt.encode(data, "wrong_secret_key", algorithm=settings.ALGORITHM)

        payload = verify_token(wrong_token)
        assert payload is None

    def test_verify_token_expired_token(self):
        """Test verification of expired token"""
        data = {"sub": "test@example.com"}
        # Create token with negative expiry (already expired)
        expires_delta = timedelta(seconds=-1)
        token = create_access_token(data, expires_delta=expires_delta)

        payload = verify_token(token)
        assert payload is None

    def test_verify_token_empty_string(self):
        """Test verification of empty token string"""
        payload = verify_token("")
        assert payload is None

    def test_create_access_token_does_not_modify_input(self):
        """Test that create_access_token doesn't modify the input dict"""
        data = {"sub": "test@example.com"}
        original_data = data.copy()

        create_access_token(data)

        assert data == original_data


class TestTokenRoundTrip:
    """Integration tests for token creation and verification"""

    def test_token_roundtrip(self):
        """Test complete token creation and verification cycle"""
        original_data = {
            "sub": "user@example.com",
            "user_id": 42,
            "role": "courier"
        }

        token = create_access_token(original_data)
        decoded = verify_token(token)

        assert decoded is not None
        assert decoded["sub"] == original_data["sub"]
        assert decoded["user_id"] == original_data["user_id"]
        assert decoded["role"] == original_data["role"]

    def test_multiple_tokens_with_different_expiry(self):
        """Test that creating tokens with different expiry produces different values"""
        from datetime import timedelta
        data = {"sub": "test@example.com"}

        token1 = create_access_token(data, expires_delta=timedelta(minutes=30))
        token2 = create_access_token(data, expires_delta=timedelta(minutes=60))

        # Tokens should be different (different expiry times)
        assert token1 != token2

        # But both should verify successfully
        assert verify_token(token1) is not None
        assert verify_token(token2) is not None
