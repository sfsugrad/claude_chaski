# Chaski Backend API

FastAPI backend for the Chaski courier matching platform.

## Setup

1. Create virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Configure environment:
   ```bash
   cp .env.example .env
   # Edit .env with your settings
   ```

4. Set up database:
   ```bash
   createdb chaski_db
   psql chaski_db -c "CREATE EXTENSION postgis;"
   ```

5. Run migrations (when implemented):
   ```bash
   alembic upgrade head
   ```

6. Start server:
   ```bash
   uvicorn main:app --reload
   ```

## API Documentation

Once the server is running, visit:
- Interactive API docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

## Project Structure

```
backend/
├── app/
│   ├── models/          # SQLAlchemy models
│   │   ├── user.py
│   │   └── package.py
│   ├── routes/          # API endpoints
│   │   ├── auth.py
│   │   ├── packages.py
│   │   ├── couriers.py
│   │   └── matching.py
│   ├── services/        # Business logic
│   ├── utils/           # Helpers
│   ├── config.py        # Configuration
│   └── database.py      # Database setup
├── main.py              # Application entry
└── requirements.txt     # Dependencies
```

## Environment Variables

Required variables in `.env`:
- `DATABASE_URL` - PostgreSQL connection string
- `SECRET_KEY` - JWT secret key
- `GOOGLE_MAPS_API_KEY` - For geocoding (or use Mapbox)

## Development

The API uses automatic reload during development. Make changes to any Python file and the server will restart automatically.

### Testing

```bash
pytest
```

## Next Steps

1. Implement authentication (JWT tokens)
2. Add geocoding service for addresses
3. Implement matching algorithm
4. Add database migrations with Alembic
5. Write tests
