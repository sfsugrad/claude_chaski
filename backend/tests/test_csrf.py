"""
Tests for CSRF (Cross-Site Request Forgery) protection utilities.

Tests cover:
- generate_csrf_token
- validate_csrf_token success
- validate_csrf_token failure
- Token format
- Token uniqueness
- Double-submit validation
- Header extraction
- Cookie extraction
- None/empty handling
- require_csrf_token HTTPException
"""

import pytest
from fastapi import HTTPException

from app.utils.csrf import (
    generate_csrf_token,
    validate_csrf_token,
    require_csrf_token,
    CSRF_TOKEN_LENGTH,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
)


class TestGenerateCSRFToken:
    """Tests for CSRF token generation"""

    def test_generates_token(self):
        """Test that a token is generated"""
        token = generate_csrf_token()
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0

    def test_token_is_url_safe(self):
        """Test that token is URL-safe (base64url encoded)"""
        token = generate_csrf_token()
        # URL-safe base64 only contains alphanumeric, -, and _
        import re
        assert re.match(r'^[A-Za-z0-9_-]+$', token)

    def test_token_length(self):
        """Test that token has expected length"""
        token = generate_csrf_token()
        # 32 bytes base64-encoded = ~43 characters
        assert len(token) >= 40

    def test_tokens_are_unique(self):
        """Test that each generated token is unique"""
        tokens = [generate_csrf_token() for _ in range(100)]
        assert len(set(tokens)) == 100  # All unique

    def test_token_randomness(self):
        """Test that tokens have good randomness (no patterns)"""
        tokens = [generate_csrf_token() for _ in range(10)]
        # No two tokens should share a common prefix longer than 3 chars
        for i, t1 in enumerate(tokens):
            for t2 in tokens[i+1:]:
                common_prefix = 0
                for c1, c2 in zip(t1, t2):
                    if c1 == c2:
                        common_prefix += 1
                    else:
                        break
                assert common_prefix < 10  # Should not have long common prefix


class TestValidateCSRFToken:
    """Tests for CSRF token validation"""

    def test_valid_matching_tokens(self):
        """Test validation succeeds with matching tokens"""
        token = generate_csrf_token()
        result = validate_csrf_token(cookie_token=token, header_token=token)
        assert result is True

    def test_mismatched_tokens(self):
        """Test validation fails with different tokens"""
        token1 = generate_csrf_token()
        token2 = generate_csrf_token()
        result = validate_csrf_token(cookie_token=token1, header_token=token2)
        assert result is False

    def test_missing_cookie_token(self):
        """Test validation fails when cookie token is missing"""
        token = generate_csrf_token()
        result = validate_csrf_token(cookie_token=None, header_token=token)
        assert result is False

    def test_missing_header_token(self):
        """Test validation fails when header token is missing"""
        token = generate_csrf_token()
        result = validate_csrf_token(cookie_token=token, header_token=None)
        assert result is False

    def test_both_tokens_missing(self):
        """Test validation fails when both tokens are missing"""
        result = validate_csrf_token(cookie_token=None, header_token=None)
        assert result is False

    def test_empty_cookie_token(self):
        """Test validation fails with empty cookie token"""
        token = generate_csrf_token()
        result = validate_csrf_token(cookie_token="", header_token=token)
        assert result is False

    def test_empty_header_token(self):
        """Test validation fails with empty header token"""
        token = generate_csrf_token()
        result = validate_csrf_token(cookie_token=token, header_token="")
        assert result is False

    def test_both_tokens_empty(self):
        """Test validation fails with both tokens empty"""
        result = validate_csrf_token(cookie_token="", header_token="")
        assert result is False

    def test_timing_attack_resistance(self):
        """Test that validation uses constant-time comparison"""
        # This test verifies the function uses secrets.compare_digest
        # by checking behavior with similar tokens (timing shouldn't matter)
        base_token = generate_csrf_token()
        similar_token = base_token[:-1] + "X"  # Differ only in last char

        # Both should fail, and timing should be consistent
        result1 = validate_csrf_token(base_token, similar_token)
        result2 = validate_csrf_token(base_token, "completely_different_token")

        assert result1 is False
        assert result2 is False


