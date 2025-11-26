import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.utils.email import (
    generate_verification_token,
    send_verification_email,
    send_welcome_email,
)


class TestGenerateVerificationToken:
    """Tests for verification token generation"""

    def test_generates_token(self):
        """Test that a token is generated"""
        token = generate_verification_token()
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_generates_unique_tokens(self):
        """Test that each call generates a unique token"""
        token1 = generate_verification_token()
        token2 = generate_verification_token()
        assert token1 != token2

    def test_token_is_url_safe(self):
        """Test that token is URL-safe"""
        token = generate_verification_token()
        # URL-safe tokens should only contain alphanumeric, dash, and underscore
        assert all(c.isalnum() or c in "-_" for c in token)


class TestSendVerificationEmail:
    """Tests for sending verification emails"""

    @pytest.mark.asyncio
    async def test_send_verification_email_success(self):
        """Test successful verification email sending"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            result = await send_verification_email(
                email="test@example.com",
                token="test-token-123",
                full_name="Test User"
            )

            assert result is True
            mock_send.assert_called_once()

            # Verify the message schema
            call_args = mock_send.call_args
            message = call_args[0][0]
            assert message.subject == "Verify Your Email - Chaski"
            assert "test@example.com" in message.recipients
            assert "Test User" in message.body
            assert "test-token-123" in message.body
            assert "Verify Email Address" in message.body

    @pytest.mark.asyncio
    async def test_send_verification_email_includes_frontend_url(self):
        """Test that verification email includes the frontend URL"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            await send_verification_email(
                email="test@example.com",
                token="test-token-123",
                full_name="Test User"
            )

            call_args = mock_send.call_args
            message = call_args[0][0]
            # Should contain verification URL
            assert "/verify-email?token=test-token-123" in message.body

    @pytest.mark.asyncio
    async def test_send_verification_email_failure(self):
        """Test handling of email sending failure"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.side_effect = Exception("SMTP error")

            result = await send_verification_email(
                email="test@example.com",
                token="test-token-123",
                full_name="Test User"
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_send_verification_email_with_special_characters(self):
        """Test sending email with special characters in name"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            result = await send_verification_email(
                email="test@example.com",
                token="test-token-123",
                full_name="José García-López"
            )

            assert result is True
            call_args = mock_send.call_args
            message = call_args[0][0]
            assert "José García-López" in message.body


class TestSendWelcomeEmail:
    """Tests for sending welcome emails"""

    @pytest.mark.asyncio
    async def test_send_welcome_email_success(self):
        """Test successful welcome email sending"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            result = await send_welcome_email(
                email="test@example.com",
                full_name="Test User"
            )

            assert result is True
            mock_send.assert_called_once()

            # Verify the message schema
            call_args = mock_send.call_args
            message = call_args[0][0]
            assert message.subject == "Welcome to Chaski!"
            assert "test@example.com" in message.recipients
            assert "Test User" in message.body
            assert "Email Verified Successfully" in message.body

    @pytest.mark.asyncio
    async def test_send_welcome_email_includes_features(self):
        """Test that welcome email includes feature highlights"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            await send_welcome_email(
                email="test@example.com",
                full_name="Test User"
            )

            call_args = mock_send.call_args
            message = call_args[0][0]
            # Should mention key features
            assert "Send packages" in message.body or "packages" in message.body
            assert "deliver" in message.body.lower()

    @pytest.mark.asyncio
    async def test_send_welcome_email_failure(self):
        """Test handling of welcome email sending failure"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.side_effect = Exception("SMTP error")

            result = await send_welcome_email(
                email="test@example.com",
                full_name="Test User"
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_send_welcome_email_with_long_name(self):
        """Test sending welcome email with very long name"""
        with patch("app.utils.email.fm.send_message", new_callable=AsyncMock) as mock_send:
            mock_send.return_value = None

            long_name = "A" * 100
            result = await send_welcome_email(
                email="test@example.com",
                full_name=long_name
            )

            assert result is True
            call_args = mock_send.call_args
            message = call_args[0][0]
            assert long_name in message.body
