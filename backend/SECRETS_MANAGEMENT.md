# Secrets Management Guide

## Overview

This guide provides comprehensive instructions for managing secrets, environment variables, and sensitive configuration in Chaski, with specific focus on Heroku deployment and production security best practices.

## Table of Contents

- [Environment Variables](#environment-variables)
- [Local Development Setup](#local-development-setup)
- [Heroku Configuration](#heroku-configuration)
- [Secret Generation](#secret-generation)
- [Key Rotation](#key-rotation)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)

## Environment Variables

### Required Variables

#### Core Application
```bash
# Application Environment
ENVIRONMENT=production          # 'development', 'staging', or 'production'
SECRET_KEY=<64-char-random>    # JWT signing key
FRONTEND_URL=https://your-app.herokuapp.com

# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname
```

#### Encryption
```bash
# PII Encryption Key (Fernet)
ENCRYPTION_KEY=<44-char-fernet-key>
```

#### Redis
```bash
# Session & Cache Store
REDIS_URL=redis://:password@host:6379/0
```

#### Email (FastAPI-Mail)
```bash
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=<app-specific-password>
MAIL_FROM=noreply@chaski.example.com
MAIL_PORT=587
MAIL_SERVER=smtp.gmail.com
MAIL_FROM_NAME=Chaski
MAIL_STARTTLS=True
MAIL_SSL_TLS=False
```

#### OAuth (Google)
```bash
GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>
GOOGLE_REDIRECT_URI=https://your-app.herokuapp.com/api/auth/google/callback
```

#### AWS S3 (File Storage)
```bash
AWS_ACCESS_KEY_ID=<access-key>
AWS_SECRET_ACCESS_KEY=<secret-key>
AWS_S3_BUCKET=chaski-delivery-proofs
AWS_REGION=us-east-1
```

#### Stripe (Payments)
```bash
STRIPE_SECRET_KEY=sk_live_<key>
STRIPE_PUBLISHABLE_KEY=pk_live_<key>
STRIPE_WEBHOOK_SECRET=whsec_<secret>
```

#### SMS (Optional - Twilio)
```bash
TWILIO_ACCOUNT_SID=<account-sid>
TWILIO_AUTH_TOKEN=<auth-token>
TWILIO_PHONE_NUMBER=+1234567890
```

### Optional Variables

```bash
# Token Expiration (minutes)
ACCESS_TOKEN_EXPIRE_MINUTES=1440        # 24 hours
REMEMBER_ME_EXPIRE_MINUTES=10080        # 7 days

# Rate Limiting
RATE_LIMIT_ENABLED=True

# Logging
LOG_LEVEL=INFO                          # DEBUG, INFO, WARNING, ERROR, CRITICAL
```

## Local Development Setup

### 1. Create .env File

Create a `.env` file in the `backend/` directory:

```bash
cd backend
cp .env.example .env
```

### 2. Generate Development Secrets

```python
# Generate SECRET_KEY
python -c "import secrets; print(secrets.token_urlsafe(64))"

# Generate ENCRYPTION_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### 3. Configure Local Services

#### PostgreSQL (Local)
```bash
# macOS (Homebrew)
brew install postgresql
brew services start postgresql
createdb chaski_dev

# .env
DATABASE_URL=postgresql://localhost/chaski_dev
```

#### Redis (Local)
```bash
# macOS (Homebrew)
brew install redis
brew services start redis

# .env
REDIS_URL=redis://localhost:6379/0
```

### 4. Development Email (Gmail)

For development, use Gmail with an app-specific password:

1. Enable 2-Step Verification in your Google account
2. Generate App Password: https://myaccount.google.com/apppasswords
3. Use the 16-character password in `.env`:

```bash
MAIL_USERNAME=your-dev-email@gmail.com
MAIL_PASSWORD=<16-char-app-password>
```

### 5. AWS S3 Development

Create a separate development bucket:

```bash
AWS_S3_BUCKET=chaski-dev-proofs
```

### 6. Stripe Test Mode

Use Stripe test keys for development:

```bash
STRIPE_SECRET_KEY=sk_test_<key>
STRIPE_PUBLISHABLE_KEY=pk_test_<key>
```

## Heroku Configuration

### Initial Setup

#### 1. Install Heroku CLI

```bash
# macOS
brew tap heroku/brew && brew install heroku

# Login
heroku login
```

#### 2. Create Heroku App

```bash
# Create app
heroku create your-app-name

# Add to existing app
heroku git:remote -a your-app-name
```

### Add-ons Configuration

#### 1. PostgreSQL

```bash
# Add Heroku Postgres
heroku addons:create heroku-postgresql:mini

# Verify DATABASE_URL was set automatically
heroku config:get DATABASE_URL
```

#### 2. Redis

```bash
# Add Heroku Redis
heroku addons:create heroku-redis:mini

# Verify REDIS_URL was set automatically
heroku config:get REDIS_URL
```

#### 3. Papertrail (Logging - Optional)

```bash
heroku addons:create papertrail:choklad
```

### Set Environment Variables

#### Core Variables

```bash
# Application
heroku config:set ENVIRONMENT=production
heroku config:set SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(64))")
heroku config:set FRONTEND_URL=https://your-app.herokuapp.com

# Encryption
heroku config:set ENCRYPTION_KEY=$(python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
```

#### Email Configuration

```bash
heroku config:set MAIL_USERNAME=your-email@gmail.com
heroku config:set MAIL_PASSWORD=<app-specific-password>
heroku config:set MAIL_FROM=noreply@chaski.example.com
heroku config:set MAIL_PORT=587
heroku config:set MAIL_SERVER=smtp.gmail.com
heroku config:set MAIL_FROM_NAME=Chaski
heroku config:set MAIL_STARTTLS=True
heroku config:set MAIL_SSL_TLS=False
```

#### OAuth (Google)

```bash
heroku config:set GOOGLE_CLIENT_ID=<client-id>.apps.googleusercontent.com
heroku config:set GOOGLE_CLIENT_SECRET=<secret>
heroku config:set GOOGLE_REDIRECT_URI=https://your-app.herokuapp.com/api/auth/google/callback
```

#### AWS S3

```bash
heroku config:set AWS_ACCESS_KEY_ID=<access-key>
heroku config:set AWS_SECRET_ACCESS_KEY=<secret-key>
heroku config:set AWS_S3_BUCKET=chaski-production-proofs
heroku config:set AWS_REGION=us-east-1
```

#### Stripe

```bash
heroku config:set STRIPE_SECRET_KEY=sk_live_<key>
heroku config:set STRIPE_PUBLISHABLE_KEY=pk_live_<key>
heroku config:set STRIPE_WEBHOOK_SECRET=whsec_<secret>
```

### View All Config

```bash
# List all config variables
heroku config

# Get specific variable
heroku config:get SECRET_KEY
```

### Update Variable

```bash
heroku config:set VARIABLE_NAME=new-value
```

### Remove Variable

```bash
heroku config:unset VARIABLE_NAME
```

## Secret Generation

### SECRET_KEY (JWT Signing)

**Requirements**:
- Minimum 64 characters
- Cryptographically random
- Unique per environment

**Generation**:
```python
import secrets
secret_key = secrets.token_urlsafe(64)
print(secret_key)
```

**Usage**: Signs JWT tokens for authentication

**Rotation Impact**: Invalidates all existing JWT tokens (all users logged out)

### ENCRYPTION_KEY (PII Encryption)

**Requirements**:
- Fernet-compatible key (44 characters, base64-encoded)
- Unique per environment
- **CRITICAL**: Loss means encrypted data cannot be decrypted

**Generation**:
```python
from cryptography.fernet import Fernet
encryption_key = Fernet.generate_key().decode()
print(encryption_key)
```

**Usage**: Encrypts PII (email, names, phone numbers)

**Backup**: Store securely in password manager and offline backup

**Rotation**: Requires data re-encryption (see Key Rotation section)

### Database Passwords

**Requirements**:
- Minimum 20 characters
- Mix of uppercase, lowercase, numbers, special characters
- Unique per environment

**Generation**:
```python
import secrets
import string
alphabet = string.ascii_letters + string.digits + "!@#$%^&*"
password = ''.join(secrets.choice(alphabet) for i in range(32))
print(password)
```

### Redis Password

Heroku Redis sets this automatically. For self-hosted:

```bash
# Generate strong password
openssl rand -base64 32
```

## Key Rotation

### SECRET_KEY Rotation

**Impact**: All users will be logged out

**Procedure**:
1. Schedule maintenance window
2. Notify users of planned logout
3. Generate new key:
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(64))"
   ```
4. Update environment variable:
   ```bash
   heroku config:set SECRET_KEY=<new-key>
   ```
5. Application automatically restarts
6. All existing tokens invalidated
7. Users must log in again

**Rollback**: Revert to old key if issues arise

### ENCRYPTION_KEY Rotation

**Impact**: Requires data re-encryption

**Procedure**:
1. **Generate new key**:
   ```python
   from cryptography.fernet import Fernet
   new_key = Fernet.generate_key().decode()
   ```

2. **Add new key to environment** (keep old key):
   ```bash
   heroku config:set ENCRYPTION_KEY_NEW=<new-key>
   ```

3. **Create migration script**:
   ```python
   # scripts/rotate_encryption_key.py
   from app.utils.encryption import EncryptionService
   from app.database import SessionLocal
   from app.models.user import User

   old_service = EncryptionService(old_key)
   new_service = EncryptionService(new_key)

   db = SessionLocal()
   users = db.query(User).all()

   for user in users:
       # Decrypt with old key
       email = old_service.decrypt(user.email_encrypted)
       name = old_service.decrypt(user.full_name_encrypted)
       phone = old_service.decrypt(user.phone_number_encrypted) if user.phone_number_encrypted else None

       # Re-encrypt with new key
       user.email_encrypted = new_service.encrypt(email)
       user.full_name_encrypted = new_service.encrypt(name)
       if phone:
           user.phone_number_encrypted = new_service.encrypt(phone)

   db.commit()
   ```

4. **Run migration** (during maintenance window):
   ```bash
   heroku maintenance:on
   heroku run python scripts/rotate_encryption_key.py
   ```

5. **Replace old key**:
   ```bash
   heroku config:set ENCRYPTION_KEY=<new-key>
   heroku config:unset ENCRYPTION_KEY_NEW
   ```

6. **Verify and resume**:
   ```bash
   heroku maintenance:off
   ```

**Frequency**: Annually or after suspected compromise

### Database Password Rotation

**Heroku Postgres**:
```bash
# Heroku manages this automatically
heroku pg:credentials:rotate
```

**Self-hosted**:
1. Create new user with new password
2. Grant all permissions
3. Update DATABASE_URL
4. Test connection
5. Drop old user

### API Keys (Stripe, AWS, etc.)

**Stripe**:
1. Generate new keys in Stripe Dashboard
2. Update environment variables
3. Verify webhook signatures with new secret
4. Delete old keys after 24-hour grace period

**AWS**:
1. Create new IAM access key
2. Update environment variables
3. Test functionality
4. Deactivate old key
5. Delete old key after 24 hours

## Security Best Practices

### Never Commit Secrets

**Checklist**:
- [ ] `.env` is in `.gitignore`
- [ ] No hardcoded secrets in code
- [ ] No secrets in commit history
- [ ] Use environment variables everywhere

**If exposed**:
1. Immediately rotate compromised secrets
2. Review git history
3. Consider `git filter-branch` or BFG Repo-Cleaner
4. Force push to remove from remote
5. Rotate all potentially affected secrets

### Access Control

**Heroku Collaborators**:
```bash
# Add collaborator (view only)
heroku access:add user@example.com

# Add with full access
heroku access:add user@example.com --privileges admin

# List collaborators
heroku access

# Remove access
heroku access:remove user@example.com
```

**Principle of Least Privilege**:
- Only share necessary credentials
- Use separate keys for different services
- Regular access reviews
- Remove access promptly when no longer needed

### Backup Secrets

**Secure Storage**:
1. **Password Manager**: 1Password, LastPass, Bitwarden
   - Store all production secrets
   - Share team vault for shared access
   - Enable 2FA

2. **Offline Backup**:
   - Encrypted USB drive
   - Paper backup in safe
   - Geographic redundancy

3. **Heroku Config Backup**:
   ```bash
   # Export to file (encrypt this file!)
   heroku config --json > heroku-config-backup.json

   # Encrypt backup
   gpg --symmetric --cipher-algo AES256 heroku-config-backup.json
   ```

### Monitoring

**Audit Secret Access**:
- Review Heroku access logs
- Monitor for config changes
- Alert on credential usage patterns
- Track API key usage (Stripe, AWS dashboards)

**Automated Checks**:
```bash
# Check for exposed secrets in code
pip install detect-secrets
detect-secrets scan > .secrets.baseline

# GitHub secret scanning (automatic)
# Enable in repository settings
```

### Environment Separation

**Never share secrets between environments**:

| Secret | Development | Staging | Production |
|--------|-------------|---------|------------|
| SECRET_KEY | Different | Different | Different |
| ENCRYPTION_KEY | Different | Different | Different |
| Database | Separate | Separate | Separate |
| Redis | Separate | Separate | Separate |
| S3 Bucket | dev-bucket | staging-bucket | prod-bucket |
| Stripe | Test keys | Test keys | Live keys |

## Troubleshooting

### Missing Environment Variables

**Symptom**: Application crashes with KeyError or config error

**Solution**:
```bash
# Check if variable exists
heroku config:get VARIABLE_NAME

# Set missing variable
heroku config:set VARIABLE_NAME=value

# View all variables
heroku config
```

### Invalid ENCRYPTION_KEY

**Symptom**: `cryptography.fernet.InvalidToken` error

**Cause**: Wrong key or corrupted encrypted data

**Solution**:
1. Verify key is correct Fernet format (44 chars)
2. Check for whitespace/newlines
3. Ensure key matches data encryption
4. Restore from backup if key lost

### Database Connection Issues

**Symptom**: Connection timeout or authentication failed

**Solution**:
```bash
# Check DATABASE_URL is set
heroku config:get DATABASE_URL

# Test connection
heroku pg:psql

# Check connection limit
heroku pg:info

# Restart database
heroku pg:restart
```

### Redis Connection Issues

**Symptom**: `redis.exceptions.ConnectionError`

**Solution**:
```bash
# Check REDIS_URL
heroku config:get REDIS_URL

# Verify Redis is running
heroku redis:info

# Check connection limit
heroku redis:maxmemory

# Upgrade if needed
heroku addons:upgrade heroku-redis:premium-0
```

### Email Not Sending

**Symptom**: Emails not received, SMTP errors

**Checklist**:
- [ ] MAIL_USERNAME and MAIL_PASSWORD correct
- [ ] App-specific password (not regular password)
- [ ] MAIL_SERVER and MAIL_PORT correct
- [ ] MAIL_STARTTLS=True for Gmail
- [ ] Firewall not blocking port 587
- [ ] Gmail "Less secure app access" not needed with app password

**Debug**:
```python
# Test email configuration
heroku run python -c "
from app.config import settings
print(f'Mail Server: {settings.MAIL_SERVER}')
print(f'Mail Port: {settings.MAIL_PORT}')
print(f'Mail Username: {settings.MAIL_USERNAME}')
print(f'Mail Password: {'*' * len(settings.MAIL_PASSWORD)}')
"
```

### OAuth Redirect Mismatch

**Symptom**: OAuth error "redirect_uri_mismatch"

**Solution**:
1. Check GOOGLE_REDIRECT_URI matches exactly
2. Verify in Google Cloud Console:
   - APIs & Services > Credentials
   - OAuth 2.0 Client IDs
   - Authorized redirect URIs
3. Must match: `https://your-app.herokuapp.com/api/auth/google/callback`
4. No trailing slashes
5. HTTPS in production

## Emergency Procedures

### Suspected Key Compromise

**Immediate Actions**:
1. **Rotate compromised key immediately**
2. **Review audit logs** for suspicious activity
3. **Notify affected users** if data may be compromised
4. **Document incident** for security review
5. **Update security procedures** to prevent recurrence

### Lost ENCRYPTION_KEY

**Prevention** (do this now!):
1. Store in password manager
2. Offline encrypted backup
3. Shared team access (encrypted)

**If lost**:
- **Encrypted data is UNRECOVERABLE**
- Must collect PII again from users
- Contact users to re-enter information
- This is why backup is critical!

### Database Corruption

**Recovery**:
```bash
# Restore from backup
heroku pg:backups:restore b001 DATABASE_URL

# List available backups
heroku pg:backups

# Create backup before changes
heroku pg:backups:capture
```

## Contact

For secrets management assistance:
- **DevOps Team**: devops@chaski.example.com
- **Security Team**: security@chaski.example.com
- **Emergency**: Use PagerDuty escalation

---

**Last Updated**: November 2025
**Version**: 1.0
