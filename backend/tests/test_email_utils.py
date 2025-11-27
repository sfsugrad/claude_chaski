"""Tests for app/utils/email.py - Email utility functions"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
import re

from app.utils.email import (
    generate_verification_token,
    send_verification_email,
    send_welcome_email,
    send_package_matched_email,
    send_package_accepted_email,
    send_package_picked_up_email,
    send_package_in_transit_email,
    send_package_delivered_email,
    send_package_cancelled_email,
    send_route_match_found_email,
    send_package_declined_email,
    _build_email_template,
    EMAIL_STYLES
)


class TestGenerateVerificationToken:
    """Tests for verification token generation"""

    def test_generates_token(self):
        """Test that a token is generated"""
        token = generate_verification_token()
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_length(self):
        """Test that token has appropriate length"""
        token = generate_verification_token()
        # token_urlsafe(32) produces ~43 characters
        assert len(token) >= 40

    def test_tokens_are_unique(self):
        """Test that multiple tokens are unique"""
        tokens = [generate_verification_token() for _ in range(100)]
        unique_tokens = set(tokens)
        assert len(unique_tokens) == 100

    def test_token_is_url_safe(self):
        """Test that token only contains URL-safe characters"""
        token = generate_verification_token()
        # URL-safe base64 uses only alphanumeric, hyphen, and underscore
        assert re.match(r'^[A-Za-z0-9_-]+$', token)


class TestBuildEmailTemplate:
    """Tests for email template builder"""

    def test_builds_template_with_content(self):
        """Test that template includes content"""
        content = "<p>Test content</p>"
        html = _build_email_template("header-blue", "Test Title", content)

        assert "Test content" in html
        assert "Test Title" in html

    def test_includes_header_class(self):
        """Test that template includes header class"""
        html = _build_email_template("header-green", "Title", "Content")
        assert "header-green" in html

    def test_includes_styles(self):
        """Test that template includes styles"""
        html = _build_email_template("header-blue", "Title", "Content")
        assert "font-family" in html  # Part of EMAIL_STYLES

    def test_includes_footer(self):
        """Test that template includes footer"""
        html = _build_email_template("header-blue", "Title", "Content")
        assert "automated email" in html.lower()

    def test_proper_html_structure(self):
        """Test that template has proper HTML structure"""
        html = _build_email_template("header-blue", "Title", "Content")
        assert "<!DOCTYPE html>" in html
        assert "<html>" in html
        assert "</html>" in html
        assert "<body>" in html
        assert "</body>" in html


class TestEmailStyles:
    """Tests for EMAIL_STYLES constant"""

    def test_styles_exist(self):
        """Test that EMAIL_STYLES is defined"""
        assert EMAIL_STYLES is not None
        assert isinstance(EMAIL_STYLES, str)

    def test_styles_contain_required_classes(self):
        """Test that styles contain required CSS classes"""
        assert ".container" in EMAIL_STYLES
        assert ".header" in EMAIL_STYLES
        assert ".content" in EMAIL_STYLES
        assert ".button" in EMAIL_STYLES
        assert ".footer" in EMAIL_STYLES

    def test_styles_contain_color_variants(self):
        """Test that styles contain color variants"""
        assert "header-blue" in EMAIL_STYLES
        assert "header-green" in EMAIL_STYLES
        assert "header-orange" in EMAIL_STYLES
        assert "header-red" in EMAIL_STYLES
        assert "header-purple" in EMAIL_STYLES


class TestSendVerificationEmail:
    """Tests for send_verification_email function"""

    @pytest.mark.asyncio
    async def test_send_verification_email_success(self):
        """Test successful verification email sending"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_verification_email(
                email="test@example.com",
                token="test_token_123",
                full_name="John Doe"
            )

            assert result is True
            mock_fm.send_message.assert_called_once()

    @pytest.mark.asyncio
    async def test_send_verification_email_failure(self):
        """Test verification email sending failure"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(side_effect=Exception("SMTP Error"))

            result = await send_verification_email(
                email="test@example.com",
                token="test_token_123",
                full_name="John Doe"
            )

            assert result is False

    @pytest.mark.asyncio
    async def test_verification_email_content(self):
        """Test verification email contains required content"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            await send_verification_email(
                email="test@example.com",
                token="my_token",
                full_name="Jane Smith"
            )

            # Get the message that was sent
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]

            assert "test@example.com" in message.recipients
            assert "Verify" in message.subject
            assert "Jane Smith" in message.body
            assert "my_token" in message.body


