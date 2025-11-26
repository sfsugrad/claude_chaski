from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from pydantic import BaseModel, EmailStr

router = APIRouter()

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str  # "sender" or "courier"
    phone_number: str | None = None

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(user: UserRegister, db: Session = Depends(get_db)):
    """Register a new user (sender or courier)"""
    # TODO: Implement user registration logic
    # - Hash password
    # - Create user in database
    # - Return success message
    return {"message": "User registration endpoint - to be implemented"}

@router.post("/login", response_model=Token)
async def login(credentials: UserLogin, db: Session = Depends(get_db)):
    """Login and get access token"""
    # TODO: Implement login logic
    # - Verify credentials
    # - Generate JWT token
    # - Return token
    return {"access_token": "token", "token_type": "bearer"}

@router.get("/me")
async def get_current_user(db: Session = Depends(get_db)):
    """Get current authenticated user"""
    # TODO: Implement get current user
    # - Verify JWT token
    # - Return user data
    return {"message": "Current user endpoint - to be implemented"}
