from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib
import hmac
from jose import JWTError, jwt
from passlib.context import CryptContext
from app.config import settings

# Password hashing context
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return encoded_jwt


def verify_token(token: str) -> Optional[dict]:
    """Verify and decode a JWT token"""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except JWTError:
        return None


def hash_token(token: str) -> str:
    """
    Hash a token using SHA-256 for secure storage.

    Used for verification tokens, password reset tokens, and phone verification codes.
    The plain token is sent to the user, but only the hash is stored in the database.

    Args:
        token: The plain text token to hash

    Returns:
        str: The SHA-256 hash of the token as a hexadecimal string
    """
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def verify_token_hash(plain_token: str, hashed_token: str) -> bool:
    """
    Verify a plain token against a hashed token.

    Args:
        plain_token: The plain text token to verify
        hashed_token: The stored hash to compare against

    Returns:
        bool: True if the token matches the hash, False otherwise
    """
    return hash_token(plain_token) == hashed_token


def hash_pii(value: str) -> str:
    """
    Hash PII (Personally Identifiable Information) for secure lookup.

    Uses HMAC-SHA256 with the application secret key to prevent rainbow table attacks.
    This creates a deterministic hash that can be used for database lookups while
    keeping the actual PII encrypted.

    Used for: email addresses, phone numbers (for uniqueness checks and lookups)

    Args:
        value: The PII value to hash (e.g., email address, phone number)

    Returns:
        str: HMAC-SHA256 hash as a hexadecimal string
    """
    # Normalize the value (lowercase for email, strip whitespace)
    normalized = value.lower().strip()
    return hmac.new(
        settings.SECRET_KEY.encode('utf-8'),
        normalized.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
