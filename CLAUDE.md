# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Reference

```bash
# Monorepo Commands (from root)
pnpm install                              # Install all dependencies
pnpm dev                                  # Start all apps in dev mode
pnpm build                                # Build all packages and apps
pnpm dev --filter=@chaski/web             # Start web app only
pnpm dev --filter=@chaski/mobile          # Start mobile app only

# Backend (from backend/)
source venv/bin/activate && uvicorn main:app --reload --port 8000  # Dev server
pytest tests/test_<file>.py::test_<name> -v                        # Single test
pytest --cov=app tests/                                            # All tests + coverage

# Web Frontend (from apps/web/)
pnpm dev                                   # Dev server (localhost:3000)
pnpm test -- path/to/test                  # Single test
pnpm test:e2e                              # Playwright E2E tests

# Mobile (from apps/mobile/)
pnpm start                                 # Start Expo dev server
pnpm ios                                   # Run on iOS simulator
pnpm android                               # Run on Android emulator

# API Docs: http://localhost:8000/docs (Swagger UI)
```

## Project Overview

Chaski is a logistics platform connecting package senders with couriers traveling along the same route. The project uses a **Turborepo monorepo** with:
- **Backend**: FastAPI (Python)
- **Web**: Next.js 14 (TypeScript)
- **Mobile**: Expo/React Native (TypeScript)
- **Shared Packages**: Types, utilities, API client, i18n

## Monorepo Structure

```
chaski/
├── apps/
│   ├── web/                    # Next.js web application
│   │   ├── app/[locale]/       # Pages with i18n
│   │   ├── components/         # React components
│   │   ├── lib/                # Utilities (re-exports from shared packages)
│   │   └── e2e/                # Playwright tests
│   └── mobile/                 # Expo React Native app
│       ├── src/app/            # Expo Router file-based routing
│       ├── src/components/     # React Native components
│       ├── src/contexts/       # Auth, etc.
│       └── src/services/       # API client setup
├── packages/
│   ├── shared-types/           # TypeScript interfaces (UserResponse, PackageResponse, etc.)
│   ├── shared-utils/           # Distance, validation, phone, package-status utilities
│   ├── shared-i18n/            # Translation files (en, fr, es)
│   └── api-client/             # Platform-agnostic API client with adapters
├── backend/                    # FastAPI backend (not in pnpm workspace)
├── turbo.json                  # Turborepo pipeline config
├── pnpm-workspace.yaml         # Workspace definition
└── package.json                # Root package.json with turbo scripts
```

## Shared Packages

### @chaski/shared-types
All TypeScript interfaces extracted from the API:
```typescript
import type { UserResponse, PackageResponse, BidResponse } from '@chaski/shared-types'
```

### @chaski/shared-utils
Utility functions shared between web and mobile:
```typescript
import { kmToMiles, formatMiles, isValidUSPhone, getStatusLabel } from '@chaski/shared-utils'
```

### @chaski/shared-i18n
Translation files and locale utilities:
```typescript
import { translations, SUPPORTED_LOCALES, isValidLocale } from '@chaski/shared-i18n'
```

### @chaski/api-client
Platform-agnostic API client with adapters:
```typescript
// Web (with cookies/CSRF)
import { createApiClient } from '@chaski/api-client'
import { createAxiosAdapter } from '@chaski/api-client/adapters/axios'

// Mobile (with Bearer token)
import { createApiClient } from '@chaski/api-client'
import { createFetchAdapter } from '@chaski/api-client/adapters/fetch'
```

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

### Web App (Next.js)
```bash
cd apps/web
pnpm dev                # Dev server
pnpm test               # Run tests
pnpm test -- path/to/test   # Single test
pnpm test:watch         # Watch mode
pnpm test:coverage      # With coverage
pnpm build              # Production build
pnpm lint               # Lint
```

### Mobile App (Expo)
```bash
cd apps/mobile
pnpm start              # Start Expo dev server
pnpm ios                # Run on iOS simulator
pnpm android            # Run on Android emulator
pnpm build:dev          # Build development client (EAS)
pnpm build:preview      # Build preview APK/IPA
```

