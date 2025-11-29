# Chaski Quick Start Guide

**Status**: Security Hardening Complete ✅
**Last Updated**: November 2025

## Overview

Chaski is a logistics platform connecting package senders with couriers. All 5 phases of security hardening are complete, and the application is ready for the next stage of development.

---

## 📚 Key Documentation

### Security Documentation
- **`SECURITY.md`** - Complete security policy and features
- **`SECURITY_AUDIT.md`** - OWASP ZAP testing guide
- **`SECRETS_MANAGEMENT.md`** - Environment variables and Heroku deployment

### Planning Documentation
- **`ROADMAP.md`** - Detailed next steps and feature roadmap
- **`TESTING.md`** - Testing guidelines and commands
- **`TESTING_QUICK_REFERENCE.md`** - Quick testing cheat sheet

### Project Documentation
- **`CLAUDE.md`** - Claude Code project instructions
- **`README.md`** - Project overview (if exists)

---

## 🎯 What's Been Completed

### Phase 1: Session Security & Headers ✅
- JWT token hashing in database
- CSRF protection middleware
- Strengthened Content Security Policy
- Security headers (X-Frame-Options, X-Content-Type-Options, etc.)

### Phase 2: PII Encryption ✅
- Fernet encryption for email, name, phone
- Database migration with encrypted columns
- Dual-write implementation
- Backfill script for existing data

### Phase 3: Account Protection ✅
- Account lockout after 5 failed login attempts
- JWT token blacklist in Redis
- Enhanced password requirements (12+ chars, complexity)
- Active session tracking

### Phase 4: Input Validation & File Security ✅
- File magic number validation
- S3 key randomization
- Input sanitization with Bleach

### Phase 5: Audit Logging & GDPR ✅
- Comprehensive security event logging
- GDPR data export endpoint (`/api/users/me/export`)
- Complete security documentation
- Automated OWASP ZAP scanning

---

## 🚀 Quick Commands

### Backend (FastAPI)
```bash
cd backend
source venv/bin/activate

# Run development server
uvicorn main:app --reload --port 8000

# Run tests
pytest

# Run tests with coverage
pytest --cov=app tests/

# Run security scan (requires OWASP ZAP)
python scripts/security_scan_zap.py
```

### Frontend (Next.js)
```bash
cd frontend

# Run development server
npm run dev

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Build for production
npm run build
```

---

## 📋 What's Next

### Immediate Priorities
1. **Test GDPR Endpoint** - Verify `/api/users/me/export` works correctly
2. **Frontend UI for Export** - Add "Download My Data" button in profile settings
3. **Account Deletion** - Implement GDPR Right to Erasure
4. **Privacy Policy** - Create legal pages for GDPR compliance

### Before Production Deployment
1. Run full OWASP ZAP security scan
2. Write integration tests for security features
3. Set up error tracking (Sentry)
4. Configure production environment variables
5. Set up database backups
6. Configure monitoring and alerts

See **`ROADMAP.md`** for complete details.

---

## 🔐 Security Features

### Authentication & Authorization
- JWT tokens in httpOnly cookies
- Token hashing in database
- Token blacklist for revoked sessions
- Account lockout (5 failed attempts, 15-minute lockout)
- Password requirements: 12+ chars, uppercase, lowercase, number, special char

### Data Protection
- PII encryption at rest (Fernet)
- Encrypted fields: email, full_name, phone_number
- Secure password hashing (bcrypt)
- CSRF protection on all state-changing endpoints

### Input Security
- File upload validation (magic number checking)
- Input sanitization (Bleach)
- S3 key randomization
- SQL injection prevention (SQLAlchemy ORM)

### Monitoring & Compliance
- Comprehensive audit logging (28 event types)
- GDPR data export endpoint
- Rate limiting on sensitive endpoints
- Security headers (CSP, HSTS, X-Frame-Options, etc.)

---

## 🗂️ Project Structure

### Backend (`/backend`)
```
backend/
├── app/
│   ├── routes/          # API endpoints
│   │   ├── auth.py      # Authentication
│   │   ├── packages.py  # Package management
│   │   ├── gdpr.py      # GDPR data export (NEW)
│   │   └── ...
│   ├── models/          # Database models
│   ├── services/        # Business logic
│   ├── utils/           # Utilities
│   │   ├── encryption.py    # PII encryption
│   │   ├── auth.py          # JWT & password hashing
│   │   └── ...
│   └── middleware/      # Custom middleware
│       ├── csrf.py          # CSRF protection
│       └── ...
├── scripts/
│   └── security_scan_zap.py  # Automated security scanning
├── tests/               # Test suite
├── migrations/          # Database migrations
├── SECURITY.md          # Security documentation
├── SECRETS_MANAGEMENT.md # Deployment guide
├── SECURITY_AUDIT.md    # Testing guide
├── ROADMAP.md          # Next steps
└── main.py             # FastAPI application
```

