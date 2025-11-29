# Geographic Registration Restrictions

This document describes the IP-based geographic registration restriction feature implemented in Chaski.

## Overview

The geo-restriction feature allows you to limit NEW user registrations based on their geographic location (determined by IP address). Existing users are **grandfathered in** and can continue using the platform regardless of their location.

## Key Features

- **IP-based Geolocation**: Uses ip-api.com free tier to determine user's country from IP address
- **Redis Caching**: Caches geolocation lookups for 24 hours to minimize API calls
- **Configurable Allowlist**: Specify which countries are allowed to register
- **Admin Override**: Option to allow all countries with a single environment variable
- **Fail-Secure**: Blocks registration if geolocation lookup fails
- **Audit Logging**: Logs all blocked registration attempts with IP and country details
- **User-Friendly**: Shows friendly error message with waitlist option to blocked users
- **Existing Users Protected**: Only affects NEW registrations, existing users unaffected

## Configuration

### Environment Variables

Add these to your `backend/.env` file:

```bash
# Geo-restriction Configuration
ALLOW_INTERNATIONAL_REGISTRATION=false  # Set to 'true' to allow all countries
REGISTRATION_COUNTRY_ALLOWLIST=US       # Comma-separated country codes (ISO 3166-1 alpha-2)
```

### Examples

**US Only (Default):**
```bash
ALLOW_INTERNATIONAL_REGISTRATION=false
REGISTRATION_COUNTRY_ALLOWLIST=US
```

**US, Canada, and UK:**
```bash
ALLOW_INTERNATIONAL_REGISTRATION=false
REGISTRATION_COUNTRY_ALLOWLIST=US,CA,GB
```

**Allow All Countries:**
```bash
ALLOW_INTERNATIONAL_REGISTRATION=true
REGISTRATION_COUNTRY_ALLOWLIST=US  # Ignored when override is true
```

## How It Works

### Registration Flow

1. User submits registration form
2. Backend extracts client IP address from request
3. Backend checks Redis cache for previously looked-up IP
4. If not cached, calls ip-api.com to get country code from IP
5. Validates country code against allowlist
6. If blocked:
   - Returns 403 Forbidden with structured error
   - Logs attempt to audit log with IP and country details
   - Frontend displays modal with friendly message and waitlist option
7. If allowed, registration proceeds normally

### Fail-Secure Design

If the geolocation lookup fails for any reason (API timeout, network error, invalid IP), the system **blocks the registration** to err on the side of caution. This ensures that:
- No unauthorized registrations slip through due to technical issues
- The security posture remains strong even during service disruptions
- You have explicit control over who can register

### Caching Strategy

- **Cache Duration**: 24 hours per IP address
- **Cache Key**: `geo:ip:{ip_address}`
- **Benefits**:
  - Reduces API calls to ip-api.com
  - Faster response times for repeat attempts
  - Stays within free tier limits (45 requests/minute)

## API Details

### Geolocation Endpoint

Uses ip-api.com's free JSON endpoint:
```
http://ip-api.com/json/{ip_address}?fields=status,country,countryCode
```

**Rate Limits**: 45 requests/minute (free tier)

**Response Example**:
```json
{
  "status": "success",
  "country": "United States",
  "countryCode": "US"
}
```

### Error Response

When a registration is blocked, the API returns:

```json
{
  "detail": {
    "error_code": "COUNTRY_NOT_ALLOWED",
    "message": "We're currently only accepting registrations from the United States. If you're interested in using Chaski from your location, please join our waitlist at [email/link].",
    "country_detected": "CA"
  }
}
```

## Frontend Integration

The frontend registration page (`frontend/app/[locale]/register/page.tsx`) includes:

- Error detection for `COUNTRY_NOT_ALLOWED` error code
- Modal display with friendly message
- Country code shown to user for transparency
- Waitlist option/link for interested users

## Audit Logging

All blocked registration attempts are logged to the `audit_log` table with:
- Action: `UNAUTHORIZED_ACCESS`
- Resource Type: `registration`
- IP Address: Client IP
- Details: Country code and blocked reason
- Timestamp: When attempt occurred

### Viewing Blocked Attempts

```sql
SELECT * FROM audit_log
WHERE action = 'UNAUTHORIZED_ACCESS'
  AND resource_type = 'registration'
ORDER BY created_at DESC;
```

## Testing

### Unit Tests

Located in `backend/tests/test_geo_restriction.py`:
- Successful IP lookup
- Cache hit behavior
- API failure handling
- Timeout handling
- Country allowlist validation
- Admin override functionality
- Multiple countries in allowlist

Run with:
```bash
pytest tests/test_geo_restriction.py -v
```

### Integration Tests

