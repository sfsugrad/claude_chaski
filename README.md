# Chaski - Smart Courier Matching Platform

Chaski is a logistics platform that connects package senders with couriers traveling along the same route. Named after the Inca messengers, Chaski enables efficient package delivery by matching packages with travelers going the same way.

## Monorepo Structure

This is a Turborepo monorepo with pnpm workspaces:

```
chaski/
├── apps/
│   ├── web/                 # Next.js 14 web application
│   └── mobile/              # React Native Expo app
├── packages/
│   ├── shared-types/        # TypeScript types shared across apps
│   ├── shared-utils/        # Utility functions (distance, validation)
│   ├── shared-i18n/         # Translation files (en, fr, es)
│   └── api-client/          # Platform-agnostic API client
├── backend/                 # FastAPI backend (Python)
├── turbo.json              # Turborepo configuration
├── pnpm-workspace.yaml     # Workspace configuration
└── package.json            # Root package.json
```

## Features

### For Senders
- Create package delivery requests with Google Places address autocomplete
- Specify package details: size, weight, description, pricing
- Receive and manage bids from couriers
- Track package status in real-time
- Rate and review couriers after delivery
- Real-time messaging with couriers

### For Couriers
- Create travel routes with start/destination
- Set maximum deviation distance from route
- View packages matching your route
- Submit bids on packages
- ID verification via Stripe Identity
- Manage deliveries and upload proof of delivery

### For Admins
- Comprehensive admin dashboard with platform statistics
- User management with role-based access control
- Package management with filtering and soft delete
- ID verification review and approval
- Audit logging for all actions

### System Features
- Intelligent route matching algorithm
- Real-time WebSocket notifications
- Bid deadline system with auto-extension
- Multi-language support (English, French, Spanish)
- Secure authentication with JWT + CSRF protection
- Phone verification via Twilio
- Payment processing via Stripe

## Tech Stack

### Backend (FastAPI)
- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Database with PostGIS for geospatial queries
- **Redis** - Caching and WebSocket pub/sub
- **SQLAlchemy** - ORM for database operations
- **JWT** - Authentication with httpOnly cookies
- **Stripe** - Payments and ID verification
- **Twilio** - SMS/phone verification

### Web App (Next.js)
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first styling
- **next-intl** - Internationalization
- **Axios** - HTTP client with CSRF handling

### Mobile App (Expo)
- **Expo SDK 52** - React Native framework
- **Expo Router** - File-based navigation
- **TypeScript** - Type-safe development
- **Zustand + TanStack Query** - State management
- **react-i18next** - Internationalization

### Shared Packages
- **@chaski/shared-types** - TypeScript interfaces
- **@chaski/shared-utils** - Distance conversion, validation
- **@chaski/shared-i18n** - Translation files
- **@chaski/api-client** - Platform-agnostic API client

## Getting Started

### Prerequisites

- **Node.js 18+** and **pnpm 8+**
- **Python 3.9+** with virtual environment
- **PostgreSQL 14+** with PostGIS extension
- **Redis** for caching and WebSockets

### Quick Start

```bash
# Install pnpm globally (if not installed)
npm install -g pnpm

# Install all dependencies
pnpm install

# Build shared packages
pnpm run build --filter="@chaski/shared-*" --filter="@chaski/api-client"
```

### Run Development Servers

```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Terminal 2 - Web App
pnpm dev --filter=@chaski/web

# Terminal 3 - Mobile App
pnpm dev --filter=@chaski/mobile
```

Or run from within each app directory:

```bash
# Web app
cd apps/web && pnpm dev

# Mobile app
cd apps/mobile && pnpm start
```

### Monorepo Commands

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm run build

# Build specific packages
pnpm run build --filter=@chaski/shared-types
pnpm run build --filter="@chaski/shared-*"

# Run dev for specific app
pnpm dev --filter=@chaski/web
pnpm dev --filter=@chaski/mobile

# Lint all packages
pnpm run lint

# Type check all packages
pnpm run typecheck
```

## Backend Setup

1. **Create virtual environment:**
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```

2. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up PostgreSQL:**
   ```bash
   createdb chaski_db
   psql chaski_db -c "CREATE EXTENSION postgis;"
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Run migrations:**
   ```bash
   PYTHONPATH=. python migrations/<migration_name>.py
   ```

6. **Start server:**
   ```bash
   uvicorn main:app --reload --port 8000
   ```

## Web App Setup

1. **Navigate to web app:**
   ```bash
   cd apps/web
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start development server:**
   ```bash
   pnpm dev
   ```

   Web app available at `http://localhost:3000`

## Mobile App Setup

1. **Navigate to mobile app:**
   ```bash
   cd apps/mobile
   ```

2. **Start Expo development server:**
   ```bash
   pnpm start
   ```

3. **Run on simulators:**
   ```bash
   pnpm ios      # iOS Simulator
   pnpm android  # Android Emulator
   ```

4. **Run on physical device:**
   - Install Expo Go from App Store / Play Store
   - Scan the QR code shown in the terminal

See [apps/mobile/README.md](apps/mobile/README.md) for detailed mobile setup.

## Shared Packages Usage

```typescript
// Types
import type { UserResponse, PackageResponse } from '@chaski/shared-types'

// Utilities
import { kmToMiles, milesToKm, formatMiles } from '@chaski/shared-utils'

// API Client (Web - Axios adapter)
import { createApiClient } from '@chaski/api-client'
import { createAxiosAdapter } from '@chaski/api-client/adapters/axios'

// API Client (Mobile - Fetch adapter)
import { createApiClient } from '@chaski/api-client'
import { createFetchAdapter } from '@chaski/api-client/adapters/fetch'

// Translations
import { translations } from '@chaski/shared-i18n'
```

## Testing

### Backend Tests
```bash
cd backend
source venv/bin/activate
pytest                              # Run all tests
pytest tests/test_packages.py -v   # Single file
pytest --cov=app tests/            # With coverage
```

### Web App Tests
```bash
cd apps/web
pnpm test                  # Run tests
pnpm test:watch           # Watch mode
pnpm test:coverage        # With coverage
```

### E2E Tests (Playwright)
```bash
cd apps/web
pnpm test:e2e             # Run all E2E tests
pnpm test:e2e:ui          # Interactive UI mode
pnpm test:e2e:headed      # Headed browser
```

## API Documentation

When the backend is running, API documentation is available at:
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:pass@localhost:5432/chaski_db
SECRET_KEY=your-jwt-secret
ENCRYPTION_KEY=fernet-key
FRONTEND_URL=http://localhost:3000
REDIS_URL=redis://localhost:6379
# See .env.example for full list
```

### Web App (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-key
```

### Mobile App (app.json)
```json
{
  "expo": {
    "extra": {
      "apiUrl": "https://api.chaski.com"
    }
  }
}
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide including:
- Heroku deployment for backend and web app
- EAS Build for mobile app
- PostgreSQL with PostGIS and Redis configuration
- Stripe webhook setup

## Documentation

- [CLAUDE.md](CLAUDE.md) - Developer guide and codebase overview
- [DEPLOYMENT.md](DEPLOYMENT.md) - Production deployment guide
- [apps/mobile/README.md](apps/mobile/README.md) - Mobile app documentation
- [backend/docs/](backend/docs/) - Backend documentation
  - [USER_ROLES_LIFECYCLE.md](backend/docs/USER_ROLES_LIFECYCLE.md) - User roles and states
  - [MATCHING_FEATURE.html](backend/docs/MATCHING_FEATURE.html) - Matching algorithm details
- [apps/web/docs/](apps/web/docs/) - Web app documentation
  - [DISTANCE_UNITS.md](apps/web/docs/DISTANCE_UNITS.md) - Distance unit handling
- [apps/web/I18N_PLAN.md](apps/web/I18N_PLAN.md) - Internationalization roadmap

## Contributing

This is a personal project, but suggestions and feedback are welcome! Please open an issue for bug reports or feature requests.

## License

MIT License - see LICENSE file for details.

## Acknowledgments

- Named after the Inca messenger system "Chasqui"
- Built with FastAPI, Next.js, and Expo
- Powered by PostgreSQL, PostGIS, and Redis

---

**Built with Claude Code**
