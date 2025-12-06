"""
Tests for logging_middleware.py - Request, performance, and user activity logging middleware.

Tests the middleware classes that handle logging throughout the application.
"""
import pytest
from unittest.mock import patch, MagicMock, AsyncMock
import time

from fastapi import FastAPI, Request, Response
from fastapi.testclient import TestClient
from starlette.middleware.base import BaseHTTPMiddleware

from app.middleware.logging_middleware import (
    RequestLoggingMiddleware,
    PerformanceMonitoringMiddleware,
    UserActivityLoggingMiddleware
)


# ==================== Test App Setup ====================

def create_test_app():
    """Create a minimal FastAPI app for middleware testing."""
    app = FastAPI()

    @app.get("/")
    async def root():
        return {"message": "Hello"}

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/docs")
    async def docs():
        return {"docs": True}

    @app.get("/slow")
    async def slow_endpoint():
        time.sleep(1.5)  # Simulate slow request
        return {"slow": True}

    @app.post("/action")
    async def action():
        return {"action": "done"}

    @app.get("/error")
    async def error_endpoint():
        raise ValueError("Test error")

    return app


# ==================== RequestLoggingMiddleware Tests ====================

class TestRequestLoggingMiddleware:
    """Tests for RequestLoggingMiddleware."""

    @patch('app.middleware.logging_middleware.request_logger')
    def test_logs_request_start_and_end(self, mock_logger):
        """Should log request start and completion."""
        app = create_test_app()
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert response.status_code == 200
        # Should have logged at least 2 times (start and end)
        assert mock_logger.info.call_count >= 2

    @patch('app.middleware.logging_middleware.request_logger')
    def test_adds_request_id_header(self, mock_logger):
        """Should add X-Request-ID to response headers."""
        app = create_test_app()
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert "X-Request-ID" in response.headers
        # Request ID should be a UUID
        request_id = response.headers["X-Request-ID"]
        assert len(request_id) == 36  # UUID format

    @patch('app.middleware.logging_middleware.request_logger')
    def test_handles_x_forwarded_for(self, mock_logger):
        """Should extract client IP from X-Forwarded-For header."""
        app = create_test_app()
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get(
            "/",
            headers={"X-Forwarded-For": "192.168.1.100, 10.0.0.1"}
        )

        assert response.status_code == 200
        # Check that 192.168.1.100 was logged (first IP in chain)
        log_calls = mock_logger.info.call_args_list
        assert any("192.168.1.100" in str(call) for call in log_calls)

    @patch('app.middleware.logging_middleware.request_logger')
    @patch('app.middleware.logging_middleware.app_logger')
    def test_logs_errors(self, mock_app_logger, mock_request_logger):
        """Should log errors with exception info."""
        app = create_test_app()
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/error")

        assert response.status_code == 500
        # Error should be logged
        mock_app_logger.error.assert_called()

    @patch('app.middleware.logging_middleware.request_logger')
    def test_logs_status_code(self, mock_logger):
        """Should log response status code."""
        app = create_test_app()
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert response.status_code == 200
        # Check that status code was included in log
        log_calls = mock_logger.info.call_args_list
        assert any("200" in str(call) for call in log_calls)

    @patch('app.middleware.logging_middleware.request_logger')
    def test_logs_duration(self, mock_logger):
        """Should log request duration."""
        app = create_test_app()
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert response.status_code == 200
        # Check that duration was included in log extras
        log_calls = mock_logger.info.call_args_list
        assert any(
            call.kwargs.get('extra', {}).get('duration_ms') is not None
            for call in log_calls
        )


# ==================== PerformanceMonitoringMiddleware Tests ====================

