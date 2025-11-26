# Chaski - Smart Courier Matching Platform

Chaski is a logistics platform that connects package senders with couriers traveling along the same route. Named after the Inca messengers, Chaski enables efficient package delivery by matching packages with travelers going the same way.

## Features

### Authentication & Security
- **User Registration** with email verification
- **Email Verification** with secure token-based validation
- **Google Single Sign-On** (OAuth 2.0) for quick authentication
- **JWT-based Authentication** for secure API access
- **Password Hashing** with bcrypt
- **Role-based Access Control** (sender, courier, or both)

### For Senders
- **Create Package Delivery Requests** with Google Places address autocomplete (coordinates auto-generated)
- **Smart Address Input**: Type and select from Google Places suggestions for accurate addresses
- **Specify Package Details**: size (small to extra large), weight, description, optional price
- **Pickup & Dropoff Information**: full addresses with optional contact details
- **Get Matched** with couriers traveling along your route
- **Track Package Status** in real-time (pending, matched, picked_up, in_transit, delivered)
- **View All Packages** from the dashboard

### For Couriers
- Enter your travel route (start and destination)
- Set maximum deviation distance (how far off-route you're willing to go)
- View packages along your route
- Accept packages to deliver and earn money
- Update delivery status

### System
- **Intelligent Route Matching Algorithm** - Matches packages with couriers on similar routes
- **Geolocation-Based Package Discovery** - Auto-geocoding from addresses (coordinates generated automatically)
- **Configurable Deviation Distance** - Couriers set how far they'll deviate from their route
- **Real-time Matching Updates** - Instant notifications when matches are found
- **Beautiful, Responsive UI** - Modern design with Tailwind CSS
- **Type-Safe API** - Full TypeScript interfaces for frontend-backend communication

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Database with PostGIS for geospatial queries
- **SQLAlchemy** - ORM for database operations
- **JWT** - Authentication and authorization
- **FastAPI-Mail** - Email sending with SMTP
- **Authlib** - OAuth 2.0 implementation
- **Bcrypt** - Password hashing
- **Geopy/Shapely** - Geospatial calculations
- **Pytest** - Testing framework

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls
- **React Hooks** - Modern state management

## Project Structure

```
chaski/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── models/      # Database models (User, Package, Route)
│   │   ├── routes/      # API endpoints (auth, packages, couriers, matching)
│   │   ├── utils/       # Utility functions (auth, email, oauth)
│   │   └── config.py    # Configuration settings
│   ├── tests/           # Pytest test suite
│   ├── main.py          # Application entry point
│   └── requirements.txt # Python dependencies
│
└── frontend/            # Next.js frontend
    ├── app/             # Next.js App Router pages
    │   ├── register/    # Registration page
    │   ├── login/       # Login page
    │   ├── dashboard/   # User dashboard
    │   ├── packages/    # Package management
    │   │   └── create/  # Package creation form
    │   ├── verify-email/# Email verification page
    │   └── auth/        # OAuth callback handler
    ├── components/      # React components (GoogleSignInButton, etc.)
    ├── lib/             # Utility functions and API client
    └── public/          # Static assets
```

## Getting Started

### Prerequisites

**For Backend:**
- Python 3.9+
- PostgreSQL 14+ with PostGIS extension
- SMTP credentials (Gmail recommended for development)
- Google OAuth credentials (optional, for SSO)

**For Frontend:**
- Node.js 18+ (v18.17.0 or higher)
- npm or yarn

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Create a virtual environment:**
   ```bash
   python3 -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Set up PostgreSQL database:**
   ```bash
   createdb chaski_db
   psql chaski_db -c "CREATE EXTENSION postgis;"
   ```

5. **Create `.env` file from example:**
   ```bash
   cp .env.example .env
   ```

6. **Update `.env` with your configuration:**

   **Required Settings:**
   ```env
   # Database
   DATABASE_URL=postgresql://user:password@localhost:5432/chaski_db

   # JWT
   SECRET_KEY=your-secret-key-here-change-in-production
   ACCESS_TOKEN_EXPIRE_MINUTES=30

   # Frontend URL
   FRONTEND_URL=http://localhost:3000
   ```

   **Email Settings (for email verification):**

   For Gmail:
   ```env
   MAIL_USERNAME=your-email@gmail.com
   MAIL_PASSWORD=your-gmail-app-password
   MAIL_FROM=noreply@chaski.com
   MAIL_SERVER=smtp.gmail.com
   MAIL_PORT=587
   ```

   To get Gmail App Password:
   - Enable 2-Factor Authentication in your Google Account
   - Go to Security → App Passwords
   - Generate an app password for "Mail"
   - Use that password in `MAIL_PASSWORD`

   **Google OAuth (optional, for SSO):**
   ```env
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   GOOGLE_REDIRECT_URI=http://localhost:8000/api/auth/google/callback
   ```

   To get Google OAuth credentials:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a project → APIs & Services → Credentials
   - Create OAuth client ID (Web application)
   - Add authorized redirect URI: `http://localhost:8000/api/auth/google/callback`

7. **Add verification_token column to database:**
   ```bash
   psql -d chaski_db -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token VARCHAR;"
   ```

8. **Run the development server:**
   ```bash
   uvicorn main:app --reload --host 0.0.0.0 --port 8000
   ```

   Backend will be available at:
   - API: `http://localhost:8000`
   - Interactive docs: `http://localhost:8000/docs`
   - Alternative docs: `http://localhost:8000/redoc`

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create `.env.local` file:**
   ```bash
   cp .env.example .env.local
   ```

4. **Configure environment variables in `.env.local`:**

   **Required:**
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8000
   ```

   **Optional (but recommended for address autocomplete):**
   ```env
   NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-places-api-key-here
   ```

   To get a Google Places API key:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create or select a project
   - Go to "APIs & Services" → "Library"
   - Enable "Places API"
   - Go to "APIs & Services" → "Credentials"
   - Create an API key
   - (Recommended) Restrict the API key to:
     - Website restrictions: Add `http://localhost:3000` for development
     - API restrictions: Limit to "Places API"

   **Note:** The application works without the Google Places API key, but users will need to manually enter coordinates. With the API key, addresses auto-complete and coordinates are automatically populated.

5. **Run the development server:**
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`

### Quick Start (Both Servers)

From the project root:

```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate  # or venv\Scripts\activate on Windows
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user with email verification
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info (requires authentication)
- `GET /api/auth/verify-email/{token}` - Verify email address
- `POST /api/auth/resend-verification` - Resend verification email
- `GET /api/auth/google/login` - Initiate Google OAuth login
- `GET /api/auth/google/callback` - Handle Google OAuth callback

### Packages (Sender)
- `POST /api/packages` - Create new package (requires sender or both role)
  - Required: description, size, weight_kg, pickup/dropoff addresses and coordinates
  - Optional: contact info for pickup/dropoff, price
  - Validates: weight (0-1000kg), description length (max 500 chars), size enum
- `GET /api/packages` - Get user's packages (sender's created packages, courier's assigned packages)
- `GET /api/packages/{id}` - Get package details (with access control)
- `PUT /api/packages/{id}/status` - Update package status (courier only)

### Couriers
- `POST /api/couriers/routes` - Create new route
- `GET /api/couriers/routes` - Get courier's routes
- `GET /api/couriers/routes/{id}` - Get route details
- `DELETE /api/couriers/routes/{id}` - Delete route

### Matching
- `GET /api/matching/packages-along-route/{route_id}` - Find packages along route
- `POST /api/matching/accept-package/{package_id}` - Accept package delivery
- `POST /api/matching/decline-package/{package_id}` - Decline package

## User Flow

### Registration & Login

1. **Email Registration:**
   - User fills registration form at `/register`
   - Receives verification email
   - Clicks verification link
   - Account is activated

2. **Google Sign-In:**
   - User clicks "Continue with Google"
   - Redirects to Google OAuth
   - Auto-creates account (already verified)
   - Redirects to dashboard

3. **Login:**
   - User enters credentials at `/login`
   - Receives JWT token
   - Redirects to dashboard

### Package Creation (Senders)

1. **Access Package Creation:**
   - Login to dashboard at `/dashboard`
   - Click "Create Package" button (sender or both roles only)
   - Redirects to `/packages/create`

2. **Fill Package Details:**
   - **Package Information**: Enter description, select size (small/medium/large/extra_large), specify weight
   - **Pickup Location**: Enter full pickup address, add optional contact name and phone
   - **Dropoff Location**: Enter full dropoff address, add optional contact name and phone
   - **Pricing**: Optionally set a price, or leave empty for courier offers
   - Coordinates are automatically generated from addresses

3. **Submit Package:**
   - Form validates all required fields
   - Package is created with "pending" status
   - Redirects back to dashboard
   - Package is now available for courier matching

## Database Schema

### Users
- Email (unique), hashed password
- Full name, phone number
- Role (sender, courier, both)
- Email verification status and token
- Courier settings (max deviation distance)
- Timestamps (created_at, updated_at)

### Packages
- Sender and courier IDs (foreign keys to Users)
- Package details:
  - Description (max 500 characters)
  - Size: small, medium, large, extra_large
  - Weight (0-1000 kg)
- Pickup location:
  - Full address (street, city, state, zip)
  - Coordinates (lat/lng, auto-generated)
  - Optional contact name and phone
- Dropoff location:
  - Full address (street, city, state, zip)
  - Coordinates (lat/lng, auto-generated)
  - Optional contact name and phone
- Status: pending → matched → picked_up → in_transit → delivered
- Optional pricing (or null for courier offers)
- Timestamps (created_at, updated_at)

### Courier Routes
- Courier ID
- Start and end locations (address, lat/lng)
- Max deviation distance
- Departure time
- Active status

## Testing

### Backend Tests

Run the test suite:
```bash
cd backend
pytest
```

Run with coverage:
```bash
pytest --cov=app tests/
```

## Development Roadmap

### Phase 1: Core Features (In Progress)
- [x] Basic project structure
- [x] Database models
- [x] User authentication with JWT
- [x] Email verification system
- [x] Google OAuth integration
- [x] Frontend registration & login
- [x] User dashboard
- [x] **Package creation** (Backend & Frontend complete)
  - [x] Full CRUD API endpoints
  - [x] Package creation form with validation
  - [x] Auto-geocoding from addresses
  - [x] Role-based access control
  - [x] Google Places autocomplete for address input
- [ ] Route creation for couriers
- [ ] Package-route matching algorithm
- [ ] Package listing and management

### Phase 2: Enhanced Matching
- [ ] Advanced route matching with real road distances
- [ ] Price negotiation
- [ ] Package categories and restrictions
- [ ] Route optimization for multiple packages

### Phase 3: Mobile App
- [ ] React Native mobile app
- [ ] Push notifications
- [ ] Real-time tracking
- [ ] In-app messaging

### Phase 4: Additional Features
- [ ] Payment integration
- [ ] Rating and review system
- [ ] Package insurance
- [ ] Analytics dashboard

## Security Features

- **Password Hashing**: Bcrypt with salt
- **JWT Tokens**: Secure token-based authentication with expiration
- **Email Verification**: Prevents fake accounts with secure token validation
- **OAuth 2.0**: Industry-standard authentication via Google
- **Role-Based Access Control**: Package creation restricted to senders, status updates to couriers
- **Resource Access Control**: Users can only view/modify their own packages
- **CORS Protection**: Configured for frontend origin only
- **SQL Injection Protection**: SQLAlchemy ORM parameterization
- **Input Validation**: Pydantic models for all request/response validation
- **Field-Level Validation**: Weight limits, description length, enum types enforced

## Environment Variables

### Backend (.env)
```env
DATABASE_URL=postgresql://user:password@localhost:5432/chaski_db
SECRET_KEY=your-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30
MAIL_USERNAME=your-email@gmail.com
MAIL_PASSWORD=your-app-password
FRONTEND_URL=http://localhost:3000
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=your-google-places-api-key-here
```

## Troubleshooting

### Backend Issues

**Database connection error:**
- Ensure PostgreSQL is running
- Check DATABASE_URL in `.env`
- Verify database exists: `psql -l`

**Email not sending:**
- Check SMTP credentials in `.env`
- For Gmail, use App Password, not account password
- Verify `MAIL_PORT=587` for TLS

**Google OAuth not working:**
- Check redirect URI matches in Google Console
- Verify CLIENT_ID and CLIENT_SECRET in `.env`

### Frontend Issues

**Node version error:**
- Upgrade to Node.js 18+: `nvm install 18`
- Check version: `node --version`

**API connection error:**
- Ensure backend is running on port 8000
- Check `NEXT_PUBLIC_API_URL` in `.env.local`

## Contributing

This is a personal project, but suggestions and feedback are welcome! Please open an issue for bug reports or feature requests.

## License

MIT License - see LICENSE file for details

## Acknowledgments

- Named after the Inca messenger system "Chasqui"
- Built with FastAPI and Next.js
- Powered by PostgreSQL and PostGIS

## Contact

For questions or support, please open an issue on the GitHub repository.

---

**Built with Claude Code** 🤖
