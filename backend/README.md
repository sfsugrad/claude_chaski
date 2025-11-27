# Chaski Backend API

FastAPI backend for the Chaski courier matching platform.

## 🔐 Security Features

This application implements comprehensive security measures including:

- ✅ **Rate Limiting** - Protection against brute force attacks
- ✅ **JWT Authentication** - Secure token-based authentication
- ✅ **Security Headers** - CSP, HSTS, X-Frame-Options, and more
- ✅ **CORS Protection** - Restricted origins and methods
- ✅ **Token Expiration** - Email verification tokens expire after 24 hours
- ✅ **Secure Session Management** - HTTPS-only cookies in production
- ✅ **Input Validation** - Comprehensive Pydantic validation
- ✅ **SQL Injection Protection** - SQLAlchemy ORM with parameterized queries
- ✅ **Password Security** - Bcrypt hashing with automatic salt

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

### 🔒 Security (CRITICAL)
- `SECRET_KEY` - **REQUIRED** JWT secret key (min 32 characters)
  ```bash
  # Generate a secure key:
  python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
  ```
  ⚠️ **NEVER** use the default key in production! The application will refuse to start.

- `ENVIRONMENT` - Set to `production` for production deployment (default: `development`)

### Database
- `DATABASE_URL` - PostgreSQL connection string with PostGIS
  ```
  postgresql://user:password@localhost:5432/chaski_db
  ```

### Authentication
- `ACCESS_TOKEN_EXPIRE_MINUTES` - JWT token expiration time (default: 30)
- `ALGORITHM` - JWT algorithm (default: HS256)

