from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from app.config import settings
from app.database import engine
from app.models import base
from app.routes import auth, packages, couriers, matching

# Create database tables
base.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Chaski API",
    description="Courier-to-package matching platform API",
    version="1.0.0"
)

# Session middleware (required for OAuth)
app.add_middleware(
    SessionMiddleware,
    secret_key=settings.SECRET_KEY,
    session_cookie="chaski_session",
    max_age=3600,  # 1 hour
    same_site="lax",
    https_only=False  # Set to True in production with HTTPS
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(packages.router, prefix="/api/packages", tags=["Packages"])
app.include_router(couriers.router, prefix="/api/couriers", tags=["Couriers"])
app.include_router(matching.router, prefix="/api/matching", tags=["Matching"])

@app.get("/")
async def root():
    return {"message": "Welcome to Chaski API"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
