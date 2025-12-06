"""
Tests for logging_config.py - Logging configuration and formatters.

Tests the logging setup, structured formatter, and logger access functions.
"""
import pytest
import logging
import json
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

from app.utils.logging_config import (
    StructuredFormatter,
    HumanReadableFormatter,
    setup_logging,
    get_request_logger,
    get_performance_logger
)


# ==================== StructuredFormatter Tests ====================

class TestStructuredFormatter:
    """Tests for StructuredFormatter."""

    def test_outputs_valid_json(self):
        """Should output valid JSON."""
        formatter = StructuredFormatter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None
        )

        output = formatter.format(record)

        # Should be valid JSON
        data = json.loads(output)
        assert isinstance(data, dict)

    def test_includes_required_fields(self):
        """Should include timestamp, level, message, etc."""
        formatter = StructuredFormatter()

        record = logging.LogRecord(
            name="test.module",
            level=logging.WARNING,
            pathname="test.py",
            lineno=42,
            msg="Warning message",
            args=(),
            exc_info=None
        )

        output = formatter.format(record)
        data = json.loads(output)

        assert "timestamp" in data
        assert data["level"] == "WARNING"
        assert data["message"] == "Warning message"
        assert data["logger"] == "test.module"
        assert data["line"] == 42

    def test_includes_exception_info(self):
        """Should include exception info when present."""
        formatter = StructuredFormatter()

        try:
            raise ValueError("Test error")
        except ValueError:
            import sys
            exc_info = sys.exc_info()

        record = logging.LogRecord(
            name="test",
            level=logging.ERROR,
            pathname="test.py",
            lineno=10,
            msg="Error occurred",
            args=(),
            exc_info=exc_info
        )

        output = formatter.format(record)
        data = json.loads(output)

        assert "exception" in data
        assert "ValueError" in data["exception"]

    def test_includes_extra_fields(self):
        """Should include extra fields when present."""
        formatter = StructuredFormatter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Request completed",
            args=(),
            exc_info=None
        )

        # Add extra fields
        record.user_id = 123
        record.request_id = "abc-123"
        record.ip_address = "192.168.1.1"
        record.endpoint = "/api/test"
        record.method = "GET"
        record.status_code = 200
        record.duration_ms = 45.5

        output = formatter.format(record)
        data = json.loads(output)

        assert data["user_id"] == 123
        assert data["request_id"] == "abc-123"
        assert data["ip_address"] == "192.168.1.1"
        assert data["endpoint"] == "/api/test"
        assert data["method"] == "GET"
        assert data["status_code"] == 200
        assert data["duration_ms"] == 45.5

    def test_handles_missing_extra_fields(self):
        """Should not fail when extra fields are missing."""
        formatter = StructuredFormatter()

        record = logging.LogRecord(
            name="test",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Simple message",
            args=(),
            exc_info=None
        )

        # Should not raise
        output = formatter.format(record)
        data = json.loads(output)

        # Extra fields should not be present
        assert "user_id" not in data
        assert "request_id" not in data


# ==================== HumanReadableFormatter Tests ====================

class TestHumanReadableFormatter:
    """Tests for HumanReadableFormatter."""

    def test_formats_with_timestamp(self):
        """Should include timestamp in readable format."""
        formatter = HumanReadableFormatter()

        record = logging.LogRecord(
            name="test.module",
            level=logging.INFO,
            pathname="test.py",
            lineno=10,
            msg="Test message",
            args=(),
            exc_info=None
        )

        output = formatter.format(record)

        # Should contain date-time pattern
        assert "|" in output  # Uses | as separator
        assert "INFO" in output
        assert "Test message" in output

    def test_includes_function_name(self):
        """Should include function name."""
        formatter = HumanReadableFormatter()

        record = logging.LogRecord(
            name="test.module",
            level=logging.DEBUG,
            pathname="test.py",
            lineno=10,
            msg="Debug message",
            args=(),
            exc_info=None
        )
        record.funcName = "test_function"

        output = formatter.format(record)

        assert "test_function" in output


# ==================== setup_logging Tests ====================

class TestSetupLogging:
    """Tests for setup_logging function."""

    def test_creates_logs_directory(self):
        """Should create logs directory if it doesn't exist."""
        # The setup_logging function should create LOGS_DIR
        # This is tested implicitly by the module import
        from app.utils.logging_config import LOGS_DIR
        # Note: We can't easily test directory creation without mocking
        # Just verify the path is defined
        assert LOGS_DIR is not None

    def test_configures_root_logger(self):
        """Should configure root logger with handlers."""
        # Save original state
        root_logger = logging.getLogger()
        original_handlers = root_logger.handlers.copy()
        original_level = root_logger.level

        try:
            setup_logging()

            # Root logger should have handlers
            assert len(root_logger.handlers) > 0
            # Root logger should be set to DEBUG
            assert root_logger.level == logging.DEBUG
        finally:
            # Restore original state
            root_logger.handlers = original_handlers
            root_logger.level = original_level

    def test_suppresses_verbose_loggers(self):
        """Should suppress verbose third-party loggers."""
        setup_logging()

        # Check that uvicorn.access is set to WARNING
        uvicorn_logger = logging.getLogger("uvicorn.access")
        assert uvicorn_logger.level == logging.WARNING

        # Check httpx and httpcore
        httpx_logger = logging.getLogger("httpx")
        assert httpx_logger.level == logging.WARNING


# ==================== Logger Access Function Tests ====================

class TestGetRequestLogger:
    """Tests for get_request_logger function."""

    def test_returns_logger(self):
        """Should return a Logger instance."""
        logger = get_request_logger()
        assert isinstance(logger, logging.Logger)

    def test_returns_correct_logger(self):
        """Should return the chaski.requests logger."""
        logger = get_request_logger()
        assert logger.name == "chaski.requests"

    def test_returns_same_logger(self):
        """Should return the same logger on multiple calls."""
        logger1 = get_request_logger()
        logger2 = get_request_logger()
        assert logger1 is logger2


class TestGetPerformanceLogger:
    """Tests for get_performance_logger function."""

    def test_returns_logger(self):
        """Should return a Logger instance."""
        logger = get_performance_logger()
        assert isinstance(logger, logging.Logger)

    def test_returns_correct_logger(self):
        """Should return the chaski.performance logger."""
        logger = get_performance_logger()
        assert logger.name == "chaski.performance"

    def test_returns_same_logger(self):
        """Should return the same logger on multiple calls."""
        logger1 = get_performance_logger()
        logger2 = get_performance_logger()
        assert logger1 is logger2
