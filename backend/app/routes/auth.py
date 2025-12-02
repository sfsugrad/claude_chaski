import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.config import settings
from app.database import get_db
from app.models.user import User, UserRole
from app.models.rating import Rating
from app.utils.auth import get_password_hash, verify_password, create_access_token, hash_token, verify_token_hash, verify_token, hash_pii
from app.utils.dependencies import get_current_user
from app.utils.email import send_verification_email, send_welcome_email, send_password_reset_email, generate_verification_token
from app.utils.oauth import oauth
from app.utils.sms import send_verification_code
from app.utils.encryption import get_encryption_service
from app.utils.password_validator import validate_password
from app.services.audit_service import (
    log_login_success,
    log_login_failed,
    log_registration,
    log_password_reset_request,
    log_password_reset_complete,
    log_email_verification,
    log_oauth_login,
    log_account_locked,
    log_session_created,
    log_session_terminated,
    log_session_deleted,
    log_password_changed,
    log_profile_updated,
    log_token_blacklisted,
)
from app.services.auth_security import (
    record_login_attempt,
    is_account_locked,
    lock_account,
    should_lock_account,
    get_time_until_unlock,
)
from app.services.jwt_blacklist import JWTBlacklistService
from app.services.session_tracker import SessionTracker
from app.utils.input_sanitizer import sanitize_plain_text, sanitize_email, sanitize_phone
from app.utils.geo_restriction import get_country_from_ip, is_country_allowed
from app.utils.phone_validator import validate_us_phone_number
from app.models.audit_log import AuditLog, AuditAction
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
    password: str = Field(..., description="Password with enhanced security requirements")
    full_name: str = Field(..., min_length=1)
    role: str = Field(..., pattern="^(sender|courier|both)$")
    phone_number: str = Field(..., min_length=10, description="Phone number in E.164 format (required)")
    max_deviation_km: int | None = Field(default=5, ge=1, le=50)
    default_address: str | None = None
    default_address_lat: float | None = None
    default_address_lng: float | None = None
    preferred_language: str = Field(default='en', pattern="^(en|fr|es)$")

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
    phone_verified: bool
    id_verified: bool
    max_deviation_km: int
    default_address: str | None = None
    default_address_lat: float | None = None
    default_address_lng: float | None = None
    preferred_language: str = 'en'
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
    new_password: str = Field(..., description="New password with enhanced security requirements")


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
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    # Validate and check phone number (required, must be US format)
    if user_data.phone_number:
        # Validate US phone number format
        validate_us_phone_number(user_data.phone_number)

        # Check if phone number already exists
        phone_hash = hash_pii(user_data.phone_number)
        existing_phone = db.query(User).filter(User.phone_number_hash == phone_hash).first()
        if existing_phone:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered to another account"
            )

    # GEO-RESTRICTION CHECK: Block registrations from outside allowed countries
    client_ip = request.client.host if request.client else None

    if client_ip:
        country_code = await get_country_from_ip(client_ip)

        if not is_country_allowed(country_code):
            # Log blocked registration attempt
            audit_log = AuditLog(
                user_id=None,
                action=AuditAction.UNAUTHORIZED_ACCESS,
                resource_type="registration",
                resource_id=None,
                details=f"Registration blocked from country: {country_code}",
                ip_address=client_ip,
                user_agent=request.headers.get("user-agent")
            )
            db.add(audit_log)
            db.commit()

            # Return structured error for frontend handling
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error_code": "COUNTRY_NOT_ALLOWED",
                    "message": "We're currently only accepting registrations from the United States. Join our waitlist to be notified when we expand to your region!",
                    "country_detected": country_code,
                }
            )
    else:
        # No IP address available - fail-secure (block registration)
        logger.warning("No client IP available for geo-check - blocking registration")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "error_code": "COUNTRY_NOT_ALLOWED",
                "message": "Unable to verify your location. Please contact support if you believe this is an error.",
                "country_detected": None,
            }
        )

    # Validate password strength
    is_valid, password_errors = validate_password(user_data.password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Password does not meet security requirements",
                "errors": password_errors
            }
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
    verification_token_hash_value = hash_token(verification_token)
    verification_token_expires_at = datetime.now(timezone.utc) + timedelta(hours=24)

    # Sanitize all user inputs to prevent XSS
    sanitized_email = sanitize_email(user_data.email)
    sanitized_full_name = sanitize_plain_text(user_data.full_name)
    sanitized_phone = sanitize_phone(user_data.phone_number) if user_data.phone_number else None
    sanitized_default_address = sanitize_plain_text(user_data.default_address) if user_data.default_address else None

    # Encrypt PII data and create hashes for lookup
    encryption_service = get_encryption_service()
    encrypted_email = encryption_service.encrypt(sanitized_email) if encryption_service else None
    encrypted_full_name = encryption_service.encrypt(sanitized_full_name) if encryption_service else None
    encrypted_phone = encryption_service.encrypt(sanitized_phone) if encryption_service and sanitized_phone else None

    # Create deterministic hashes for secure lookup
    email_hash_value = hash_pii(sanitized_email)
    phone_hash_value = hash_pii(sanitized_phone) if sanitized_phone else None

    # Create new user
    new_user = User(
        # Email: hash for lookup, encrypted for storage, plaintext for transition
        email_hash=email_hash_value,
        email_encrypted=encrypted_email,
        email=sanitized_email,  # DEPRECATED: kept for transition period
        hashed_password=hashed_password,
        # Full name: encrypted only (not queried)
        full_name_encrypted=encrypted_full_name,
        full_name=sanitized_full_name,  # DEPRECATED: kept for transition period
        role=user_role,
        # Phone: hash for lookup, encrypted for storage
        phone_number_hash=phone_hash_value,
        phone_number_encrypted=encrypted_phone,
        phone_number=sanitized_phone,  # DEPRECATED: kept for transition period
        max_deviation_km=user_data.max_deviation_km or 5,
        default_address=sanitized_default_address,
        default_address_lat=user_data.default_address_lat,
        default_address_lng=user_data.default_address_lng,
        preferred_language=user_data.preferred_language,
        # Verification token: hash only (no plaintext stored)
        verification_token_hash=verification_token_hash_value,
        verification_token_expires_at=verification_token_expires_at,
        verification_token=None,  # DEPRECATED: no longer storing plaintext
    )

    db.add(new_user)

    try:
        db.commit()
        db.refresh(new_user)
    except IntegrityError as e:
        db.rollback()
        error_msg = str(e.orig) if hasattr(e, 'orig') else str(e)

        # Check for specific constraint violations
        if 'email' in error_msg.lower() or 'idx_users_email' in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )
        elif 'phone' in error_msg.lower() or 'idx_users_phone' in error_msg.lower():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phone number already registered to another account"
            )
        else:
            # Log the unexpected error for debugging
            logger.error(f"Registration IntegrityError: {error_msg}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Registration failed due to a data conflict. Please check your information and try again."
            )

    # Audit log registration
    log_registration(db, new_user, request)

    # Send verification email
    await send_verification_email(new_user.email, verification_token, new_user.full_name)

    return new_user


