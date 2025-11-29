# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chaski is a logistics platform connecting package senders with couriers traveling along the same route. It's a full-stack application with a FastAPI backend and Next.js frontend.

## Development Commands

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate  # Activate virtual environment

# Run development server
uvicorn main:app --reload --port 8000

# Run tests
pytest

# Run single test file
pytest tests/test_packages.py

# Run single test function
pytest tests/test_packages.py::test_create_package_success -v

# Run with coverage
pytest --cov=app tests/

# Load test data (users, packages, routes, notifications)
python -m test_data.load_test_data
```

### Frontend (Next.js)
```bash
cd frontend

# Run development server
npm run dev

# Run tests
npm test

# Run single test file
npm test -- path/to/test.tsx

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Build
npm run build

# Lint
npm run lint
```

## Architecture

### Backend Structure
- `main.py` - FastAPI app entry point with middleware (CORS, security headers, rate limiting, sessions)
- `app/config.py` - Environment settings via pydantic-settings
- `app/database.py` - SQLAlchemy database connection and session management
- `app/models/` - SQLAlchemy models:
  - `user.py` - User model with UserRole enum
  - `package.py` - Package and CourierRoute models with PackageStatus/PackageSize enums
  - `notification.py` - Notification model
  - `rating.py` - Rating model
  - `message.py` - Message model
  - `audit_log.py` - AuditLog model with AuditAction enum (28 action types)
  - `bid.py` - CourierBid model for bidding system
  - `delivery_proof.py` - Delivery proof images and verification
  - `payment.py` - Stripe payment intent tracking
  - `tracking.py` - Real-time location tracking for deliveries
  - `analytics.py` - Platform metrics and statistics
- `app/routes/` - API endpoints organized by domain:
  - `auth.py` - Registration, login, email verification, password reset, OAuth
  - `packages.py` - Package CRUD for senders
  - `couriers.py` - Route management for couriers
  - `matching.py` - Package-courier matching algorithm
  - `admin.py` - Admin-only user/package management, audit logs
  - `notifications.py` - User notification management
  - `ratings.py` - Rating and review system
  - `messages.py` - In-app messaging between sender and courier
  - `ws.py` - WebSocket endpoint for real-time updates
  - `bids.py` - Bidding system for courier price proposals
  - `payments.py` - Stripe payment intent creation and confirmation
  - `payouts.py` - Courier payout requests via Stripe Connect
  - `delivery_proof.py` - Delivery proof image upload (AWS S3)
  - `tracking.py` - Real-time location tracking for deliveries
  - `analytics.py` - Platform statistics and metrics
  - `notes.py` - Package notes for sender-courier communication
  - `logs.py` - Frontend error logging endpoint
- `app/utils/` - Shared utilities:
  - `dependencies.py` - FastAPI dependencies (`get_current_user`, `get_current_admin_user`)
  - `auth.py` - JWT token and password hashing
  - `email.py` - Email sending via FastAPI-Mail (includes event notification emails)
  - `geo.py` - Geospatial calculations for route matching (centralized `haversine_distance` function)
  - `oauth.py` - Google OAuth configuration
  - `tracking_id.py` - Unique tracking ID generation for packages
  - `sms.py` - SMS sending utility (console logging for development)
  - `logging_config.py` - Structured logging configuration with file rotation
- `app/services/` - Business logic services:
  - `websocket_manager.py` - WebSocket connection manager and broadcast functions
  - `matching_job.py` - Background job for automatic package-route matching (can run as standalone script)
  - `route_optimizer.py` - Route optimization algorithms
  - `audit_service.py` - Audit logging service for sensitive operations
  - `redis_client.py` - Redis connection manager for pub/sub and caching
  - `stripe_service.py` - Stripe payment and payout operations
  - `file_storage.py` - AWS S3 file upload/download for delivery proofs
  - `tracking_service.py` - Live location update handling with Redis cache
  - `package_status.py` - Complex package state transitions
  - `bid_deadline_job.py` - Background job for bid deadline monitoring
  - `route_cleanup_job.py` - Periodic cleanup of expired/completed routes
  - `route_deactivation_service.py` - Automatic route deactivation after completion/expiry
  - `user_service.py` - User-related business logic operations
- `test_data/` - JSON fixtures and loader script for seeding the database
- `app/middleware/` - FastAPI middleware:
  - `logging_middleware.py` - Request/response logging, performance monitoring, user activity tracking

### Frontend Structure
- `app/` - Next.js 14 App Router pages
- `lib/api.ts` - Centralized API client with:
  - Axios instance with auth interceptor and `withCredentials: true`
  - TypeScript interfaces for all API types
  - Organized API modules: `authAPI`, `packagesAPI`, `couriersAPI`, `matchingAPI`, `notificationsAPI`, `ratingsAPI`, `messagesAPI`, `adminAPI`, `verificationAPI`, `bidsAPI`, `paymentsAPI`, `payoutsAPI`, `trackingAPI`, `proofAPI`, `analyticsAPI`
  - All API calls should go through these modules (no direct axios calls in components)
- `lib/logger.ts` - Frontend error tracking and logging utility
- `hooks/` - Custom React hooks:
  - `useWebSocket.ts` - WebSocket connection hook with auto-reconnect
- `contexts/` - React contexts:
  - `WebSocketContext.tsx` - Shared WebSocket provider for app-wide real-time updates (wraps useWebSocket)
- `components/` - Reusable React components:
  - `ErrorBoundary.tsx` - React Error Boundary for catching and logging component errors

### Key Patterns

**Authentication Flow:**
1. JWT tokens stored in httpOnly cookies (set by server)
2. `lib/api.ts` configured with `withCredentials: true` to send cookies
3. Backend `get_current_user` dependency validates tokens from cookies
4. Role-based access: sender, courier, both, admin
5. Password reset via email with secure time-limited tokens (1 hour expiry)

**Database:**
- PostgreSQL with PostGIS for geospatial queries
- Tests use SQLite in-memory database (see `tests/conftest.py`)

**API Design:**
- All endpoints prefixed with `/api/`
- Pydantic models for request/response validation
- Role-based guards via FastAPI dependencies

**Real-time Updates:**
- WebSocket endpoint at `/api/ws` with JWT authentication
- Events: `notification_created`, `unread_count_updated`, `message_received`, `ping/pong`
- Frontend `useWebSocket` hook with auto-reconnect and fallback polling

**Code Organization:**
- Backend: Shared utilities (like `haversine_distance`) are centralized in `app/utils/` - import from there instead of duplicating
- Frontend: All API calls go through `lib/api.ts` modules - no direct axios/fetch calls in components
- TypeScript types for API responses are defined in `lib/api.ts` and should be reused

### Testing

**Backend:** Pytest with fixtures in `tests/conftest.py` providing:
- `client` - TestClient with database override
- `authenticated_sender`, `authenticated_courier`, `authenticated_both_role`, `authenticated_admin` - Pre-authenticated tokens
- `test_package_data`, `test_user_data`, `test_courier_data` - Sample data fixtures
- `test_verified_user`, `test_admin` - User objects (not tokens) for direct database operations

**Frontend:** Jest with React Testing Library. Test files colocated in `__tests__/` directories.

**E2E Testing:** Playwright for full user flow testing:
```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Run with interactive UI
npm run test:e2e:headed    # Run in headed browser mode
npm run test:e2e:debug     # Run in debug mode
```

## Role System

Users have one role: `sender`, `courier`, `both`, or `admin`
- **sender**: Can create/manage packages
- **courier**: Can create routes, view/accept matching packages
- **both**: Combined sender and courier capabilities
- **admin**: Full platform management, created directly in database

## Current Features

- **Authentication**: Email/password, JWT tokens (httpOnly cookies), email verification, password reset, Google OAuth
- **Package Management**: Full CRUD, status state machine (see below), soft delete
- **Courier Routes**: Create/update/delete routes, one active route per courier
- **Matching Algorithm**: Geospatial matching using haversine/cross-track distance
- **Bidding System**: Couriers submit price proposals, senders select winning bid, deadline with extensions (max 2)
- **Payments**: Stripe payment intents for senders, escrow until delivery confirmed
- **Payouts**: Stripe Connect for courier accounts, minimum threshold for payout requests
- **Delivery Proof**: Image upload to AWS S3, verification workflow, proof required flag
- **Real-time Tracking**: Live location updates from couriers, Redis cache, location history
- **Admin Dashboard**: User management, package management, platform statistics, audit logs
- **Analytics**: Platform metrics, visualizations (Recharts), admin-only dashboard
- **Notification System**: Backend API, email notifications, real-time WebSocket updates, frontend dropdown with unread badge
- **Rating & Review System**: Post-delivery ratings, user average ratings, reviews page at /profile/reviews
- **In-App Messaging**: Package-based conversations between sender and courier, real-time via WebSocket
- **Audit Logging**: Tracks authentication, admin actions, package operations, courier routes with IP/user agent
- **Package Notes**: Sender can add notes to packages for courier visibility
- **Tracking IDs**: Unique tracking identifiers for each package for easy reference
- **Internationalization (i18n)**: Multi-language support for English, French, and Spanish using next-intl
- **Phone Verification**: SMS-based phone number verification for users (console logging in development)
- **Logging System**: Comprehensive structured logging with file rotation, request/response tracking, performance monitoring, and frontend error tracking

## Internationalization (i18n)

The frontend supports multiple languages using `next-intl`. See **[frontend/I18N_PLAN.md](frontend/I18N_PLAN.md)** for the complete internationalization roadmap.

**Current Status:**
- ✅ Infrastructure set up with next-intl
- ✅ Locale-based routing (`/en`, `/fr`, `/es`)
- ✅ Language switcher component in navbar
- ✅ Initial translation keys for common UI elements
- 🚧 Full page translations (in progress - see I18N_PLAN.md)

**Supported Languages:**
- English (en) - Default
- French (fr)
- Spanish (es)

**Key Files:**
- `frontend/i18n/request.ts` - i18n configuration
- `frontend/middleware.ts` - Locale routing middleware
- `frontend/messages/*.json` - Translation files (en.json, fr.json, es.json)
- `frontend/components/LanguageSwitcher.tsx` - Language selector component

**Usage in Components:**

Client Components:
```typescript
'use client';
import { useTranslations } from 'next-intl';

export default function Component() {
  const t = useTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
```

Server Components:
```typescript
import { getTranslations } from 'next-intl/server';

export default async function Page() {
  const t = await getTranslations('namespace');
  return <h1>{t('key')}</h1>;
}
```

**Adding New Translations:**
1. Add keys to all language files in `frontend/messages/*.json`
2. Use the `useTranslations()` hook in components
3. Replace hardcoded strings with `t('key')` calls
4. Test in all supported languages

**URL Structure:**
- Default (English): `http://localhost:3000/en`
- French: `http://localhost:3000/fr`
- Spanish: `http://localhost:3000/es`

**Next Steps:** See the detailed implementation plan in [frontend/I18N_PLAN.md](frontend/I18N_PLAN.md) for translating the remaining pages and backend components.

## Logging System

The application has a comprehensive logging system for monitoring, debugging, and error tracking across both backend and frontend.

### Backend Logging

**Configuration** (`app/utils/logging_config.py`):
- **Structured JSON logging** with timestamps, log levels, module/function info, and contextual data
- **Rotating file handlers** (max 10MB per file, keeps 5 backups)
- Multiple specialized log files in `backend/logs/`:
  - `app.log` - All application logs (DEBUG+)
  - `error.log` - Error logs only (ERROR+)
  - `requests.log` - HTTP request/response logs
  - `performance.log` - Performance metrics and slow request warnings
  - `frontend.log` - Frontend errors from browser

**Middleware** (`app/middleware/logging_middleware.py`):
1. **RequestLoggingMiddleware**:
   - Logs every HTTP request with unique request IDs
   - Captures: method, endpoint, IP address, user agent, query params, duration
   - Adds `X-Request-ID` header to responses for distributed tracing

2. **PerformanceMonitoringMiddleware**:
   - Monitors request execution time
   - Logs warnings for slow requests (>1 second threshold)
   - Skips health check and docs endpoints

3. **UserActivityLoggingMiddleware**:
   - Logs authenticated user actions
   - Tracks state-changing operations (POST, PUT, DELETE, PATCH)
   - Includes user ID and email

**Frontend Logging API** (`app/routes/logs.py`):
- Endpoint: `POST /api/logs/frontend`
- Receives and logs frontend errors, warnings, and info messages
- Captures stack traces, URLs, user agents, and custom context

**Log Format Example**:
```json
{
  "timestamp": "2025-11-29T11:49:30.420273",
  "level": "ERROR",
  "logger": "chaski.frontend",
  "message": "[FRONTEND] Test frontend error",
  "module": "logs",
  "function": "log_frontend_error",
  "line": 56,
  "request_id": "d8a4525f-e6fb-4731-916f-19c70b060b97",
  "ip_address": "127.0.0.1"
}
```

### Frontend Logging

**Logger Utility** (`lib/logger.ts`):
- Singleton logger with `error()`, `warn()`, and `info()` methods
- Captures error stack traces and contextual data
- Sends logs to backend in production only (via `/api/logs/frontend`)
- **Global error handlers** automatically log:
  - Unhandled JavaScript errors
  - Unhandled promise rejections
  - Network connectivity changes

**Error Boundary** (`components/ErrorBoundary.tsx`):
- React Error Boundary that catches component rendering errors
- Automatically logs errors to the logging system
- Shows user-friendly error UI with reload/go back options
- Displays error details in development mode

**Usage Example**:
```typescript
import { logError, logWarn, logInfo } from '@/lib/logger';

// Log an error with context
try {
  // code that might fail
} catch (error) {
  logError('Failed to process payment', error, { userId, packageId });
}

// Initialize global handlers in root layout
logger.initGlobalHandlers();
```

### Viewing Logs

**Development**:
```bash
# View all logs
tail -f backend/logs/app.log

# View requests only
tail -f backend/logs/requests.log | jq .

# View frontend errors
tail -f backend/logs/frontend.log | jq .

# View performance issues
tail -f backend/logs/performance.log | jq 'select(.duration_ms > 100)'
```

**Log Rotation**:
- Automatic rotation at 10MB
- Keeps 5 backup files (e.g., `app.log.1`, `app.log.2`, etc.)
- Old logs are automatically compressed and deleted

**Important Notes**:
- Logs directory is in `.gitignore` - logs are not committed
- In production, logs should be shipped to a centralized logging service (e.g., CloudWatch, DataDog)
- Request IDs allow tracing a single request across all log files
- Frontend errors only sent to backend in production mode

## Package Status State Machine

Package status transitions are strictly enforced in `app/services/package_status.py`:

```
NEW → OPEN_FOR_BIDS → BID_SELECTED → PENDING_PICKUP → IN_TRANSIT → DELIVERED
                          ↓                ↓              ↓
                    OPEN_FOR_BIDS*       FAILED         FAILED

CANCELED can occur from any non-terminal state (except IN_TRANSIT and FAILED)
FAILED → OPEN_FOR_BIDS (admin only retry)
```

**Status meanings:**
- `NEW`: Just created, auto-transitions to OPEN_FOR_BIDS
- `OPEN_FOR_BIDS`: Shown to couriers, accepting price proposals
- `BID_SELECTED`: Sender chose a courier from bids
- `PENDING_PICKUP`: Courier confirmed, awaiting pickup
- `IN_TRANSIT`: Courier confirmed pickup
- `DELIVERED`: Package delivered (terminal)
- `CANCELED`: Sender canceled (terminal)
- `FAILED`: Pickup/delivery failed (admin can retry)

**Important:** Always use `validate_transition()` or `transition_package()` from `package_status.py` - never update status directly.

## Environment Setup

**Required services:**
- PostgreSQL with PostGIS extension
- Redis (for WebSocket pub/sub and caching)
- SMTP server (for email verification)
- Stripe account (for payments)
- AWS S3 bucket (for delivery proof images)

**Backend `.env` file:** Copy from `.env.example` - includes database URL, JWT secret, email config, Stripe keys, AWS credentials.

**Frontend `.env.local` file:** Copy from `.env.example` - includes API URL and Google Places API key.