Located in `backend/tests/test_auth.py`:
- Registration blocked from non-US IP
- Registration allowed from US IP
- Registration blocked when geo lookup fails
- Blocked attempts logged to audit log
- Admin override allows all countries

Run with:
```bash
pytest tests/test_auth.py::test_register_blocked_from_non_us_ip -v
pytest tests/test_auth.py::test_register_allowed_from_us_ip -v
pytest tests/test_auth.py::test_register_blocked_when_geo_lookup_fails -v
pytest tests/test_auth.py::test_register_logs_blocked_attempts_to_audit -v
pytest tests/test_auth.py::test_register_with_admin_override_allows_all_countries -v
```

### Testing in Development

To test geo-restriction locally, you can:

1. **Mock the IP**: The system reads the client IP from `request.client.host`
2. **Use VPN**: Test with a VPN to different countries
3. **Mock the Lookup**: Patch `get_country_from_ip` in tests to return specific countries

## Security Considerations

### VPN Detection

**Note**: This implementation does NOT detect VPNs or proxies. Users can potentially bypass the restriction using:
- VPN services
- Proxy servers
- Tor network

If VPN detection is required, consider:
- Commercial services like MaxMind GeoIP2, IPQualityScore
- Additional IP reputation checks
- Multi-factor verification for suspicious IPs

### IP Spoofing

The IP address is taken from `request.client.host` which is provided by the web server. Ensure:
- Your reverse proxy (nginx, etc.) properly sets `X-Forwarded-For` headers
- You're using HTTPS to prevent MITM attacks
- Rate limiting is enabled to prevent abuse

### Privacy

IP addresses are:
- **Not stored** in the user record
- **Only logged** in audit log for blocked attempts
- **Cached** in Redis temporarily (24 hours)
- **Subject to privacy laws** - ensure compliance with GDPR, CCPA, etc.

## Grandfathering Existing Users

The geo-restriction **only applies to NEW registrations**. Existing users are completely unaffected:

- Users registered before geo-restriction was enabled can login normally
- No retroactive blocking of existing accounts
- No IP checks on login, only on registration

## Admin Override

To temporarily allow international registrations (e.g., for a promotion or expansion):

1. Set environment variable:
   ```bash
   ALLOW_INTERNATIONAL_REGISTRATION=true
   ```

2. Restart the backend server:
   ```bash
   # Kill and restart uvicorn
   pkill -f uvicorn
   cd backend && source venv/bin/activate && uvicorn main:app --reload --port 8000
   ```

3. When done, set back to `false` and restart

**Note**: The admin override bypasses ALL geo-restriction checks. Use with caution.

## Troubleshooting

### Legitimate Users Blocked

If legitimate users in allowed countries are blocked:

1. **Check their IP**: Have them visit https://ip-api.com and check their detected country
2. **Check Redis**: See if their IP is cached with wrong country
   ```bash
   redis-cli
   GET geo:ip:{their_ip}
   ```
3. **Clear cache if needed**:
   ```bash
   redis-cli
   DEL geo:ip:{their_ip}
   ```
4. **Check API limits**: Ensure you haven't exceeded ip-api.com rate limits

### API Rate Limiting

If you hit ip-api.com rate limits (45 req/min):

1. **Increase cache TTL**: Modify `IP_GEO_CACHE_TTL` in `geo_restriction.py`
2. **Upgrade to Pro**: Consider ip-api.com Pro tier ($13/month for unlimited)
3. **Alternative Services**: Use MaxMind, IPinfo, or IPStack

### Redis Connection Issues

If Redis is unavailable:
- The system creates a dummy Redis client that returns `None`
- All lookups will hit the API (slower, but functional)
- Cache writes silently fail
- Consider monitoring Redis uptime

## Country Codes

The system uses ISO 3166-1 alpha-2 country codes. Common codes:

- **US**: United States
- **CA**: Canada
- **GB**: United Kingdom
- **AU**: Australia
- **DE**: Germany
- **FR**: France
- **JP**: Japan
- **CN**: China
- **IN**: India
- **BR**: Brazil

Full list: https://en.wikipedia.org/wiki/ISO_3166-1_alpha-2

## Future Enhancements

Potential improvements for future versions:

1. **VPN Detection**: Integrate with IPQualityScore or similar
2. **Multiple Allowlists**: Different allowlists for different user types
3. **Time-based Restrictions**: Allow international during certain hours
4. **Geo-based Pricing**: Different pricing for different regions
5. **Analytics Dashboard**: View blocked attempts by country
6. **Email Waitlist**: Automated waitlist signup for blocked users

## Support

For questions or issues with geo-restriction:
- Check logs: `tail -f backend/logs/app.log | grep geo_restriction`
- Review audit logs: SQL query shown above
- Check Redis: `redis-cli KEYS "geo:ip:*"`
- GitHub Issues: https://github.com/anthropics/chaski/issues