@router.post("/login", response_model=LoginResponse)
@limiter.limit("100/minute")  # Max 100 login attempts per minute per IP (higher for E2E tests)
async def login(request: Request, response: Response, credentials: UserLogin, db: Session = Depends(get_db)):
    """
    Login and get JWT access token set in httpOnly cookie.

    - **email**: Registered email address
    - **password**: User's password
    - **remember_me**: If true, extends session to 7 days (default: false)

    Sets JWT token in httpOnly cookie valid for 24 hours (default) or 7 days (remember me).

    Security features:
    - Account lockout after 5 failed login attempts
    - Lockout duration: 15 minutes
    - Login attempts tracked per email and IP
    """
    # Get request context
    ip_address = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "unknown")

    # Find user by email hash (secure lookup)
    email_hash_value = hash_pii(credentials.email)
    user = db.query(User).filter(User.email_hash == email_hash_value).first()

    # Fallback to plaintext email for users who registered before hash migration
    if not user:
        user = db.query(User).filter(User.email == credentials.email).first()

    # Check if account is locked (even if user doesn't exist, to prevent enumeration)
    if user and is_account_locked(user):
        time_until_unlock = get_time_until_unlock(user)
        minutes_remaining = int(time_until_unlock.total_seconds() / 60) if time_until_unlock else 0

        # Record failed attempt
        record_login_attempt(
            db, credentials.email, ip_address, user_agent,
            successful=False, failure_reason="account_locked", user_id=user.id
        )

        log_login_failed(db, credentials.email, request, "account_locked")

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is locked due to too many failed login attempts. Please try again in {minutes_remaining} minutes.",
        )

    if not user:
        # Record failed attempt for non-existent user (helps track brute force)
        record_login_attempt(
            db, credentials.email, ip_address, user_agent,
            successful=False, failure_reason="user_not_found"
        )

        log_login_failed(db, credentials.email, request, "user_not_found")

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    if not verify_password(credentials.password, user.hashed_password):
        # Record failed attempt
        record_login_attempt(
            db, credentials.email, ip_address, user_agent,
            successful=False, failure_reason="invalid_password", user_id=user.id
        )

        log_login_failed(db, credentials.email, request, "invalid_password")

        # Check if account should be locked
        if should_lock_account(db, credentials.email):
            lock_account(db, user)

            # Audit log account lockout
            log_account_locked(db, user, "Exceeded failed login attempts threshold", request)

            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Too many failed login attempts. Your account has been locked for 15 minutes.",
            )

        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check if user is active (admin-controlled deactivation)
    if not user.is_active:
        record_login_attempt(
            db, credentials.email, ip_address, user_agent,
            successful=False, failure_reason="account_inactive", user_id=user.id
        )

        log_login_failed(db, credentials.email, request, "account_inactive")

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account has been deactivated. Please contact support."
        )

    # Note: Email and phone verification status is returned in the response
    # Frontend will show appropriate banners for unverified users

    # Successful login - record attempt
    record_login_attempt(
        db, credentials.email, ip_address, user_agent,
        successful=True, user_id=user.id
    )

    # Determine token expiration based on remember_me
    if credentials.remember_me:
        expire_minutes = settings.REMEMBER_ME_EXPIRE_MINUTES
    else:
        expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES

    # Create session in Redis (tracks active sessions across devices)
    ttl_seconds = expire_minutes * 60
    session_id = await SessionTracker.create_session(
        user_id=user.id,
        ip_address=ip_address,
        user_agent=user_agent,
        ttl_seconds=ttl_seconds
    )

    # Audit log session creation
    log_session_created(db, user, session_id, request)

    # Create access token with session_id and issued-at time
    access_token_expires = timedelta(minutes=expire_minutes)
    now = int(datetime.now(timezone.utc).timestamp())
    access_token = create_access_token(
        data={
            "sub": user.email,
            "role": user.role.value,
            "session_id": session_id,
            "iat": now  # Issued-at time for token revocation
        },
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
        phone_verified=current_user.phone_verified,
        id_verified=current_user.id_verified,
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
    # Get encryption service for PII dual-write
    encryption_service = get_encryption_service()

    # Track changes for audit log
    changes = {}

    # Update only provided fields (with sanitization and dual-write for PII)
    if user_data.full_name is not None:
        sanitized_name = sanitize_plain_text(user_data.full_name)
        changes["full_name"] = {"old": current_user.full_name, "new": sanitized_name}
        current_user.full_name = sanitized_name
        current_user.full_name_encrypted = encryption_service.encrypt(sanitized_name) if encryption_service else None
    if user_data.phone_number is not None:
        sanitized_phone_update = sanitize_phone(user_data.phone_number)
        changes["phone_number"] = {"old": current_user.phone_number, "new": sanitized_phone_update}
        current_user.phone_number = sanitized_phone_update
        current_user.phone_number_encrypted = encryption_service.encrypt(sanitized_phone_update) if encryption_service else None
    if user_data.max_deviation_km is not None:
        changes["max_deviation_km"] = {"old": current_user.max_deviation_km, "new": user_data.max_deviation_km}
        current_user.max_deviation_km = user_data.max_deviation_km
    if user_data.default_address is not None:
        sanitized_address = sanitize_plain_text(user_data.default_address)
        changes["default_address"] = {"old": current_user.default_address, "new": sanitized_address}
        current_user.default_address = sanitized_address
    if user_data.default_address_lat is not None:
        changes["default_address_lat"] = {"old": current_user.default_address_lat, "new": user_data.default_address_lat}
        current_user.default_address_lat = user_data.default_address_lat
    if user_data.default_address_lng is not None:
        changes["default_address_lng"] = {"old": current_user.default_address_lng, "new": user_data.default_address_lng}
        current_user.default_address_lng = user_data.default_address_lng

    db.commit()
    db.refresh(current_user)

    # Audit log profile update if any changes were made
    if changes:
        log_profile_updated(db, current_user, changes)

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
        phone_verified=current_user.phone_verified,
        id_verified=current_user.id_verified,
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
    # Hash the incoming token for secure comparison
    token_hash_value = hash_token(token)

    # Find user by verification token hash only (no plaintext fallback)
    user = db.query(User).filter(User.verification_token_hash == token_hash_value).first()

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

    # Mark user as verified and clear the token hash
    user.is_verified = True
    user.verification_token = None  # Clear deprecated field if present
    user.verification_token_hash = None
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
    # Find user by email hash (secure lookup)
    email_hash_value = hash_pii(email)
    user = db.query(User).filter(User.email_hash == email_hash_value).first()

    # Fallback to plaintext email for users who registered before hash migration
    if not user:
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
    user.verification_token = None  # DEPRECATED: no longer storing plaintext
    user.verification_token_hash = hash_token(verification_token)  # Store hash only
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
async def google_login(request: Request, locale: str = 'en'):
    """
    Initiate Google OAuth login flow.

    Redirects user to Google's authentication page.
    Accepts locale parameter to preserve user's language preference.
    """
    redirect_uri = settings.GOOGLE_REDIRECT_URI
    # Pass locale through OAuth state to preserve it
    return await oauth.google.authorize_redirect(
        request,
        redirect_uri,
        state=locale  # Store locale in OAuth state
    )


@router.get("/google/callback")
async def google_callback(request: Request, state: str = 'en', db: Session = Depends(get_db)):
    """
    Handle Google OAuth callback.

    Creates or logs in user based on their Google account.
    Accepts state parameter containing the user's locale preference.
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
            # Use locale from OAuth state for new user's preferred language
            user_locale = state if state in ['en', 'fr', 'es'] else 'en'

            # Encrypt PII data (dual-write: store both plain text and encrypted)
            encryption_service = get_encryption_service()
            full_name_value = full_name or email.split('@')[0]
            encrypted_email = encryption_service.encrypt(email) if encryption_service else None
            encrypted_full_name = encryption_service.encrypt(full_name_value) if encryption_service else None

            user = User(
                email=email,
                email_encrypted=encrypted_email,
                hashed_password=get_password_hash(secrets.token_urlsafe(32)),  # Random password
                full_name=full_name_value,
                full_name_encrypted=encrypted_full_name,
                role=UserRole.SENDER,
                is_verified=True,  # Google emails are already verified
                verification_token=None,
                preferred_language=user_locale
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

        # Get client info for session tracking
        ip_address = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Create session in Redis (tracks active sessions across devices)
        expire_minutes = settings.ACCESS_TOKEN_EXPIRE_MINUTES
        ttl_seconds = expire_minutes * 60
        session_id = await SessionTracker.create_session(
            user_id=user.id,
            ip_address=ip_address,
            user_agent=user_agent,
            ttl_seconds=ttl_seconds
        )

        # Audit log session creation
        log_session_created(db, user, session_id, request)

        # Create access token with session_id and issued-at time
        access_token_expires = timedelta(minutes=expire_minutes)
        now = int(datetime.now(timezone.utc).timestamp())
        access_token = create_access_token(
            data={
                "sub": user.email,
                "role": user.role.value,
                "session_id": session_id,
                "iat": now  # Issued-at time for token revocation
            },
            expires_delta=access_token_expires
        )

        # Audit log OAuth login
        log_oauth_login(db, user, "google", is_new_user, request)

        # Redirect to frontend with token in httpOnly cookie
        # Use user's preferred language for the redirect
        preferred_lang = user.preferred_language or 'en'
        frontend_url = f"{settings.FRONTEND_URL}/{preferred_lang}/auth/callback"
        response = RedirectResponse(url=frontend_url)
        set_auth_cookie(response, access_token)
        return response

    except Exception as e:
        # Log the actual error for debugging
        logger.error(f"Google OAuth callback failed: {type(e).__name__}: {str(e)}", exc_info=True)
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
    # Find user by email hash (secure lookup)
    email_hash_value = hash_pii(data.email)
    user = db.query(User).filter(User.email_hash == email_hash_value).first()

    # Fallback to plaintext email for users who registered before hash migration
    if not user:
        user = db.query(User).filter(User.email == data.email).first()

    # Always return success to prevent user enumeration
    if not user:
        return {"message": "If an account exists with this email, a password reset link has been sent."}

    # Check if user is active
    if not user.is_active:
        return {"message": "If an account exists with this email, a password reset link has been sent."}

    # Generate password reset token (expires in 1 hour)
    reset_token = generate_verification_token()
    user.password_reset_token = None  # DEPRECATED: no longer storing plaintext
    user.password_reset_token_hash = hash_token(reset_token)  # Store hash only
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
    - **new_password**: New password meeting enhanced security requirements
    """
    # Validate new password strength
    is_valid, password_errors = validate_password(data.new_password)
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "message": "Password does not meet security requirements",
                "errors": password_errors
            }
        )

    # Hash the incoming token for secure comparison
    token_hash_value = hash_token(data.token)

    # Find user by reset token hash only (no plaintext fallback)
    user = db.query(User).filter(User.password_reset_token_hash == token_hash_value).first()

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

    # Update password and clear reset token and hash
    user.hashed_password = get_password_hash(data.new_password)
    user.password_reset_token = None
    user.password_reset_token_hash = None
    user.password_reset_token_expires_at = None
    db.commit()

    # Audit log password change
    log_password_changed(db, user)

    # Revoke all existing tokens for this user (security: password change = logout all sessions)
    await JWTBlacklistService.revoke_all_user_tokens(
        user.id,
        revoke_before=datetime.now(timezone.utc)
    )

    # Audit log password reset completion
    log_password_reset_complete(db, user)

    logger.info(f"Password reset completed for user {user.id}, all existing sessions revoked")

    return {"message": "Password has been reset successfully. You can now log in with your new password."}


