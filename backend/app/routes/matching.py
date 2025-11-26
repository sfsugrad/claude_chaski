from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from pydantic import BaseModel
from typing import List

router = APIRouter()

class MatchedPackage(BaseModel):
    package_id: int
    description: str
    pickup_address: str
    dropoff_address: str
    distance_from_route_km: float
    estimated_detour_km: float

@router.get("/packages-along-route/{route_id}", response_model=List[MatchedPackage])
async def get_packages_along_route(route_id: int, db: Session = Depends(get_db)):
    """Find packages along a courier's route within deviation distance"""
    # TODO: Implement matching algorithm
    # - Get courier route
    # - Get all pending packages
    # - Calculate which packages are within deviation distance
    # - Calculate estimated detour for each package
    # - Return sorted list (by detour distance or profitability)
    return []

@router.post("/accept-package/{package_id}")
async def accept_package(package_id: int, db: Session = Depends(get_db)):
    """Courier accepts a package for delivery"""
    # TODO: Implement package acceptance
    # - Verify user is courier
    # - Verify package is available
    # - Update package status to "matched"
    # - Assign courier to package
    return {"message": "Package accepted"}

@router.post("/decline-package/{package_id}")
async def decline_package(package_id: int, db: Session = Depends(get_db)):
    """Courier declines a matched package"""
    # TODO: Implement package decline
    return {"message": "Package declined"}
