# Chaski - Smart Courier Matching Platform

Chaski is a logistics platform that connects package senders with couriers traveling along the same route. Named after the Inca messengers, Chaski enables efficient package delivery by matching packages with travelers going the same way.

## Features

### For Senders
- Create package delivery requests with pickup and dropoff addresses
- Specify package details (size, weight, description)
- Get matched with couriers traveling along your route
- Track package status in real-time

### For Couriers
- Enter your travel route (start and destination)
- Set maximum deviation distance (how far off-route you're willing to go)
- View packages along your route
- Accept packages to deliver and earn money
- Update delivery status

### System
- Intelligent route matching algorithm
- Geolocation-based package discovery
- Configurable deviation distance
- Real-time matching updates

## Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **PostgreSQL** - Database with PostGIS for geospatial queries
- **SQLAlchemy** - ORM for database operations
- **JWT** - Authentication and authorization
- **Geopy/Shapely** - Geospatial calculations

### Frontend
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe JavaScript
- **Tailwind CSS** - Utility-first CSS framework
- **Axios** - HTTP client for API calls

## Project Structure

```
chaski/
├── backend/              # FastAPI backend
│   ├── app/
│   │   ├── models/      # Database models
│   │   ├── routes/      # API endpoints
│   │   ├── services/    # Business logic
│   │   └── utils/       # Utility functions
│   ├── main.py          # Application entry point
│   └── requirements.txt # Python dependencies
│
└── frontend/            # Next.js frontend
    ├── app/             # Next.js App Router pages
    ├── components/      # React components
    ├── lib/             # Utility functions and API client
    └── public/          # Static assets
```

## Getting Started

### Prerequisites

**For Backend:**
- Python 3.9+
- PostgreSQL 14+ with PostGIS extension
- pip or pipenv

**For Frontend:**
- Node.js 16+ (recommended: 18+)
- npm or yarn

**Note:** The frontend requires Node.js 16 or higher. If you're running Node 14, please upgrade to a newer version.

### Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

4. Set up PostgreSQL database:
   ```bash
   createdb chaski_db
   psql chaski_db -c "CREATE EXTENSION postgis;"
   ```

5. Create `.env` file from example:
   ```bash
   cp .env.example .env
   ```

6. Update `.env` with your configuration:
   - Database URL
   - Secret key (generate a secure random string)
   - API keys for mapping service

7. Run the development server:
   ```bash
   uvicorn main:app --reload
   ```

   Backend will be available at `http://localhost:8000`
   API docs at `http://localhost:8000/docs`

### Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create `.env.local` file from example:
   ```bash
   cp .env.example .env.local
   ```

4. Update `.env.local` with your configuration:
   - API URL (backend URL)
   - Google Maps API key

5. Run the development server:
   ```bash
   npm run dev
   ```

   Frontend will be available at `http://localhost:3000`

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Packages (Sender)
- `POST /api/packages` - Create new package
- `GET /api/packages` - Get user's packages
- `GET /api/packages/{id}` - Get package details
- `PUT /api/packages/{id}/status` - Update package status

### Couriers
- `POST /api/couriers/routes` - Create new route
- `GET /api/couriers/routes` - Get courier's routes
- `GET /api/couriers/routes/{id}` - Get route details
- `DELETE /api/couriers/routes/{id}` - Delete route

### Matching
- `GET /api/matching/packages-along-route/{route_id}` - Find packages along route
- `POST /api/matching/accept-package/{package_id}` - Accept package delivery
- `POST /api/matching/decline-package/{package_id}` - Decline package

## Database Schema

### Users
- Email, password (hashed)
- Full name, phone
- Role (sender, courier, both)
- Courier settings (max deviation distance)

### Packages
- Sender and courier IDs
- Package details (description, size, weight)
- Pickup location (address, lat/lng, contact)
- Dropoff location (address, lat/lng, contact)
- Status (pending, matched, picked_up, in_transit, delivered)
- Pricing and timestamps

### Courier Routes
- Courier ID
- Start and end locations (address, lat/lng)
- Max deviation distance
- Departure time
- Active status

## Development Roadmap

### Phase 1: Core Features (Current)
- [x] Basic project structure
- [x] Database models
- [ ] User authentication
- [ ] Package creation
- [ ] Route creation
- [ ] Basic matching algorithm

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

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT License - see LICENSE file for details

## Contact

For questions or support, please open an issue on the GitHub repository.
