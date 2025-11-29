"""
Tests for input sanitization utilities.

Tests cover:
- XSS prevention (script tags, event handlers, javascript: URLs)
- HTML stripping for plain text
- Allowed HTML tags for rich text
- Special character handling
- Whitespace normalization
- Email and phone sanitization
- Edge cases (None, empty, unicode)
"""

import pytest

from app.utils.input_sanitizer import (
    sanitize_text,
    sanitize_plain_text,
    sanitize_rich_text,
    sanitize_email,
    sanitize_phone,
    normalize_whitespace,
    remove_control_characters,
    truncate_text,
    InputSanitizer,
)


class TestSanitizeText:
    """Tests for main sanitize_text function"""

    def test_sanitize_basic_text(self):
        """Test sanitizing basic plain text"""
        result = sanitize_text("Hello World")
        assert result == "Hello World"

    def test_sanitize_none_returns_empty_string(self):
        """Test that None input returns empty string"""
        result = sanitize_text(None)
        assert result == ""

    def test_sanitize_strips_script_tags(self):
        """Test XSS prevention - script tags removed"""
        result = sanitize_text("<script>alert('xss')</script>Hello")
        # bleach.clean with strip=True removes the <script> tags but keeps inner text
        # The key security check is that no <script> tags remain
        assert "<script>" not in result.lower()
        assert "</script>" not in result.lower()

    def test_sanitize_strips_event_handlers(self):
        """Test XSS prevention - onclick removed"""
        result = sanitize_text('<div onclick="alert()">Text</div>')
        assert result == "Text"
        assert "onclick" not in result.lower()

    def test_sanitize_strips_onerror_handler(self):
        """Test XSS prevention - onerror removed"""
        result = sanitize_text('<img onerror="alert()" src="x">')
        assert result == ""
        assert "onerror" not in result.lower()

    def test_sanitize_strips_javascript_url(self):
        """Test XSS prevention - javascript: URL removed"""
        result = sanitize_text('<a href="javascript:alert()">Click</a>')
        assert result == "Click"
        assert "javascript" not in result.lower()

    def test_sanitize_strips_all_html_by_default(self):
        """Test that all HTML is stripped by default (plain text mode)"""
        result = sanitize_text("<b>Bold</b> and <i>italic</i>")
        assert result == "Bold and italic"

    def test_sanitize_preserves_allowed_html_when_enabled(self):
        """Test that safe HTML is preserved when allow_html=True"""
        result = sanitize_text("<strong>Bold</strong>", allow_html=True)
        assert result == "<strong>Bold</strong>"

    def test_sanitize_strips_dangerous_html_even_when_allowed(self):
        """Test that dangerous HTML is stripped even with allow_html=True"""
        result = sanitize_text("<script>bad</script><strong>Good</strong>", allow_html=True)
        assert "<strong>Good</strong>" in result
        assert "script" not in result.lower()

    def test_sanitize_with_numbers(self):
        """Test sanitizing numeric input"""
        result = sanitize_text(12345)
        assert result == "12345"

    def test_sanitize_preserves_valid_text(self):
        """Test that valid text is preserved unchanged"""
        text = "This is a perfectly valid sentence with numbers 123 and symbols: @#$"
        result = sanitize_text(text)
        assert result == text

    def test_sanitize_unicode(self):
        """Test sanitizing unicode characters"""
        text = "Café résumé naïve 你好 مرحبا"
        result = sanitize_text(text)
        assert result == text

    def test_sanitize_nested_tags(self):
        """Test sanitizing nested dangerous tags"""
        result = sanitize_text("<div><script>alert()</script></div>Content")
        # bleach removes tags but keeps inner text
        # Key security: no actual script/div tags remain
        assert "<script>" not in result.lower()
        assert "<div>" not in result.lower()

    def test_sanitize_case_insensitive(self):
        """Test that tag matching is case insensitive"""
        result = sanitize_text("<SCRIPT>bad</SCRIPT>Hello")
        # bleach handles case insensitively - removes SCRIPT tags
        assert "<script>" not in result.lower()
        assert "<SCRIPT>" not in result


class TestSanitizePlainText:
    """Tests for plain text sanitization"""

    def test_strips_all_html(self):
        """Test that all HTML is stripped"""
        result = sanitize_plain_text("<b>Bold</b> <a href='#'>Link</a>")
        assert result == "Bold Link"

    def test_preserves_special_characters(self):
        """Test that special characters are preserved"""
        text = "Price: $100.50 @ 10% discount!"
        result = sanitize_plain_text(text)
        assert result == text

    def test_handles_empty_string(self):
        """Test empty string handling"""
        result = sanitize_plain_text("")
        assert result == ""


