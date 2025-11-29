"""
PII Encryption Utilities

This module provides encryption/decryption functions for Personally Identifiable Information (PII)
using Fernet symmetric encryption (AES-128 in CBC mode with HMAC for authenticity).

PII fields that should be encrypted:
- Email addresses
- Phone numbers
- Full names
- Addresses
- Any other sensitive personal data

Security considerations:
- Encryption key must be securely stored (environment variable, not in code)
- Key should be backed up securely (loss means data cannot be decrypted)
- Use different keys for development, staging, and production
- Rotate encryption keys periodically (requires re-encrypting all data)
"""

import logging
import base64
from typing import Optional
from cryptography.fernet import Fernet, InvalidToken

logger = logging.getLogger(__name__)


class EncryptionError(Exception):
    """Base exception for encryption-related errors"""
    pass


class EncryptionService:
    """
    Service for encrypting and decrypting PII data using Fernet symmetric encryption.

    This service uses a single encryption key loaded from the environment.
    In production, this key should be securely managed (e.g., AWS Secrets Manager,
    Heroku Config Vars, etc.)
    """

    def __init__(self, encryption_key: Optional[bytes] = None):
        """
        Initialize encryption service with the provided key.

        Args:
            encryption_key: Base64-encoded Fernet key (32 bytes). If None,
                          will be loaded from environment via config.

        Raises:
            EncryptionError: If encryption key is invalid or missing
        """
        if encryption_key is None:
            raise EncryptionError("Encryption key is required. Set ENCRYPTION_KEY environment variable.")

        try:
            self.fernet = Fernet(encryption_key)
        except Exception as e:
            logger.error(f"Failed to initialize Fernet cipher: {e}")
            raise EncryptionError(f"Invalid encryption key: {e}")

    def encrypt(self, plaintext: Optional[str]) -> Optional[str]:
        """
        Encrypt a plaintext string.

        Args:
            plaintext: The string to encrypt (e.g., email, phone number)

        Returns:
            Base64-encoded encrypted string, or None if plaintext is None

        Raises:
            EncryptionError: If encryption fails
        """
        if plaintext is None:
            return None

        if not isinstance(plaintext, str):
            raise EncryptionError(f"Expected string, got {type(plaintext)}")

        try:
            # Convert string to bytes, encrypt, return as base64 string
            plaintext_bytes = plaintext.encode('utf-8')
            encrypted_bytes = self.fernet.encrypt(plaintext_bytes)
            # Return as string for database storage
            return encrypted_bytes.decode('utf-8')
        except Exception as e:
            logger.error(f"Encryption failed: {e}")
            raise EncryptionError(f"Failed to encrypt data: {e}")

    def decrypt(self, ciphertext: Optional[str]) -> Optional[str]:
        """
        Decrypt an encrypted string.

        Args:
            ciphertext: Base64-encoded encrypted string

        Returns:
            Decrypted plaintext string, or None if ciphertext is None

        Raises:
            EncryptionError: If decryption fails (invalid ciphertext or wrong key)
        """
        if ciphertext is None:
            return None

        if not isinstance(ciphertext, str):
            raise EncryptionError(f"Expected string, got {type(ciphertext)}")

        try:
            # Convert string to bytes, decrypt, return as string
            ciphertext_bytes = ciphertext.encode('utf-8')
            decrypted_bytes = self.fernet.decrypt(ciphertext_bytes)
            return decrypted_bytes.decode('utf-8')
        except InvalidToken:
            logger.error("Decryption failed: Invalid token (wrong key or corrupted data)")
            raise EncryptionError("Failed to decrypt data: Invalid encryption key or corrupted data")
        except Exception as e:
            logger.error(f"Decryption failed: {e}")
            raise EncryptionError(f"Failed to decrypt data: {e}")

    def encrypt_email(self, email: Optional[str]) -> Optional[str]:
        """
        Encrypt an email address.

        Email-specific encryption that validates format before encryption.

        Args:
            email: Email address to encrypt

        Returns:
            Encrypted email string, or None if email is None
        """
        if email is None:
            return None

        # Basic email validation
        if '@' not in email or '.' not in email.split('@')[1]:
            logger.warning(f"Potentially invalid email format: {email}")

        return self.encrypt(email)

    def decrypt_email(self, encrypted_email: Optional[str]) -> Optional[str]:
        """
        Decrypt an encrypted email address.

        Args:
            encrypted_email: Encrypted email string

        Returns:
            Decrypted email address, or None if encrypted_email is None
        """
        return self.decrypt(encrypted_email)

    def encrypt_phone(self, phone: Optional[str]) -> Optional[str]:
        """
        Encrypt a phone number.

        Args:
            phone: Phone number to encrypt

        Returns:
            Encrypted phone string, or None if phone is None
        """
        if phone is None:
            return None

        return self.encrypt(phone)

    def decrypt_phone(self, encrypted_phone: Optional[str]) -> Optional[str]:
        """
        Decrypt an encrypted phone number.

        Args:
            encrypted_phone: Encrypted phone string

        Returns:
            Decrypted phone number, or None if encrypted_phone is None
        """
        return self.decrypt(encrypted_phone)


def generate_encryption_key() -> str:
    """
    Generate a new Fernet encryption key.

    This should be run once during initial setup and the key should be
    securely stored (e.g., in environment variables, secrets manager).

    Returns:
        Base64-encoded Fernet key as a string

    Example:
        >>> key = generate_encryption_key()
        >>> print(f"Add this to your .env file: ENCRYPTION_KEY={key}")
    """
    key = Fernet.generate_key()
    return key.decode('utf-8')


# Global encryption service instance
# This will be initialized when config is loaded
_encryption_service: Optional[EncryptionService] = None


def get_encryption_service() -> EncryptionService:
    """
    Get the global encryption service instance.

    Returns:
        Initialized EncryptionService instance

    Raises:
        EncryptionError: If encryption service is not initialized
    """
    if _encryption_service is None:
        raise EncryptionError("Encryption service not initialized. Call init_encryption_service() first.")
    return _encryption_service


def init_encryption_service(encryption_key: bytes) -> None:
    """
    Initialize the global encryption service with the provided key.

    This should be called once during application startup.

    Args:
        encryption_key: Base64-encoded Fernet key
    """
    global _encryption_service
    _encryption_service = EncryptionService(encryption_key)
    logger.info("Encryption service initialized successfully")


# Convenience functions for easy access
def encrypt_pii(plaintext: Optional[str]) -> Optional[str]:
    """Encrypt PII data using the global encryption service"""
    return get_encryption_service().encrypt(plaintext)


def decrypt_pii(ciphertext: Optional[str]) -> Optional[str]:
    """Decrypt PII data using the global encryption service"""
    return get_encryption_service().decrypt(ciphertext)
