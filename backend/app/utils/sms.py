"""
SMS sending utility

For production, replace with actual SMS service like Twilio, AWS SNS, etc.
Currently logs to console for development/testing.
"""

import logging
from typing import Optional

logger = logging.getLogger(__name__)

async def send_sms(phone_number: str, message: str) -> bool:
    """
    Send SMS to phone number

    Args:
        phone_number: Phone number in E.164 format (e.g., +1234567890)
        message: Message content to send

    Returns:
        bool: True if sent successfully, False otherwise
    """
    try:
        # TODO: Replace with actual SMS service (Twilio, AWS SNS, etc.)
        # For now, just log to console
        logger.info(f"📱 SMS to {phone_number}: {message}")
        print(f"\n{'='*60}")
        print(f"📱 SMS VERIFICATION CODE")
        print(f"{'='*60}")
        print(f"To: {phone_number}")
        print(f"Message: {message}")
        print(f"{'='*60}\n")

        return True
    except Exception as e:
        logger.error(f"Failed to send SMS to {phone_number}: {str(e)}")
        return False


async def send_verification_code(phone_number: str, code: str) -> bool:
    """
    Send verification code via SMS

    Args:
        phone_number: Phone number in E.164 format
        code: Verification code

    Returns:
        bool: True if sent successfully
    """
    message = f"Your Chaski verification code is: {code}. This code will expire in 10 minutes."
    return await send_sms(phone_number, message)
