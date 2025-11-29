from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.config import settings
from app.database import engine
from app.models import base
from app.routes import auth, packages, couriers, matching, admin, notifications, ratings, ws, messages, delivery_proof, payments, payouts, tracking, analytics, bids, notes, logs
from app.utils.logging_config import setup_logging
from app.middleware.logging_middleware import (
    RequestLoggingMiddleware,
    PerformanceMonitoringMiddleware,
    UserActivityLoggingMiddleware
)
from app.middleware.csrf import CSRFMiddleware

# Initialize logging system
setup_logging()


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses"""
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Skip CSP for Swagger UI docs to allow it to load properly
        if request.url.path in ["/docs", "/redoc", "/openapi.json"]:
            return response

        # Content Security Policy
        # Note: 'unsafe-inline' and 'unsafe-eval' should be removed in future iterations
        # by implementing nonces/hashes for inline scripts and refactoring eval usage
        csp_directives = [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  # TODO: Remove unsafe-* with nonces
            "style-src 'self' 'unsafe-inline'",  # TODO: Use nonces for inline styles
            "img-src 'self' data: https:",
            "font-src 'self' data:",
            "connect-src 'self'",
            "frame-ancestors 'none'",
            "base-uri 'self'",  # Prevent <base> tag injection
            "form-action 'self'",  # Restrict form submissions to same origin
            "object-src 'none'",  # Block plugins (Flash, Java, etc.)
            "media-src 'self'",  # Restrict audio/video sources
            "worker-src 'self'",  # Restrict web workers
            "manifest-src 'self'",  # Restrict web app manifests
        ]

        # Add upgrade-insecure-requests in production to force HTTPS
        if settings.ENVIRONMENT == "production":
            csp_directives.append("upgrade-insecure-requests")

        response.headers["Content-Security-Policy"] = "; ".join(csp_directives) + ";"

        # Strict Transport Security (HSTS) - only in production
        if settings.ENVIRONMENT == "production":
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # XSS Protection (legacy browsers)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer Policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions Policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=(), "
            "usb=(), "
            "magnetometer=(), "
            "gyroscope=(), "
            "speaker=()"
        )

        return response

# Create database tables
base.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Chaski API",
    description="Courier-to-package matching platform API",
    version="1.0.0"
)

# Initialize rate limiter (disabled during automated tests)
limiter = Limiter(key_func=get_remote_address, enabled=settings.ENVIRONMENT != "test")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware (should be first)
app.add_middleware(SecurityHeadersMiddleware)

# Session middleware (required for OAuth)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie="chaski_session",
    max_age=3600,  # 1 hour
    same_site="lax",
    https_only=settings.ENVIRONMENT == "production"  # Secure cookies in production
)

# CORS middleware
# Restrict allowed origins based on environment
allowed_origins = ["http://localhost:3000", "http://localhost:3001"]
if settings.ENVIRONMENT == "production":
    # Add production frontend URL when deployed
    # allowed_origins = ["https://yourdomain.com"]
    pass

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # Specific methods only
    allow_headers=[
        "Content-Type",
        "Authorization",
        "Accept",
        "Origin",
        "User-Agent",
        "DNT",
        "Cache-Control",
        "X-Requested-With",
        "X-CSRF-Token",  # Allow CSRF token header
    ],  # Specific headers only
    expose_headers=["X-CSRF-Token"],  # Expose CSRF token to frontend
    max_age=600,  # Cache preflight requests for 10 minutes
)

# CSRF protection middleware (after CORS, before logging)
app.add_middleware(CSRFMiddleware)

# Logging middleware
app.add_middleware(UserActivityLoggingMiddleware)
app.add_middleware(PerformanceMonitoringMiddleware)
app.add_middleware(RequestLoggingMiddleware)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(packages.router, prefix="/api/packages", tags=["Packages"])
app.include_router(couriers.router, prefix="/api/couriers", tags=["Couriers"])
app.include_router(matching.router, prefix="/api/matching", tags=["Matching"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["Notifications"])
app.include_router(ratings.router, prefix="/api/ratings", tags=["Ratings"])
app.include_router(messages.router, prefix="/api/messages", tags=["Messages"])
app.include_router(delivery_proof.router, prefix="/api/proof", tags=["Delivery Proof"])
app.include_router(payments.router, prefix="/api/payments", tags=["Payments"])
app.include_router(payouts.router, prefix="/api/payouts", tags=["Payouts"])
app.include_router(tracking.router, prefix="/api/tracking", tags=["Tracking"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["Analytics"])
app.include_router(bids.router, prefix="/api/bids", tags=["Bids"])
app.include_router(notes.router, prefix="/api/packages", tags=["Package Notes"])
app.include_router(logs.router, prefix="/api/logs", tags=["Logging"])
app.include_router(ws.router, prefix="/api", tags=["WebSocket"])

@app.get("/")
async def root():
    return {"message": "Welcome to Chaski API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
