from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from pydantic import BaseModel
from typing import List

router = APIRouter()

class PackageCreate(BaseModel):
    description: str
    size: str  # "small", "medium", "large", "extra_large"
    weight_kg: float
    pickup_address: str
    dropoff_address: str
    pickup_contact_name: str | None = None
    pickup_contact_phone: str | None = None
    dropoff_contact_name: str | None = None
    dropoff_contact_phone: str | None = None
    price: float | None = None

class PackageResponse(BaseModel):
    id: int
    description: str
    status: str
    pickup_address: str
    dropoff_address: str

@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_package(package: PackageCreate, db: Session = Depends(get_db)):
    """Create a new package (sender only)"""
    # TODO: Implement package creation
    # - Verify user is sender
    # - Geocode addresses to get lat/lng
    # - Create package in database
    # - Return package details
    return {"message": "Package creation endpoint - to be implemented"}

@router.get("/", response_model=List[PackageResponse])
async def get_packages(db: Session = Depends(get_db)):
    """Get all packages for current user"""
    # TODO: Implement get packages
    # - If sender: return their packages
    # - If courier: return packages they're delivering
    return []

@router.get("/{package_id}")
async def get_package(package_id: int, db: Session = Depends(get_db)):
    """Get specific package details"""
    # TODO: Implement get package by ID
    return {"message": f"Get package {package_id} - to be implemented"}

@router.put("/{package_id}/status")
async def update_package_status(package_id: int, status: str, db: Session = Depends(get_db)):
    """Update package status (courier only)"""
    # TODO: Implement status update
    # - Verify user is the assigned courier
    # - Update status (picked_up, in_transit, delivered)
    return {"message": "Package status update - to be implemented"}
