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
- `app/utils/` - Shared utilities:
  - `dependencies.py` - FastAPI dependencies (`get_current_user`, `get_current_admin_user`)
  - `auth.py` - JWT token and password hashing
  - `email.py` - Email sending via FastAPI-Mail (includes event notification emails)
  - `geo.py` - Geospatial calculations for route matching (centralized `haversine_distance` function)
  - `oauth.py` - Google OAuth configuration
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
- `test_data/` - JSON fixtures and loader script for seeding the database

### Frontend Structure
- `app/` - Next.js 14 App Router pages
- `lib/api.ts` - Centralized API client with:
  - Axios instance with auth interceptor and `withCredentials: true`
  - TypeScript interfaces for all API types
  - Organized API modules: `authAPI`, `packagesAPI`, `couriersAPI`, `matchingAPI`, `notificationsAPI`, `ratingsAPI`, `messagesAPI`, `adminAPI`, `verificationAPI`, `bidsAPI`, `paymentsAPI`, `payoutsAPI`, `trackingAPI`, `proofAPI`, `analyticsAPI`
  - All API calls should go through these modules (no direct axios calls in components)
- `hooks/` - Custom React hooks:
  - `useWebSocket.ts` - WebSocket connection hook with auto-reconnect
- `contexts/` - React contexts:
  - `WebSocketContext.tsx` - Shared WebSocket provider for app-wide real-time updates (wraps useWebSocket)
- `components/` - Reusable React components

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
