from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from slowapi import Limiter
from slowapi.util import get_remote_address
from app.database import get_db
from app.models.user import User, UserRole
from app.models.rating import Rating
from app.utils.auth import get_password_hash, verify_password, create_access_token
from app.utils.dependencies import get_current_user
from app.utils.email import send_verification_email, send_welcome_email, generate_verification_token
from app.utils.oauth import oauth
from app.config import settings
from pydantic import BaseModel, EmailStr, Field
import secrets

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)

# Request/Response Models
class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters")
    full_name: str = Field(..., min_length=1)
    role: str = Field(..., pattern="^(sender|courier|both)$")
    phone_number: str | None = None
    max_deviation_km: int | None = Field(default=5, ge=1, le=50)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    phone_number: str | None
    is_active: bool
    is_verified: bool
    max_deviation_km: int
    created_at: datetime
    average_rating: float | None = None
    total_ratings: int = 0

    class Config:
        from_attributes = True


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
        verification_token=verification_token,
        verification_token_expires_at=verification_token_expires_at
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Send verification email
    await send_verification_email(new_user.email, verification_token, new_user.full_name)

    return new_user


@router.post("/login", response_model=Token)
@limiter.limit("10/minute")  # Max 10 login attempts per minute per IP
async def login(request: Request, credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login and get JWT access token.

    - **email**: Registered email address
    - **password**: User's password

    Returns a JWT token valid for 30 minutes (default).
    """
    # Find user by email
    user = db.query(User).filter(User.email == credentials.email).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive"
        )

    # Create access token
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "role": user.role.value},
        expires_delta=access_token_expires
    )

    return {
        "access_token": access_token,
        "token_type": "bearer"
    }


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

    # Always return success to prevent user enumeration
    if not user:
        return {
            "message": "If the email is registered and not verified, a verification email has been sent."
        }

    if user.is_verified:
        return {
            "message": "If the email is registered and not verified, a verification email has been sent."
        }

    # Generate new verification token (expires in 24 hours)
    verification_token = generate_verification_token()
    user.verification_token = verification_token
    user.verification_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)
    db.commit()

    # Send verification email
    await send_verification_email(user.email, verification_token, user.full_name)

    return {
        "message": "If the email is registered and not verified, a verification email has been sent."
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

        # Redirect to frontend with token
        frontend_url = f"{settings.FRONTEND_URL}/auth/callback?token={access_token}"
        return RedirectResponse(url=frontend_url)

    except Exception as e:
        # Redirect to frontend with error
        error_url = f"{settings.FRONTEND_URL}/login?error=oauth_failed"
        return RedirectResponse(url=error_url)