### E2E Testing (Playwright)
```bash
cd apps/web
pnpm test:e2e           # Run all E2E tests
pnpm test:e2e:ui        # Interactive UI
pnpm test:e2e:headed    # Headed browser
pnpm test:e2e:debug     # Debug mode
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

### Web App Structure (apps/web/)
- `app/[locale]/` - Next.js 14 App Router pages with i18n locale prefix
- `lib/api.ts` - Centralized API client (all API calls must go through this, no direct axios in components)
  - Axios with `withCredentials: true`, auto CSRF token handling
  - API modules: `authAPI`, `packagesAPI`, `couriersAPI`, `matchingAPI`, `adminAPI`, `bidsAPI`, `paymentsAPI`, etc.
- `lib/distance.ts` - Re-exports from `@chaski/shared-utils`
- `lib/logger.ts` - Frontend error tracking (sends to `/api/logs/frontend` in production)
- `hooks/useWebSocket.ts` - WebSocket with auto-reconnect
- `contexts/WebSocketContext.tsx` - App-wide real-time updates
- `components/` - Reusable components (ErrorBoundary, LanguageSwitcher, UnverifiedCourierGuard, CourierVerificationGuard, VerificationBanner, etc.)
- `i18n/request.ts` - Uses `@chaski/shared-i18n` for translations

### Mobile App Structure (apps/mobile/)
- `src/app/` - Expo Router file-based navigation
  - `(auth)/` - Login, register, forgot-password screens
  - `(tabs)/` - Main tab navigation (dashboard, packages, routes, messages, profile)
- `src/components/` - React Native components
- `src/contexts/AuthContext.tsx` - Authentication with SecureStore token storage
- `src/services/api.ts` - API client using `@chaski/api-client` with fetch adapter
- `src/utils/i18n.ts` - i18next setup with `@chaski/shared-i18n`
- `metro.config.js` - Configured for monorepo package resolution
- `app.json` - Expo configuration with permissions

### Key Patterns

**Authentication:**
- **Web**: JWT in httpOnly cookies, CSRF protection via double-submit cookie pattern
- **Mobile**: JWT stored in SecureStore, Bearer token in Authorization header
- `get_current_user` / `get_current_admin_user` FastAPI dependencies
- Account lockout after 5 failed attempts (15 min)
- Role-based access: sender, courier, both, admin

**Security:**
- CSRF tokens required for state-changing requests on web (header: `X-CSRF-Token`)
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
- Web: Cookie-based auth
- Mobile: Token passed via query parameter (`?token=xxx`)
- Events: `notification_created`, `unread_count_updated`, `message_received`

**Code Rules:**
- Backend utilities centralized in `app/utils/` - never duplicate
- Web/Mobile API calls through shared `@chaski/api-client`
- TypeScript types from `@chaski/shared-types` - never duplicate
- Shared utilities from `@chaski/shared-utils` - never duplicate
- Package status changes via `package_status.py` functions only

**Distance Units (km/miles):**
- Backend stores all distances in **kilometers** (e.g., `max_deviation_km`)
- Frontend displays all distances in **miles** for US users
- Use `@chaski/shared-utils` for conversion:
  ```typescript
  import { kmToMiles, milesToKm, formatMiles } from '@chaski/shared-utils'

  // Display: convert km → miles
  const displayValue = kmToMiles(user.max_deviation_km).toFixed(1);  // "3.1"

  // Input: convert miles → km for storage
  const storageValue = milesToKm(parseFloat(inputValue));
  ```
- See **[apps/web/docs/DISTANCE_UNITS.md](apps/web/docs/DISTANCE_UNITS.md)** for implementation details

### Testing

**Backend:** Pytest fixtures in `tests/conftest.py`:
- `client` - TestClient with database override
- `authenticated_sender`, `authenticated_courier`, `authenticated_both_role`, `authenticated_admin` - Pre-authenticated tokens
- `test_package_data`, `test_user_data`, `test_courier_data` - Sample data
- `test_verified_user`, `test_admin` - User objects for direct DB operations

**Web Frontend:** Jest + React Testing Library. Tests in `__tests__/` directories.

**E2E (Playwright):** Tests in `apps/web/e2e/` using fixtures from `apps/web/e2e/fixtures/test-fixtures.ts`:
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

**Web:** Uses `next-intl` with locale-based routing (`/en`, `/fr`, `/es`).

**Mobile:** Uses `react-i18next` with `expo-localization` for device language detection.

**Shared translations:** All translations in `@chaski/shared-i18n`:
```typescript
// Web (next-intl)
const t = useTranslations('namespace');

