"""
Logging configuration with file rotation and structured logging
"""

import logging
import logging.handlers
import sys
from pathlib import Path
from datetime import datetime
import json
from typing import Any, Dict

# Create logs directory if it doesn't exist
LOGS_DIR = Path(__file__).parent.parent.parent / "logs"
LOGS_DIR.mkdir(exist_ok=True)

class StructuredFormatter(logging.Formatter):
    """
    Custom formatter that outputs structured JSON logs
    """
    def format(self, record: logging.LogRecord) -> str:
        log_data: Dict[str, Any] = {
            "timestamp": datetime.utcnow().isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }

        # Add exception info if present
        if record.exc_info:
            log_data["exception"] = self.formatException(record.exc_info)

        # Add extra fields if present
        if hasattr(record, "user_id"):
            log_data["user_id"] = record.user_id
        if hasattr(record, "request_id"):
            log_data["request_id"] = record.request_id
        if hasattr(record, "ip_address"):
            log_data["ip_address"] = record.ip_address
        if hasattr(record, "endpoint"):
            log_data["endpoint"] = record.endpoint
        if hasattr(record, "method"):
            log_data["method"] = record.method
        if hasattr(record, "status_code"):
            log_data["status_code"] = record.status_code
        if hasattr(record, "duration_ms"):
            log_data["duration_ms"] = record.duration_ms

        return json.dumps(log_data)

class HumanReadableFormatter(logging.Formatter):
    """
    Human-readable formatter for console output
    """
    def __init__(self):
        super().__init__(
            fmt="%(asctime)s | %(levelname)-8s | %(name)s:%(funcName)s:%(lineno)d | %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S"
        )

def setup_logging():
    """
    Configure logging with multiple handlers:
    - Console (human-readable, INFO+)
    - app.log (all application logs, rotating)
    - error.log (ERROR+ only, rotating)
    - requests.log (HTTP requests, rotating)
    - performance.log (performance metrics, rotating)
    """

    # Root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(logging.DEBUG)

    # Remove existing handlers to avoid duplicates
    root_logger.handlers.clear()

    # Console handler (human-readable)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(logging.INFO)
    console_handler.setFormatter(HumanReadableFormatter())
    root_logger.addHandler(console_handler)

    # Application log file (rotating, max 10MB, keep 5 backups)
    app_handler = logging.handlers.RotatingFileHandler(
        LOGS_DIR / "app.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    app_handler.setLevel(logging.DEBUG)
    app_handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(app_handler)

    # Error log file (ERROR+ only, rotating)
    error_handler = logging.handlers.RotatingFileHandler(
        LOGS_DIR / "error.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(StructuredFormatter())
    root_logger.addHandler(error_handler)

    # Request log (separate logger)
    request_logger = logging.getLogger("chaski.requests")
    request_logger.setLevel(logging.INFO)
    request_logger.propagate = False  # Don't propagate to root logger

    request_handler = logging.handlers.RotatingFileHandler(
        LOGS_DIR / "requests.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    request_handler.setLevel(logging.INFO)
    request_handler.setFormatter(StructuredFormatter())
    request_logger.addHandler(request_handler)

    # Performance log (separate logger)
    performance_logger = logging.getLogger("chaski.performance")
    performance_logger.setLevel(logging.INFO)
    performance_logger.propagate = False  # Don't propagate to root logger

    performance_handler = logging.handlers.RotatingFileHandler(
        LOGS_DIR / "performance.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    performance_handler.setLevel(logging.INFO)
    performance_handler.setFormatter(StructuredFormatter())
    performance_logger.addHandler(performance_handler)

    # Frontend log (separate logger)
    frontend_logger = logging.getLogger("chaski.frontend")
    frontend_logger.setLevel(logging.INFO)
    frontend_logger.propagate = False  # Don't propagate to root logger

    frontend_handler = logging.handlers.RotatingFileHandler(
        LOGS_DIR / "frontend.log",
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=5,
        encoding="utf-8"
    )
    frontend_handler.setLevel(logging.INFO)
    frontend_handler.setFormatter(StructuredFormatter())
    frontend_logger.addHandler(frontend_handler)

    # Suppress verbose third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)

    logging.info("Logging system initialized")

def get_request_logger() -> logging.Logger:
    """Get the request logger"""
    return logging.getLogger("chaski.requests")

def get_performance_logger() -> logging.Logger:
    """Get the performance logger"""
    return logging.getLogger("chaski.performance")
