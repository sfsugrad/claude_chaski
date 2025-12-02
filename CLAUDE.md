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
Key migrations: `add_phone_verification_fields.py`, `add_account_lockout_column.py`, `add_encrypted_pii_columns.py`, `add_login_attempts_table.py`, `add_id_verification.py`

## Architecture

### Backend Structure
- `main.py` - FastAPI app entry point with middleware stack (CORS, CSRF, security headers, rate limiting, sessions, logging)
- `app/config.py` - Environment settings via pydantic-settings
- `app/database.py` - SQLAlchemy database connection and session management
- `app/models/` - SQLAlchemy models:
  - `user.py` - User with UserRole enum, account lockout, phone/ID verification
  - `package.py` - Package and CourierRoute with PackageStatus/PackageSize enums
  - `login_attempt.py` - Login attempt tracking for security
  - `id_verification.py` - IDVerification with IDVerificationStatus enum (8 states)
  - `audit_log.py` - AuditLog with AuditAction enum (28 action types)
  - `bid.py`, `delivery_proof.py`, `payment.py`, `tracking.py`, `analytics.py`, `notification.py`, `rating.py`, `message.py`
- `app/routes/` - API endpoints organized by domain (auth, packages, couriers, matching, admin, bids, payments, payouts, delivery_proof, tracking, analytics, messages, ratings, notifications, notes, ws, logs, id_verification)
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
  - `phone_validator.py` - US phone number validation (E.164 format: `+1XXXXXXXXXX`)
  - `sms.py` - Twilio SMS/Verify integration (falls back to console)
  - `email.py`, `oauth.py`, `tracking_id.py`, `logging_config.py`
- `app/services/` - Business logic:
  - `auth_security.py` - Login attempt tracking, account lockout (5 attempts, 15 min lockout)
  - `jwt_blacklist.py` - Token blacklisting for logout
  - `session_tracker.py` - Active session management
  - `package_status.py` - Package state machine (use `validate_transition()` or `transition_package()`)
  - `stripe_identity_service.py` - Stripe Identity for courier ID verification
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
- `components/` - Reusable components (ErrorBoundary, LanguageSwitcher, UnverifiedCourierGuard, CourierVerificationGuard, VerificationBanner, etc.)
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

**Distance Units (km/miles):**
- Backend stores all distances in **kilometers** (e.g., `max_deviation_km`)
- Frontend displays all distances in **miles** for US users
- Use `lib/distance.ts` utilities for conversion:
  ```typescript
  import { kmToMiles, milesToKm } from '@/lib/distance';

  // Display: convert km → miles
  const displayValue = kmToMiles(user.max_deviation_km).toFixed(1);  // "3.1"

  // Input: convert miles → km for storage
  const storageValue = milesToKm(parseFloat(inputValue));
  ```
- See **[frontend/docs/DISTANCE_UNITS.md](frontend/docs/DISTANCE_UNITS.md)** for implementation details

### Testing

**Backend:** Pytest fixtures in `tests/conftest.py`:
- `client` - TestClient with database override
- `authenticated_sender`, `authenticated_courier`, `authenticated_both_role`, `authenticated_admin` - Pre-authenticated tokens
- `test_package_data`, `test_user_data`, `test_courier_data` - Sample data
- `test_verified_user`, `test_admin` - User objects for direct DB operations

**Frontend:** Jest + React Testing Library. Tests in `__tests__/` directories.

**E2E (Playwright):** Tests in `frontend/e2e/` using fixtures from `frontend/e2e/fixtures/test-fixtures.ts`:
- Test users: `TEST_USERS.sender`, `TEST_USERS.courier`, `TEST_USERS.both`, `TEST_USERS.admin`
- Helpers: `loginUser(page, user)`, `logoutUser(page)`, page object helpers (`NavbarHelper`, `PackageHelper`, `RouteHelper`)
- Run single test: `npx playwright test e2e/auth.spec.ts`

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

## ID Verification (Stripe Identity)

Couriers must verify their identity before placing bids or accepting packages. Uses Stripe Identity for document + selfie verification.

**Status Flow:**
```
PENDING → PROCESSING → VERIFIED (success)
                    → FAILED (automated rejection)
                    → REQUIRES_REVIEW (manual review needed)

FAILED/REQUIRES_REVIEW → ADMIN_APPROVED (manual approval)
                       → ADMIN_REJECTED (manual rejection)
```

**Endpoints:**
- `GET /api/id-verification/status` - Current verification status
- `POST /api/id-verification/start` - Start verification (returns Stripe Identity URL)
- `GET /api/id-verification/history` - Verification history
- `POST /api/id-verification/webhook` - Stripe webhook handler

**Admin Endpoints:**
- `GET /api/id-verification/admin/pending` - Pending reviews
- `GET /api/id-verification/admin/all` - All verifications
- `POST /api/id-verification/admin/{id}/review` - Approve/reject
- `PUT /api/admin/users/{user_id}/toggle-id-verified` - Manually toggle user's ID verification status

**Environment Variables:**
```bash
STRIPE_SECRET_KEY=sk_xxx  # Same as payments
STRIPE_IDENTITY_WEBHOOK_SECRET=whsec_xxx  # Separate webhook secret for identity events
```