@router.post("/logout", response_model=LoginResponse)
async def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user)
):
    """
    Logout user by blacklisting their token and clearing the authentication cookie.

    Security features:
    - Token is added to Redis blacklist with TTL matching token expiration
    - Session is deleted from Redis session tracking
    - Cookie is cleared from browser
    - Token cannot be reused even if intercepted
    """
    # Get token from request
    token = request.cookies.get(COOKIE_NAME)

    session_id = None
    if token:
        # Extract session_id from token (if present)
        try:
            payload = verify_token(token)
            if payload:
                session_id = payload.get("session_id")
                if session_id:
                    # Delete the session from Redis
                    await SessionTracker.delete_session(session_id, current_user.id)

                    # Audit log session termination
                    log_session_terminated(db, current_user, session_id, "user_logout", request)
        except Exception:
            # Ignore errors during session deletion
            pass

        # Blacklist the token so it cannot be reused
        await JWTBlacklistService.blacklist_token(token, reason="logout")

    # Clear the authentication cookie
    clear_auth_cookie(response)

    logger.info(f"User {current_user.id} logged out successfully")

    return {"message": "Logged out successfully"}


# Phone Verification Models
class PhoneVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


@router.post("/phone/send-code", status_code=status.HTTP_200_OK)
@limiter.limit("3/minute")
async def send_phone_verification_code(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Send verification code to user's phone number via SMS.
    Rate limited to 3 requests per minute.
    """
    if not current_user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number associated with this account"
        )

    if current_user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already verified"
        )

    # Generate 6-digit code
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    # Set expiration time (2 hours)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=2)

    # Update user with hashed verification code (for security)
    current_user.phone_verification_code = hash_token(code)
    current_user.phone_verification_code_expires_at = expires_at
    db.commit()

    # Send SMS with plain text code (user needs to see it)
    await send_verification_code(current_user.phone_number, code)

    logger.info(f"Phone verification code sent to user {current_user.id}")

    return {
        "message": "Verification code sent to your phone number",
        "expires_in_hours": 2
    }


@router.post("/phone/verify", status_code=status.HTTP_200_OK)
async def verify_phone_number(
    verify_data: PhoneVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Verify phone number using the code sent via SMS.
    """
    if current_user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already verified"
        )

    if not current_user.phone_verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No verification code found. Please request a new code."
        )

    # Check if code has expired
    if (current_user.phone_verification_code_expires_at and
        current_user.phone_verification_code_expires_at < datetime.now(timezone.utc)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired. Please request a new code."
        )

    # Verify code by comparing hashes
    code_hash = hash_token(verify_data.code)
    if current_user.phone_verification_code != code_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code"
        )

    # Mark phone as verified
    current_user.phone_verified = True
    current_user.phone_verification_code = None
    current_user.phone_verification_code_expires_at = None
    db.commit()

    logger.info(f"Phone number verified for user {current_user.id}")

    return {
        "message": "Phone number verified successfully",
        "phone_verified": True
    }