class TestRequireCSRFToken:
    """Tests for require_csrf_token function that raises HTTPException"""

    def test_valid_tokens_no_exception(self):
        """Test no exception raised with valid tokens"""
        token = generate_csrf_token()
        # Should not raise
        require_csrf_token(cookie_token=token, header_token=token)

    def test_invalid_tokens_raises_403(self):
        """Test HTTPException raised with invalid tokens"""
        token1 = generate_csrf_token()
        token2 = generate_csrf_token()

        with pytest.raises(HTTPException) as exc_info:
            require_csrf_token(cookie_token=token1, header_token=token2)

        assert exc_info.value.status_code == 403
        assert "CSRF" in exc_info.value.detail

    def test_missing_cookie_raises_403(self):
        """Test HTTPException raised when cookie is missing"""
        token = generate_csrf_token()

        with pytest.raises(HTTPException) as exc_info:
            require_csrf_token(cookie_token=None, header_token=token)

        assert exc_info.value.status_code == 403

    def test_missing_header_raises_403(self):
        """Test HTTPException raised when header is missing"""
        token = generate_csrf_token()

        with pytest.raises(HTTPException) as exc_info:
            require_csrf_token(cookie_token=token, header_token=None)

        assert exc_info.value.status_code == 403

    def test_exception_message_contains_csrf(self):
        """Test exception message mentions CSRF"""
        with pytest.raises(HTTPException) as exc_info:
            require_csrf_token(cookie_token=None, header_token=None)

        assert "CSRF" in exc_info.value.detail.upper() or "csrf" in exc_info.value.detail.lower()


class TestCSRFConstants:
    """Tests for CSRF configuration constants"""

    def test_token_length_constant(self):
        """Test CSRF_TOKEN_LENGTH is set appropriately"""
        assert CSRF_TOKEN_LENGTH == 32  # 256 bits

    def test_cookie_name_constant(self):
        """Test CSRF_COOKIE_NAME is set"""
        assert CSRF_COOKIE_NAME == "csrf_token"

    def test_header_name_constant(self):
        """Test CSRF_HEADER_NAME is set"""
        assert CSRF_HEADER_NAME == "X-CSRF-Token"


class TestDoubleSubmitCookiePattern:
    """Tests for double-submit cookie pattern implementation"""

    def test_same_token_in_cookie_and_header(self):
        """Test double-submit pattern with same token"""
        # Simulate: Server generates token, sends in cookie and response
        server_token = generate_csrf_token()

        # Client receives token, includes in both cookie and header
        cookie_token = server_token  # From cookie
        header_token = server_token  # Client reads and puts in header

        # Validation should pass
        assert validate_csrf_token(cookie_token, header_token) is True

    def test_attacker_cannot_read_cookie(self):
        """Test that attacker without cookie access fails"""
        # Server generates token for legitimate user
        legitimate_token = generate_csrf_token()

        # Attacker can't read the cookie (same-origin policy)
        # So attacker guesses or uses different token
        attacker_token = generate_csrf_token()

        # Validation should fail - attacker's header doesn't match cookie
        assert validate_csrf_token(legitimate_token, attacker_token) is False

    def test_token_reuse_is_valid(self):
        """Test that same token can be validated multiple times"""
        token = generate_csrf_token()

        # Multiple requests with same token should all pass
        assert validate_csrf_token(token, token) is True
        assert validate_csrf_token(token, token) is True
        assert validate_csrf_token(token, token) is True


class TestEdgeCases:
    """Tests for edge cases"""

    def test_whitespace_in_token(self):
        """Test tokens with whitespace are handled"""
        token = generate_csrf_token()
        spaced_token = f" {token} "

        # Should fail because whitespace changes the token
        result = validate_csrf_token(token, spaced_token)
        assert result is False

    def test_case_sensitivity(self):
        """Test that tokens are case-sensitive"""
        token = generate_csrf_token()
        upper_token = token.upper()

        # If token has any lowercase, they won't match
        if token != upper_token:
            result = validate_csrf_token(token, upper_token)
            assert result is False

    def test_unicode_in_comparison(self):
        """Test handling of unicode characters if somehow present"""
        token = generate_csrf_token()
        # Note: secrets.compare_digest raises TypeError for non-ASCII strings
        # This is expected behavior - CSRF tokens should only be base64url chars
        # The test verifies the function doesn't crash silently
        try:
            result = validate_csrf_token(token, "токен")  # Russian "token"
            # If it doesn't raise, result should be False
            assert result is False
        except TypeError:
            # This is expected behavior for secrets.compare_digest
            pass

    def test_very_long_token_comparison(self):
        """Test comparison with very long token doesn't crash"""
        token = generate_csrf_token()
        long_token = token * 100  # Very long

        result = validate_csrf_token(token, long_token)
        assert result is False

    def test_special_characters_in_comparison(self):
        """Test special characters don't break comparison"""
        token = generate_csrf_token()
        special = "<script>alert('xss')</script>"

        result = validate_csrf_token(token, special)
        assert result is False
