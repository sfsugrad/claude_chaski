# Deploying Chaski to Heroku

This guide covers deploying the Chaski full-stack application to Heroku with separate apps for backend and frontend.

## Prerequisites

1. **Heroku CLI installed**: Download from https://devcenter.heroku.com/articles/heroku-cli
2. **Heroku account**: Sign up at https://heroku.com
3. **Git repository**: Ensure your code is committed to git
4. **External services configured**:
   - Stripe account (API keys)
   - AWS S3 bucket (for delivery proof images)
   - Google OAuth credentials
   - Email SMTP credentials

## Part 1: Deploy Backend

### Step 1: Create Heroku App for Backend

```bash
# Login to Heroku
heroku login

# Create backend app (replace 'chaski-backend' with your preferred name)
heroku create chaski-backend

# Add to existing app (if already created)
# heroku git:remote -a chaski-backend
```

### Step 2: Add Required Add-ons

```bash
# Add PostgreSQL with PostGIS support
heroku addons:create heroku-postgresql:mini

# Add Redis for WebSocket pub/sub and caching
heroku addons:create heroku-redis:mini

# Verify add-ons were created
heroku addons
```

### Step 3: Enable PostGIS Extension

```bash
# Connect to your Heroku PostgreSQL database
heroku pg:psql

# In the PostgreSQL prompt, run:
CREATE EXTENSION IF NOT EXISTS postgis;
\q
```

### Step 4: Configure Environment Variables

```bash
# Set all required environment variables
heroku config:set SECRET_KEY="your-secret-key-here"
heroku config:set ALGORITHM="HS256"
heroku config:set ACCESS_TOKEN_EXPIRE_MINUTES=30
heroku config:set FRONTEND_URL="https://your-frontend-app.herokuapp.com"

# Email Configuration
heroku config:set MAIL_USERNAME="chaski@mychaski.net"
heroku config:set MAIL_PASSWORD="your-email-password"
heroku config:set MAIL_FROM="noreply@chaski.com"
heroku config:set MAIL_FROM_NAME="Chaski"
heroku config:set MAIL_SERVER="smtp.gmail.com"
heroku config:set MAIL_PORT=587
heroku config:set MAIL_STARTTLS=True
heroku config:set MAIL_SSL_TLS=False
heroku config:set USE_CREDENTIALS=True
heroku config:set VALIDATE_CERTS=True

# Google OAuth
heroku config:set GOOGLE_CLIENT_ID="your-google-client-id"
heroku config:set GOOGLE_CLIENT_SECRET="your-google-client-secret"
heroku config:set GOOGLE_REDIRECT_URI="https://chaski-backend.herokuapp.com/api/auth/google/callback"

# Stripe
heroku config:set STRIPE_SECRET_KEY="your-stripe-secret-key"
heroku config:set STRIPE_PUBLISHABLE_KEY="your-stripe-publishable-key"
heroku config:set STRIPE_WEBHOOK_SECRET="your-stripe-webhook-secret"

# AWS S3
heroku config:set AWS_ACCESS_KEY_ID="your-aws-access-key"
heroku config:set AWS_SECRET_ACCESS_KEY="your-aws-secret-key"
heroku config:set AWS_S3_BUCKET="your-s3-bucket-name"
heroku config:set AWS_REGION="us-east-1"

# Environment
heroku config:set ENVIRONMENT="production"

# Note: DATABASE_URL and REDIS_URL are automatically set by Heroku add-ons
```

### Step 5: Deploy Backend

```bash
# From your project root directory
cd backend

# Initialize git subtree if not already done
git subtree push --prefix backend heroku main

# Or if using main Heroku remote
git push heroku main:main

# Alternative: Use subtree for monorepo
# git subtree push --prefix backend heroku main
```

**For Monorepo Deployment:**

If deploying from the root directory:

```bash
# From project root
heroku git:remote -a chaski-backend

# Deploy only the backend folder
git subtree push --prefix backend heroku main
```

### Step 6: Run Database Migrations

The `release` phase in Procfile automatically runs migrations, but you can also run manually:

```bash
heroku run alembic upgrade head
```

### Step 7: Verify Backend Deployment

```bash
# Check logs
heroku logs --tail

# Open the app
heroku open

# You should see the FastAPI docs at https://your-backend-app.herokuapp.com/docs
```

## Part 2: Deploy Frontend

### Step 1: Create Heroku App for Frontend

```bash
# Create frontend app
heroku create chaski-frontend

# Or add to existing app
# heroku git:remote -a chaski-frontend -r heroku-frontend
```

### Step 2: Configure Environment Variables

```bash
# Set backend API URL
heroku config:set NEXT_PUBLIC_API_URL="https://chaski-backend.herokuapp.com"

# Set Google Maps API key (if using)
heroku config:set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY="your-google-maps-api-key"
```

### Step 3: Update Frontend API Configuration

Before deploying, update your frontend `.env.local` or create `.env.production`:

```bash
# frontend/.env.production
NEXT_PUBLIC_API_URL=https://chaski-backend.herokuapp.com
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Step 4: Deploy Frontend

```bash
# From project root, deploy frontend subfolder
git subtree push --prefix frontend heroku main

# Or if in frontend directory
cd frontend
git push heroku main
```

### Step 5: Verify Frontend Deployment

```bash
heroku logs --tail -a chaski-frontend
heroku open -a chaski-frontend
```

## Part 3: Post-Deployment Configuration

### Update CORS Settings

Make sure your backend allows requests from the frontend domain. In `backend/main.py`, the CORS middleware should include your Heroku frontend URL:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.FRONTEND_URL,  # This should be your Heroku frontend URL
        "https://chaski-frontend.herokuapp.com"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

Update the `FRONTEND_URL` config var:

```bash
heroku config:set FRONTEND_URL="https://chaski-frontend.herokuapp.com" -a chaski-backend
```

### Update Google OAuth Redirect URI

In your Google Cloud Console:
1. Go to APIs & Services > Credentials
2. Update authorized redirect URIs to include:
   - `https://chaski-backend.herokuapp.com/api/auth/google/callback`
   - `https://chaski-frontend.herokuapp.com`

