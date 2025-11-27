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
- `app/models/` - SQLAlchemy models (User, Package, Notification, CourierRoute, Rating, Message)
- `app/routes/` - API endpoints organized by domain:
  - `auth.py` - Registration, login, email verification, OAuth
  - `packages.py` - Package CRUD for senders
  - `couriers.py` - Route management for couriers
  - `matching.py` - Package-courier matching algorithm
  - `admin.py` - Admin-only user/package management
  - `notifications.py` - User notification management
  - `ratings.py` - Rating and review system
  - `messages.py` - In-app messaging between sender and courier
  - `ws.py` - WebSocket endpoint for real-time updates
- `app/utils/` - Shared utilities:
  - `dependencies.py` - FastAPI dependencies (`get_current_user`, `get_current_admin_user`)
  - `auth.py` - JWT token and password hashing
  - `email.py` - Email sending via FastAPI-Mail (includes event notification emails)
  - `geo.py` - Geospatial calculations for route matching
  - `oauth.py` - Google OAuth configuration
- `app/services/` - Business logic services:
  - `websocket_manager.py` - WebSocket connection manager and broadcast functions
- `test_data/` - JSON fixtures and loader script for seeding the database

### Frontend Structure
- `app/` - Next.js 14 App Router pages
- `lib/api.ts` - Axios client with auth interceptor and TypeScript interfaces for all API types
- `hooks/` - Custom React hooks:
  - `useWebSocket.ts` - WebSocket connection hook with auto-reconnect
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

**Backend:** Pytest with fixtures in `tests/conftest.py` providing:
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

## Current Features

- **Authentication**: Email/password, JWT tokens, email verification, Google OAuth
- **Package Management**: Full CRUD, status tracking, cancel functionality
- **Courier Routes**: Create/update/delete routes, one active route per courier
- **Matching Algorithm**: Geospatial matching using haversine/cross-track distance
- **Admin Dashboard**: User management, package management, platform statistics
- **Notification System**: Full backend API, email notifications, frontend dropdown with unread badge, full notifications page at /notifications
- **Rating & Review System**:
  - Backend: Rating model, API endpoints (create rating, get user ratings, get pending ratings)
  - Frontend: StarRating component, RatingModal for post-delivery ratings, reviews page at /profile/reviews
  - User ratings displayed in navbar with link to reviews page
  - Automatic rating prompts on dashboard after package delivery
- **Real-time Updates (WebSocket)**:
  - Backend: WebSocket endpoint at `/api/ws` with JWT authentication
  - Connection manager supporting multiple connections per user
  - Real-time notification broadcast on all package events (status changes, matching, cancellation)
  - Events: `notification_created`, `unread_count_updated`, `message_received`, `ping/pong`
  - Frontend: `useWebSocket` hook with auto-reconnect and fallback polling
  - NotificationDropdown integrates WebSocket for instant updates with visual connection indicator
  - Comprehensive test suite (12 tests)
- **In-App Messaging**:
  - Backend: Message model, API endpoints at `/api/messages`
  - Package-based conversations: sender and courier can chat about a specific package
  - Available at any package status (pending through delivered)
  - Private: only sender and courier can view/send messages (admins excluded)
  - Real-time delivery via WebSocket `message_received` event
  - Frontend: ChatWindow component, dedicated /messages page, chat in package detail page
  - Messages icon in navbar with unread badge
  - Comprehensive test suite (11 tests)

## Pending Features

### High Priority
- **Payment & Earnings System (Stripe)**: Payment processing, courier earnings dashboard, commission handling, payouts
- **Verification & Trust System**: ID verification, trust scores, verification badges, fraud detection
- **Dispute Resolution**: Claim creation, evidence upload, mediation workflow, resolution tracking

### Medium Priority
- **Scheduling & Time Windows**: Pickup/delivery time preferences, courier availability, SLA tracking
- **Advanced Courier Search/Filtering**: Filter packages by price, size, time window, sender rating

### Lower Priority
- **Insurance Options**: Optional coverage for high-value packages, claims process
- **Analytics Dashboards**: Courier earnings trends, sender cost analysis, admin demand heatmaps
- **Mobile App (React Native)**: Push notifications, real-time tracking
