# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chaski is a logistics platform connecting package senders with couriers traveling along the same route. FastAPI backend + Next.js frontend.

## Development Commands

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate

uvicorn main:app --reload --port 8000     # Dev server
pytest                                      # Run all tests
pytest tests/test_packages.py -v           # Single test file
pytest tests/test_packages.py::test_create_package_success -v  # Single test
pytest --cov=app tests/                    # With coverage
python -m test_data.load_test_data         # Load test fixtures
```

### Frontend (Next.js)
```bash
cd frontend
npm run dev                # Dev server
npm test                   # Run tests
npm test -- path/to/test   # Single test
npm run test:watch         # Watch mode
npm run test:coverage      # With coverage
npm run build              # Production build
npm run lint               # Lint
```

### E2E Testing (Playwright)
```bash
cd frontend
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Interactive UI
npm run test:e2e:headed    # Headed browser
npm run test:e2e:debug     # Debug mode
```

### Database Migrations
```bash
cd backend
source venv/bin/activate
PYTHONPATH=. python migrations/<migration_name>.py
```
Key migrations: `add_phone_verification_fields.py`, `add_account_lockout_column.py`, `add_encrypted_pii_columns.py`, `add_login_attempts_table.py`

## Architecture

### Backend Structure
- `main.py` - FastAPI app entry point with middleware stack (CORS, CSRF, security headers, rate limiting, sessions, logging)
- `app/config.py` - Environment settings via pydantic-settings
- `app/database.py` - SQLAlchemy database connection and session management
- `app/models/` - SQLAlchemy models:
  - `user.py` - User with UserRole enum, account lockout, phone verification
  - `package.py` - Package and CourierRoute with PackageStatus/PackageSize enums
  - `login_attempt.py` - Login attempt tracking for security
  - `audit_log.py` - AuditLog with AuditAction enum (28 action types)
  - `bid.py`, `delivery_proof.py`, `payment.py`, `tracking.py`, `analytics.py`, `notification.py`, `rating.py`, `message.py`
- `app/routes/` - API endpoints organized by domain (auth, packages, couriers, matching, admin, bids, payments, payouts, delivery_proof, tracking, analytics, messages, ratings, notifications, notes, ws, logs)
- `app/utils/` - Shared utilities:
  - `dependencies.py` - FastAPI dependencies (`get_current_user`, `get_current_admin_user`)
  - `auth.py` - JWT token and password hashing
  - `csrf.py` - CSRF token generation and validation (double-submit cookie pattern)
  - `encryption.py` - Fernet encryption for PII fields
  - `input_sanitizer.py` - XSS prevention and input sanitization
  - `password_validator.py` - Password strength validation
  - `file_validator.py` - File upload validation (type, size)
  - `geo.py` - Geospatial calculations (`haversine_distance`)
  - `geo_restriction.py` - IP-based country geolocation for registration restrictions (uses ip-api.com with Redis caching)
  - `sms.py` - Twilio SMS/Verify integration (falls back to console)
  - `email.py`, `oauth.py`, `tracking_id.py`, `logging_config.py`
- `app/services/` - Business logic:
  - `auth_security.py` - Login attempt tracking, account lockout (5 attempts, 15 min lockout)
  - `jwt_blacklist.py` - Token blacklisting for logout
  - `session_tracker.py` - Active session management
  - `package_status.py` - Package state machine (use `validate_transition()` or `transition_package()`)
  - `websocket_manager.py`, `matching_job.py`, `audit_service.py`, `redis_client.py`, `stripe_service.py`, `file_storage.py`, `tracking_service.py`
- `app/middleware/` - CSRF protection, request logging, performance monitoring, user activity tracking
- `test_data/` - JSON fixtures and loader script

### Frontend Structure
- `app/[locale]/` - Next.js 14 App Router pages with i18n locale prefix
- `lib/api.ts` - Centralized API client (all API calls must go through this, no direct axios in components)
  - Axios with `withCredentials: true`, auto CSRF token handling
  - API modules: `authAPI`, `packagesAPI`, `couriersAPI`, `matchingAPI`, `adminAPI`, `bidsAPI`, `paymentsAPI`, etc.
- `lib/logger.ts` - Frontend error tracking (sends to `/api/logs/frontend` in production)
- `hooks/useWebSocket.ts` - WebSocket with auto-reconnect
- `contexts/WebSocketContext.tsx` - App-wide real-time updates
- `components/` - Reusable components (ErrorBoundary, LanguageSwitcher, etc.)
- `messages/*.json` - i18n translation files (en, fr, es)

### Key Patterns

**Authentication:**
- JWT in httpOnly cookies, CSRF protection via double-submit cookie pattern
- `get_current_user` / `get_current_admin_user` FastAPI dependencies
- Account lockout after 5 failed attempts (15 min)
- Role-based access: sender, courier, both, admin

**Security:**
- CSRF tokens required for state-changing requests (header: `X-CSRF-Token`)
- PII fields encrypted with Fernet (phone, addresses)
- Input sanitization for XSS prevention
- File upload validation (type, size limits)
- JWT blacklisting for logout
- Geo-restriction: NEW registrations restricted by country (IP-based, default: US only)
  - Existing users grandfathered in
  - Admin override via `ALLOW_INTERNATIONAL_REGISTRATION` env var
  - Fail-secure: blocks if geolocation lookup fails
  - Logs blocked attempts to audit log

**Database:**
- PostgreSQL with PostGIS for geospatial queries
- Tests use SQLite in-memory database (see `tests/conftest.py`)

**Real-time Updates:**
- WebSocket at `/api/ws` with JWT auth
- Events: `notification_created`, `unread_count_updated`, `message_received`

**Code Rules:**
- Backend utilities centralized in `app/utils/` - never duplicate
- Frontend API calls ONLY through `lib/api.ts` modules
- TypeScript types defined in `lib/api.ts` - reuse them
- Package status changes via `package_status.py` functions only

### Testing

**Backend:** Pytest fixtures in `tests/conftest.py`:
- `client` - TestClient with database override
- `authenticated_sender`, `authenticated_courier`, `authenticated_both_role`, `authenticated_admin` - Pre-authenticated tokens
- `test_package_data`, `test_user_data`, `test_courier_data` - Sample data
- `test_verified_user`, `test_admin` - User objects for direct DB operations

**Frontend:** Jest + React Testing Library. Tests in `__tests__/` directories.

## Role System

Users have one of four roles:
- **sender**: Can create/manage packages
- **courier**: Can create routes, view/accept matching packages
- **both**: Combined sender + courier capabilities
- **admin**: Full platform management

**Role Hierarchy:**
```
        ADMIN (highest)
           ↕
         BOTH (middle)
        ↗    ↖
   SENDER    COURIER (lowest)
```

**Role Transitions (Admin Only):**
Only these 4 transitions are allowed:
- `sender → both` (upgrade)
- `courier → both` (upgrade)
- `both → admin` (promote)
- `admin → both` (demote)

All other transitions are **forbidden**. To promote sender to admin: `sender → both → admin` (2 steps).

See **[backend/docs/USER_ROLES_LIFECYCLE.md](backend/docs/USER_ROLES_LIFECYCLE.md)** for complete documentation on user states, lifecycle, and restrictions.

## Internationalization (i18n)

Uses `next-intl` with locale-based routing (`/en`, `/fr`, `/es`). See **[frontend/I18N_PLAN.md](frontend/I18N_PLAN.md)** for full roadmap.

```typescript
// Client components
const t = useTranslations('namespace');

// Server components
const t = await getTranslations('namespace');
```

Translation files: `frontend/messages/{en,fr,es}.json`

## Logging

**Backend** (`backend/logs/`): Structured JSON logging with rotation (10MB, 5 backups)
- `app.log` - All logs, `error.log` - Errors only, `requests.log` - HTTP requests, `performance.log` - Slow requests

**Frontend** (`lib/logger.ts`): Sends to `/api/logs/frontend` in production
```typescript
import { logError } from '@/lib/logger';
logError('Failed to process', error, { context });
```

View logs: `tail -f backend/logs/app.log | jq .`

## Phone Verification (Twilio)

See **[backend/TWILIO_SETUP.md](backend/TWILIO_SETUP.md)** for setup.

- Twilio Verify API (recommended) or Messaging API
- Falls back to console logging in development
- Endpoints: `POST /api/auth/phone/send-code`, `POST /api/auth/phone/verify`
- Phone numbers in E.164 format (`+12125551234`)

## Package Status State Machine

Transitions enforced in `app/services/package_status.py` - always use `validate_transition()` or `transition_package()`:

```
NEW → OPEN_FOR_BIDS → BID_SELECTED → PENDING_PICKUP → IN_TRANSIT → DELIVERED
                          ↓                ↓              ↓
                    OPEN_FOR_BIDS*       FAILED         FAILED

CANCELED can occur from any non-terminal state (except IN_TRANSIT and FAILED)
FAILED → OPEN_FOR_BIDS (admin only retry)
```

## Environment Setup

**Required services:**
- PostgreSQL with PostGIS extension
- Redis (for WebSocket pub/sub and caching)
- SMTP server (for email verification)

**Optional services:**
- Stripe (payments) - Stripe Connect for courier payouts
- AWS S3 (delivery proof images)
- Twilio (SMS verification - falls back to console)

**Backend `.env`:** Copy from `.env.example`
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/chaski_db
SECRET_KEY=your-jwt-secret
ENCRYPTION_KEY=fernet-key  # Generate: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
FRONTEND_URL=http://localhost:3000
# Geo-restriction (optional - restricts NEW user registrations by country)
ALLOW_INTERNATIONAL_REGISTRATION=false  # Set to 'true' to allow all countries
REGISTRATION_COUNTRY_ALLOWLIST=US       # Comma-separated country codes (e.g., "US,CA,GB")
# Email, OAuth, Stripe, AWS, Twilio - see .env.example
```

**Frontend `.env.local`:** Copy from `.env.example`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-key  # For address autocomplete
```
