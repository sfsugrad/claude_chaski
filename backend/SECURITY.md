# Security Policy

## Overview

Chaski implements a comprehensive, defense-in-depth security architecture designed to protect user data and prevent common web application vulnerabilities. This document outlines our security features, policies, and best practices.

## Table of Contents

- [Reporting Security Issues](#reporting-security-issues)
- [Authentication & Authorization](#authentication--authorization)
- [Data Protection](#data-protection)
- [Session Management](#session-management)
- [Rate Limiting](#rate-limiting)
- [Input Validation & Sanitization](#input-validation--sanitization)
- [File Upload Security](#file-upload-security)
- [CSRF Protection](#csrf-protection)
- [Security Headers](#security-headers)
- [Audit Logging](#audit-logging)
- [Password Requirements](#password-requirements)
- [Token Management](#token-management)
- [Security Best Practices](#security-best-practices)

## Reporting Security Issues

If you discover a security vulnerability, please email us at **security@chaski.example.com** (replace with actual email).

**Please do NOT:**
- Open public GitHub issues for security vulnerabilities
- Disclose the vulnerability publicly before we've had a chance to address it

**What to include:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if applicable)

We aim to respond to security reports within 48 hours and will keep you updated on remediation progress.

## Authentication & Authorization

### JWT Token Authentication
- **Implementation**: HTTP-only cookies with secure JWT tokens
- **Expiration**: 24 hours (default) or 7 days (remember me)
- **Algorithm**: HS256 with secure secret key
- **Storage**: Tokens stored in HTTP-only, secure, SameSite cookies
- **Blacklisting**: Redis-backed token blacklist for logout/revocation

**Location**: `app/utils/auth.py`, `app/routes/auth.py`

### Password Security
- **Hashing**: bcrypt with automatic salt generation
- **Token Storage**: Verification and reset tokens stored as SHA-256 hashes
- **Reset Tokens**: 1-hour expiration window
- **Verification Tokens**: 24-hour expiration window

**Location**: `app/utils/auth.py:17-20`, `app/routes/auth.py:193-196`

### OAuth Integration
- **Provider**: Google OAuth 2.0
- **Email Verification**: OAuth users automatically verified
- **Account Linking**: Prevents duplicate accounts via email matching

**Location**: `app/routes/auth.py:583-708`

### Role-Based Access Control (RBAC)
- **Roles**: `sender`, `courier`, `both`, `admin`
- **Enforcement**: FastAPI dependency injection via `get_current_user`, `get_current_admin_user`
- **Granularity**: Endpoint-level and resource-level authorization

**Location**: `app/utils/dependencies.py`

## Data Protection

### PII Encryption at Rest
- **Algorithm**: Fernet (AES-128-CBC with HMAC authentication)
- **Encrypted Fields**:
  - Email addresses
  - Full names
  - Phone numbers
- **Dual-Write Strategy**: Maintains both plaintext and encrypted versions during migration
- **Key Management**: Encryption key stored in environment variable (`ENCRYPTION_KEY`)

**Location**: `app/utils/encryption.py`, `app/models/user.py:90-134`

### Database Security
- **Connection**: SSL/TLS enforced for production PostgreSQL
- **Migrations**: Alembic with version control
- **Soft Deletes**: Sensitive data marked inactive instead of deleted
- **Query Parameterization**: SQLAlchemy ORM prevents SQL injection

**Location**: `app/database.py`, `alembic/`

## Session Management

### Active Session Tracking
- **Storage**: Redis with TTL-based expiration
- **Features**:
  - Multi-device session management
  - View active sessions per user
  - Remote session termination
  - Session metadata (IP, user agent, login time)
- **Cleanup**: Automatic expiration via Redis TTL

**Location**: `app/services/session_tracker.py`, `app/routes/auth.py:1008-1156`

### Session Security Features
- **Session Binding**: JWT contains session ID for validation
- **Issued-At Time**: Tokens include `iat` claim for revocation
- **Password Change**: All sessions revoked on password reset
- **Logout**:
  - Single session: Specific token blacklisted + session deleted
  - All devices: All user tokens revoked before timestamp

**Location**: `app/routes/auth.py:804-857`

## Rate Limiting

### SlowAPI Integration
- **Registration**: 5 requests/minute per IP
- **Login**: 100 requests/minute per IP (higher for E2E tests)
- **Password Reset**: 3 requests/minute per IP
- **Email Verification**: 3 requests/minute per IP
- **Phone Verification**: 3 send/minute, 2 resend/minute per IP

**Location**: `app/routes/auth.py:150, 244, 542, 712, 866, 962`

### Account Lockout
- **Threshold**: 5 failed login attempts
- **Duration**: 15-minute lockout period
- **Tracking**: Per email address and IP address
- **Storage**: PostgreSQL `login_attempts` table
- **Reset**: Successful login clears failed attempts

**Location**: `app/services/auth_security.py`, `app/models/login_attempt.py`

## Input Validation & Sanitization

### Server-Side Validation
- **Framework**: Pydantic models with FastAPI
- **Email**: EmailStr validation
- **Fields**: Length limits, regex patterns, type checking
- **Enums**: Strict validation for roles, statuses, etc.

### HTML/XSS Sanitization
- **Library**: Bleach 6.1.0
- **Plain Text**: Strips all HTML tags
- **Rich Text**: Allows safe tags only (b, i, u, p, br, strong, em)
- **Email/Phone**: Format validation and normalization
- **Applied To**: User inputs, package descriptions, notes, ratings

**Location**: `app/utils/input_sanitizer.py`

**Coverage**:
- User registration/update: `app/routes/auth.py:199-202, 440-465`
- Package creation: `app/routes/packages.py`
- Ratings/reviews: `app/routes/ratings.py:123-126`
- Notes: `app/routes/notes.py`

## File Upload Security

### Magic Number Validation
- **Implementation**: `python-magic` library
- **Validation**: Checks actual file content, not just extension
- **Allowed Types**:
  - Images: JPEG, PNG, GIF, WebP
  - Maximum size: 10MB per file
- **Rejection**: Invalid MIME types rejected before storage

**Location**: `app/services/file_storage.py:validate_uploaded_file()`

### S3 Security
- **Key Randomization**: UUIDs prevent predictable file paths
- **Pre-signed URLs**: Time-limited upload/download URLs (1 hour expiry)
- **Bucket Policy**: Private bucket, no public access
- **File Organization**: `packages/{package_id}/{file_type}/{random_uuid}.{ext}`

**Location**: `app/services/file_storage.py`

### Upload Flow
1. Client requests pre-signed upload URL
2. Server validates user permissions
3. Server generates unique S3 key with UUID
4. Client uploads directly to S3
5. Server validates uploaded file magic numbers
6. Server stores validated S3 key in database

**Location**: `app/routes/delivery_proof.py:121-180`

## CSRF Protection

### Double-Submit Cookie Pattern
- **Implementation**: Custom middleware
- **Token Generation**: Cryptographically secure random tokens
- **Validation**: Automatic for state-changing methods (POST, PUT, DELETE, PATCH)
- **Exemptions**: WebSocket, login endpoint
- **Header**: `X-CSRF-Token` required for protected requests
- **Frontend**: Automatic token inclusion via Axios interceptor

**Location**: `app/middleware/csrf_middleware.py`, `frontend/app/lib/api.ts`

### Configuration
- **Token Refresh**: New token on each protected request
- **Cookie Settings**:
  - Secure: True (production)
  - HttpOnly: False (JS needs to read)
  - SameSite: Lax

## Security Headers

### Content Security Policy (CSP)
```
default-src 'self';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://maps.googleapis.com;
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
font-src 'self' https://fonts.gstatic.com;
img-src 'self' data: https: blob:;
connect-src 'self' https://accounts.google.com ws: wss:;
frame-src https://accounts.google.com;
```

**Location**: `main.py:security_headers_middleware()`

### Additional Headers
- **X-Content-Type-Options**: `nosniff`
- **X-Frame-Options**: `DENY`
- **X-XSS-Protection**: `1; mode=block`
- **Strict-Transport-Security**: `max-age=31536000; includeSubDomains`
- **Referrer-Policy**: `strict-origin-when-cross-origin`
- **Permissions-Policy**: Restricted camera, microphone, geolocation

**Location**: `main.py:41-92`

## Audit Logging

### Comprehensive Event Tracking
All security-sensitive operations are logged to the `audit_logs` table with:
- User ID and email
- Action type (28+ distinct actions)
- Resource type and ID
- IP address and user agent
- Timestamp
- Success/failure status
- Detailed context (JSON)

### Logged Events

#### Authentication Events
- `LOGIN_SUCCESS`, `LOGIN_FAILED`
- `LOGOUT`, `REGISTER`
- `PASSWORD_RESET_REQUEST`, `PASSWORD_RESET_COMPLETE`
- `EMAIL_VERIFICATION`, `OAUTH_LOGIN`
- `ACCOUNT_LOCKED`, `ACCOUNT_UNLOCK_ATTEMPT`

#### Session Management
- `SESSION_CREATED`, `SESSION_TERMINATED`, `SESSION_DELETED`
- `PASSWORD_CHANGED`, `PROFILE_UPDATED`

#### Access Control
- `UNAUTHORIZED_ACCESS`, `PERMISSION_DENIED`
- `TOKEN_BLACKLISTED`

#### File Upload Security
- `FILE_UPLOAD_SUCCESS`, `FILE_UPLOAD_FAILED`
- `FILE_VALIDATION_FAILED`, `SUSPICIOUS_FILE_UPLOAD`

#### User Management (Admin)
- `USER_CREATE`, `USER_UPDATE`, `USER_ROLE_CHANGE`
- `USER_DEACTIVATE`, `USER_ACTIVATE`, `USER_DELETE`

#### Business Operations
- Package operations (create, update, status change, cancel)
- Courier route operations
- Bidding events
- Rating submissions
- Data export (GDPR)

**Location**: `app/models/audit_log.py`, `app/services/audit_service.py`

### Audit Log Access
- **Admin Only**: `GET /api/admin/audit-logs`
- **Filters**: By user, action type, date range, resource
- **Retention**: Indefinite (implement retention policy as needed)

## Password Requirements

### Strength Requirements (Enforced)
- **Minimum Length**: 8 characters
- **Uppercase**: At least 1 uppercase letter
- **Lowercase**: At least 1 lowercase letter
- **Digits**: At least 1 number
- **Special Characters**: At least 1 special character
- **Common Passwords**: Rejection of 10,000+ common passwords
- **Validation**: Server-side enforcement with detailed error messages

**Location**: `app/utils/password_validator.py`

### Password Operations
- **Change**: All active sessions revoked
- **Reset**: Time-limited tokens (1 hour)
- **Token Storage**: SHA-256 hashed tokens
- **History**: Not implemented (consider for future)

## Token Management

### JWT Token Lifecycle
1. **Creation**: User login/OAuth
2. **Storage**: HTTP-only cookie
3. **Validation**: On each authenticated request
4. **Blacklisting**: On logout, password change, or revocation
5. **Expiration**: Automatic by TTL

### Token Blacklist (Redis)
- **Storage**: Token JTI (JWT ID) or full token hash
- **TTL**: Matches token expiration
- **Cleanup**: Automatic Redis expiration
- **Revocation Patterns**:
  - Single token (logout)
  - All tokens before timestamp (password change)
  - All user tokens (admin action)

**Location**: `app/services/jwt_blacklist.py`

### Token Verification Flow
```python
1. Extract token from cookie
2. Decode and validate signature
3. Check expiration
4. Verify not blacklisted (Redis)
5. Validate session exists (Redis)
6. Return user object
```

**Location**: `app/utils/dependencies.py:get_current_user()`

## Security Best Practices

### For Developers

1. **Never commit secrets**
   - Use `.env` files (gitignored)
   - Never hardcode credentials
   - Use environment variables

2. **Always validate input**
   - Use Pydantic models
   - Sanitize user content
   - Validate file uploads

3. **Use parameterized queries**
   - SQLAlchemy ORM (preferred)
   - No raw SQL with user input

4. **Implement proper error handling**
   - Don't leak stack traces
   - Generic error messages to users
   - Detailed logging for debugging

5. **Keep dependencies updated**
   - Regular `pip-audit` scans
   - Monitor security advisories
   - Update promptly

### For Administrators

1. **Environment Variables**
   - Generate strong `SECRET_KEY` (64+ characters)
   - Unique `ENCRYPTION_KEY` for production
   - Secure Redis password
   - Rotate keys regularly

2. **Database Security**
   - Use strong passwords
   - Enable SSL/TLS
   - Regular backups
   - Restrict network access

3. **Redis Security**
   - Enable password authentication
   - Disable dangerous commands
   - Use separate instances for cache/sessions

4. **Monitoring**
   - Monitor audit logs for suspicious activity
   - Set up alerts for:
     - Multiple failed logins
     - Account lockouts
     - Unusual file uploads
     - Admin actions

5. **Regular Security Audits**
   - Quarterly penetration testing
   - Automated scanning (OWASP ZAP)
   - Code reviews
   - Dependency audits

### For Users

1. **Strong Passwords**
   - Use unique passwords
   - Enable remember me only on trusted devices
   - Change password if suspicious activity

2. **Session Management**
   - Review active sessions regularly
   - Logout from unused devices
   - Don't share login credentials

3. **Two-Factor Authentication**
   - Phone verification available
   - Email verification required
   - Additional 2FA planned for future

## Compliance

### GDPR
- **Data Export**: Users can request complete data export
- **Right to Erasure**: Soft delete with data retention policy
- **Consent**: Explicit consent for data processing
- **Audit Trails**: All data access logged

### Data Retention
- **Active Users**: Indefinite
- **Inactive Accounts**: Deactivated (data retained)
- **Deleted Accounts**: Soft delete (can be restored)
- **Audit Logs**: Retained indefinitely (implement policy as needed)

## Vulnerability Disclosure Timeline

1. **Initial Report**: Security team acknowledges within 48 hours
2. **Triage**: 1 week for severity assessment
3. **Fix Development**: Based on severity
   - Critical: 7 days
   - High: 14 days
   - Medium: 30 days
   - Low: 60 days
4. **Public Disclosure**: 90 days after fix deployment or by agreement

## Security Roadmap

### Planned Enhancements
- [ ] Two-factor authentication (TOTP)
- [ ] Rate limiting per user (in addition to IP)
- [ ] Advanced anomaly detection
- [ ] Automated security scanning in CI/CD
- [ ] Security headers testing automation
- [ ] Password history (prevent reuse)
- [ ] Geolocation-based access controls
- [ ] API key management for integrations

### Recent Improvements
- [x] PII encryption at rest (Phase 2)
- [x] Account lockout mechanism (Phase 3)
- [x] Enhanced password requirements (Phase 3)
- [x] Session tracking and management (Phase 3)
- [x] File upload security (Phase 4)
- [x] Input sanitization (Phase 4)
- [x] Comprehensive audit logging (Phase 5)
- [x] CSRF protection (Phase 1)
- [x] Security headers (Phase 1)

## Contact

For security concerns, contact:
- **Email**: security@chaski.example.com
- **PGP Key**: [Public key fingerprint]
- **Response Time**: Within 48 hours

---

**Last Updated**: November 2025
**Version**: 1.0