**Enforcement:**
- Couriers without `id_verified=True` cannot place bids (checked in `bids.py`)
- Frontend `VerificationBanner.tsx` prompts couriers to verify
- Admin can manually approve failed verifications

**Admin UI for ID Verification:**
- Admin users list (`/admin` → Users tab) shows ID verification status column
- Click the ID badge to toggle verification status directly from the list
- User detail page (`/admin/users/{id}`) allows editing ID verification status in edit mode
- All ID verification changes are logged to the audit log

## User Verification Restrictions

All users must complete verification to access platform features. Verification requirements vary by role:

**Senders require:**
1. **Email verified** (`is_verified=True`)
2. **Phone verified** (`phone_verified=True`)

**Couriers require:**
1. **Email verified** (`is_verified=True`)
2. **Phone verified** (`phone_verified=True`)
3. **ID verified** (`id_verified=True`)

**Users with `both` role** follow courier verification requirements (all three verifications needed).

**Unverified users are restricted to:**
- `/dashboard` - View verification status and start verification
- `/id-verification` - Complete ID verification process (couriers)
- Public routes (login, register, etc.)

**Implementation (Frontend):**
- `UnverifiedCourierGuard` (`components/UnverifiedCourierGuard.tsx`) - Global guard in `providers.tsx` that redirects unverified users to `/dashboard`
- `CourierVerificationGuard` (`components/CourierVerificationGuard.tsx`) - Individual route guard for courier-specific pages
- `Navbar.tsx` - Hides inaccessible features (messages, notifications, reviews, sender/courier tabs) for unverified users
- `VerificationBanner.tsx` - Prompts couriers to complete ID verification
- Dashboard shows verification banner for unverified senders

**Verification Check Logic:**
```typescript
// Senders need email + phone
const isSenderVerified = user.is_verified && user.phone_verified

// Couriers need email + phone + ID
const isCourierFullyVerified = user.is_verified && user.phone_verified && user.id_verified

// General features (messages, notifications, reviews) access:
// - Admins: always allowed
// - Senders: need email + phone
// - Couriers: need email + phone + ID
// - Both: need courier-level verification (all three)
```

## Package Status State Machine

Transitions enforced in `app/services/package_status.py` - always use `validate_transition()` or `transition_package()`:

```
NEW → OPEN_FOR_BIDS → BID_SELECTED → PENDING_PICKUP → IN_TRANSIT → DELIVERED
                          ↓                ↓              ↓
                    OPEN_FOR_BIDS*       FAILED         FAILED

CANCELED can occur from any non-terminal state (except IN_TRANSIT and FAILED)
FAILED → OPEN_FOR_BIDS (admin only retry)
```

## Route-Package Matching Algorithm

The matching algorithm finds packages along a courier's route within a configurable deviation distance.

**How it works:**
1. Creates a Shapely `LineString` from route start→end coordinates
2. For each `OPEN_FOR_BIDS` package, calculates distance from pickup/dropoff to route
3. Matches if BOTH points are within `max_deviation_km`
4. Returns packages sorted by estimated detour (shortest first)

**Key files:** `app/routes/matching.py`, `app/utils/geo.py`

**Current Limitations & Future Improvements:**

| Priority | Improvement | Reason |
|----------|-------------|--------|
| High | Use PostGIS `ST_DWithin` for spatial filtering | Current O(n) Python filtering won't scale past ~10k packages |
| Medium | Add date/deadline matching | Package due tomorrow shouldn't match route next week |
| Medium | Check route direction | Ensure pickup comes before dropoff along route (avoid backtracking) |
| Low | Use geodesic/UTM projection | Shapely uses flat-earth math; ~10-20% error at 200km+ routes |
| Low | Support multi-point routes | Current straight-line model doesn't match curved road routes |

**Note:** The algorithm uses Shapely's Cartesian distance, not the spherical `point_to_line_distance` in `geo.py`. At LA-SD scale (~180km), expect ~10-20% distance variance between the two methods.

See **[backend/docs/MATCHING_FEATURE.html](backend/docs/MATCHING_FEATURE.html)** for detailed documentation.

## Bidding System

**Bid States:** `PENDING` → `SELECTED` | `REJECTED` | `WITHDRAWN` | `EXPIRED`

**Timeline:**
- First bid starts 24-hour deadline for sender to select
- If deadline expires without selection: auto-extends 12 hours (max 2 extensions)
- After 2 extensions: all bids expire, package returns to `OPEN_FOR_BIDS`
- 6 hours before deadline: warning notification sent to sender

**Key files:** `app/routes/bids.py`, `app/services/bid_deadline_job.py`

## Environment Setup

**Required services:**
- PostgreSQL with PostGIS extension
- Redis (for WebSocket pub/sub and caching)
- SMTP server (for email verification)

**Optional services:**
- Stripe (payments + ID verification) - Stripe Connect for courier payouts, Stripe Identity for courier ID verification
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

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for Heroku deployment guide including:
- Separate backend/frontend apps setup
- PostgreSQL with PostGIS and Redis add-ons
- Stripe Identity webhook configuration
- Environment variables and migrations