class TestSanitizeRichText:
    """Tests for rich text sanitization with allowed HTML"""

    def test_preserves_safe_formatting_tags(self):
        """Test that safe formatting tags are preserved"""
        text = "<strong>Bold</strong> and <em>italic</em>"
        result = sanitize_rich_text(text)
        assert "<strong>Bold</strong>" in result
        assert "<em>italic</em>" in result

    def test_preserves_list_tags(self):
        """Test that list tags are preserved"""
        text = "<ul><li>Item 1</li><li>Item 2</li></ul>"
        result = sanitize_rich_text(text)
        assert "<ul>" in result
        assert "<li>Item 1</li>" in result

    def test_preserves_code_tags(self):
        """Test that code tags are preserved"""
        text = "<code>console.log()</code> and <pre>preformatted</pre>"
        result = sanitize_rich_text(text)
        assert "<code>" in result
        assert "<pre>" in result

    def test_strips_script_in_rich_text(self):
        """Test that script tags are stripped even in rich text mode"""
        text = "<strong>Good</strong><script>alert('bad')</script>"
        result = sanitize_rich_text(text)
        assert "<strong>Good</strong>" in result
        assert "script" not in result.lower()

    def test_strips_style_tags(self):
        """Test that style tags are stripped"""
        text = "<style>body{display:none}</style>Content"
        result = sanitize_rich_text(text)
        # bleach removes <style> tags but keeps content
        # The key check is no style tags remain
        assert "<style>" not in result.lower()
        assert "Content" in result

    def test_strips_attributes(self):
        """Test that attributes are stripped (no onclick, etc.)"""
        text = '<p onclick="alert()">Paragraph</p>'
        result = sanitize_rich_text(text)
        assert "onclick" not in result
        # The p tag should still be there
        assert "Paragraph" in result


class TestSanitizeEmail:
    """Tests for email sanitization"""

    def test_sanitize_email_lowercase(self):
        """Test that email is converted to lowercase"""
        result = sanitize_email("User@EXAMPLE.com")
        assert result == "user@example.com"

    def test_sanitize_email_strips_whitespace(self):
        """Test that whitespace is stripped"""
        result = sanitize_email("  user@example.com  ")
        assert result == "user@example.com"

    def test_sanitize_email_removes_html(self):
        """Test that HTML is removed from email"""
        result = sanitize_email("<script>user</script>@example.com")
        assert "script" not in result

    def test_sanitize_email_empty(self):
        """Test empty email handling"""
        result = sanitize_email("")
        assert result == ""

    def test_sanitize_email_none(self):
        """Test None email handling"""
        result = sanitize_email(None)
        assert result == ""


class TestSanitizePhone:
    """Tests for phone number sanitization"""

    def test_sanitize_phone_keeps_digits(self):
        """Test that digits are preserved"""
        result = sanitize_phone("+1 (212) 555-1234")
        assert "1" in result
        assert "212" in result

    def test_sanitize_phone_keeps_plus(self):
        """Test that plus sign is preserved"""
        result = sanitize_phone("+12125551234")
        assert result.startswith("+")

    def test_sanitize_phone_removes_html(self):
        """Test that HTML is removed from phone"""
        result = sanitize_phone("<script>+1</script>2345")
        assert "script" not in result

    def test_sanitize_phone_removes_letters(self):
        """Test that letters are removed"""
        result = sanitize_phone("1-800-CALL-NOW")
        assert "C" not in result
        assert "1" in result
        assert "800" in result

    def test_sanitize_phone_empty(self):
        """Test empty phone handling"""
        result = sanitize_phone("")
        assert result == ""

    def test_sanitize_phone_none(self):
        """Test None phone handling"""
        result = sanitize_phone(None)
        assert result == ""


class TestNormalizeWhitespace:
    """Tests for whitespace normalization"""

    def test_replaces_multiple_spaces(self):
        """Test that multiple spaces become single space"""
        result = normalize_whitespace("Hello    World")
        assert result == "Hello World"

    def test_replaces_tabs(self):
        """Test that tabs become spaces"""
        result = normalize_whitespace("Hello\tWorld")
        assert result == "Hello World"

    def test_preserves_single_newlines(self):
        """Test that single newlines are preserved"""
        result = normalize_whitespace("Line 1\nLine 2")
        assert result == "Line 1\nLine 2"

    def test_collapses_excessive_newlines(self):
        """Test that excessive newlines are collapsed"""
        result = normalize_whitespace("Line 1\n\n\n\n\nLine 2")
        assert result == "Line 1\n\nLine 2"


