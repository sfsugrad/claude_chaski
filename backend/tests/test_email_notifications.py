import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from app.utils.email import (
    send_package_matched_email,
    send_package_accepted_email,
    send_package_picked_up_email,
    send_package_in_transit_email,
    send_package_delivered_email,
    send_package_cancelled_email,
    send_package_declined_email,
    send_route_match_found_email,
    _build_email_template,
    EMAIL_STYLES,
)


class TestBuildEmailTemplate:
    """Tests for the email template builder"""

    def test_build_email_template_structure(self):
        """Test that template has correct HTML structure"""
        content = "<p>Test content</p>"
        result = _build_email_template("header-blue", "Test Title", content)

        assert "<!DOCTYPE html>" in result
        assert "<html>" in result
        assert "</html>" in result
        assert "Test Title" in result
        assert "Test content" in result
        assert "header-blue" in result

    def test_build_email_template_includes_styles(self):
        """Test that template includes CSS styles"""
        result = _build_email_template("header-green", "Title", "<p>Content</p>")

        assert "font-family" in result
        assert ".container" in result
        assert ".header" in result
        assert ".content" in result

    def test_build_email_template_different_headers(self):
        """Test different header color classes"""
        for header_class in ["header-blue", "header-green", "header-orange", "header-red", "header-purple"]:
            result = _build_email_template(header_class, "Title", "<p>Content</p>")
            assert header_class in result

    def test_build_email_template_footer(self):
        """Test that template includes footer"""
        result = _build_email_template("header-blue", "Title", "<p>Content</p>")

        assert "automated email" in result.lower()
        assert "footer" in result


class TestEmailStyles:
    """Tests for email styles constant"""

    def test_email_styles_contains_required_classes(self):
        """Test that EMAIL_STYLES has all required CSS classes"""
        assert ".container" in EMAIL_STYLES
        assert ".header" in EMAIL_STYLES
        assert ".header-blue" in EMAIL_STYLES
        assert ".header-green" in EMAIL_STYLES
        assert ".header-orange" in EMAIL_STYLES
        assert ".header-red" in EMAIL_STYLES
        assert ".header-purple" in EMAIL_STYLES
        assert ".content" in EMAIL_STYLES
        assert ".button" in EMAIL_STYLES
        assert ".info-box" in EMAIL_STYLES
        assert ".footer" in EMAIL_STYLES