### Configure Stripe Webhooks

1. Go to Stripe Dashboard > Developers > Webhooks
2. Add endpoint: `https://chaski-backend.herokuapp.com/api/payments/webhook`
3. Select events to listen for
4. Copy the webhook signing secret and update:

```bash
heroku config:set STRIPE_WEBHOOK_SECRET="whsec_xxx" -a chaski-backend
```

### Configure Stripe Identity (ID Verification)

Chaski uses Stripe Identity for courier ID verification (document + selfie). To set this up:

1. **Run the ID verification migration**:
   ```bash
   heroku run bash -a chaski-backend
   PYTHONPATH=. python migrations/add_id_verification.py
   exit
   ```

2. **Set up Stripe Identity webhook endpoint**:
   - Go to Stripe Dashboard > Developers > Webhooks
   - Add endpoint: `https://chaski-backend.herokuapp.com/api/id-verification/webhook`
   - Select events: `identity.verification_session.verified`, `identity.verification_session.requires_input`, `identity.verification_session.canceled`
   - Copy the webhook signing secret

3. **Configure the webhook secret**:
   ```bash
   heroku config:set STRIPE_IDENTITY_WEBHOOK_SECRET="whsec_xxx" -a chaski-backend
   ```

4. **Verify Stripe Identity is enabled**:
   - Go to Stripe Dashboard > Identity
   - Ensure Identity is enabled for your account
   - Note: Stripe Identity may require additional activation for some accounts

### Load Initial Data (Optional)

```bash
# Connect to your Heroku app
heroku run bash -a chaski-backend

# Inside the Heroku dyno
python -m test_data.load_test_data
exit
```

## Part 4: Monitoring and Maintenance

### View Logs

```bash
# Backend logs
heroku logs --tail -a chaski-backend

# Frontend logs
heroku logs --tail -a chaski-frontend
```

### Database Management

```bash
# Connect to PostgreSQL
heroku pg:psql -a chaski-backend

# View database info
heroku pg:info -a chaski-backend

# Create backup
heroku pg:backups:capture -a chaski-backend

# Download backup
heroku pg:backups:download -a chaski-backend
```

### Redis Management

```bash
# View Redis info
heroku redis:info -a chaski-backend

# Connect to Redis CLI
heroku redis:cli -a chaski-backend
```

### Scaling

```bash
# Scale web dynos
heroku ps:scale web=2 -a chaski-backend

# View current dyno status
heroku ps -a chaski-backend
```

## Troubleshooting

### Common Issues

**1. Database Connection Errors**
```bash
# Verify DATABASE_URL is set
heroku config:get DATABASE_URL -a chaski-backend

# Restart the app
heroku restart -a chaski-backend
```

**2. PostGIS Extension Not Found**
```bash
# Reconnect and create extension
heroku pg:psql -a chaski-backend
CREATE EXTENSION IF NOT EXISTS postgis;
```

**3. Frontend Can't Connect to Backend**
- Verify `NEXT_PUBLIC_API_URL` is set correctly
- Check CORS settings in backend
- Verify backend is running: `heroku open -a chaski-backend`

**4. Email Not Sending**
- Verify all MAIL_* config vars are set
- Check logs for SMTP errors
- For Gmail, ensure you're using App Password, not regular password

**5. WebSocket Connection Issues**
- Heroku supports WebSockets, but ensure you're using `wss://` protocol
- Check that Redis is properly connected
- Verify WebSocket endpoint is accessible

### Check Application Health

```bash
# Backend health check
curl https://chaski-backend.herokuapp.com/docs

# View all config
heroku config -a chaski-backend

# Restart if needed
heroku restart -a chaski-backend
```

## Deployment Checklist

Before going live:

- [ ] All environment variables configured
- [ ] PostGIS extension enabled
- [ ] Database migrations run successfully
- [ ] CORS configured with production URLs
- [ ] Google OAuth redirect URIs updated
- [ ] Stripe webhook endpoint configured
- [ ] Stripe Identity webhook endpoint configured (for ID verification)
- [ ] AWS S3 bucket permissions set
- [ ] Email sending tested
- [ ] WebSocket connections tested
- [ ] SSL/HTTPS working (Heroku provides this automatically)
- [ ] Admin user created in database
- [ ] Test data loaded (if desired)
- [ ] ID verification migration run (`migrations/add_id_verification.py`)

## Alternative: Single App Deployment

If you prefer to deploy both backend and frontend in a single Heroku app, you'll need to use multiple buildpacks:

```bash
heroku create chaski-app
heroku buildpacks:add heroku/python
heroku buildpacks:add heroku/nodejs

# You'll need to modify the project structure and Procfile accordingly
```

However, separate apps are recommended for better scaling and maintenance.

## Cost Optimization

- Start with `mini` tier add-ons ($7/month for Postgres, $3/month for Redis)
- Use `eco` dynos ($5/month) for non-critical environments
- Upgrade to `basic` or `standard` dynos for production
- Consider using Heroku Scheduler for background jobs instead of worker dynos

## Resources

- [Heroku Python Support](https://devcenter.heroku.com/articles/python-support)
- [Heroku PostgreSQL](https://devcenter.heroku.com/articles/heroku-postgresql)
- [Heroku Redis](https://devcenter.heroku.com/articles/heroku-redis)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [PostGIS on Heroku](https://devcenter.heroku.com/articles/postgis)
