# Twilio SMS Integration Setup Guide

This guide explains how to set up Twilio SMS integration for phone verification in the Chaski application.

## Overview

The application supports two Twilio integration methods:

1. **Twilio Verify API** (Recommended) - Managed OTP service with built-in security features
2. **Twilio Messaging API** - Standard SMS API with custom message content

If Twilio is not configured, the system falls back to console logging for development.

## Prerequisites

1. A Twilio account - Sign up at [https://www.twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. A verified phone number or a Twilio phone number

## Setup Instructions

### Option 1: Twilio Verify API (Recommended)

This is the recommended approach for OTP verification as it provides:
- Automatic rate limiting
- Fraud detection
- Delivery optimization
- International support
- No need to manage verification codes

#### Steps:

1. **Create a Verify Service**:
   - Go to [Twilio Console > Verify > Services](https://console.twilio.com/us1/develop/verify/services)
   - Click "Create new Service"
   - Give it a name (e.g., "Chaski Phone Verification")
   - Copy the **Service SID** (starts with `VA...`)

2. **Get Account Credentials**:
   - Go to [Twilio Console](https://console.twilio.com/)
   - Find your **Account SID** and **Auth Token** on the dashboard

3. **Configure Environment Variables**:

   Add to your `backend/.env` file:
   ```bash
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_VERIFY_SERVICE_SID=your-verify-service-sid
   ```

4. **Test the Integration**:

   The verification code will be sent automatically via Twilio Verify:
   ```python
   from app.utils.sms import send_verification_code

   # Sends OTP via Twilio Verify
   await send_verification_code("+1234567890", "123456")
   ```

   Note: When using Twilio Verify API, the `code` parameter is ignored - Twilio generates and sends its own code.

### Option 2: Twilio Messaging API

Use this if you want full control over the SMS content or don't want to use Verify API.

#### Steps:

1. **Get a Twilio Phone Number**:
   - Go to [Phone Numbers > Buy a Number](https://console.twilio.com/us1/develop/phone-numbers/manage/search)
   - Choose a number with SMS capabilities
   - Purchase the number

2. **Get Account Credentials**:
   - Go to [Twilio Console](https://console.twilio.com/)
   - Find your **Account SID** and **Auth Token**

3. **Configure Environment Variables**:

   Add to your `backend/.env` file:
   ```bash
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_PHONE_NUMBER=+1234567890  # Your Twilio number
   ```

4. **Test the Integration**:
   ```python
   from app.utils.sms import send_verification_code

   # Sends custom SMS via Messaging API
   await send_verification_code("+1234567890", "123456")
   ```

## Development Mode (No Twilio)

If you don't configure Twilio credentials, the system will:
- Log SMS messages to the console
- Print formatted verification codes
- Return success for all SMS operations

This is useful for local development and testing.

## Phone Number Format

All phone numbers must be in **E.164 format**:
- Format: `+[country code][number]`
- Examples:
  - US: `+12125551234`
  - UK: `+442071234567`
  - France: `+33612345678`

The frontend `react-phone-number-input` component automatically formats numbers to E.164.

## Usage in Code

### Sending Verification Codes

```python
from app.utils.sms import send_verification_code

# Send verification code
success = await send_verification_code(
    phone_number="+12125551234",
    code="123456"
)

if success:
    print("SMS sent successfully")
else:
    print("Failed to send SMS")
```

### Sending Custom SMS

```python
from app.utils.sms import send_sms

# Send custom message
success = await send_sms(
    phone_number="+12125551234",
    message="Your delivery is on the way!"
)
```

### Verifying with Twilio Verify API

If you're using Twilio Verify API to send codes, you can also verify them:

```python
from app.utils.sms import verify_code_with_twilio

# Verify code entered by user
is_valid = await verify_code_with_twilio(
    phone_number="+12125551234",
    code="123456"
)

if is_valid:
    print("Code is valid")
else:
    print("Invalid or expired code")
```

**Note**: If not using Twilio Verify API, verify codes in your application logic (as currently implemented in `app/routes/auth.py`).

## Cost Considerations

### Twilio Verify API
- $0.05 per verification (includes sending and checking)
- Free trial credits available
- More cost-effective for OTP use cases

### Twilio Messaging API
- $0.0079 per SMS (US)
- Varies by country
- You control the message content

## Security Best Practices

1. **Never commit credentials** - Always use environment variables
2. **Use Verify API** - Provides better security and fraud protection
3. **Rate limiting** - Already implemented in `app/routes/auth.py`
4. **Code expiration** - Set appropriate expiration times (currently 10 minutes)
5. **HTTPS only** - Ensure production uses HTTPS

## Troubleshooting

### "Twilio package not installed"
```bash
cd backend
source venv/bin/activate
pip install twilio==9.0.4
```

### "Failed to initialize Twilio client"
- Check your Account SID and Auth Token are correct
- Ensure they're properly set in `.env`
- Verify no extra spaces in the values

### "Unable to create record"
- Verify your phone number is in E.164 format
- Check the Twilio phone number is active
- For Verify API, ensure the service SID is correct
- Check your Twilio account balance

### Messages not sending
- Check Twilio console for error logs
- Verify the recipient's phone number is valid
- For trial accounts, you can only send to verified numbers

## Testing

### Manual Testing

Send a test SMS:
```bash
cd backend
source venv/bin/activate
python -c "
import asyncio
from app.utils.sms import send_verification_code

async def test():
    result = await send_verification_code('+12125551234', '123456')
    print(f'Success: {result}')

asyncio.run(test())
"
```

### Integration Testing

The phone verification endpoints are already integrated in `app/routes/auth.py`:
- `POST /api/auth/phone/send-code` - Send verification code
- `POST /api/auth/phone/verify` - Verify code
- `POST /api/auth/phone/resend-code` - Resend code

## References

- [Twilio Verify API Documentation](https://www.twilio.com/docs/verify/api)
- [Twilio Messaging API Documentation](https://www.twilio.com/docs/sms/api)
- [Twilio Console](https://console.twilio.com/)
- [Twilio Pricing](https://www.twilio.com/pricing)

## Support

For Twilio-specific issues:
- [Twilio Support](https://support.twilio.com/)
- [Twilio Status](https://status.twilio.com/)

For application issues:
- Check the application logs in `backend/logs/`
- Review error messages in the console
