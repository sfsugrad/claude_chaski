"""
SMS sending utility with Twilio integration

Supports two methods:
1. Twilio Verify API (recommended for OTP verification)
2. Twilio Messaging API (for custom messages)

Falls back to console logging if Twilio is not configured.
"""

import logging
from typing import Optional
from app.config import settings

logger = logging.getLogger(__name__)

# Initialize Twilio client lazily
_twilio_client = None

def get_twilio_client():
    """Get or create Twilio client"""
    global _twilio_client

    if _twilio_client is not None:
        return _twilio_client

    if not settings.TWILIO_ACCOUNT_SID or not settings.TWILIO_AUTH_TOKEN:
        return None

    try:
        from twilio.rest import Client
        _twilio_client = Client(
            settings.TWILIO_ACCOUNT_SID,
            settings.TWILIO_AUTH_TOKEN
        )
        return _twilio_client
    except ImportError:
        logger.warning("Twilio package not installed. Install with: pip install twilio")
        return None
    except Exception as e:
        logger.error(f"Failed to initialize Twilio client: {str(e)}")
        return None


async def send_sms(phone_number: str, message: str) -> bool:
    """
    Send SMS to phone number using Twilio Messaging API

    Args:
        phone_number: Phone number in E.164 format (e.g., +1234567890)
        message: Message content to send

    Returns:
        bool: True if sent successfully, False otherwise
    """
    client = get_twilio_client()

    # Fallback to console logging if Twilio is not configured
    if client is None or not settings.TWILIO_PHONE_NUMBER:
        logger.info(f"📱 SMS to {phone_number}: {message}")
        print(f"\n{'='*60}")
        print(f"📱 SMS VERIFICATION CODE")
        print(f"{'='*60}")
        print(f"To: {phone_number}")
        print(f"Message: {message}")
        print(f"{'='*60}\n")
        return True

    try:
        # Send SMS via Twilio Messaging API
        message_obj = client.messages.create(
            body=message,
            from_=settings.TWILIO_PHONE_NUMBER,
            to=phone_number
        )

        logger.info(f"SMS sent successfully to {phone_number}. SID: {message_obj.sid}")
        return True

    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
        return False


async def send_verification_code(phone_number: str, code: str) -> bool:
    """
    Send verification code via SMS

    Uses Twilio Verify API if configured, otherwise falls back to Messaging API.

    Args:
        phone_number: Phone number in E.164 format
        code: Verification code

    Returns:
        bool: True if sent successfully
    """
    client = get_twilio_client()

    # If Twilio Verify Service is configured, use Verify API (recommended)
    if client is not None and settings.TWILIO_VERIFY_SERVICE_SID:
        try:
            verification = client.verify \
                .v2 \
                .services(settings.TWILIO_VERIFY_SERVICE_SID) \
                .verifications \
                .create(to=phone_number, channel='sms')

            logger.info(f"Verification code sent via Twilio Verify to {phone_number}. Status: {verification.status}")
            return True

        except Exception as e:
            logger.error(f"Failed to send verification via Twilio Verify: {str(e)}")
            # Fall through to regular SMS method

    # Use regular SMS API
    message = f"Your Chaski verification code is: {code}. This code will expire in 10 minutes."
    return await send_sms(phone_number, message)


async def verify_code_with_twilio(phone_number: str, code: str) -> bool:
    """
    Verify code using Twilio Verify API

    Only use this if you're using Twilio Verify API to send codes.
    If using regular SMS, verify codes in your application logic instead.

    Args:
        phone_number: Phone number in E.164 format
        code: Verification code entered by user

    Returns:
        bool: True if verification succeeded
    """
    client = get_twilio_client()

    if client is None or not settings.TWILIO_VERIFY_SERVICE_SID:
        logger.warning("Twilio Verify not configured. Verification must be done in application logic.")
        return False

    try:
        verification_check = client.verify \
            .v2 \
            .services(settings.TWILIO_VERIFY_SERVICE_SID) \
            .verification_checks \
            .create(to=phone_number, code=code)

        logger.info(f"Verification check for {phone_number}: {verification_check.status}")
        return verification_check.status == 'approved'

    except Exception as e:
        logger.error(f"Failed to verify code for {phone_number}: {str(e)}")
        return False