### Frontend & CORS
- `FRONTEND_URL` - Frontend URL for CORS and redirects (default: http://localhost:3000)

### Email Configuration
- `MAIL_USERNAME` - SMTP username (Gmail recommended)
- `MAIL_PASSWORD` - SMTP password (use Gmail App Password)
- `MAIL_FROM` - Sender email address
- `MAIL_FROM_NAME` - Sender name (default: Chaski)
- `MAIL_SERVER` - SMTP server (default: smtp.gmail.com)
- `MAIL_PORT` - SMTP port (default: 587)

### Google OAuth (Optional)
- `GOOGLE_CLIENT_ID` - Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` - Google OAuth client secret
- `GOOGLE_REDIRECT_URI` - Google OAuth redirect URI (e.g., http://localhost:8000/api/auth/google/callback)

## API Endpoints

### Authentication

**Rate Limits:**
- `POST /api/auth/register` - **5 requests/minute** - Register new user
- `POST /api/auth/login` - **10 requests/minute** - Login and get JWT token
- `POST /api/auth/resend-verification` - **3 requests/minute** - Resend verification email

**Other Endpoints:**
- `GET /api/auth/me` - Get current user info (requires JWT)
- `GET /api/auth/verify-email/{token}` - Verify email (24-hour token expiration)
- `GET /api/auth/google/login` - Initiate Google OAuth flow
- `GET /api/auth/google/callback` - Google OAuth callback handler

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

# Add verification_token_expires_at column to users table
PYTHONPATH=$(pwd) python3 migrations/add_verification_token_expires_at.py
```

### Available Migrations
- `add_package_is_active.py` - Adds soft delete functionality to packages
- `add_verification_token_expires_at.py` - Adds 24-hour expiration to email verification tokens

## Features Implemented

### Authentication & Security
- [x] JWT authentication with secure token generation
- [x] Email verification system with 24-hour token expiration
- [x] Google OAuth integration
- [x] Role-based access control (SENDER, COURIER, BOTH, ADMIN)
- [x] Secure password hashing (Bcrypt with salt)
- [x] Rate limiting on sensitive endpoints
  - Login: 10 requests/minute per IP
  - Registration: 5 requests/minute per IP
  - Resend verification: 3 requests/minute per IP
- [x] Security headers (CSP, HSTS, X-Frame-Options, etc.)
- [x] CORS protection with restricted origins
- [x] User enumeration prevention
- [x] SECRET_KEY validation

### Core Features
- [x] Package CRUD operations
- [x] Courier route management
- [x] Package-courier matching system
- [x] Soft delete for packages and users
- [x] Comprehensive input validation (Pydantic)

### Admin Features
- [x] Admin dashboard endpoints
- [x] User management (create, update, soft delete, role changes)
- [x] Package management (view, soft delete)
- [x] Platform statistics (users, packages, revenue)
- [x] Self-protection (admins cannot delete/deactivate themselves)

## Production Deployment

### Security Checklist

Before deploying to production, ensure:

1. ✅ **Set a strong SECRET_KEY** (minimum 32 characters)
   ```bash
   python3 -c 'import secrets; print(secrets.token_urlsafe(32))'
   ```

2. ✅ **Set ENVIRONMENT=production** in your `.env` file
   - Enables HTTPS-only session cookies
   - Enables HSTS (Strict-Transport-Security) headers
   - Enforces SECRET_KEY validation

3. ✅ **Configure production CORS origins**
   - Update `allowed_origins` in `main.py` to include your production frontend URL
   - Remove localhost from allowed origins

4. ✅ **Use HTTPS**
   - Configure SSL/TLS certificates
   - Enable HTTPS on your reverse proxy (Nginx, Caddy, etc.)

5. ✅ **Configure production database**
   - Use a managed PostgreSQL service with PostGIS
   - Enable SSL connections to database
   - Use strong database passwords

6. ✅ **Set up email service**
   - Use a production email service (SendGrid, Mailgun, etc.)
   - Or configure Gmail with App Password

7. ✅ **Run all database migrations**
   ```bash
   PYTHONPATH=$(pwd) python3 migrations/add_package_is_active.py
   PYTHONPATH=$(pwd) python3 migrations/add_verification_token_expires_at.py
   ```

8. ✅ **Environment variables**
   - Never commit `.env` file to version control
   - Use environment variable management (Docker secrets, AWS Secrets Manager, etc.)

### Recommended Production Stack

- **Web Server**: Uvicorn with Gunicorn
  ```bash
  gunicorn main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
  ```
- **Reverse Proxy**: Nginx or Caddy (for SSL termination and static files)
- **Database**: Managed PostgreSQL with PostGIS (AWS RDS, Google Cloud SQL, etc.)
- **Process Manager**: systemd or Docker
- **Monitoring**: Sentry for error tracking, Prometheus for metrics

## Next Steps

### High Priority
1. Move JWT tokens from localStorage to httpOnly cookies (prevents XSS token theft)
2. Add input sanitization for user-generated content
3. Implement comprehensive audit logging

### Feature Development
1. Complete courier route matching algorithm
2. Add real-time notifications (WebSockets)
3. Implement payment integration (Stripe)
4. Add file upload for package photos
5. Implement caching for statistics (Redis)
6. Add search functionality

### Testing & Quality
1. Increase test coverage
2. Add integration tests
3. Add load testing
4. Set up CI/CD pipeline

---

## Security Implementation Details

### Security Headers

All API responses include the following security headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `Content-Security-Policy` | `default-src 'self'; ...` | Prevents XSS attacks by controlling resource loading |
| `X-Frame-Options` | `DENY` | Prevents clickjacking attacks |
| `X-Content-Type-Options` | `nosniff` | Prevents MIME type sniffing |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS protection for older browsers |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Controls referrer information leakage |
| `Permissions-Policy` | Restrictive | Disables unnecessary browser features |
| `Strict-Transport-Security` | `max-age=31536000` | Forces HTTPS (production only) |

### Rate Limiting

Rate limits are enforced per IP address:

| Endpoint | Limit | Window | Purpose |
|----------|-------|--------|---------|
| `/api/auth/login` | 10 | 1 minute | Prevent brute force attacks |
| `/api/auth/register` | 5 | 1 minute | Prevent spam registrations |
| `/api/auth/resend-verification` | 3 | 1 minute | Prevent email flooding |

When rate limit is exceeded, API returns HTTP 429 (Too Many Requests).

### Token Security

- **JWT Tokens**: HS256 algorithm, 30-minute expiration (configurable)
- **Verification Tokens**: 24-hour expiration, single-use only
- **Token Storage**: Frontend uses localStorage (⚠️ consider moving to httpOnly cookies)

### Password Security

- **Algorithm**: Bcrypt with automatic salt generation
- **Minimum Length**: 8 characters (enforced)
- **Storage**: Only bcrypt hashes stored, never plaintext

### User Enumeration Prevention

Endpoints that could reveal user existence return generic messages:
- `/api/auth/resend-verification` - Same message whether email exists or not
- `/api/auth/login` - "Incorrect email or password" (doesn't specify which)

---

## License

This project is private and proprietary.

## Support

For issues and questions, please contact the development team.