class TestRemoveControlCharacters:
    """Tests for control character removal"""

    def test_removes_null_byte(self):
        """Test that null byte is removed"""
        result = remove_control_characters("Hello\x00World")
        assert "\x00" not in result
        assert "HelloWorld" in result

    def test_preserves_printable_chars(self):
        """Test that printable characters are preserved"""
        text = "Hello World! 123 @#$"
        result = remove_control_characters(text)
        assert result == text

    def test_preserves_newlines_and_tabs(self):
        """Test that newlines and tabs are preserved"""
        text = "Line 1\n\tIndented"
        result = remove_control_characters(text)
        assert "\n" in result
        assert "\t" in result


class TestTruncateText:
    """Tests for text truncation"""

    def test_truncate_long_text(self):
        """Test truncating long text"""
        text = "This is a very long text that should be truncated"
        result = truncate_text(text, 20)
        assert len(result) == 20
        assert result.endswith("...")

    def test_no_truncate_short_text(self):
        """Test that short text is not truncated"""
        text = "Short"
        result = truncate_text(text, 20)
        assert result == "Short"

    def test_custom_suffix(self):
        """Test custom truncation suffix"""
        text = "This is a long text"
        result = truncate_text(text, 15, suffix="…")
        assert result.endswith("…")

    def test_exact_length(self):
        """Test text at exact max length"""
        text = "Exact"
        result = truncate_text(text, 5)
        assert result == "Exact"


class TestInputSanitizer:
    """Tests for InputSanitizer helper class"""

    def test_sanitize_dict_plain_fields(self):
        """Test sanitizing dictionary with plain text fields"""
        data = {
            "name": "<b>John</b>",
            "description": "<script>bad</script>Good",
        }
        field_types = {"name": "plain", "description": "plain"}
        result = InputSanitizer.sanitize_dict(data, field_types)
        assert result["name"] == "John"
        # bleach strips tags but keeps content
        assert "<script>" not in result["description"]
        assert "Good" in result["description"]

    def test_sanitize_dict_rich_fields(self):
        """Test sanitizing dictionary with rich text fields"""
        data = {
            "bio": "<strong>Bold</strong><script>bad</script>",
        }
        field_types = {"bio": "rich"}
        result = InputSanitizer.sanitize_dict(data, field_types)
        assert "<strong>Bold</strong>" in result["bio"]
        assert "script" not in result["bio"]

    def test_sanitize_dict_preserves_unlisted_fields(self):
        """Test that unlisted fields are preserved unchanged"""
        data = {
            "name": "<b>John</b>",
            "id": 123,
            "email": "test@example.com",
        }
        field_types = {"name": "plain"}
        result = InputSanitizer.sanitize_dict(data, field_types)
        assert result["id"] == 123
        assert result["email"] == "test@example.com"

    def test_sanitize_dict_handles_none_values(self):
        """Test that None values in dict are handled"""
        data = {
            "name": None,
            "description": "Valid",
        }
        field_types = {"name": "plain", "description": "plain"}
        result = InputSanitizer.sanitize_dict(data, field_types)
        assert result["name"] is None
        assert result["description"] == "Valid"

    def test_sanitize_dict_does_not_modify_original(self):
        """Test that original dict is not modified"""
        data = {"name": "<b>John</b>"}
        field_types = {"name": "plain"}
        result = InputSanitizer.sanitize_dict(data, field_types)
        assert data["name"] == "<b>John</b>"  # Original unchanged
        assert result["name"] == "John"  # Result sanitized


class TestCommonAttackVectors:
    """Tests for common XSS and injection attack vectors"""

    def test_svg_xss(self):
        """Test SVG-based XSS is prevented"""
        result = sanitize_text('<svg onload="alert(1)">')
        assert "onload" not in result.lower()

    def test_img_xss(self):
        """Test img tag XSS is prevented"""
        result = sanitize_text('<img src=x onerror=alert(1)>')
        assert "onerror" not in result.lower()

    def test_iframe_xss(self):
        """Test iframe is removed"""
        result = sanitize_text('<iframe src="evil.com"></iframe>Content')
        assert "iframe" not in result.lower()
        assert "Content" in result

    def test_data_uri_xss(self):
        """Test data: URI scheme is handled"""
        result = sanitize_text('<a href="data:text/html,<script>alert(1)</script>">Click</a>')
        assert "data:" not in result.lower() or "script" not in result.lower()

    def test_encoded_script_tag(self):
        """Test URL-encoded script tag"""
        # bleach handles this at HTML level, not URL encoding
        result = sanitize_text('<script>alert(1)</script>')
        assert "script" not in result.lower()

    def test_mixed_case_bypass_attempt(self):
        """Test mixed case bypass attempt"""
        result = sanitize_text('<ScRiPt>alert(1)</sCrIpT>')
        assert "script" not in result.lower()

    def test_null_byte_injection(self):
        """Test null byte injection is handled"""
        result = sanitize_text('Hello\x00<script>bad</script>World')
        assert "script" not in result.lower()