@pytest.mark.asyncio
class TestSendPackageMatchedEmail:
    """Tests for send_package_matched_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_matched_email_success(self, mock_fm):
        """Test successful package matched email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_matched_email(
            sender_email="sender@example.com",
            sender_name="John Sender",
            courier_name="Jane Courier",
            package_description="Important documents",
            pickup_address="123 Pickup St",
            dropoff_address="456 Dropoff Ave",
            package_id=1
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        # Check the message content
        call_args = mock_fm.send_message.call_args
        message = call_args[0][0]
        assert message.recipients == ["sender@example.com"]
        assert "Matched" in message.subject
        assert "John Sender" in message.body
        assert "Jane Courier" in message.body
        assert "Important documents" in message.body

    @patch('app.utils.email.fm')
    async def test_send_package_matched_email_failure(self, mock_fm):
        """Test package matched email failure handling"""
        mock_fm.send_message = AsyncMock(side_effect=Exception("SMTP error"))

        result = await send_package_matched_email(
            sender_email="sender@example.com",
            sender_name="John",
            courier_name="Jane",
            package_description="Package",
            pickup_address="Pickup",
            dropoff_address="Dropoff",
            package_id=1
        )

        assert result is False


@pytest.mark.asyncio
class TestSendPackageAcceptedEmail:
    """Tests for send_package_accepted_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_accepted_email_success(self, mock_fm):
        """Test successful package accepted email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_accepted_email(
            sender_email="sender@example.com",
            sender_name="John Sender",
            courier_name="Jane Courier",
            courier_phone="+1234567890",
            package_description="Electronics",
            package_id=2
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "Accepted" in message.subject
        assert "+1234567890" in message.body

    @patch('app.utils.email.fm')
    async def test_send_package_accepted_email_no_phone(self, mock_fm):
        """Test package accepted email when courier has no phone"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_accepted_email(
            sender_email="sender@example.com",
            sender_name="John",
            courier_name="Jane",
            courier_phone=None,
            package_description="Package",
            package_id=2
        )

        assert result is True
        message = mock_fm.send_message.call_args[0][0]
        assert "Not provided" in message.body


@pytest.mark.asyncio
class TestSendPackagePickedUpEmail:
    """Tests for send_package_picked_up_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_picked_up_email_success(self, mock_fm):
        """Test successful package picked up email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_picked_up_email(
            sender_email="sender@example.com",
            sender_name="John Sender",
            courier_name="Jane Courier",
            package_description="Fragile items",
            dropoff_address="789 Destination Blvd",
            package_id=3
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "Picked Up" in message.subject
        assert "789 Destination Blvd" in message.body

    @patch('app.utils.email.fm')
    async def test_send_package_picked_up_email_failure(self, mock_fm):
        """Test package picked up email failure"""
        mock_fm.send_message = AsyncMock(side_effect=Exception("Connection error"))

        result = await send_package_picked_up_email(
            sender_email="sender@example.com",
            sender_name="John",
            courier_name="Jane",
            package_description="Package",
            dropoff_address="Address",
            package_id=3
        )

        assert result is False


@pytest.mark.asyncio
class TestSendPackageInTransitEmail:
    """Tests for send_package_in_transit_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_in_transit_email_success(self, mock_fm):
        """Test successful package in transit email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_in_transit_email(
            sender_email="sender@example.com",
            sender_name="John Sender",
            package_description="Books",
            dropoff_address="Library Lane",
            package_id=4
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "In Transit" in message.subject
        assert "Books" in message.body


@pytest.mark.asyncio
class TestSendPackageDeliveredEmail:
    """Tests for send_package_delivered_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_delivered_email_success(self, mock_fm):
        """Test successful package delivered email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_delivered_email(
            sender_email="sender@example.com",
            sender_name="John Sender",
            package_description="Gift package",
            dropoff_address="100 Happy St",
            courier_name="Jane Courier",
            package_id=5
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "Delivered" in message.subject
        assert "Gift package" in message.body
        assert "100 Happy St" in message.body
        assert "Jane Courier" in message.body

    @patch('app.utils.email.fm')
    async def test_send_package_delivered_email_includes_rating_cta(self, mock_fm):
        """Test that delivered email includes rating call-to-action"""
        mock_fm.send_message = AsyncMock(return_value=None)

        await send_package_delivered_email(
            sender_email="sender@example.com",
            sender_name="John",
            package_description="Package",
            dropoff_address="Address",
            courier_name="Jane",
            package_id=5
        )

        message = mock_fm.send_message.call_args[0][0]
        assert "Rate" in message.body


@pytest.mark.asyncio
class TestSendPackageCancelledEmail:
    """Tests for send_package_cancelled_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_cancelled_email_success(self, mock_fm):
        """Test successful package cancelled email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_cancelled_email(
            recipient_email="user@example.com",
            recipient_name="John User",
            package_description="Cancelled package",
            cancellation_reason="Sender request",
            package_id=6
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "Cancelled" in message.subject
        assert "Sender request" in message.body

    @patch('app.utils.email.fm')
    async def test_send_package_cancelled_email_no_reason(self, mock_fm):
        """Test package cancelled email without reason"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_cancelled_email(
            recipient_email="user@example.com",
            recipient_name="John",
            package_description="Package",
            cancellation_reason=None,
            package_id=6
        )

        assert result is True
        message = mock_fm.send_message.call_args[0][0]
        # Should not contain "Reason:" when no reason provided
        assert "Reason:" not in message.body or "None" not in message.body


@pytest.mark.asyncio
class TestSendPackageDeclinedEmail:
    """Tests for send_package_declined_email function"""

    @patch('app.utils.email.fm')
    async def test_send_package_declined_email_success(self, mock_fm):
        """Test successful package declined email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_package_declined_email(
            sender_email="sender@example.com",
            sender_name="John Sender",
            package_description="Time-sensitive documents",
            package_id=7
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "sender@example.com" in message.recipients
        assert "declined" in message.body.lower()
        assert "back in the queue" in message.body.lower()

    @patch('app.utils.email.fm')
    async def test_send_package_declined_email_failure(self, mock_fm):
        """Test package declined email failure"""
        mock_fm.send_message = AsyncMock(side_effect=Exception("Error"))

        result = await send_package_declined_email(
            sender_email="sender@example.com",
            sender_name="John",
            package_description="Package",
            package_id=7
        )

        assert result is False


@pytest.mark.asyncio
class TestSendRouteMatchFoundEmail:
    """Tests for send_route_match_found_email function"""

    @patch('app.utils.email.fm')
    async def test_send_route_match_found_email_success(self, mock_fm):
        """Test successful route match found email"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_route_match_found_email(
            courier_email="courier@example.com",
            courier_name="Jane Courier",
            matching_packages_count=5,
            route_origin="New York",
            route_destination="Boston"
        )

        assert result is True
        mock_fm.send_message.assert_called_once()

        message = mock_fm.send_message.call_args[0][0]
        assert "courier@example.com" in message.recipients
        assert "5" in message.subject
        assert "New York" in message.body
        assert "Boston" in message.body

    @patch('app.utils.email.fm')
    async def test_send_route_match_found_email_single_package(self, mock_fm):
        """Test route match found email with single package"""
        mock_fm.send_message = AsyncMock(return_value=None)

        result = await send_route_match_found_email(
            courier_email="courier@example.com",
            courier_name="Jane",
            matching_packages_count=1,
            route_origin="A",
            route_destination="B"
        )

        assert result is True
        message = mock_fm.send_message.call_args[0][0]
        assert "1" in message.subject

    @patch('app.utils.email.fm')
    async def test_send_route_match_found_email_failure(self, mock_fm):
        """Test route match found email failure"""
        mock_fm.send_message = AsyncMock(side_effect=Exception("SMTP error"))

        result = await send_route_match_found_email(
            courier_email="courier@example.com",
            courier_name="Jane",
            matching_packages_count=3,
            route_origin="A",
            route_destination="B"
        )

        assert result is False


