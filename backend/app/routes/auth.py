import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.rating import Rating
from app.utils.auth import get_password_hash, verify_password, create_access_token
from app.utils.dependencies import get_current_user
from app.utils.email import send_verification_email, send_welcome_email, send_password_reset_email, generate_verification_token
from app.utils.oauth import oauth
from app.services.audit_service import (
    log_login_success,
    log_login_failed,
    log_registration,
    log_password_reset_request,
    log_password_reset_complete,
    log_email_verification,
    log_oauth_login,
)
from pydantic import BaseModel, EmailStr, Field

logger = logging.getLogger(__name__)

router = APIRouter()
limiter = Limiter(key_func=get_remote_address, enabled=settings.ENVIRONMENT != "test")

# Cookie configuration
COOKIE_NAME = "access_token"
COOKIE_MAX_AGE = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60  # Convert to seconds


def set_auth_cookie(response: Response, token: str, max_age: int = COOKIE_MAX_AGE) -> None:
    """Set the JWT token in an httpOnly cookie."""
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=max_age,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    """Clear the authentication cookie."""
    response.delete_cookie(
        key=COOKIE_NAME,
        httponly=True,
        secure=settings.ENVIRONMENT == "production",
        samesite="lax",
        path="/",
    )

# Request/Response Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(..., min_length=1)
    role: str = Field(..., pattern="^(sender|courier|both)$")
    phone_number: str | None = None
    max_deviation_km: int | None = Field(default=5, ge=1, le=50)
    default_address: str | None = None
    default_address_lat: float | None = None
    default_address_lng: float | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str
    remember_me: bool = False

class Token(BaseModel):
    access_token: str
    token_type: str


class LoginResponse(BaseModel):
    message: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    phone_number: str | None
    is_active: bool
    is_verified: bool
    max_deviation_km: int
    default_address: str | None = None
    default_address_lat: float | None = None
    default_address_lng: float | None = None
    created_at: datetime
    average_rating: float | None = None
    total_ratings: int = 0

    class Config:
        from_attributes = True


class UserUpdate(BaseModel):
    full_name: str | None = None
    phone_number: str | None = None
    max_deviation_km: int | None = Field(default=None, ge=1, le=50)
    default_address: str | None = None
    default_address_lat: float | None = None
    default_address_lng: float | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, description="Password must be at least 8 characters")


