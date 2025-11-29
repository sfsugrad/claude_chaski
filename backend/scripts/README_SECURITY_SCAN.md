# Security Scanning Quick Reference

## Quick Start

### 1. Install OWASP ZAP

**macOS**:
```bash
brew install --cask owasp-zap
```

**Or download from**: https://www.zaproxy.org/download/

### 2. Install Python ZAP API

```bash
pip install python-owasp-zap-v2.4
```

### 3. Start ZAP Daemon

```bash
# Start ZAP in headless mode
/Applications/OWASP\ ZAP.app/Contents/Java/zap.sh -daemon -port 8090 -config api.disablekey=true &

# Wait for ZAP to start (about 10 seconds)
sleep 10

# Verify ZAP is running
curl http://localhost:8090
```

### 4. Start Chaski Backend

```bash
# In a separate terminal
cd backend
source venv/bin/activate
uvicorn main:app --reload --port 8000
```

### 5. Run Security Scan

```bash
# Run automated security scan
python scripts/security_scan_zap.py

# Custom target
python scripts/security_scan_zap.py --target http://localhost:8000

# Custom report directory
python scripts/security_scan_zap.py --report-dir ./my-reports
```

### 6. View Reports

Reports are saved in `reports/` directory:
- `zap_report_YYYYMMDD_HHMMSS.html` - Full HTML report
- `zap_report_YYYYMMDD_HHMMSS.json` - Machine-readable JSON
- `zap_report_YYYYMMDD_HHMMSS.xml` - XML format
- `zap_summary_YYYYMMDD_HHMMSS.md` - Markdown summary

```bash
# Open HTML report in browser
open reports/zap_report_*.html
```

## One-Liner

Complete security scan in one command:

```bash
# Start ZAP, wait, run scan
/Applications/OWASP\ ZAP.app/Contents/Java/zap.sh -daemon -port 8090 -config api.disablekey=true & sleep 15 && python scripts/security_scan_zap.py
```

## Common Issues

### ZAP Won't Connect
```bash
# Check if ZAP is running
lsof -i :8090

# Kill existing ZAP
pkill -f zap

# Restart ZAP
/Applications/OWASP\ ZAP.app/Contents/Java/zap.sh -daemon -port 8090 -config api.disablekey=true &
```

### Port Already in Use
```bash
# Use different port
/Applications/OWASP\ ZAP.app/Contents/Java/zap.sh -daemon -port 8091 -config api.disablekey=true &

# Scan with custom ZAP port
python scripts/security_scan_zap.py --zap-url http://localhost:8091
```

### Backend Not Running
```bash
# Check if backend is running
curl http://localhost:8000/api/auth/me

# Start backend
cd backend && uvicorn main:app --reload --port 8000
```

## Advanced Usage

### Scan Specific Endpoints

Edit `scripts/security_scan_zap.py` and modify the `setup_context()` method to include/exclude specific URLs.

### Change Scan Depth

```python
# In security_scan_zap.py, modify spider_scan call:
self.spider_scan(max_depth=10)  # Default is 5
```

### Custom Scan Policy

Create custom policy in ZAP GUI, export, and reference in script.

## CI/CD Integration

See `SECURITY_AUDIT.md` for GitHub Actions integration.

## Documentation

Full documentation: `SECURITY_AUDIT.md`

## Support

For security scanning help:
- Documentation: `../SECURITY_AUDIT.md`
- Security Team: security@chaski.example.com