@router.post("/phone/resend-code", status_code=status.HTTP_200_OK)
@limiter.limit("2/minute")
async def resend_phone_verification_code(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Resend verification code to user's phone number.
    Rate limited to 2 requests per minute.
    """
    if not current_user.phone_number:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No phone number associated with this account"
        )

    if current_user.phone_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Phone number is already verified"
        )

    # Generate new 6-digit code
    code = ''.join([str(secrets.randbelow(10)) for _ in range(6)])

    # Set expiration time (2 hours)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=2)

    # Update user with hashed verification code (for security)
    current_user.phone_verification_code = hash_token(code)
    current_user.phone_verification_code_expires_at = expires_at
    db.commit()

    # Send SMS with plain text code (user needs to see it)
    await send_verification_code(current_user.phone_number, code)

    logger.info(f"Phone verification code resent to user {current_user.id}")

    return {
        "message": "Verification code resent to your phone number",
        "expires_in_hours": 2
    }


# Session Management Endpoints

@router.get("/sessions")
async def get_active_sessions(
    request: Request,
    current_user: User = Depends(get_current_user)
):
    """
    Get all active sessions for the current user.

    Shows sessions across all devices with:
    - Device information (browser, OS)
    - IP address
    - Login time
    - Last activity time
    - Current session indicator
    """
    # Extract current session_id from token
    token = request.cookies.get(COOKIE_NAME)
    current_session_id = None

    if token:
        try:
            payload = verify_token(token)
            if payload:
                current_session_id = payload.get("session_id")
        except Exception:
            pass

    # Get all sessions for user
    sessions = await SessionTracker.get_user_sessions(
        user_id=current_user.id,
        current_session_id=current_session_id
    )

    return {
        "sessions": [session.to_dict() for session in sessions],
        "total": len(sessions)
    }


@router.delete("/sessions/{session_id}")
async def delete_specific_session(
    request: Request,
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a specific session (logout from a specific device).

    This allows users to remotely logout from other devices.
    """
    # Attempt to delete the session
    success = await SessionTracker.delete_session(session_id, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or does not belong to you"
        )

    # Audit log session deletion
    log_session_deleted(db, current_user, session_id, request)

    logger.info(f"User {current_user.id} deleted session {session_id}")

    return {"message": "Session deleted successfully"}


@router.delete("/sessions/others")
async def delete_other_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete all sessions except the current one.

    Useful for "logout from all other devices" functionality.
    """
    # Extract current session_id from token
    token = request.cookies.get(COOKIE_NAME)
    current_session_id = None

    if token:
        try:
            payload = verify_token(token)
            if payload:
                current_session_id = payload.get("session_id")
        except Exception:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Could not identify current session"
            )

    if not current_session_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active session found"
        )

    # Delete all sessions except current
    deleted_count = await SessionTracker.delete_all_sessions_except_current(
        user_id=current_user.id,
        current_session_id=current_session_id
    )

    # Audit log batch session deletion
    if deleted_count > 0:
        log_session_deleted(
            db, current_user, f"batch_{deleted_count}_sessions", request
        )

    logger.info(f"User {current_user.id} deleted {deleted_count} other sessions")

    return {
        "message": f"Successfully logged out from {deleted_count} other device(s)",
        "deleted_count": deleted_count
    }
