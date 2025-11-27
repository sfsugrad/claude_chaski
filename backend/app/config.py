from pydantic_settings import BaseSettings
from typing import Optional
import secrets

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "postgresql://user:password@localhost:5432/chaski_db"

    # JWT
    SECRET_KEY: str = "your-secret-key-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours default
    REMEMBER_ME_EXPIRE_MINUTES: int = 10080  # 7 days for "Remember Me"

    def validate_secret_key(self) -> None:
        """Validate that SECRET_KEY has been changed from default"""
        insecure_keys = [
            "your-secret-key-change-in-production",
            "change-me",
            "secret",
            "password",
            "secret-key"
        ]
        if self.SECRET_KEY in insecure_keys or len(self.SECRET_KEY) < 32:
            if self.ENVIRONMENT == "production":
                raise ValueError(
                    "CRITICAL SECURITY ERROR: SECRET_KEY must be changed from default "
                    "and must be at least 32 characters long for production use. "
                    f"Generate a secure key with: python -c 'import secrets; print(secrets.token_urlsafe(32))'"
                )
            else:
                # In development, generate a random key if using default
                import warnings
                warnings.warn(
                    "WARNING: Using insecure SECRET_KEY. For production, set a secure SECRET_KEY "
                    "in your .env file (at least 32 characters).",
                    UserWarning
                )

    # API Keys
    GOOGLE_MAPS_API_KEY: Optional[str] = None
    MAPBOX_API_KEY: Optional[str] = None

    # Email Configuration
    MAIL_USERNAME: str = "your-email@gmail.com"
    MAIL_PASSWORD: str = "your-app-password"
    MAIL_FROM: str = "noreply@chaski.com"
    MAIL_PORT: int = 587
    MAIL_SERVER: str = "smtp.gmail.com"
    MAIL_FROM_NAME: str = "Chaski"
    MAIL_STARTTLS: bool = True
    MAIL_SSL_TLS: bool = False
    USE_CREDENTIALS: bool = True
    VALIDATE_CERTS: bool = True

    # Frontend URL for email verification links
    FRONTEND_URL: str = "http://localhost:3000"

    # Google OAuth Configuration
    GOOGLE_CLIENT_ID: str = "your-google-client-id.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = "your-google-client-secret"
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/api/auth/google/callback"

    # Environment
    ENVIRONMENT: str = "development"

    class Config:
        env_file = ".env"

settings = Settings()
# Validate SECRET_KEY on startup
settings.validate_secret_key()
