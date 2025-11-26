# Chaski Backend API

FastAPI backend for the Chaski courier matching platform.

## Setup

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Set up database:
   ```bash
   createdb chaski_db
   psql chaski_db -c "CREATE EXTENSION postgis;"
   ```

5. Run migrations (when implemented):
   ```bash
   alembic upgrade head
   ```

6. Start server:
   ```bash
   uvicorn main:app --reload
   ```

## API Documentation

Once the server is running, visit:
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── models/          # SQLAlchemy models
│   │   ├── base.py      # Base model class
│   │   ├── user.py      # User and UserRole models
│   │   └── package.py   # Package, PackageStatus, PackageSize, CourierRoute
│   ├── routes/          # API endpoints
│   │   ├── auth.py      # Authentication (register, login, verify-email, OAuth)
│   │   ├── packages.py  # Package CRUD operations
│   │   ├── couriers.py  # Courier routes management
│   │   ├── matching.py  # Package-courier matching
│   │   └── admin.py     # Admin-only endpoints (users, packages, stats)
│   ├── utils/           # Utility functions
│   │   ├── auth.py      # Password hashing and JWT tokens
│   │   ├── email.py     # Email sending functionality
│   │   ├── oauth.py     # Google OAuth integration
│   │   └── dependencies.py # FastAPI dependencies (auth, admin check)
│   ├── config.py        # Configuration settings
│   └── database.py      # Database setup and session management
├── migrations/          # Database migration scripts
│   └── add_package_is_active.py  # Adds is_active column to packages
├── tests/               # Pytest test suite
│   └── test_*.py        # Test files
├── main.py              # Application entry point
└── requirements.txt     # Python dependencies
```

## Environment Variables

Required variables in `.env`:
- `DATABASE_URL` - PostgreSQL connection string with PostGIS
- `SECRET_KEY` - JWT secret key (change in production)
- `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT token expiration time
- `FRONTEND_URL` - Frontend URL for CORS and redirects
- `MAIL_USERNAME` - SMTP username (Gmail recommended)
- `MAIL_PASSWORD` - SMTP password (use Gmail App Password)
- `MAIL_FROM` - Sender email address
- `MAIL_SERVER` - SMTP server (smtp.gmail.com for Gmail)
- `MAIL_PORT` - SMTP port (587 for TLS)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID (optional)
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret (optional)
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI (optional)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info
- `GET /api/auth/verify-email/{token}` - Verify email
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/google/login` - Google OAuth login
- `GET /api/auth/google/callback` - Google OAuth callback

### Packages
- `POST /api/packages` - Create package
- `GET /api/packages` - Get user's packages
- `GET /api/packages/{id}` - Get package details
- `PUT /api/packages/{id}/status` - Update package status

### Couriers
- `POST /api/couriers/routes` - Create courier route
- `GET /api/couriers/routes` - Get courier's routes
- `GET /api/couriers/routes/{id}` - Get route details
- `DELETE /api/couriers/routes/{id}` - Delete route

### Matching
- `GET /api/matching/packages-along-route/{route_id}` - Find packages along route
- `POST /api/matching/accept-package/{package_id}` - Accept package
- `POST /api/matching/decline-package/{package_id}` - Decline package

### Admin (Admin Only)
- `GET /api/admin/users` - Get all users
- `POST /api/admin/users` - Create new user
- `GET /api/admin/users/{id}` - Get user details
- `PUT /api/admin/users/{id}` - Update user role
- `DELETE /api/admin/users/{id}` - Delete user
- `GET /api/admin/packages` - Get all packages
- `GET /api/admin/packages/{id}` - Get package details
- `PUT /api/admin/packages/{id}/toggle-active` - Toggle package active status
- `DELETE /api/admin/packages/{id}` - Delete package
- `GET /api/admin/stats` - Get platform statistics

## Development

The API uses automatic reload during development. Make changes to any Python file and the server will restart automatically.

### Testing

Run the test suite:
```bash
pytest
```

Run with verbose output:
```bash
pytest -v
```

Run with coverage:
```bash
pytest --cov=app tests/
```

## Database Migrations

Run migrations to update the database schema:

```bash
# Add is_active column to packages table
PYTHONPATH=$(pwd) python3 migrations/add_package_is_active.py
```

## Features Implemented

- [x] JWT authentication
- [x] Email verification system
- [x] Google OAuth integration
- [x] Role-based access control (SENDER, COURIER, BOTH, ADMIN)
- [x] Package CRUD operations
- [x] Admin dashboard endpoints
- [x] User management (admin)
- [x] Package management (admin)
- [x] Platform statistics (admin)
- [x] Soft delete for packages
- [x] Comprehensive input validation
- [x] Secure password hashing

## Next Steps

1. Implement courier route matching algorithm
2. Add real-time notifications
3. Implement payment integration
4. Add more comprehensive tests
5. Add API rate limiting
6. Implement caching for statistics