class TestSendWelcomeEmail:
    """Tests for send_welcome_email function"""

    @pytest.mark.asyncio
    async def test_send_welcome_email_success(self):
        """Test successful welcome email sending"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_welcome_email(
                email="test@example.com",
                full_name="John Doe"
            )

            assert result is True

    @pytest.mark.asyncio
    async def test_send_welcome_email_failure(self):
        """Test welcome email sending failure"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(side_effect=Exception("SMTP Error"))

            result = await send_welcome_email(
                email="test@example.com",
                full_name="John Doe"
            )

            assert result is False


class TestPackageEmailFunctions:
    """Tests for package-related email functions"""

    @pytest.mark.asyncio
    async def test_send_package_matched_email(self):
        """Test package matched email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_matched_email(
                sender_email="sender@example.com",
                sender_name="Sender",
                courier_name="Courier",
                package_description="Test package",
                pickup_address="123 Pickup St",
                dropoff_address="456 Dropoff Ave",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Matched" in message.subject
            assert "Test package" in message.body
            assert "Courier" in message.body

    @pytest.mark.asyncio
    async def test_send_package_accepted_email(self):
        """Test package accepted email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_accepted_email(
                sender_email="sender@example.com",
                sender_name="Sender",
                courier_name="Courier",
                courier_phone="555-1234",
                package_description="Test package",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Accepted" in message.subject
            assert "555-1234" in message.body

    @pytest.mark.asyncio
    async def test_send_package_picked_up_email(self):
        """Test package picked up email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_picked_up_email(
                sender_email="sender@example.com",
                sender_name="Sender",
                courier_name="Courier",
                package_description="Test package",
                dropoff_address="456 Dropoff Ave",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Picked Up" in message.subject

    @pytest.mark.asyncio
    async def test_send_package_in_transit_email(self):
        """Test package in transit email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_in_transit_email(
                sender_email="sender@example.com",
                sender_name="Sender",
                package_description="Test package",
                dropoff_address="456 Dropoff Ave",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Transit" in message.subject

    @pytest.mark.asyncio
    async def test_send_package_delivered_email(self):
        """Test package delivered email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_delivered_email(
                sender_email="sender@example.com",
                sender_name="Sender",
                package_description="Test package",
                dropoff_address="456 Dropoff Ave",
                courier_name="Courier",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Delivered" in message.subject

    @pytest.mark.asyncio
    async def test_send_package_cancelled_email(self):
        """Test package cancelled email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_cancelled_email(
                recipient_email="user@example.com",
                recipient_name="User",
                package_description="Test package",
                cancellation_reason="Changed plans",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Cancelled" in message.subject
            assert "Changed plans" in message.body

    @pytest.mark.asyncio
    async def test_send_package_cancelled_email_no_reason(self):
        """Test package cancelled email without reason"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_cancelled_email(
                recipient_email="user@example.com",
                recipient_name="User",
                package_description="Test package"
            )

            assert result is True

    @pytest.mark.asyncio
    async def test_send_package_declined_email(self):
        """Test package declined email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_package_declined_email(
                sender_email="sender@example.com",
                sender_name="Sender",
                package_description="Test package",
                package_id=1
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "Update" in message.subject or "Declined" in message.body


class TestCourierEmailFunctions:
    """Tests for courier-related email functions"""

    @pytest.mark.asyncio
    async def test_send_route_match_found_email(self):
        """Test route match found email"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(return_value=None)

            result = await send_route_match_found_email(
                courier_email="courier@example.com",
                courier_name="Courier",
                matching_packages_count=5,
                route_origin="City A",
                route_destination="City B"
            )

            assert result is True
            call_args = mock_fm.send_message.call_args
            message = call_args[0][0]
            assert "5" in message.subject
            assert "City A" in message.body
            assert "City B" in message.body


class TestEmailFailureHandling:
    """Tests for email failure handling"""

    @pytest.mark.asyncio
    async def test_all_functions_handle_exceptions_gracefully(self):
        """Test that all email functions return False on exception"""
        with patch('app.utils.email.fm') as mock_fm:
            mock_fm.send_message = AsyncMock(side_effect=Exception("SMTP Error"))

            # Test all email functions
            assert await send_verification_email("e@e.com", "t", "n") is False
            assert await send_welcome_email("e@e.com", "n") is False
            assert await send_package_matched_email("e@e.com", "n", "c", "d", "p", "d", 1) is False
            assert await send_package_accepted_email("e@e.com", "n", "c", "p", "d", 1) is False
            assert await send_package_picked_up_email("e@e.com", "n", "c", "d", "a", 1) is False
            assert await send_package_in_transit_email("e@e.com", "n", "d", "a", 1) is False
            assert await send_package_delivered_email("e@e.com", "n", "d", "a", "c", 1) is False
            assert await send_package_cancelled_email("e@e.com", "n", "d") is False
            assert await send_route_match_found_email("e@e.com", "n", 1, "o", "d") is False
            assert await send_package_declined_email("e@e.com", "n", "d", 1) is False