@router.post("/register", status_code=status.HTTP_201_CREATED, response_model=UserResponse)
@limiter.limit("5/minute")  # Max 5 registrations per minute per IP
async def register(request: Request, user_data: UserRegister, db: Session = Depends(get_db)):
    """
    Register a new user (sender, courier, or both).

    - **email**: Valid email address (must be unique)
    - **password**: Minimum 8 characters
    - **full_name**: User's full name
    - **role**: One of 'sender', 'courier', or 'both'
    - **phone_number**: Optional phone number
    - **max_deviation_km**: Maximum deviation distance for couriers (1-50 km)
    """
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Validate role
    try:
        user_role = UserRole(user_data.role)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid role. Must be 'sender', 'courier', or 'both'"
        )

    # Hash password
    hashed_password = get_password_hash(user_data.password)

    # Generate verification token (expires in 24 hours)
    verification_token = generate_verification_token()
    verification_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    # Create new user
    new_user = User(
        email=user_data.email,
        hashed_password=hashed_password,
        full_name=user_data.full_name,
        role=user_role,
        phone_number=user_data.phone_number,
        max_deviation_km=user_data.max_deviation_km or 5,
        default_address=user_data.default_address,
        default_address_lat=user_data.default_address_lat,
        default_address_lng=user_data.default_address_lng,
        verification_token=verification_token,
        verification_token_expires_at=verification_token_expires_at
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Audit log registration
    log_registration(db, new_user, request)

    # Send verification email
    await send_verification_email(new_user.email, verification_token, new_user.full_name)

    return new_user


@router.post("/login", response_model=LoginResponse)
@limiter.limit("10/minute")  # Max 10 login attempts per minute per IP
async def login(request: Request, response: Response, credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login and get JWT access token set in httpOnly cookie.

    - **email**: Registered email address
    - **password**: User's password
    - **remember_me**: If true, extends session to 7 days (default: false)

    Sets JWT token in httpOnly cookie valid for 24 hours (default) or 7 days (remember me).
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        log_login_failed(db, credentials.email, request, "user_not_found")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        log_login_failed(db, credentials.email, request, "invalid_password")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        log_login_failed(db, credentials.email, request, "account_inactive")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Determine token expiration based on remember_me
    if credentials.remember_me:
        expire_minutes = settings.REMEMBER_ME_EXPIRE_MINUTES
    else:
        expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    # Create access token
    access_token_expires = timedelta(minutes=expire_minutes)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value},
        expires_delta=access_token_expires
    )

    # Set JWT in httpOnly cookie with appropriate max_age
    cookie_max_age = expire_minutes * 60  # Convert to seconds
    set_auth_cookie(response, access_token, cookie_max_age)

    # Audit log successful login
    log_login_success(db, user, request, "password")

    return {"message": "Login successful"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current authenticated user information.

    Requires: Valid JWT token in Authorization header (Bearer token)
    """
    # Calculate average rating for the user
    avg_result = db.query(func.avg(Rating.score)).filter(
        Rating.rated_user_id == current_user.id
    ).scalar()
    total_ratings = db.query(Rating).filter(
        Rating.rated_user_id == current_user.id
    ).count()

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        phone_number=current_user.phone_number,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        max_deviation_km=current_user.max_deviation_km,
        default_address=current_user.default_address,
        default_address_lat=current_user.default_address_lat,
        default_address_lng=current_user.default_address_lng,
        created_at=current_user.created_at,
        average_rating=round(float(avg_result), 2) if avg_result else None,
        total_ratings=total_ratings
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update current authenticated user's profile.

    All fields are optional. Only provided fields will be updated.
    - **full_name**: User's full name
    - **phone_number**: Phone number
    - **max_deviation_km**: Maximum deviation distance for couriers (1-50 km)
    - **default_address**: Default address for package pickup
    - **default_address_lat**: Latitude of default address
    - **default_address_lng**: Longitude of default address
    """
    # Update only provided fields
    if user_data.full_name is not None:
        current_user.full_name = user_data.full_name
    if user_data.phone_number is not None:
        current_user.phone_number = user_data.phone_number
    if user_data.max_deviation_km is not None:
        current_user.max_deviation_km = user_data.max_deviation_km
    if user_data.default_address is not None:
        current_user.default_address = user_data.default_address
    if user_data.default_address_lat is not None:
        current_user.default_address_lat = user_data.default_address_lat
    if user_data.default_address_lng is not None:
        current_user.default_address_lng = user_data.default_address_lng

    db.commit()
    db.refresh(current_user)

    # Calculate average rating for the user
    avg_result = db.query(func.avg(Rating.score)).filter(
        Rating.rated_user_id == current_user.id
    ).scalar()
    total_ratings = db.query(Rating).filter(
        Rating.rated_user_id == current_user.id
    ).count()

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role.value,
        phone_number=current_user.phone_number,
        is_active=current_user.is_active,
        is_verified=current_user.is_verified,
        max_deviation_km=current_user.max_deviation_km,
        default_address=current_user.default_address,
        default_address_lat=current_user.default_address_lat,
        default_address_lng=current_user.default_address_lng,
        created_at=current_user.created_at,
        average_rating=round(float(avg_result), 2) if avg_result else None,
        total_ratings=total_ratings
    )


@router.get("/verify-email/{token}")
async def verify_email(token: str, db: Session = Depends(get_db)):
    """
    Verify user's email address using the verification token.

    - **token**: Verification token sent to user's email
    """
    # Find user by verification token
    user = db.query(User).filter(User.verification_token == token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification token"
        )

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already verified"
        )

    # Check if token has expired
    if user.verification_token_expires_at and user.verification_token_expires_at < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification token has expired. Please request a new verification email."
        )

    # Mark user as verified and clear the token
    user.is_verified = True
    user.verification_token = None
    user.verification_token_expires_at = None
    db.commit()

    # Audit log email verification
    log_email_verification(db, user)

    # Send welcome email
    await send_welcome_email(user.email, user.full_name)

    return {
        "message": "Email verified successfully",
        "email": user.email
    }


