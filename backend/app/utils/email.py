from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from app.config import settings
from typing import List
import secrets

# Email configuration
conf = ConnectionConfig(
    MAIL_USERNAME=settings.MAIL_USERNAME,
    MAIL_PASSWORD=settings.MAIL_PASSWORD,
    MAIL_FROM=settings.MAIL_FROM,
    MAIL_PORT=settings.MAIL_PORT,
    MAIL_SERVER=settings.MAIL_SERVER,
    MAIL_FROM_NAME=settings.MAIL_FROM_NAME,
    MAIL_STARTTLS=settings.MAIL_STARTTLS,
    MAIL_SSL_TLS=settings.MAIL_SSL_TLS,
    USE_CREDENTIALS=settings.USE_CREDENTIALS,
    VALIDATE_CERTS=settings.VALIDATE_CERTS
)

fm = FastMail(conf)


def generate_verification_token() -> str:
    """Generate a secure random verification token"""
    return secrets.token_urlsafe(32)


async def send_verification_email(email: str, token: str, full_name: str):
    """
    Send email verification link to user

    Args:
        email: User's email address
        token: Verification token
        full_name: User's full name
    """
    verification_url = f"{settings.FRONTEND_URL}/verify-email?token={token}"

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background-color: #3b82f6;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
            }}
            .content {{
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 5px 5px;
            }}
            .button {{
                display: inline-block;
                padding: 12px 30px;
                background-color: #3b82f6;
                color: white;
                text-decoration: none;
                border-radius: 5px;
                margin: 20px 0;
            }}
            .footer {{
                text-align: center;
                margin-top: 20px;
                color: #666;
                font-size: 12px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Welcome to Chaski!</h1>
            </div>
            <div class="content">
                <p>Hi {full_name},</p>
                <p>Thank you for registering with Chaski! We're excited to have you on board.</p>
                <p>To complete your registration and verify your email address, please click the button below:</p>
                <div style="text-align: center;">
                    <a href="{verification_url}" class="button">Verify Email Address</a>
                </div>
                <p>Or copy and paste this link into your browser:</p>
                <p style="word-break: break-all; color: #3b82f6;">{verification_url}</p>
                <p>This link will expire in 24 hours for security reasons.</p>
                <p>If you didn't create an account with Chaski, please ignore this email.</p>
                <p>Best regards,<br>The Chaski Team</p>
            </div>
            <div class="footer">
                <p>This is an automated email, please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Verify Your Email - Chaski",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        return False


async def send_welcome_email(email: str, full_name: str):
    """
    Send welcome email after successful verification

    Args:
        email: User's email address
        full_name: User's full name
    """
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{
                font-family: Arial, sans-serif;
                line-height: 1.6;
                color: #333;
            }}
            .container {{
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
            }}
            .header {{
                background-color: #10b981;
                color: white;
                padding: 20px;
                text-align: center;
                border-radius: 5px 5px 0 0;
            }}
            .content {{
                background-color: #f9fafb;
                padding: 30px;
                border-radius: 0 0 5px 5px;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>Email Verified Successfully!</h1>
            </div>
            <div class="content">
                <p>Hi {full_name},</p>
                <p>Your email has been verified successfully! You can now access all features of Chaski.</p>
                <p>Start exploring:</p>
                <ul>
                    <li>Send packages to your destination</li>
                    <li>Earn money by delivering packages along your route</li>
                    <li>Track your deliveries in real-time</li>
                </ul>
                <p>Best regards,<br>The Chaski Team</p>
            </div>
        </div>
    </body>
    </html>
    """

    message = MessageSchema(
        subject="Welcome to Chaski!",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending welcome email: {e}")
        return False


# Email template base styles
EMAIL_STYLES = """
    body {
        font-family: Arial, sans-serif;
        line-height: 1.6;
        color: #333;
    }
    .container {
        max-width: 600px;
        margin: 0 auto;
        padding: 20px;
    }
    .header {
        padding: 20px;
        text-align: center;
        border-radius: 5px 5px 0 0;
    }
    .header-blue { background-color: #3b82f6; color: white; }
    .header-green { background-color: #10b981; color: white; }
    .header-orange { background-color: #f59e0b; color: white; }
    .header-red { background-color: #ef4444; color: white; }
    .header-purple { background-color: #8b5cf6; color: white; }
    .content {
        background-color: #f9fafb;
        padding: 30px;
        border-radius: 0 0 5px 5px;
    }
    .button {
        display: inline-block;
        padding: 12px 30px;
        background-color: #3b82f6;
        color: white;
        text-decoration: none;
        border-radius: 5px;
        margin: 20px 0;
    }
    .info-box {
        background-color: #e0f2fe;
        border-left: 4px solid #3b82f6;
        padding: 15px;
        margin: 15px 0;
    }
    .footer {
        text-align: center;
        margin-top: 20px;
        color: #666;
        font-size: 12px;
    }
"""


def _build_email_template(header_class: str, title: str, content: str) -> str:
    """Build a consistent email template"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>{EMAIL_STYLES}</style>
    </head>
    <body>
        <div class="container">
            <div class="header {header_class}">
                <h1>{title}</h1>
            </div>
            <div class="content">
                {content}
            </div>
            <div class="footer">
                <p>This is an automated email from Chaski. Please do not reply.</p>
            </div>
        </div>
    </body>
    </html>
    """


async def send_package_matched_email(
    sender_email: str,
    sender_name: str,
    courier_name: str,
    package_description: str,
    pickup_address: str,
    dropoff_address: str,
    package_id: int
):
    """
    Send notification to sender when their package is matched with a courier

    Args:
        sender_email: Sender's email address
        sender_name: Sender's full name
        courier_name: Courier's full name
        package_description: Description of the package
        pickup_address: Pickup address
        dropoff_address: Dropoff address
        package_id: Package ID for tracking
    """
    package_url = f"{settings.FRONTEND_URL}/packages/{package_id}"

    content = f"""
        <p>Hi {sender_name},</p>
        <p>Great news! Your package has been matched with a courier.</p>
        <div class="info-box">
            <strong>Package Details:</strong><br>
            <strong>Description:</strong> {package_description}<br>
            <strong>Courier:</strong> {courier_name}<br>
            <strong>Pickup:</strong> {pickup_address}<br>
            <strong>Dropoff:</strong> {dropoff_address}
        </div>
        <p>The courier will contact you soon to arrange pickup.</p>
        <div style="text-align: center;">
            <a href="{package_url}" class="button">View Package Details</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-blue", "Package Matched!", content)

    message = MessageSchema(
        subject=f"Your Package Has Been Matched - Chaski",
        recipients=[sender_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package matched email: {e}")
        return False


async def send_package_accepted_email(
    sender_email: str,
    sender_name: str,
    courier_name: str,
    courier_phone: str,
    package_description: str,
    package_id: int
):
    """
    Send notification to sender when courier accepts their package

    Args:
        sender_email: Sender's email address
        sender_name: Sender's full name
        courier_name: Courier's full name
        courier_phone: Courier's phone number
        package_description: Description of the package
        package_id: Package ID
    """
    package_url = f"{settings.FRONTEND_URL}/packages/{package_id}"

    content = f"""
        <p>Hi {sender_name},</p>
        <p>Your package has been accepted by the courier!</p>
        <div class="info-box">
            <strong>Package:</strong> {package_description}<br>
            <strong>Courier:</strong> {courier_name}<br>
            <strong>Courier Phone:</strong> {courier_phone if courier_phone else 'Not provided'}
        </div>
        <p>Please prepare your package for pickup. The courier will contact you to confirm the pickup time.</p>
        <div style="text-align: center;">
            <a href="{package_url}" class="button">Track Your Package</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-green", "Package Accepted!", content)

    message = MessageSchema(
        subject=f"Courier Accepted Your Package - Chaski",
        recipients=[sender_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package accepted email: {e}")
        return False


async def send_package_picked_up_email(
    sender_email: str,
    sender_name: str,
    courier_name: str,
    package_description: str,
    dropoff_address: str,
    package_id: int
):
    """
    Send notification to sender when package is picked up

    Args:
        sender_email: Sender's email address
        sender_name: Sender's full name
        courier_name: Courier's full name
        package_description: Description of the package
        dropoff_address: Dropoff address
        package_id: Package ID
    """
    package_url = f"{settings.FRONTEND_URL}/packages/{package_id}"

    content = f"""
        <p>Hi {sender_name},</p>
        <p>Your package has been picked up and is on its way!</p>
        <div class="info-box">
            <strong>Package:</strong> {package_description}<br>
            <strong>Courier:</strong> {courier_name}<br>
            <strong>Destination:</strong> {dropoff_address}
        </div>
        <p>You can track your package status in real-time.</p>
        <div style="text-align: center;">
            <a href="{package_url}" class="button">Track Your Package</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-orange", "Package Picked Up!", content)

    message = MessageSchema(
        subject=f"Your Package Has Been Picked Up - Chaski",
        recipients=[sender_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package picked up email: {e}")
        return False


async def send_package_in_transit_email(
    sender_email: str,
    sender_name: str,
    package_description: str,
    dropoff_address: str,
    package_id: int
):
    """
    Send notification to sender when package is in transit

    Args:
        sender_email: Sender's email address
        sender_name: Sender's full name
        package_description: Description of the package
        dropoff_address: Dropoff address
        package_id: Package ID
    """
    package_url = f"{settings.FRONTEND_URL}/packages/{package_id}"

    content = f"""
        <p>Hi {sender_name},</p>
        <p>Your package is now in transit to its destination!</p>
        <div class="info-box">
            <strong>Package:</strong> {package_description}<br>
            <strong>Destination:</strong> {dropoff_address}
        </div>
        <p>The recipient will be notified when the package arrives.</p>
        <div style="text-align: center;">
            <a href="{package_url}" class="button">Track Your Package</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-blue", "Package In Transit", content)

    message = MessageSchema(
        subject=f"Your Package Is In Transit - Chaski",
        recipients=[sender_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package in transit email: {e}")
        return False


async def send_package_delivered_email(
    sender_email: str,
    sender_name: str,
    package_description: str,
    dropoff_address: str,
    courier_name: str,
    package_id: int
):
    """
    Send notification to sender when package is delivered

    Args:
        sender_email: Sender's email address
        sender_name: Sender's full name
        package_description: Description of the package
        dropoff_address: Dropoff address
        courier_name: Courier's full name
        package_id: Package ID
    """
    package_url = f"{settings.FRONTEND_URL}/packages/{package_id}"

    content = f"""
        <p>Hi {sender_name},</p>
        <p>Great news! Your package has been delivered successfully!</p>
        <div class="info-box">
            <strong>Package:</strong> {package_description}<br>
            <strong>Delivered to:</strong> {dropoff_address}<br>
            <strong>Delivered by:</strong> {courier_name}
        </div>
        <p>Thank you for using Chaski! We'd love to hear about your experience.</p>
        <div style="text-align: center;">
            <a href="{package_url}" class="button">Rate Your Experience</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-green", "Package Delivered!", content)

    message = MessageSchema(
        subject=f"Your Package Has Been Delivered - Chaski",
        recipients=[sender_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package delivered email: {e}")
        return False


async def send_package_cancelled_email(
    recipient_email: str,
    recipient_name: str,
    package_description: str,
    cancellation_reason: str = None,
    package_id: int = None
):
    """
    Send notification when a package is cancelled

    Args:
        recipient_email: Recipient's email address
        recipient_name: Recipient's full name
        package_description: Description of the package
        cancellation_reason: Optional reason for cancellation
        package_id: Package ID
    """
    reason_text = f"<br><strong>Reason:</strong> {cancellation_reason}" if cancellation_reason else ""

    content = f"""
        <p>Hi {recipient_name},</p>
        <p>A package delivery has been cancelled.</p>
        <div class="info-box">
            <strong>Package:</strong> {package_description}{reason_text}
        </div>
        <p>If you have any questions, please contact our support team.</p>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-red", "Package Cancelled", content)

    message = MessageSchema(
        subject=f"Package Delivery Cancelled - Chaski",
        recipients=[recipient_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package cancelled email: {e}")
        return False


async def send_route_match_found_email(
    courier_email: str,
    courier_name: str,
    matching_packages_count: int,
    route_origin: str,
    route_destination: str
):
    """
    Send notification to courier when packages are found along their route

    Args:
        courier_email: Courier's email address
        courier_name: Courier's full name
        matching_packages_count: Number of matching packages
        route_origin: Route starting point
        route_destination: Route ending point
    """
    dashboard_url = f"{settings.FRONTEND_URL}/courier/dashboard"

    content = f"""
        <p>Hi {courier_name},</p>
        <p>We found packages that match your route!</p>
        <div class="info-box">
            <strong>Route:</strong> {route_origin} → {route_destination}<br>
            <strong>Matching Packages:</strong> {matching_packages_count}
        </div>
        <p>Check your dashboard to view and accept these packages.</p>
        <div style="text-align: center;">
            <a href="{dashboard_url}" class="button">View Matching Packages</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-purple", "Packages Found Along Your Route!", content)

    message = MessageSchema(
        subject=f"{matching_packages_count} Package(s) Found Along Your Route - Chaski",
        recipients=[courier_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending route match found email: {e}")
        return False


async def send_package_declined_email(
    sender_email: str,
    sender_name: str,
    package_description: str,
    package_id: int
):
    """
    Send notification to sender when courier declines their package

    Args:
        sender_email: Sender's email address
        sender_name: Sender's full name
        package_description: Description of the package
        package_id: Package ID
    """
    package_url = f"{settings.FRONTEND_URL}/packages/{package_id}"

    content = f"""
        <p>Hi {sender_name},</p>
        <p>Unfortunately, the matched courier has declined your package.</p>
        <div class="info-box">
            <strong>Package:</strong> {package_description}
        </div>
        <p>Don't worry! Your package is back in the queue and we'll find another courier for you soon.</p>
        <div style="text-align: center;">
            <a href="{package_url}" class="button">View Package Status</a>
        </div>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-orange", "Courier Declined Package", content)

    message = MessageSchema(
        subject=f"Package Match Update - Chaski",
        recipients=[sender_email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending package declined email: {e}")
        return False


async def send_password_reset_email(email: str, token: str, full_name: str):
    """
    Send password reset link to user

    Args:
        email: User's email address
        token: Password reset token
        full_name: User's full name
    """
    reset_url = f"{settings.FRONTEND_URL}/reset-password?token={token}"

    content = f"""
        <p>Hi {full_name},</p>
        <p>We received a request to reset your password for your Chaski account.</p>
        <p>Click the button below to reset your password:</p>
        <div style="text-align: center;">
            <a href="{reset_url}" class="button">Reset Password</a>
        </div>
        <p>Or copy and paste this link into your browser:</p>
        <p style="word-break: break-all; color: #3b82f6;">{reset_url}</p>
        <p>This link will expire in 1 hour for security reasons.</p>
        <p>If you didn't request a password reset, please ignore this email. Your password will remain unchanged.</p>
        <p>Best regards,<br>The Chaski Team</p>
    """

    html_content = _build_email_template("header-blue", "Reset Your Password", content)

    message = MessageSchema(
        subject="Reset Your Password - Chaski",
        recipients=[email],
        body=html_content,
        subtype=MessageType.html
    )

    try:
        await fm.send_message(message)
        return True
    except Exception as e:
        print(f"Error sending password reset email: {e}")
        return False