### Frontend (`/frontend`)
```
frontend/
├── app/                 # Next.js 14 App Router
│   ├── [locale]/       # Internationalized pages
│   └── ...
├── lib/
│   └── api.ts          # API client (centralized)
├── components/         # React components
├── hooks/              # Custom hooks
└── contexts/           # React contexts
```

---

## 🔧 Environment Setup

### Required Services
- **PostgreSQL** (with PostGIS extension)
- **Redis** (for session management and caching)
- **SMTP Server** (for email verification)
- **Stripe** (for payments)
- **AWS S3** (for file storage)

### Environment Variables
See **`SECRETS_MANAGEMENT.md`** for complete list of required variables.

Quick checklist:
- ✅ `SECRET_KEY` - JWT signing key
- ✅ `ENCRYPTION_KEY` - Fernet key for PII encryption
- ✅ `DATABASE_URL` - PostgreSQL connection string
- ✅ `REDIS_URL` - Redis connection string
- ✅ `MAIL_*` - Email configuration
- ✅ `STRIPE_*` - Payment keys
- ✅ `AWS_*` - S3 credentials

---

## 📊 Key Endpoints

### Authentication
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - Logout
- `GET /api/auth/me` - Get current user
- `POST /api/auth/forgot-password` - Password reset request
- `POST /api/auth/reset-password` - Reset password

### GDPR (NEW)
- `GET /api/users/me/export` - Export all user data (rate limited: 3/hour)

### Security
- `POST /api/auth/sessions` - List active sessions
- `DELETE /api/auth/sessions/{session_id}` - Revoke session
- `PUT /api/auth/change-password` - Change password

---

## 🧪 Testing

### Run All Tests
```bash
cd backend
pytest
```

### Test Security Features
```bash
# Account lockout
pytest tests/test_auth.py::test_account_lockout -v

# Token blacklist
pytest tests/test_auth.py::test_logout_blacklists_token -v

# Password validation
pytest tests/test_auth.py::test_password_validation -v

# CSRF protection
pytest tests/test_csrf.py -v  # (needs to be created)
```

### Security Scanning
```bash
# Start OWASP ZAP daemon
/Applications/OWASP\ ZAP.app/Contents/Java/zap.sh -daemon -port 8090 -config api.disablekey=true &

# Run automated scan
python scripts/security_scan_zap.py
```

See **`SECURITY_AUDIT.md`** for detailed testing instructions.

---

## 🚨 Security Incident Response

### If You Suspect a Security Issue

1. **Do NOT disclose publicly**
2. Check audit logs: `GET /api/admin/audit-logs`
3. Review recent login attempts
4. Check for suspicious account lockouts
5. Review session activity in Redis
6. Contact security team (see `SECURITY.md`)

### Common Security Checks
```bash
# Check audit logs for suspicious activity
psql $DATABASE_URL -c "SELECT * FROM audit_logs WHERE action IN ('ACCOUNT_LOCKED', 'UNAUTHORIZED_ACCESS') ORDER BY created_at DESC LIMIT 20;"

# Check Redis for active sessions
redis-cli KEYS "session:*"

# Check blacklisted tokens
redis-cli KEYS "blacklist:*"
```

---

## 🎓 Learning Resources

### Security Best Practices
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- GDPR Compliance: https://gdpr.eu/
- FastAPI Security: https://fastapi.tiangolo.com/tutorial/security/

### Framework Documentation
- FastAPI: https://fastapi.tiangolo.com/
- Next.js: https://nextjs.org/docs
- SQLAlchemy: https://docs.sqlalchemy.org/

---

## 📞 Getting Help

### Documentation References
- **General Questions**: See `CLAUDE.md`
- **Security Questions**: See `SECURITY.md`
- **Deployment Questions**: See `SECRETS_MANAGEMENT.md`
- **Testing Questions**: See `SECURITY_AUDIT.md`
- **Feature Planning**: See `ROADMAP.md`

### External Support
- OWASP ZAP: https://www.zaproxy.org/docs/
- Heroku: https://devcenter.heroku.com/

---

## ✅ Pre-Deployment Checklist

Before deploying to production:

- [ ] All environment variables set (see `SECRETS_MANAGEMENT.md`)
- [ ] Database migrations run successfully
- [ ] Security scan completed (OWASP ZAP)
- [ ] Integration tests passing
- [ ] HTTPS configured
- [ ] Error tracking set up (Sentry)
- [ ] Monitoring configured
- [ ] Database backups enabled
- [ ] Privacy policy published
- [ ] Terms of service published
- [ ] Cookie consent banner implemented

---

## 🎯 Current Focus

**Status**: Ready for next phase of development

**Recommended Next Steps**:
1. Test GDPR data export endpoint
2. Add frontend UI for data export
3. Implement account deletion (Right to Erasure)
4. Write integration tests for security features

See **`ROADMAP.md`** for complete roadmap and priorities.

---

**Happy Coding! 🚀**
