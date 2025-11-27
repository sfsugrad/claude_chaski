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

# Run with coverage
pytest --cov=app tests/
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

# Build
npm run build

# Lint
npm run lint
```

## Architecture

### Backend Structure
- `main.py` - FastAPI app entry point with middleware configuration (CORS, security headers, rate limiting, sessions)
- `app/config.py` - Environment settings via pydantic-settings
- `app/database.py` - SQLAlchemy database connection and session management
- `app/models/` - SQLAlchemy models (User, Package, Notification)
- `app/routes/` - API endpoints organized by domain:
  - `auth.py` - Registration, login, email verification, OAuth
  - `packages.py` - Package CRUD for senders
  - `couriers.py` - Route management for couriers
  - `matching.py` - Package-courier matching algorithm
  - `admin.py` - Admin-only user/package management
  - `notifications.py` - User notification management
- `app/utils/` - Shared utilities:
  - `dependencies.py` - FastAPI dependencies (`get_current_user`, `get_current_admin_user`)
  - `auth.py` - JWT token and password hashing
  - `email.py` - Email sending via FastAPI-Mail (includes event notification emails)
  - `geo.py` - Geospatial calculations for route matching
  - `oauth.py` - Google OAuth configuration
- `app/services/` - Business logic services

### Frontend Structure
- `app/` - Next.js 14 App Router pages
- `lib/api.ts` - Axios client with auth interceptor and TypeScript interfaces for all API types
- `components/` - Reusable React components

### Key Patterns

**Authentication Flow:**
1. JWT tokens stored in localStorage
2. `lib/api.ts` interceptor adds Bearer token to all requests
3. Backend `get_current_user` dependency validates tokens
4. Role-based access: sender, courier, both, admin

**Database:**
- PostgreSQL with PostGIS for geospatial queries
- Tests use SQLite in-memory database (see `tests/conftest.py`)

**API Design:**
- All endpoints prefixed with `/api/`
- Pydantic models for request/response validation
- Role-based guards via FastAPI dependencies

### Testing

**Backend:** Pytest with fixtures in `conftest.py` providing:
- `client` - TestClient with database override
- `authenticated_sender`, `authenticated_courier`, `authenticated_admin` - Pre-authenticated tokens
- `test_package_data`, `test_user_data` - Sample data fixtures

**Frontend:** Jest with React Testing Library. Test files colocated in `__tests__/` directories.

## Role System

Users have one role: `sender`, `courier`, `both`, or `admin`
- **sender**: Can create/manage packages
- **courier**: Can create routes, view/accept matching packages
- **both**: Combined sender and courier capabilities
- **admin**: Full platform management, created directly in database

## Implementation Status

### Fully Implemented
- **Authentication**: Email/password, JWT tokens, email verification, Google OAuth
- **Package Management**: Full CRUD, status tracking, cancel functionality, edit pending packages
- **Courier Routes**: Create/update/delete routes, one active route per courier
- **Matching Algorithm**: Geospatial matching using haversine/cross-track distance, accept/decline packages
- **Admin Dashboard**: User management, package management, platform statistics
- **Notification System (Backend)**:
  - Notification model with types (package_matched, accepted, declined, picked_up, in_transit, delivered, cancelled, route_match_found, system)
  - Full API: GET /api/notifications, GET /api/notifications/unread-count, PUT /api/notifications/{id}/read, PUT /api/notifications/mark-read, DELETE endpoints
  - Email notification functions for all package events (matched, accepted, picked up, in transit, delivered, cancelled, declined, route match found)

### Not Yet Implemented
- Real-time updates (WebSockets)
- Frontend notification UI (dropdown component, badge in nav)
- Integration of notifications into existing endpoints (trigger on status changes)
- Rating & review system
- Payment integration
- Mobile app

## Remaining Implementation Plan

### Phase 1: Core Platform Completion

**1. Notification System (Remaining)**
- ~~Create `Notification` model (user_id, type, message, read, created_at)~~ DONE
- ~~Backend endpoints: GET /api/notifications, PUT /api/notifications/{id}/read~~ DONE
- ~~Extend `app/utils/email.py` for event notifications (matched, status change, delivered)~~ DONE
- Integrate notifications into existing endpoints (call `create_notification()` and email functions on events)
- Frontend: notification dropdown component, badge in nav

**2. Rating & Review System**
- Create `Rating` model (rater_id, rated_user_id, package_id, score 1-5, comment)
- Endpoints: POST /api/ratings, GET /api/users/{id}/ratings
- Add `average_rating` to User response
- Frontend: rating modal after delivery, display on profiles

**3. Real-time Updates**
- Add FastAPI WebSocket endpoint for live status updates
- Frontend: WebSocket hook for package/matching updates
- Fallback polling for unsupported browsers

### Phase 2: Monetization

**4. Payment Integration**
- Integrate Stripe SDK
- Create `Payment` model (package_id, amount, status, stripe_payment_id)
- Escrow flow: hold on match, release on delivery
- Frontend: payment form in package creation, payment history

### Phase 3: Mobile & Advanced Features

**5. Mobile App (React Native)**
- Share TypeScript types from `lib/api.ts`
- Core screens: auth, dashboard, package list, route creation
- Push notifications via Firebase

**6. Advanced Matching**
- Real road distances via Google Directions API
- Package categories (fragile, temperature-sensitive)
- Multi-package route optimization

### Priority Order

| Priority | Feature | Effort | Impact |
|----------|---------|--------|--------|
| 1 | Notification System | Medium | High |
| 2 | Rating System | Medium | High |
| 3 | Real-time Updates | Medium | Medium |
| 4 | Payment Integration | High | High |
| 5 | Mobile App | High | High |
