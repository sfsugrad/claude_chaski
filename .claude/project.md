# Chaski - Courier Matching Platform

## Project Overview

Chaski is a peer-to-peer courier matching platform that connects package senders with individuals already traveling along the same route. The platform enables cost-effective, eco-friendly package delivery by leveraging existing travel plans.

## New Machine Setup Guide

This guide walks through setting up the project on a fresh development machine.

### 1. Install Prerequisites

#### macOS
```bash
# Install Homebrew (if not already installed)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install Node.js via nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc  # or ~/.zshrc
nvm install 18
nvm use 18

# Install Python 3
brew install python@3.11

# Install PostgreSQL
brew install postgresql@14
brew services start postgresql@14
```

#### Ubuntu/Debian
```bash
# Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# Install Python 3
sudo apt update
sudo apt install python3.11 python3.11-venv python3-pip

# Install PostgreSQL
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Clone Repository
```bash
git clone <repository-url>
cd chaski
git checkout dev  # or master
```

### 3. Database Setup

```bash
# Start PostgreSQL (if not running)
# macOS: brew services start postgresql@14
# Ubuntu: sudo systemctl start postgresql

# Create database
createdb chaski_db

# Create PostgreSQL user (optional, if you want specific credentials)
psql postgres
# In psql:
CREATE USER chaski_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE chaski_db TO chaski_user;
\q
```

### 4. Get API Keys

#### Google Cloud Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (e.g., "Chaski")
3. Enable required APIs:
   - Go to "APIs & Services" > "Library"
   - Search and enable: **Places API**
   - Search and enable: **Maps JavaScript API**
   - Search and enable: **Geocoding API**

4. Create API credentials:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "API Key"
   - Copy the API key (use for both GOOGLE_PLACES_API_KEY and GOOGLE_MAPS_API_KEY)
   - (Optional) Restrict the key to specific APIs and domains

5. Set up OAuth 2.0:
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "OAuth 2.0 Client ID"
   - Application type: "Web application"
   - Name: "Chaski Web Client"
   - Authorized redirect URIs: `http://localhost:8000/api/auth/google/callback`
   - Copy Client ID and Client Secret

