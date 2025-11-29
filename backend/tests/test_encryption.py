"""
Tests for PII encryption utilities.

Tests cover:
- Encrypt/decrypt round trips
- Edge cases (None, empty string, unicode, special chars)
- Error handling (invalid key, corrupted data)
- Convenience functions (email, phone)
- Encryption service initialization
"""

import pytest
from cryptography.fernet import Fernet

from app.utils.encryption import (
    EncryptionService,
    EncryptionError,
    generate_encryption_key,
    init_encryption_service,
    get_encryption_service,
    encrypt_pii,
    decrypt_pii,
)


class TestEncryptionService:
    """Tests for EncryptionService class"""

    @pytest.fixture
    def encryption_key(self):
        """Generate a valid Fernet encryption key"""
        return Fernet.generate_key()

    @pytest.fixture
    def service(self, encryption_key):
        """Create an encryption service instance"""
        return EncryptionService(encryption_key)

    def test_encrypt_decrypt_round_trip(self, service):
        """Test that encrypted data can be decrypted back to original"""
        plaintext = "test@example.com"
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_decrypt_empty_string(self, service):
        """Test encryption of empty string"""
        plaintext = ""
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_with_none_returns_none(self, service):
        """Test that encrypting None returns None"""
        assert service.encrypt(None) is None

    def test_decrypt_with_none_returns_none(self, service):
        """Test that decrypting None returns None"""
        assert service.decrypt(None) is None

    def test_encrypt_unicode_characters(self, service):
        """Test encryption of unicode characters"""
        plaintext = "Héllo Wörld 你好 مرحبا 🎉"
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_special_characters(self, service):
        """Test encryption of special characters"""
        plaintext = "!@#$%^&*()_+-=[]{}|;':\",./<>?`~"
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_encrypt_produces_different_ciphertext(self, service):
        """Test that same plaintext produces different ciphertext each time (nonce)"""
        plaintext = "test@example.com"
        encrypted1 = service.encrypt(plaintext)
        encrypted2 = service.encrypt(plaintext)
        # Fernet uses random nonce, so ciphertext should differ
        assert encrypted1 != encrypted2
        # But both should decrypt to same value
        assert service.decrypt(encrypted1) == service.decrypt(encrypted2) == plaintext

    def test_decrypt_with_invalid_data_raises_error(self, service):
        """Test that decrypting invalid data raises EncryptionError"""
        with pytest.raises(EncryptionError, match="Failed to decrypt"):
            service.decrypt("not-valid-ciphertext")

    def test_decrypt_with_wrong_key_raises_error(self, encryption_key):
        """Test that decrypting with wrong key raises EncryptionError"""
        service1 = EncryptionService(encryption_key)
        different_key = Fernet.generate_key()
        service2 = EncryptionService(different_key)

        encrypted = service1.encrypt("secret data")
        with pytest.raises(EncryptionError, match="Failed to decrypt"):
            service2.decrypt(encrypted)

    def test_encrypt_non_string_raises_error(self, service):
        """Test that encrypting non-string raises EncryptionError"""
        with pytest.raises(EncryptionError, match="Expected string"):
            service.encrypt(12345)

    def test_decrypt_non_string_raises_error(self, service):
        """Test that decrypting non-string raises EncryptionError"""
        with pytest.raises(EncryptionError, match="Expected string"):
            service.decrypt(12345)

    def test_encrypt_large_data(self, service):
        """Test encryption of large data"""
        plaintext = "A" * 100000  # 100KB of data
        encrypted = service.encrypt(plaintext)
        decrypted = service.decrypt(encrypted)
        assert decrypted == plaintext

    def test_service_init_without_key_raises_error(self):
        """Test that initializing without key raises EncryptionError"""
        with pytest.raises(EncryptionError, match="Encryption key is required"):
            EncryptionService(None)

    def test_service_init_with_invalid_key_raises_error(self):
        """Test that initializing with invalid key raises EncryptionError"""
        with pytest.raises(EncryptionError, match="Invalid encryption key"):
            EncryptionService(b"not-a-valid-fernet-key")


class TestEmailEncryption:
    """Tests for email-specific encryption"""

    @pytest.fixture
    def service(self):
        key = Fernet.generate_key()
        return EncryptionService(key)

    def test_encrypt_email(self, service):
        """Test email encryption round trip"""
        email = "user@example.com"
        encrypted = service.encrypt_email(email)
        decrypted = service.decrypt_email(encrypted)
        assert decrypted == email

    def test_encrypt_email_none(self, service):
        """Test that None email returns None"""
        assert service.encrypt_email(None) is None

    def test_decrypt_email_none(self, service):
        """Test that None encrypted email returns None"""
        assert service.decrypt_email(None) is None


class TestPhoneEncryption:
    """Tests for phone-specific encryption"""

    @pytest.fixture
    def service(self):
        key = Fernet.generate_key()
        return EncryptionService(key)

    def test_encrypt_phone(self, service):
        """Test phone encryption round trip"""
        phone = "+12125551234"
        encrypted = service.encrypt_phone(phone)
        decrypted = service.decrypt_phone(encrypted)
        assert decrypted == phone

    def test_encrypt_phone_none(self, service):
        """Test that None phone returns None"""
        assert service.encrypt_phone(None) is None

    def test_decrypt_phone_none(self, service):
        """Test that None encrypted phone returns None"""
        assert service.decrypt_phone(None) is None


class TestGenerateEncryptionKey:
    """Tests for key generation"""

    def test_generate_key_returns_valid_key(self):
        """Test that generated key is valid for Fernet"""
        key_str = generate_encryption_key()
        assert isinstance(key_str, str)
        # Should be base64 encoded
        key_bytes = key_str.encode('utf-8')
        # Should be usable as Fernet key
        fernet = Fernet(key_bytes)
        assert fernet is not None

    def test_generate_key_uniqueness(self):
        """Test that each generated key is unique"""
        keys = [generate_encryption_key() for _ in range(10)]
        assert len(set(keys)) == 10  # All should be unique


class TestGlobalEncryptionService:
    """Tests for global encryption service functions"""

    def test_init_and_get_encryption_service(self):
        """Test initializing and getting global service"""
        key = Fernet.generate_key()
        init_encryption_service(key)
        service = get_encryption_service()
        assert service is not None
        assert isinstance(service, EncryptionService)

    def test_encrypt_pii_convenience_function(self):
        """Test encrypt_pii convenience function"""
        key = Fernet.generate_key()
        init_encryption_service(key)

        plaintext = "sensitive data"
        encrypted = encrypt_pii(plaintext)
        decrypted = decrypt_pii(encrypted)
        assert decrypted == plaintext

    def test_encrypt_pii_none(self):
        """Test encrypt_pii with None"""
        key = Fernet.generate_key()
        init_encryption_service(key)
        assert encrypt_pii(None) is None

    def test_decrypt_pii_none(self):
        """Test decrypt_pii with None"""
        key = Fernet.generate_key()
        init_encryption_service(key)
        assert decrypt_pii(None) is None