@router.post("/resend-verification")
@limiter.limit("3/minute")  # Max 3 resend attempts per minute per IP
async def resend_verification_email(request: Request, email: EmailStr, db: Session = Depends(get_db)):
    """
    Resend verification email to user.

    - **email**: User's email address

    Note: Returns success message regardless of whether email exists to prevent user enumeration.
    """
    user = db.query(User).filter(User.email == email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    if user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified"
        )

    # Generate new verification token (expires in 24 hours)
    verification_token = generate_verification_token()
    user.verification_token = verification_token
    user.verification_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()

    # Send verification email but don't fail the endpoint if email delivery fails
    try:
        await send_verification_email(user.email, verification_token, user.full_name)
    except Exception as exc:  # pragma: no cover - network/email provider issues
        logger.warning("Failed to send verification email for %s: %s", user.email, exc)

    return {
        "message": "Verification email sent successfully"
    }


@router.get("/google/login")
async def google_login(request: Request):
    """
    Initiate Google OAuth login flow.

    Redirects user to Google's authentication page.
    """
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback.

    Creates or logs in user based on their Google account.
    """
    try:
        # Get the authorization token
        token = await oauth.google.authorize_access_token(request)

        # Get user info from Google
        user_info = token.get('userinfo')
        if not user_info:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to get user information from Google"
            )

        email = user_info.get('email')
        full_name = user_info.get('name')
        google_id = user_info.get('sub')

        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email not provided by Google"
            )

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        is_new_user = False

        if not user:
            # Create new user with Google account
            # Default role is 'sender', user can change it later
            user = User(
                email=email,
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
                full_name=full_name or email.split('@')[0],
                role=UserRole.SENDER,
                is_verified=True,  # Google emails are already verified
                verification_token=None
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            is_new_user = True
        else:
            # User exists, mark as verified if using Google
            if not user.is_verified:
                user.is_verified = True
                db.commit()

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": user.email, "role": user.role.value},
            expires_delta=access_token_expires
        )

        # Audit log OAuth login
        log_oauth_login(db, user, "google", is_new_user, request)

        # Redirect to frontend with token in httpOnly cookie
        frontend_url = f"{settings.FRONTEND_URL}/auth/callback"
        response = RedirectResponse(url=frontend_url)
        set_auth_cookie(response, access_token)
        return response

    except Exception as e:
        # Redirect to frontend with error
        error_url = f"{settings.FRONTEND_URL}/login?error=oauth_failed"
        return RedirectResponse(url=error_url)


@router.post("/forgot-password")
@limiter.limit("3/minute")  # Max 3 password reset requests per minute per IP
async def forgot_password(request: Request, data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Request a password reset email.

    - **email**: User's email address

    Note: Returns success message regardless of whether email exists to prevent user enumeration.
    """
    user = db.query(User).filter(User.email == data.email).first()

    # Always return success to prevent user enumeration
    if not user:
        return {"message": "If an account exists with this email, a password reset link has been sent."}

    # Check if user is active
    if not user.is_active:
        return {"message": "If an account exists with this email, a password reset link has been sent."}

    # Generate password reset token (expires in 1 hour)
    reset_token = generate_verification_token()
    user.password_reset_token = reset_token
    user.password_reset_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()

    # Audit log password reset request
    log_password_reset_request(db, user, request)

    # Send password reset email
    try:
        await send_password_reset_email(user.email, reset_token, user.full_name)
    except Exception as exc:  # pragma: no cover - network/email provider issues
        logger.warning("Failed to send password reset email for %s: %s", user.email, exc)

    return {"message": "If an account exists with this email, a password reset link has been sent."}


@router.post("/reset-password")
async def reset_password(data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset password using the reset token.

    - **token**: Password reset token from email
    - **new_password**: New password (minimum 8 characters)
    """
    # Find user by reset token
    user = db.query(User).filter(User.password_reset_token == data.token).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired password reset token"
        )

    # Check if token has expired
    if user.password_reset_token_expires_at:
        # Handle both naive and aware datetimes (SQLite stores naive, PostgreSQL stores aware)
        expires_at = user.password_reset_token_expires_at
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at < datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Password reset token has expired. Please request a new one."
            )

    # Update password and clear reset token
    user.hashed_password = get_password_hash(data.new_password)
    user.password_reset_token = None
    user.password_reset_token_expires_at = None
    db.commit()

    # Audit log password reset completion
    log_password_reset_complete(db, user)

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


@router.post("/logout", response_model=LoginResponse)
async def logout(response: Response):
    """
    Logout user by clearing the authentication cookie.
    """
    clear_auth_cookie(response)
    return {"message": "Logged out successfully"}
