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

    # Encryption Key for PII (Fernet)
    # Generate with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'
    ENCRYPTION_KEY: Optional[str] = None

    def validate_encryption_key(self) -> None:
        """Validate that ENCRYPTION_KEY is set for production"""
        if self.ENVIRONMENT == "production" and not self.ENCRYPTION_KEY:
            raise ValueError(
                "CRITICAL SECURITY ERROR: ENCRYPTION_KEY must be set in production. "
                "Generate a key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
            )

        if self.ENCRYPTION_KEY:
            # Validate that it's a valid Fernet key (base64-encoded, correct length)
            try:
                from cryptography.fernet import Fernet
                Fernet(self.ENCRYPTION_KEY.encode())
            except Exception as e:
                raise ValueError(
                    f"ENCRYPTION_KEY is invalid: {e}. "
                    "Generate a valid key with: python -c 'from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())'"
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

    # Redis Configuration
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_LOCATION_TTL: int = 60  # seconds for location cache

    # AWS S3 Configuration
    AWS_ACCESS_KEY_ID: Optional[str] = None
    AWS_SECRET_ACCESS_KEY: Optional[str] = None
    AWS_S3_BUCKET: str = "chaski-delivery-proofs"
    AWS_S3_REGION: str = "us-east-1"
    AWS_CLOUDFRONT_DOMAIN: Optional[str] = None
    S3_PRESIGNED_URL_EXPIRY: int = 3600  # 1 hour

    # Celery Configuration
    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/2"

    # Stripe Configuration
    STRIPE_SECRET_KEY: Optional[str] = None
    STRIPE_PUBLISHABLE_KEY: Optional[str] = None
    STRIPE_WEBHOOK_SECRET: Optional[str] = None
    STRIPE_CONNECT_CLIENT_ID: Optional[str] = None
    PLATFORM_FEE_PERCENT: float = 15.0  # 15% platform fee

    # Twilio Configuration
    TWILIO_ACCOUNT_SID: Optional[str] = None
    TWILIO_AUTH_TOKEN: Optional[str] = None
    TWILIO_PHONE_NUMBER: Optional[str] = None  # Format: +1234567890
    TWILIO_VERIFY_SERVICE_SID: Optional[str] = None  # Optional: for Twilio Verify API

    class Config:
        env_file = ".env"

settings = Settings()

# Validate security settings on startup
settings.validate_secret_key()
settings.validate_encryption_key()

# Initialize encryption service if encryption key is provided
if settings.ENCRYPTION_KEY:
    from app.utils.encryption import init_encryption_service
    init_encryption_service(settings.ENCRYPTION_KEY.encode())