#### Gmail App Password Setup
1. Go to your [Google Account](https://myaccount.google.com/)
2. Security > 2-Step Verification (enable if not enabled)
3. Security > App passwords
4. Select app: "Mail", Select device: "Other (Custom name)"
5. Enter "Chaski" and click Generate
6. Copy the 16-character app password

### 5. Backend Setup

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://hachimhamidi@localhost:5432/chaski_db

# JWT
SECRET_KEY=your-secret-key-here-generate-a-long-random-string
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Frontend URL
FRONTEND_URL=http://localhost:3000

# Email Configuration (Gmail)
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-16-char-app-password
MAIL_FROM=noreply@chaski.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME=Chaski
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
USE_CREDENTIALS=True
VALIDATE_CERTS=True

# Google OAuth Configuration
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# API Keys
GOOGLE_MAPS_API_KEY=your-google-api-key

# Environment
ENVIRONMENT=development
EOF

# Generate a secure SECRET_KEY (optional but recommended)
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
# Copy the output and update SECRET_KEY in .env

# Start backend server
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Frontend Setup

```bash
cd frontend

# Ensure you're using Node 18
nvm use 18

# Install dependencies
npm install

# Create .env.local file
cat > .env.local << 'EOF'
# Backend API URL
NEXT_PUBLIC_API_URL=http://localhost:8000

# Google Places API Key
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-api-key
EOF

# Start frontend development server
npm run dev
```

### 7. Verify Setup

1. **Frontend**: Open http://localhost:3000
   - Should see Chaski homepage
   - Test sender page: http://localhost:3000/sender
   - Test courier page: http://localhost:3000/courier

2. **Backend**: Open http://localhost:8000/docs
   - Should see FastAPI Swagger documentation
   - Test API endpoints

3. **Database**:
   ```bash
   psql chaski_db
   \dt  # Should show tables: users, packages, etc.
   ```

4. **Email**: Try registering a user
   - Should receive verification email

5. **Google OAuth**: Try "Sign in with Google"
   - Should redirect to Google login

### 8. Run Tests

```bash
# Frontend tests
cd frontend
npm test

# Backend tests (when implemented)
cd backend
pytest
```

### Troubleshooting New Setup

**"Command not found: nvm"**
- Restart terminal or run: `source ~/.bashrc` (or `~/.zshrc`)

**"Connection refused" on localhost:8000**
- Backend not running: `cd backend && python3 -m uvicorn main:app --reload`

**"FATAL: database does not exist"**
- Create database: `createdb chaski_db`

**"No module named 'fastapi'"**
- Activate venv: `source backend/venv/bin/activate`
- Install deps: `pip install -r requirements.txt`

**Google Places autocomplete not working**
- Check API key in frontend/.env.local
- Verify Places API is enabled in Google Cloud Console
- Check browser console for errors

**Email verification not sending**
- Check Gmail credentials in backend/.env
- Ensure you're using App Password, not regular Gmail password
- Check backend logs for email errors

---

## Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **HTTP Client**: Axios
- **Maps**: Google Places API (address autocomplete)
- **Testing**: Jest + React Testing Library
- **Port**: 3000

### Backend
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Authentication**: JWT + Google OAuth 2.0
- **Email**: FastAPI-Mail (Gmail SMTP)
- **Testing**: Pytest
- **Port**: 8000

## Project Structure

```
chaski/
├── frontend/               # Next.js application
│   ├── app/               # App Router pages
│   │   ├── courier/       # Courier landing page
│   │   ├── sender/        # Sender landing page
│   │   ├── packages/      # Package management
│   │   │   └── create/    # Create package page
│   │   ├── register/      # User registration
│   │   ├── login/         # User login
│   │   └── verify-email/  # Email verification
│   ├── components/        # Reusable components
│   │   └── AddressAutocomplete.tsx
│   ├── lib/               # Utilities
│   │   └── api.ts        # Axios instance
│   └── __tests__/         # Component tests
│
└── backend/               # FastAPI application
    ├── app/
    │   ├── models/        # SQLAlchemy models
    │   │   └── user.py
    │   ├── routes/        # API endpoints
    │   │   └── auth.py
    │   ├── schemas/       # Pydantic schemas
    │   └── utils/         # Utilities
    ├── tests/             # Backend tests
    ├── main.py            # FastAPI app entry
    └── database.py        # Database configuration
```

## Key Features

### Authentication
- **Email/Password**: Registration with email verification
- **Google OAuth 2.0**: Single sign-on with Google
- **JWT Tokens**: Secure session management
- **Email Verification**: Confirmation emails sent via Gmail SMTP

### User Roles
- **Senders**: Create package delivery requests
- **Couriers**: Accept deliveries along their routes

### Package Management
- Create package requests with pickup/dropoff locations
- Address autocomplete using Google Places API
- Package size, weight, and pricing
- Delivery timeline selection

## Environment Variables

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=<your-api-key>
```

### Backend (.env)
```
DATABASE_URL=postgresql://user@localhost:5432/chaski_db
SECRET_KEY=<jwt-secret>
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
FRONTEND_URL=http://localhost:3000

# Email
MAIL_USERNAME=<gmail-address>
MAIL_PASSWORD=<app-password>
MAIL_FROM=noreply@chaski.com
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587

# Google OAuth
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback

# Google Maps API
GOOGLE_MAPS_API_KEY=<api-key>
```

## Development Setup

### Prerequisites
- Node.js 18+ (managed via nvm)
- Python 3.8+
- PostgreSQL

### Frontend Setup
```bash
cd frontend
nvm use 18
npm install
npm run dev  # Starts on http://localhost:3000
```

### Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Database Setup
```bash
# Create database
createdb chaski_db

# Database will auto-migrate on first run via SQLAlchemy
```

## Testing

### Frontend Tests
```bash
cd frontend
npm test                    # Run all tests
npm test -- --watch        # Watch mode
```

**Test Coverage:**
- 104 total tests across 5 test suites
- Package creation page tests
- Email verification page tests
- Sender/Courier landing page tests
- AddressAutocomplete component tests

### Backend Tests
```bash
cd backend
pytest                      # Run all tests
pytest -v                   # Verbose mode
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login with email/password
- `GET /api/auth/verify-email/{token}` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/google/login` - Initiate Google OAuth
- `GET /api/auth/google/callback` - Google OAuth callback

### Users
- `GET /api/users/me` - Get current user profile

### Packages (planned)
- `POST /api/packages` - Create package request
- `GET /api/packages` - List packages
- `GET /api/packages/{id}` - Get package details

## Database Schema

### Users Table
- `id` (UUID, primary key)
- `email` (unique, indexed)
- `hashed_password`
- `full_name`
- `user_type` (sender/courier)
- `is_verified` (boolean)
- `verification_token`
- `google_id` (optional, for OAuth)
- `created_at`, `updated_at`

### Packages Table
- `id` (UUID, primary key)
- `sender_id` (foreign key to users)
- `pickup_location`, `dropoff_location`
- `package_size`, `weight`, `price`
- `description`, `delivery_deadline`
- `status` (pending/matched/in_transit/delivered)
- `created_at`, `updated_at`

## Common Tasks

### Delete User from Database
```bash
# Connect to database
psql chaski_db

# Delete user (handle foreign keys first)
DELETE FROM packages WHERE sender_id = (SELECT id FROM users WHERE email = 'user@example.com');
DELETE FROM users WHERE email = 'user@example.com';
```

### Restart Frontend (to load new env vars)
```bash
# Kill existing process
pkill -f "npm run dev"

# Start fresh
cd frontend
source ~/.nvm/nvm.sh
nvm use 18
npm run dev
```

### Check Running Processes
```bash
# Frontend
lsof -i :3000

# Backend
lsof -i :8000
```

## Git Workflow

### Branches
- `master` - Production branch
- `dev` - Development branch (current)

### Commit Messages
Follow conventional commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `test:` - Test additions/changes
- `docs:` - Documentation
- `refactor:` - Code refactoring

### Recent Commits
- `5f985e7` - Add sender and courier landing pages with comprehensive tests
- `5226e7e` - Fix Google OAuth by adding required packages and session middleware
- `291a3cf` - Fix email verification double-call issue and add resend verification

## Security Considerations

### Sensitive Files (in .gitignore)
- `.env` - Backend environment variables
- `.env.local` - Frontend environment variables
- `venv/` - Python virtual environment
- `node_modules/` - Node packages

### API Keys
- Google Places API (frontend autocomplete)
- Google Maps API (backend geocoding)
- Google OAuth credentials
- Gmail App Password (for email sending)
- JWT Secret Key

## Design Patterns

### Color Schemes
- **Sender Pages**: Blue theme (blue-50, blue-600)
- **Courier Pages**: Green theme (green-50, green-600)
- **General**: Gray for neutral elements

### Component Structure
- Server components by default (Next.js 14)
- Client components marked with 'use client'
- Reusable components in `/components`
- Page-specific tests in `__tests__` subdirectories

## Known Issues & Considerations

### React Testing Warnings
- Console warnings about `act(...)` in tests are informational only
- All tests pass successfully despite warnings
- Related to Next.js Link component state updates

### Email Verification
- Uses Gmail SMTP with App Password
- Verification tokens have no expiration (consider adding TTL)
- Email verification required before login

### Google OAuth
- Requires SessionMiddleware for state management
- Session cookie: `chaski_session`
- Redirect URI must match Google Cloud Console configuration

## Future Enhancements

### Planned Features
- Courier route management
- Package matching algorithm
- Real-time delivery tracking
- Payment integration
- Rating and review system
- Push notifications
- Mobile app (React Native)

### Performance Optimizations
- Implement caching (Redis)
- Database query optimization
- Image optimization (Next.js Image)
- API rate limiting

### Security Enhancements
- Add CSRF protection
- Implement rate limiting
- Add password reset functionality
- Two-factor authentication
- Audit logging

## Support & Documentation

### External Resources
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Google Places API](https://developers.google.com/maps/documentation/places/web-service)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)

### Common Errors

**"No such built-in module: node:stream/web"**
- Solution: Switch to Node 18 with `nvm use 18`

**"Foreign key constraint violation"**
- Solution: Delete related records before deleting user

**"Email already registered"**
- Solution: Delete user from database or use different email

**"Google OAuth state mismatch"**
- Solution: Ensure SessionMiddleware is configured in main.py