@pytest.mark.asyncio
class TestEmailContentValidation:
    """Tests to validate email content requirements"""

    @patch('app.utils.email.fm')
    async def test_all_emails_include_frontend_links(self, mock_fm):
        """Test that all package-related emails include links to frontend"""
        mock_fm.send_message = AsyncMock(return_value=None)

        # Test package matched
        await send_package_matched_email(
            "test@test.com", "Test", "Courier", "Pkg", "A", "B", 1
        )
        assert "/packages/1" in mock_fm.send_message.call_args[0][0].body

        # Test package accepted
        await send_package_accepted_email(
            "test@test.com", "Test", "Courier", "123", "Pkg", 2
        )
        assert "/packages/2" in mock_fm.send_message.call_args[0][0].body

        # Test package delivered
        await send_package_delivered_email(
            "test@test.com", "Test", "Pkg", "Addr", "Courier", 3
        )
        assert "/packages/3" in mock_fm.send_message.call_args[0][0].body

    @patch('app.utils.email.fm')
    async def test_route_match_email_includes_dashboard_link(self, mock_fm):
        """Test that route match email includes courier dashboard link"""
        mock_fm.send_message = AsyncMock(return_value=None)

        await send_route_match_found_email(
            "courier@test.com", "Courier", 5, "A", "B"
        )

        message = mock_fm.send_message.call_args[0][0]
        assert "/courier/dashboard" in message.body

    @patch('app.utils.email.fm')
    async def test_all_emails_are_html_type(self, mock_fm):
        """Test that all emails are sent as HTML"""
        from fastapi_mail import MessageType
        mock_fm.send_message = AsyncMock(return_value=None)

        await send_package_matched_email(
            "test@test.com", "Test", "Courier", "Pkg", "A", "B", 1
        )

        message = mock_fm.send_message.call_args[0][0]
        assert message.subtype == MessageType.html
