"""
Tests for config.py - Application configuration and validation.

Tests the Settings class and its validation methods.
"""
import pytest
import os
from unittest.mock import patch
from pydantic_settings import BaseSettings


# ==================== Settings Class Tests ====================

class TestSecretKeyValidation:
    """Tests for validate_secret_key method."""

    def test_rejects_default_key_in_production(self):
        """Should raise ValueError for default key in production."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "SECRET_KEY": "your-secret-key-change-in-production",
            "ENVIRONMENT": "production"
        }):
            settings = Settings()
            with pytest.raises(ValueError) as exc_info:
                settings.validate_secret_key()

            assert "CRITICAL SECURITY ERROR" in str(exc_info.value)

    def test_rejects_short_key_in_production(self):
        """Should raise ValueError for short key in production."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "SECRET_KEY": "short-key",  # Less than 32 chars
            "ENVIRONMENT": "production"
        }):
            settings = Settings()
            with pytest.raises(ValueError) as exc_info:
                settings.validate_secret_key()

            assert "at least 32 characters" in str(exc_info.value)

    def test_accepts_secure_key(self):
        """Should accept secure key (32+ chars)."""
        from app.config import Settings

        secure_key = "a" * 32  # Exactly 32 chars

        with patch.dict(os.environ, {
            "SECRET_KEY": secure_key,
            "ENVIRONMENT": "production"
        }):
            settings = Settings()
            # Should not raise
            settings.validate_secret_key()

    def test_warns_in_development(self):
        """Should warn but not raise in development."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "SECRET_KEY": "your-secret-key-change-in-production",
            "ENVIRONMENT": "development"
        }):
            settings = Settings()
            # Should not raise, just warn
            with pytest.warns(UserWarning):
                settings.validate_secret_key()

    def test_rejects_common_insecure_keys(self):
        """Should reject common insecure keys in production."""
        from app.config import Settings

        insecure_keys = ["change-me", "secret", "password", "secret-key"]

        for key in insecure_keys:
            with patch.dict(os.environ, {
                "SECRET_KEY": key,
                "ENVIRONMENT": "production"
            }):
                settings = Settings()
                with pytest.raises(ValueError):
                    settings.validate_secret_key()


class TestEncryptionKeyValidation:
    """Tests for validate_encryption_key method."""

    def test_raises_in_production_if_not_set(self):
        """Should raise ValueError if ENCRYPTION_KEY not set in production."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "ENCRYPTION_KEY": "",
            "ENVIRONMENT": "production",
            "SECRET_KEY": "a" * 32  # Valid secret key
        }, clear=False):
            settings = Settings()
            settings.ENCRYPTION_KEY = None  # Explicitly set to None
            settings.ENVIRONMENT = "production"

            with pytest.raises(ValueError) as exc_info:
                settings.validate_encryption_key()

            assert "ENCRYPTION_KEY must be set" in str(exc_info.value)

    def test_validates_fernet_key_format(self):
        """Should validate that ENCRYPTION_KEY is a valid Fernet key."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "ENCRYPTION_KEY": "invalid-key-format",
            "ENVIRONMENT": "development",
            "SECRET_KEY": "a" * 32
        }):
            settings = Settings()
            settings.ENCRYPTION_KEY = "invalid-key-format"

            with pytest.raises(ValueError) as exc_info:
                settings.validate_encryption_key()

            assert "ENCRYPTION_KEY is invalid" in str(exc_info.value)

    def test_accepts_valid_fernet_key(self):
        """Should accept a valid Fernet key."""
        from app.config import Settings
        from cryptography.fernet import Fernet

        valid_key = Fernet.generate_key().decode()

        with patch.dict(os.environ, {
            "ENCRYPTION_KEY": valid_key,
            "ENVIRONMENT": "production",
            "SECRET_KEY": "a" * 32
        }):
            settings = Settings()
            settings.ENCRYPTION_KEY = valid_key
            settings.ENVIRONMENT = "production"

            # Should not raise
            settings.validate_encryption_key()

    def test_skips_validation_if_not_set_in_development(self):
        """Should not raise if ENCRYPTION_KEY not set in development."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "ENVIRONMENT": "development",
            "SECRET_KEY": "a" * 32
        }):
            settings = Settings()
            settings.ENCRYPTION_KEY = None
            settings.ENVIRONMENT = "development"

            # Should not raise
            settings.validate_encryption_key()


class TestDefaultValues:
    """Tests for default configuration values."""

    def test_default_environment(self):
        """Should default to development environment."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.ENVIRONMENT == "development"

    def test_default_access_token_expire(self):
        """Should have default access token expiration."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.ACCESS_TOKEN_EXPIRE_MINUTES == 1440  # 24 hours

    def test_default_remember_me_expire(self):
        """Should have default remember me expiration."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.REMEMBER_ME_EXPIRE_MINUTES == 10080  # 7 days

    def test_default_platform_fee(self):
        """Should have default platform fee percentage."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.PLATFORM_FEE_PERCENT == 15.0

    def test_default_redis_location_ttl(self):
        """Should have default Redis location TTL."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.REDIS_LOCATION_TTL == 60

    def test_default_geo_restriction(self):
        """Should default to US-only registration."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.ALLOW_INTERNATIONAL_REGISTRATION is False
            assert settings.REGISTRATION_COUNTRY_ALLOWLIST == "US"


class TestOptionalSettings:
    """Tests for optional configuration settings."""

    def test_optional_stripe_keys(self):
        """Stripe keys should be optional."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            # These should be None by default
            assert settings.STRIPE_SECRET_KEY is None
            assert settings.STRIPE_PUBLISHABLE_KEY is None
            assert settings.STRIPE_WEBHOOK_SECRET is None

    def test_optional_twilio_settings(self):
        """Twilio settings should be optional."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.TWILIO_ACCOUNT_SID is None
            assert settings.TWILIO_AUTH_TOKEN is None
            assert settings.TWILIO_PHONE_NUMBER is None

    def test_optional_aws_settings(self):
        """AWS settings should be optional."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert settings.AWS_ACCESS_KEY_ID is None
            assert settings.AWS_SECRET_ACCESS_KEY is None


class TestEnvironmentVariableLoading:
    """Tests for environment variable loading."""

    def test_loads_from_environment(self):
        """Should load settings from environment variables."""
        from app.config import Settings

        with patch.dict(os.environ, {
            "SECRET_KEY": "test-secret-key-from-environment-var-32chars",
            "ENVIRONMENT": "testing",
            "FRONTEND_URL": "https://test.example.com"
        }):
            settings = Settings()
            assert settings.SECRET_KEY == "test-secret-key-from-environment-var-32chars"
            assert settings.ENVIRONMENT == "testing"
            assert settings.FRONTEND_URL == "https://test.example.com"

    def test_database_url_default(self):
        """Should have default DATABASE_URL."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert "postgresql://" in settings.DATABASE_URL

    def test_redis_url_default(self):
        """Should have default REDIS_URL."""
        from app.config import Settings

        with patch.dict(os.environ, {"SECRET_KEY": "a" * 32}, clear=False):
            settings = Settings()
            assert "redis://" in settings.REDIS_URL
