"""
Frontend logging endpoints
"""

from fastapi import APIRouter, Request, status
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import logging

router = APIRouter()

logger = logging.getLogger("chaski.frontend")

class FrontendLog(BaseModel):
    level: str = Field(..., description="Log level: error, warn, or info")
    message: str = Field(..., description="Log message")
    stack: Optional[str] = Field(None, description="Error stack trace")
    timestamp: str = Field(..., description="ISO timestamp from frontend")
    url: str = Field(..., description="URL where error occurred")
    userAgent: str = Field(..., description="Browser user agent")
    context: Optional[Dict[str, Any]] = Field(None, description="Additional context")

@router.post("/frontend", status_code=status.HTTP_201_CREATED)
async def log_frontend_error(log_data: FrontendLog, request: Request):
    """
    Receive and log frontend errors/warnings

    This endpoint accepts logs from the frontend application and writes them
    to the backend logging system for centralized monitoring.
    """

    # Get client IP
    client_ip = request.client.host if request.client else "unknown"
    if forwarded_for := request.headers.get("X-Forwarded-For"):
        client_ip = forwarded_for.split(",")[0].strip()

    # Prepare log entry with all context
    extra_data = {
        "frontend_url": log_data.url,
        "user_agent": log_data.userAgent,
        "client_ip": client_ip,
        "frontend_timestamp": log_data.timestamp,
    }

    if log_data.context:
        extra_data["context"] = log_data.context

    # Log based on level
    log_message = f"[FRONTEND] {log_data.message}"

    if log_data.stack:
        log_message += f"\nStack: {log_data.stack}"

    if log_data.level == "error":
        logger.error(log_message, extra=extra_data)
    elif log_data.level == "warn":
        logger.warning(log_message, extra=extra_data)
    else:
        logger.info(log_message, extra=extra_data)

    return {"status": "logged"}
