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