class TestPerformanceMonitoringMiddleware:
    """Tests for PerformanceMonitoringMiddleware."""

    @patch('app.middleware.logging_middleware.performance_logger')
    def test_skips_health_endpoint(self, mock_logger):
        """Should skip logging for health endpoint."""
        app = create_test_app()
        app.add_middleware(PerformanceMonitoringMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/health")

        assert response.status_code == 200
        # Should not have logged anything
        mock_logger.info.assert_not_called()
        mock_logger.warning.assert_not_called()

    @patch('app.middleware.logging_middleware.performance_logger')
    def test_skips_docs_endpoint(self, mock_logger):
        """Should skip logging for docs endpoint."""
        app = create_test_app()
        app.add_middleware(PerformanceMonitoringMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/docs")

        assert response.status_code == 200
        mock_logger.info.assert_not_called()

    @patch('app.middleware.logging_middleware.performance_logger')
    def test_logs_normal_requests(self, mock_logger):
        """Should log normal (fast) requests as info."""
        app = create_test_app()
        app.add_middleware(PerformanceMonitoringMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert response.status_code == 200
        mock_logger.info.assert_called()

    @patch('app.middleware.logging_middleware.performance_logger')
    def test_logs_slow_requests_as_warning(self, mock_logger):
        """Should log slow requests (>1000ms) as warning."""
        app = create_test_app()
        app.add_middleware(PerformanceMonitoringMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/slow")

        assert response.status_code == 200
        mock_logger.warning.assert_called()
        # Check that "Slow request" is in the message
        warning_call = mock_logger.warning.call_args
        assert "Slow request" in warning_call.args[0]

    @patch('app.middleware.logging_middleware.performance_logger')
    def test_logs_errors(self, mock_logger):
        """Should log request errors."""
        app = create_test_app()
        app.add_middleware(PerformanceMonitoringMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/error")

        assert response.status_code == 500
        mock_logger.error.assert_called()


# ==================== UserActivityLoggingMiddleware Tests ====================

class TestUserActivityLoggingMiddleware:
    """Tests for UserActivityLoggingMiddleware."""

    @patch('app.middleware.logging_middleware.app_logger')
    def test_skips_get_requests(self, mock_logger):
        """Should not log GET requests."""
        app = create_test_app()
        app.add_middleware(UserActivityLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert response.status_code == 200
        # Should not log user activity for GET
        assert not any(
            "User action" in str(call) for call in mock_logger.info.call_args_list
        )

    @patch('app.middleware.logging_middleware.app_logger')
    def test_logs_post_requests_for_authenticated_user(self, mock_logger):
        """Should log POST requests for authenticated users."""
        app = create_test_app()

        # Add middleware that sets user on request.state
        @app.middleware("http")
        async def add_user(request: Request, call_next):
            request.state.user = MagicMock(id=1, email="test@example.com")
            return await call_next(request)

        app.add_middleware(UserActivityLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.post("/action")

        assert response.status_code == 200
        # Should log user activity
        assert any(
            "User action" in str(call) for call in mock_logger.info.call_args_list
        )

    @patch('app.middleware.logging_middleware.app_logger')
    def test_skips_unauthenticated_requests(self, mock_logger):
        """Should not log for unauthenticated requests."""
        app = create_test_app()
        app.add_middleware(UserActivityLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.post("/action")

        assert response.status_code == 200
        # Should not log user activity (no user in request.state)
        assert not any(
            "User action" in str(call) for call in mock_logger.info.call_args_list
        )


# ==================== Integration Tests ====================

class TestMiddlewareIntegration:
    """Integration tests for all middleware together."""

    @patch('app.middleware.logging_middleware.performance_logger')
    @patch('app.middleware.logging_middleware.request_logger')
    def test_all_middleware_work_together(
        self, mock_request_logger, mock_performance_logger
    ):
        """All middleware should work together without conflicts."""
        app = create_test_app()
        app.add_middleware(UserActivityLoggingMiddleware)
        app.add_middleware(PerformanceMonitoringMiddleware)
        app.add_middleware(RequestLoggingMiddleware)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/")

        assert response.status_code == 200
        assert "X-Request-ID" in response.headers
        mock_request_logger.info.assert_called()
        mock_performance_logger.info.assert_called()