// Mobile (react-i18next)
const { t } = useTranslation();
t('namespace.key')
```

Translation files: `packages/shared-i18n/src/locales/{en,fr,es}.json`

See **[apps/web/I18N_PLAN.md](apps/web/I18N_PLAN.md)** for full roadmap.

## Logging

**Backend** (`backend/logs/`): Structured JSON logging with rotation (10MB, 5 backups)
- `app.log` - All logs, `error.log` - Errors only, `requests.log` - HTTP requests, `performance.log` - Slow requests

**Web Frontend** (`lib/logger.ts`): Sends to `/api/logs/frontend` in production
```typescript
import { logError } from '@/lib/logger';
logError('Failed to process', error, { context });
```

View logs: `tail -f backend/logs/app.log | jq .`

## Audit Logging

All security-relevant actions are tracked in the `audit_logs` table via `app/services/audit_service.py`.

**Usage:**
```python
from app.services.audit_service import log_audit_event
from app.models.audit_log import AuditAction

log_audit_event(
    db=db,
    action=AuditAction.PACKAGE_CREATE,
    user_id=current_user.id,
    resource_type="package",
    resource_id=package.id,
    details={"size": "medium"},
    request=request  # Captures IP and user agent
)
```

**Action Categories (50+ actions):**

| Category | Actions |
|----------|---------|
| **Authentication** | `LOGIN_SUCCESS`, `LOGIN_FAILED`, `LOGOUT`, `REGISTER`, `PASSWORD_RESET_*`, `EMAIL_VERIFICATION`, `OAUTH_LOGIN` |
| **Security** | `ACCOUNT_LOCKED`, `SESSION_*`, `PASSWORD_CHANGED`, `TOKEN_BLACKLISTED` |
| **Access Control** | `UNAUTHORIZED_ACCESS`, `PERMISSION_DENIED` |
| **File Upload** | `FILE_UPLOAD_SUCCESS`, `FILE_UPLOAD_FAILED`, `FILE_VALIDATION_FAILED`, `SUSPICIOUS_FILE_UPLOAD` |
| **User Management** | `USER_CREATE`, `USER_UPDATE`, `USER_ROLE_CHANGE`, `USER_ACTIVATE`, `USER_DEACTIVATE`, `USER_DELETE` |
| **Packages** | `PACKAGE_CREATE`, `PACKAGE_UPDATE`, `PACKAGE_STATUS_CHANGE`, `PACKAGE_CANCEL`, `PACKAGE_DELETE` |
| **Courier** | `ROUTE_CREATE`, `ROUTE_UPDATE`, `ROUTE_DELETE`, `PACKAGE_ACCEPT`, `PACKAGE_REJECT` |
| **Bidding** | `BID_CREATED`, `BID_WITHDRAWN`, `BID_SELECTED` |
| **ID Verification** | `ID_VERIFICATION_STARTED`, `ID_VERIFICATION_COMPLETED`, `ID_VERIFICATION_FAILED`, `ID_VERIFICATION_ADMIN_*` |
| **Data Privacy** | `DATA_EXPORT_REQUEST`, `DATA_EXPORT_COMPLETED` |

**Admin endpoint:** `GET /api/logs/audit` - Query audit logs with filters (action, user, date range)

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

Also available in frontend via `@chaski/shared-utils`:
```typescript
import { isValidTransition, getStatusLabel, getStatusColor } from '@chaski/shared-utils'
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

**Web App `.env.local`:** Copy from `.env.example`
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-key  # For address autocomplete
```

**Mobile App:** Configure in `app.json` or via environment:
```javascript
// apps/mobile/app.json → extra
{
  "extra": {
    "apiUrl": "http://localhost:8000"
  }
}
```

## Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for Heroku deployment guide including:
- Separate backend/frontend apps setup
- PostgreSQL with PostGIS and Redis add-ons
- Stripe Identity webhook configuration
- Environment variables and migrations

### Mobile Deployment (EAS Build)
```bash
cd apps/mobile
eas build --profile development   # Development client
eas build --profile preview       # Internal testing
eas build --profile production    # App store release
```
