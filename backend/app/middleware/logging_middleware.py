"""
Request/Response and Performance Logging Middleware
"""

import time
import logging
import uuid
from typing import Callable
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
from app.utils.logging_config import get_request_logger, get_performance_logger

request_logger = get_request_logger()
performance_logger = get_performance_logger()
app_logger = logging.getLogger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log all HTTP requests and responses
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate unique request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"
        if forwarded_for := request.headers.get("X-Forwarded-For"):
            client_ip = forwarded_for.split(",")[0].strip()

        # Start timer
        start_time = time.time()

        # Log request
        request_logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "request_id": request_id,
                "method": request.method,
                "endpoint": str(request.url.path),
                "ip_address": client_ip,
                "user_agent": request.headers.get("user-agent", "unknown"),
                "query_params": dict(request.query_params) if request.query_params else None,
            }
        )

        try:
            # Process request
            response: Response = await call_next(request)

            # Calculate duration
            duration_ms = (time.time() - start_time) * 1000

            # Log response
            request_logger.info(
                f"Request completed: {request.method} {request.url.path} - {response.status_code}",
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "endpoint": str(request.url.path),
                    "status_code": response.status_code,
                    "duration_ms": round(duration_ms, 2),
                    "ip_address": client_ip,
                }
            )

            # Add request ID to response headers for tracking
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            # Calculate duration even for errors
            duration_ms = (time.time() - start_time) * 1000

            # Log error
            app_logger.error(
                f"Request failed: {request.method} {request.url.path} - {str(e)}",
                exc_info=True,
                extra={
                    "request_id": request_id,
                    "method": request.method,
                    "endpoint": str(request.url.path),
                    "duration_ms": round(duration_ms, 2),
                    "ip_address": client_ip,
                }
            )

            # Re-raise to let FastAPI handle the error
            raise


class PerformanceMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Middleware to monitor and log slow requests
    """

    # Threshold in milliseconds - log warning if request takes longer
    SLOW_REQUEST_THRESHOLD_MS = 1000  # 1 second

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip health check and docs endpoints
        if request.url.path in ["/health", "/", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)

        start_time = time.time()

        try:
            response: Response = await call_next(request)
            duration_ms = (time.time() - start_time) * 1000

            # Log if request was slow
            if duration_ms > self.SLOW_REQUEST_THRESHOLD_MS:
                performance_logger.warning(
                    f"Slow request detected: {request.method} {request.url.path} took {duration_ms:.2f}ms",
                    extra={
                        "request_id": getattr(request.state, "request_id", None),
                        "method": request.method,
                        "endpoint": str(request.url.path),
                        "duration_ms": round(duration_ms, 2),
                        "status_code": response.status_code,
                    }
                )
            else:
                # Log all performance metrics
                performance_logger.info(
                    f"Performance: {request.method} {request.url.path}",
                    extra={
                        "request_id": getattr(request.state, "request_id", None),
                        "method": request.method,
                        "endpoint": str(request.url.path),
                        "duration_ms": round(duration_ms, 2),
                        "status_code": response.status_code,
                    }
                )

            return response

        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000

            performance_logger.error(
                f"Request error: {request.method} {request.url.path} failed after {duration_ms:.2f}ms",
                exc_info=True,
                extra={
                    "request_id": getattr(request.state, "request_id", None),
                    "method": request.method,
                    "endpoint": str(request.url.path),
                    "duration_ms": round(duration_ms, 2),
                }
            )

            raise


class UserActivityLoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware to log user activity (authenticated actions)
    """

    def __init__(self, app: ASGIApp):
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response: Response = await call_next(request)

        # Log authenticated user actions
        if hasattr(request.state, "user"):
            user = request.state.user

            # Only log state-changing operations
            if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
                app_logger.info(
                    f"User action: {user.email} - {request.method} {request.url.path}",
                    extra={
                        "user_id": user.id,
                        "request_id": getattr(request.state, "request_id", None),
                        "method": request.method,
                        "endpoint": str(request.url.path),
                        "status_code": response.status_code,
                    }
                )

        return response
