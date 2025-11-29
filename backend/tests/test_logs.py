"""
Tests for frontend logging endpoint.

Tests cover:
- Log frontend error
- Log frontend warning
- Log frontend info
- Log with stack trace
- Log with context data
- Log without authentication (should work)
- Log validation (required fields)
- IP address extraction from X-Forwarded-For
"""

import pytest
from datetime import datetime

from app.utils.csrf import generate_csrf_token, CSRF_COOKIE_NAME, CSRF_HEADER_NAME


@pytest.fixture
def csrf_headers():
    """Generate CSRF token and return headers/cookies for requests"""
    token = generate_csrf_token()
    return {
        "headers": {CSRF_HEADER_NAME: token},
        "cookies": {CSRF_COOKIE_NAME: token}
    }


class TestFrontendLogging:
    """Tests for frontend logging endpoint"""

    def test_log_frontend_error(self, client, csrf_headers):
        """Test logging a frontend error"""
        log_data = {
            "level": "error",
            "message": "Uncaught TypeError: Cannot read property 'foo' of undefined",
            "stack": "TypeError: Cannot read property 'foo' of undefined\n    at Object.<anonymous> (/app/src/index.js:10:5)",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/dashboard",
            "userAgent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/91.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201
        assert response.json()["status"] == "logged"

    def test_log_frontend_warning(self, client, csrf_headers):
        """Test logging a frontend warning"""
        log_data = {
            "level": "warn",
            "message": "Deprecated API usage detected",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/profile",
            "userAgent": "Mozilla/5.0 Safari/605.1.15"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201
        assert response.json()["status"] == "logged"

    def test_log_frontend_info(self, client, csrf_headers):
        """Test logging a frontend info message"""
        log_data = {
            "level": "info",
            "message": "User navigated to checkout page",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/checkout",
            "userAgent": "Mozilla/5.0 Firefox/89.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201
        assert response.json()["status"] == "logged"

    def test_log_with_stack_trace(self, client, csrf_headers):
        """Test logging with stack trace"""
        log_data = {
            "level": "error",
            "message": "Application error",
            "stack": """Error: Application error
    at handleClick (/app/src/components/Button.tsx:15:11)
    at HTMLButtonElement.dispatch (/app/node_modules/react-dom/cjs/react-dom.development.js:3942:7)
    at HTMLButtonElement.eventHandler (/app/node_modules/react-dom/cjs/react-dom.development.js:3890:13)""",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0 Chrome/91.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201

    def test_log_with_context_data(self, client, csrf_headers):
        """Test logging with additional context"""
        log_data = {
            "level": "error",
            "message": "Failed to load package data",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/packages/123",
            "userAgent": "Mozilla/5.0 Chrome/91.0",
            "context": {
                "packageId": 123,
                "userId": 456,
                "requestId": "abc-123-def"
            }
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201

    def test_log_without_csrf_succeeds_in_test_env(self, client):
        """Test that logging without CSRF token succeeds in test environment.

        Note: CSRF middleware is disabled when ENVIRONMENT=test,
        so this test verifies the endpoint works without CSRF in test mode.
        In production, CSRF would be required.
        """
        log_data = {
            "level": "error",
            "message": "Login page error",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/login",
            "userAgent": "Mozilla/5.0"
        }

        # No CSRF token - but CSRF is disabled in test environment
        response = client.post("/api/logs/frontend", json=log_data)

        # Succeeds because CSRF middleware is disabled in test env
        assert response.status_code == 201

    def test_log_validation_missing_level(self, client, csrf_headers):
        """Test validation fails without level"""
        log_data = {
            "message": "Error message",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 422  # Validation error

    def test_log_validation_missing_message(self, client, csrf_headers):
        """Test validation fails without message"""
        log_data = {
            "level": "error",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 422

    def test_log_validation_missing_timestamp(self, client, csrf_headers):
        """Test validation fails without timestamp"""
        log_data = {
            "level": "error",
            "message": "Error message",
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 422

    def test_log_validation_missing_url(self, client, csrf_headers):
        """Test validation fails without URL"""
        log_data = {
            "level": "error",
            "message": "Error message",
            "timestamp": datetime.utcnow().isoformat(),
            "userAgent": "Mozilla/5.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 422

    def test_log_validation_missing_user_agent(self, client, csrf_headers):
        """Test validation fails without user agent"""
        log_data = {
            "level": "error",
            "message": "Error message",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 422

    def test_log_with_forwarded_ip(self, client, csrf_headers):
        """Test IP extraction from X-Forwarded-For header"""
        log_data = {
            "level": "info",
            "message": "Test with forwarded IP",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0"
        }

        headers = csrf_headers["headers"].copy()
        headers["X-Forwarded-For"] = "203.0.113.195, 70.41.3.18, 150.172.238.178"

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=headers)

        assert response.status_code == 201

    def test_log_empty_context(self, client, csrf_headers):
        """Test logging with empty context"""
        log_data = {
            "level": "info",
            "message": "Test with empty context",
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0",
            "context": {}
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201

    def test_log_null_stack(self, client, csrf_headers):
        """Test logging with null stack"""
        log_data = {
            "level": "warn",
            "message": "Warning without stack",
            "stack": None,
            "timestamp": datetime.utcnow().isoformat(),
            "url": "http://localhost:3000/",
            "userAgent": "Mozilla/5.0"
        }

        client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
        response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])

        assert response.status_code == 201


class TestLogLevels:
    """Tests for different log levels"""

    def test_all_valid_log_levels(self, client, csrf_headers):
        """Test that all expected log levels work"""
        levels = ["error", "warn", "info"]

        for level in levels:
            log_data = {
                "level": level,
                "message": f"Test message for {level}",
                "timestamp": datetime.utcnow().isoformat(),
                "url": "http://localhost:3000/",
                "userAgent": "Mozilla/5.0"
            }

            client.cookies.set(CSRF_COOKIE_NAME, csrf_headers["cookies"][CSRF_COOKIE_NAME])
            response = client.post("/api/logs/frontend", json=log_data, headers=csrf_headers["headers"])
            assert response.status_code == 201, f"Failed for level: {level}"
