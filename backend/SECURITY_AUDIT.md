# OWASP ZAP Security Audit Guide

## Overview

This guide provides step-by-step instructions for running comprehensive security testing on the Chaski application using OWASP ZAP (Zed Attack Proxy).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Automated Scanning](#automated-scanning)
- [Manual Testing](#manual-testing)
- [Authentication Configuration](#authentication-configuration)
- [Interpreting Results](#interpreting-results)
- [Common Findings & Remediation](#common-findings--remediation)
- [CI/CD Integration](#cicd-integration)

## Prerequisites

### Required Services Running
```bash
# Backend API
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000

# Frontend (optional, for full E2E testing)
cd frontend
npm run dev

# PostgreSQL
# Redis
```

### Test User Credentials
Create a test user for authenticated scanning:
```bash
# Via API or admin panel
Email: security-test@chaski.test
Password: SecureTest123!@#
Role: both
```

## Installation

### macOS (Homebrew)
```bash
brew install --cask owasp-zap
```

### Linux
```bash
# Download from https://www.zaproxy.org/download/
wget https://github.com/zaproxy/zaproxy/releases/download/v2.14.0/ZAP_2_14_0_unix.sh
chmod +x ZAP_2_14_0_unix.sh
./ZAP_2_14_0_unix.sh
```

### Docker
```bash
docker pull zaproxy/zap-stable
```

### Verify Installation
```bash
# GUI version
/Applications/OWASP\ ZAP.app/Contents/MacOS/OWASP\ ZAP

# Command-line version
zap.sh -version
```

## Quick Start

### 1. Launch ZAP
```bash
# GUI Mode (recommended for first-time setup)
/Applications/OWASP\ ZAP.app/Contents/MacOS/OWASP\ ZAP

# Headless Mode (for automation)
zap.sh -daemon -port 8090 -config api.disablekey=true
```

### 2. Configure Target
- **Target URL**: `http://localhost:8000`
- **Mode**: Standard (for learning), Protected (for testing), Safe (very cautious)

### 3. Basic Scan
1. Enter target URL in Quick Start tab
2. Click "Automated Scan"
3. Wait for scan completion
4. Review alerts in Alerts tab

## Automated Scanning

### Using Python ZAP API

Install ZAP Python API:
```bash
pip install python-owasp-zap-v2.4
```

### Basic Automated Scan Script

See `scripts/security_scan_zap.py` for full implementation.

```python
from zapv2 import ZAPv2
import time

# Connect to ZAP
zap = ZAPv2(apikey='your-api-key', proxies={'http': 'http://127.0.0.1:8090', 'https': 'http://127.0.0.1:8090'})

# Target
target = 'http://localhost:8000'

# Spider scan
print('Starting spider scan...')
scan_id = zap.spider.scan(target)
while int(zap.spider.status(scan_id)) < 100:
    print(f'Spider progress: {zap.spider.status(scan_id)}%')
    time.sleep(2)

# Active scan
print('Starting active scan...')
scan_id = zap.ascan.scan(target)
while int(zap.ascan.status(scan_id)) < 100:
    print(f'Active scan progress: {zap.ascan.status(scan_id)}%')
    time.sleep(5)

# Get results
alerts = zap.core.alerts(baseurl=target)
print(f'Found {len(alerts)} alerts')

# Generate report
zap.core.htmlreport()
```

### Run Automated Scan

```bash
# Start ZAP daemon
zap.sh -daemon -port 8090 -config api.disablekey=true &

# Wait for ZAP to start
sleep 10

# Run scan script
python scripts/security_scan_zap.py

# Results saved to reports/zap-report.html
```

## Manual Testing

### Authentication Setup

#### 1. Configure Context

**ZAP GUI** → **File** → **New Context**
- Name: `Chaski Auth`
- Include in Context: `http://localhost:8000.*`

#### 2. Set Up Authentication

**Context** → **Authentication**
- **Method**: Form-Based Authentication
- **Login URL**: `http://localhost:8000/api/auth/login`
- **Login Request POST Data**:
  ```
  {"email":"security-test@chaski.test","password":"SecureTest123!@#"}
  ```
- **Username parameter**: `email`
- **Password parameter**: `password`
- **Logged in indicator**: Look for success response or specific cookie
- **Logged out indicator**: 401 Unauthorized response

#### 3. Add User

**Context** → **Users**
- Username: `security-test@chaski.test`
- Click **Add**
- Enable user

#### 4. Configure Session Management

**Context** → **Session Management**
- **Method**: Cookie-Based Session Management
- **Session tokens**: `access_token`

### Spider Scan (Crawling)

1. **Right-click target** → **Attack** → **Spider**
2. **Options**:
   - Max Depth: 5
   - Max Children: 10
   - Include subtree only
3. **Start Scan**
4. Monitor progress in Spider tab

### Active Scan (Vulnerability Testing)

1. **Right-click target** → **Attack** → **Active Scan**
2. **Policy**: Default or custom
3. **Options**:
   - All scanners enabled
   - Threshold: Medium
   - Strength: Medium (or High for thorough testing)
4. **Start Scan**
5. Monitor progress in Active Scan tab

**⚠️ Warning**: Active scanning sends potentially harmful payloads. Only run against development/test environments.

### Manual Exploration

1. **Configure browser proxy**:
   - Proxy: `localhost:8090`
   - Use FoxyProxy browser extension for easy toggling

2. **Browse application manually**:
   - Login as test user
   - Navigate all features
   - Submit forms
   - Upload files
   - Test API endpoints

3. **ZAP records all traffic** in Sites tree

## Authentication Configuration

### Cookie-Based JWT Authentication

Create authentication script for Chaski's JWT cookie flow:

**ZAP** → **Scripts** → **Authentication**

```javascript
// Chaski JWT Cookie Authentication Script
function authenticate(helper, paramsValues, credentials) {
    var HttpRequestHeader = Java.type('org.parosproxy.paros.network.HttpRequestHeader');
    var HttpHeader = Java.type('org.parosproxy.paros.network.HttpHeader');
    var URI = Java.type('org.apache.commons.httpclient.URI');

    // Login request
    var loginUrl = paramsValues.get("loginUrl");
    var requestUri = new URI(loginUrl, true);
    var requestMethod = HttpRequestHeader.POST;

    // Build request
    var msg = helper.prepareMessage();
    var requestHeader = new HttpRequestHeader(requestMethod, requestUri, HttpHeader.HTTP11);
    msg.setRequestHeader(requestHeader);

    // Set body
    var loginData = {
        email: credentials.getParam("email"),
        password: credentials.getParam("password")
    };
    msg.setRequestBody(JSON.stringify(loginData));
    msg.getRequestHeader().setContentLength(msg.getRequestBody().length());
    msg.getRequestHeader().setHeader("Content-Type", "application/json");

    // Send request
    helper.sendAndReceive(msg);

    // Extract cookie from response
    var cookies = msg.getResponseHeader().getHttpCookies();
    for (var i = 0; i < cookies.size(); i++) {
        var cookie = cookies.get(i);
        if (cookie.getName() === "access_token") {
            return msg;
        }
    }

    return null;
}

function getRequiredParamsNames() {
    return ["loginUrl"];
}

function getOptionalParamsNames() {
    return [];
}

function getCredentialsParamsNames() {
    return ["email", "password"];
}
```

## Interpreting Results

### Alert Risk Levels

| Risk | Severity | Action Required |
|------|----------|-----------------|
| High | Critical/High | Fix immediately before deployment |
| Medium | Medium | Fix in current sprint |
| Low | Low | Fix in backlog |
| Informational | Info | Review and consider |

### Common Alert Categories

#### High Risk
- **SQL Injection**: Parameterized queries needed
- **XSS**: Input sanitization required
- **Authentication Bypass**: Fix auth logic
- **Path Traversal**: Validate file paths
- **Remote Code Execution**: Critical security flaw

#### Medium Risk
- **CSRF**: Token validation needed
- **Sensitive Data Exposure**: Encryption required
- **Security Misconfiguration**: Update settings
- **Weak Cryptography**: Use stronger algorithms

#### Low Risk
- **Information Disclosure**: Remove verbose errors
- **Weak Passwords**: Enforce password policy
- **Missing Security Headers**: Add headers
- **Cookie Security**: Set HttpOnly, Secure flags

#### Informational
- **Information Leakage**: Review stack traces
- **Debug Messages**: Disable in production
- **Directory Listing**: Disable if not needed

### Review Process

For each alert:
1. **Understand the issue**: Read description
2. **Verify finding**: Reproduce manually
3. **Assess impact**: Evaluate risk to application
4. **Determine fix**: Research remediation
5. **Implement**: Apply security fix
6. **Retest**: Verify issue resolved
7. **Document**: Update security docs

## Common Findings & Remediation

### 1. Missing Security Headers

**Finding**: X-Content-Type-Options, X-Frame-Options missing

**Remediation**: Already implemented in `main.py:41-92`

**Verify**:
```bash
curl -I http://localhost:8000/api/auth/me
```

### 2. CSRF Token Missing

**Finding**: State-changing requests lack CSRF protection

**Remediation**: Already implemented in `app/middleware/csrf_middleware.py`

**Verify**: Check for `X-CSRF-Token` header requirement

### 3. Weak Password Policy

**Finding**: Allows weak passwords

**Remediation**: Already implemented in `app/utils/password_validator.py`

**Verify**: Try creating user with weak password

### 4. SQL Injection

**Finding**: SQL injection vulnerabilities

**Remediation**: Use SQLAlchemy ORM (already implemented)

**Verify**: All database queries use ORM, no raw SQL with user input

### 5. XSS Vulnerabilities

**Finding**: Unescaped user input in responses

**Remediation**: Already implemented via:
- Input sanitization (`app/utils/input_sanitizer.py`)
- Pydantic validation
- Frontend escaping

**Verify**: Submit XSS payloads, check if sanitized

### 6. Insecure Cookies

**Finding**: Missing HttpOnly or Secure flags

**Remediation**: Already implemented in `app/routes/auth.py:63-71`

**Verify**:
```bash
curl -i http://localhost:8000/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"Test123!@#"}'
```

### 7. Information Disclosure

**Finding**: Verbose error messages

**Check**: FastAPI error handling doesn't leak stack traces in production

**Remediation**:
```python
# main.py
if settings.ENVIRONMENT == "production":
    @app.exception_handler(Exception)
    async def generic_exception_handler(request, exc):
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error"}
        )
```

### 8. Directory Traversal

**Finding**: File path validation needed

**Remediation**: Already implemented in `app/services/file_storage.py`

**Verify**: S3 keys use UUIDs, no user-controlled paths

## False Positives

### Expected "Findings" (Not Issues)

1. **CSP 'unsafe-inline'**: Required for Next.js, Google Maps
   - **Mitigation**: Nonce-based CSP planned for future

2. **CORS enabled**: Needed for frontend-backend communication
   - **Mitigation**: Origin whitelist in `main.py`

3. **Rate limiting not detected**: ZAP may not detect SlowAPI
   - **Mitigation**: Verify manually with repeated requests

4. **Session fixation**: False positive with httpOnly cookies
   - **Mitigation**: Session ID in JWT, regenerated on login

## Reporting

### Generate HTML Report

**ZAP GUI**:
- **Report** → **Generate HTML Report**
- Save to `reports/zap-report-YYYY-MM-DD.html`

**Command Line**:
```bash
zap-cli report -o reports/zap-report.html -f html
```

### Generate JSON Report (for CI/CD)

```bash
zap-cli report -o reports/zap-report.json -f json
```

### Report Contents

Include in report:
- Executive summary
- Scan details (date, target, scope)
- Findings by severity
- Detailed vulnerability descriptions
- Remediation recommendations
- Retest results

## CI/CD Integration

### GitHub Actions

Create `.github/workflows/security-scan.yml`:

```yaml
name: Security Scan

on:
  schedule:
    - cron: '0 2 * * 0'  # Weekly on Sunday at 2 AM
  workflow_dispatch:  # Manual trigger

jobs:
  zap-scan:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: chaski_test
        ports:
          - 5432:5432

      redis:
        image: redis:7
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.12'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt

      - name: Start application
        run: |
          cd backend
          uvicorn main:app --host 0.0.0.0 --port 8000 &
          sleep 10
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/chaski_test
          REDIS_URL: redis://localhost:6379/0
          SECRET_KEY: test-secret-key-for-ci
          ENCRYPTION_KEY: ${{ secrets.ENCRYPTION_KEY_TEST }}

      - name: OWASP ZAP Baseline Scan
        uses: zaproxy/action-baseline@v0.7.0
        with:
          target: 'http://localhost:8000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload ZAP Report
        uses: actions/upload-artifact@v3
        if: always()
        with:
          name: zap-scan-report
          path: report_html.html
```

### ZAP Rules Configuration

Create `.zap/rules.tsv`:
```tsv
10011	IGNORE	(Cookie Without Secure Flag - expected in dev)
10015	IGNORE	(Incomplete or No Cache-control - API responses)
10021	WARN	(X-Content-Type-Options - already implemented)
10096	WARN	(Timestamp Disclosure - not sensitive)
```

## Best Practices

### 1. Scan Regularly
- **Weekly**: Automated baseline scan
- **Monthly**: Full active scan
- **Pre-deployment**: Quick scan of changes
- **Post-incident**: Thorough review

### 2. Scope Appropriately
- **Include**: All application endpoints
- **Exclude**:
  - Third-party APIs
  - Logout endpoints (prevents session termination during scan)
  - Rate-limited endpoints (if causing issues)

### 3. Test Safely
- **Never** scan production without authorization
- Use separate test environment
- Backup database before active scanning
- Inform team before testing

### 4. Track Findings
- Document all vulnerabilities
- Track remediation status
- Maintain security backlog
- Retest after fixes

### 5. Continuous Improvement
- Update ZAP regularly
- Review new scan rules
- Learn from findings
- Share knowledge with team

## Troubleshooting

### ZAP Won't Start
```bash
# Check if port 8090 is available
lsof -i :8090

# Kill existing ZAP process
pkill -f zap

# Start with different port
zap.sh -daemon -port 8091
```

### Spider Not Finding Pages
- Check authentication is working
- Verify session management
- Increase max depth
- Add seed URLs manually

### Active Scan Too Slow
- Reduce scan policy strength
- Disable unnecessary scanners
- Scan specific paths only
- Use multiple ZAP instances

### False Positives
- Review alert details carefully
- Verify manually
- Add to ignore list if confirmed false positive
- Document decision

### Authentication Failing
- Verify credentials are correct
- Check login request format
- Ensure cookies are being set
- Review authentication script

## Resources

- **OWASP ZAP Docs**: https://www.zaproxy.org/docs/
- **ZAP API**: https://www.zaproxy.org/docs/api/
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **ZAP Getting Started**: https://www.zaproxy.org/getting-started/

## Contact

For security testing questions:
- **Security Team**: security@chaski.example.com
- **DevOps**: devops@chaski.example.com

---

**Last Updated**: November 2025
**Version**: 1.0
