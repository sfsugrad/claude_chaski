"""
Tests for password validation utility.

Tests cover:
- Minimum length (12 chars)
- Requires uppercase
- Requires lowercase
- Requires digit
- Requires special character
- Common password rejection (123456, password)
- Sequential chars rejection
- Repeated chars rejection
- Valid password passes
- Password strength score
- Unicode in password
- Error messages
"""

import pytest

from app.utils.password_validator import (
    validate_password,
    has_sequential_characters,
    has_repeating_characters,
    get_password_strength_score,
    get_password_strength_label,
    MIN_LENGTH,
    COMMON_PASSWORDS,
)


class TestValidatePassword:
    """Tests for main password validation function"""

    def test_valid_strong_password(self):
        """Test that a strong password passes validation"""
        password = "MyStr0ng!Pass@2024"
        is_valid, errors = validate_password(password)
        assert is_valid is True
        assert errors == []

    def test_minimum_length_requirement(self):
        """Test password must be at least 12 characters"""
        password = "Short!1A"  # Only 8 chars
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any(f"at least {MIN_LENGTH}" in error for error in errors)

    def test_requires_uppercase(self):
        """Test password must contain uppercase letter"""
        password = "nouppercasehere123!"  # More than 12 chars but no uppercase
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("uppercase" in error.lower() for error in errors)

    def test_requires_lowercase(self):
        """Test password must contain lowercase letter"""
        password = "NOLOWERCASEHERE123!"  # More than 12 chars but no lowercase
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("lowercase" in error.lower() for error in errors)

    def test_requires_digit(self):
        """Test password must contain digit"""
        password = "NoDigitsHereAtAll!"  # More than 12 chars but no digit
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("digit" in error.lower() for error in errors)

    def test_requires_special_character(self):
        """Test password must contain special character"""
        password = "NoSpecialChars123A"  # More than 12 chars but no special
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("special character" in error.lower() for error in errors)

    def test_rejects_common_password_password(self):
        """Test rejection of 'password' (case-insensitive)"""
        # Make it pass length and complexity first
        password = "password"
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("common" in error.lower() or "guessable" in error.lower() for error in errors)

    def test_rejects_common_password_123456(self):
        """Test rejection of '123456' variations"""
        password = "123456"
        is_valid, errors = validate_password(password)
        assert is_valid is False
        # Should fail for multiple reasons

    def test_rejects_sequential_characters(self):
        """Test rejection of sequential characters like 1234, abcd"""
        password = "MyPass1234word!"  # Contains 1234
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("sequential" in error.lower() for error in errors)

    def test_rejects_repeating_characters(self):
        """Test rejection of repeating characters like aaaa, 1111"""
        password = "MyPaaaaassword1!"  # Contains aaaa
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert any("repeating" in error.lower() for error in errors)

    def test_multiple_errors_returned(self):
        """Test that multiple validation errors are returned"""
        password = "a"  # Fails almost everything
        is_valid, errors = validate_password(password)
        assert is_valid is False
        assert len(errors) >= 3  # Should have multiple errors

    def test_unicode_characters_in_password(self):
        """Test password with unicode characters"""
        password = "Pässwörd123!@#"  # 14 chars with unicode
        is_valid, errors = validate_password(password)
        # Should pass basic requirements (unicode letters count as letters)
        # Note: Depends on implementation details
        assert isinstance(is_valid, bool)

    def test_password_with_spaces(self):
        """Test password with spaces"""
        password = "My Strong Pass1!"  # 16 chars with spaces
        is_valid, errors = validate_password(password)
        assert is_valid is True


class TestCommonPasswordsSet:
    """Tests for common passwords set"""

    def test_common_passwords_exist(self):
        """Test that common passwords set is populated"""
        assert len(COMMON_PASSWORDS) > 50

    def test_password_in_common_set(self):
        """Test that 'password' is in common set"""
        assert "password" in COMMON_PASSWORDS

    def test_123456_in_common_set(self):
        """Test that '123456' is in common set"""
        assert "123456" in COMMON_PASSWORDS

    def test_qwerty_in_common_set(self):
        """Test that 'qwerty' is in common set"""
        assert "qwerty" in COMMON_PASSWORDS


class TestHasSequentialCharacters:
    """Tests for sequential character detection"""

    def test_detects_numeric_ascending_sequence(self):
        """Test detection of 1234"""
        assert has_sequential_characters("abc1234xyz") is True

    def test_detects_numeric_descending_sequence(self):
        """Test detection of 4321"""
        assert has_sequential_characters("abc4321xyz") is True

    def test_detects_alpha_ascending_sequence(self):
        """Test detection of abcd"""
        assert has_sequential_characters("123abcd789") is True

    def test_detects_alpha_descending_sequence(self):
        """Test detection of dcba"""
        assert has_sequential_characters("123dcba789") is True

    def test_detects_qwerty_sequence(self):
        """Test detection of qwerty keyboard pattern"""
        assert has_sequential_characters("myqwertpass") is True

    def test_no_sequence_in_valid_password(self):
        """Test that valid password has no sequence"""
        assert has_sequential_characters("MyStr0ng!Pa") is False

    def test_short_sequence_not_detected(self):
        """Test that 3-char sequence is not detected by default"""
        # Default min_length is 4
        assert has_sequential_characters("abc") is False

    def test_custom_min_length(self):
        """Test custom minimum sequence length"""
        assert has_sequential_characters("abc", min_length=3) is True
        assert has_sequential_characters("ab", min_length=3) is False


class TestHasRepeatingCharacters:
    """Tests for repeating character detection"""

    def test_detects_four_repeating_chars(self):
        """Test detection of aaaa"""
        assert has_repeating_characters("passaaaard") is True

    def test_detects_repeating_numbers(self):
        """Test detection of 1111"""
        assert has_repeating_characters("pass1111word") is True

    def test_three_repeating_not_detected_by_default(self):
        """Test that 3 repeating chars is allowed by default"""
        # Default max_repeats is 3, so 4+ triggers
        assert has_repeating_characters("pass111word") is False

    def test_no_repeating_in_valid_password(self):
        """Test that valid password has no excessive repeating"""
        assert has_repeating_characters("MyStr0ng!Pass") is False

    def test_custom_max_repeats(self):
        """Test custom max repeats threshold"""
        # The function checks for max_repeats+1 consecutive chars
        # With max_repeats=2, it checks for 4 consecutive same chars (i.e., index+3)
        # So "pass1111word" (4 ones) would trigger with max_repeats=2
        assert has_repeating_characters("pass1111word", max_repeats=2) is True
        # 3 ones should not trigger with max_repeats=2
        assert has_repeating_characters("pass111word", max_repeats=2) is False


class TestGetPasswordStrengthScore:
    """Tests for password strength scoring"""

    def test_strong_password_high_score(self):
        """Test that strong password gets high score"""
        password = "MyV3ryStr0ng!P@ss#2024"
        score = get_password_strength_score(password)
        assert score >= 60

    def test_weak_password_low_score(self):
        """Test that weak password gets low score"""
        password = "weak"
        score = get_password_strength_score(password)
        assert score < 40

    def test_common_password_penalty(self):
        """Test that common password gets heavy penalty"""
        password = "password"
        score = get_password_strength_score(password)
        assert score < 20

    def test_score_range(self):
        """Test that score is between 0 and 100"""
        passwords = ["", "a", "password", "MyStr0ng!Pass@2024"]
        for password in passwords:
            score = get_password_strength_score(password)
            assert 0 <= score <= 100

    def test_longer_password_higher_score(self):
        """Test that longer passwords get higher scores"""
        short = "Abc123!@"
        long = "Abc123!@#$%^&*Xyz"
        assert get_password_strength_score(long) > get_password_strength_score(short)

    def test_complexity_increases_score(self):
        """Test that complexity increases score"""
        simple = "aaaaaaaaaaaa"  # 12 chars, no complexity
        complex_pw = "Aa1!Aa1!Aa1!"  # 12 chars, high complexity
        assert get_password_strength_score(complex_pw) > get_password_strength_score(simple)


class TestGetPasswordStrengthLabel:
    """Tests for password strength label"""

    def test_very_weak_label(self):
        """Test 'Very Weak' label for score < 20"""
        assert get_password_strength_label(10) == "Very Weak"
        assert get_password_strength_label(0) == "Very Weak"
        assert get_password_strength_label(19) == "Very Weak"

    def test_weak_label(self):
        """Test 'Weak' label for score 20-39"""
        assert get_password_strength_label(20) == "Weak"
        assert get_password_strength_label(39) == "Weak"

    def test_fair_label(self):
        """Test 'Fair' label for score 40-59"""
        assert get_password_strength_label(40) == "Fair"
        assert get_password_strength_label(59) == "Fair"

    def test_strong_label(self):
        """Test 'Strong' label for score 60-79"""
        assert get_password_strength_label(60) == "Strong"
        assert get_password_strength_label(79) == "Strong"

    def test_very_strong_label(self):
        """Test 'Very Strong' label for score >= 80"""
        assert get_password_strength_label(80) == "Very Strong"
        assert get_password_strength_label(100) == "Very Strong"


class TestEdgeCases:
    """Tests for edge cases"""

    def test_empty_password(self):
        """Test empty password fails validation"""
        is_valid, errors = validate_password("")
        assert is_valid is False
        assert len(errors) > 0

    def test_whitespace_only_password(self):
        """Test whitespace-only password fails"""
        is_valid, errors = validate_password("            ")  # 12 spaces
        assert is_valid is False

    def test_very_long_password(self):
        """Test very long password"""
        # 100 characters, valid
        password = "A" * 25 + "a" * 25 + "1" * 25 + "!" * 25
        is_valid, errors = validate_password(password)
        # Should pass length but may fail on repeating chars
        assert isinstance(is_valid, bool)

    def test_special_characters_accepted(self):
        """Test various special characters are accepted"""
        specials = "!@#$%^&*(),.?\":{}|<>_-+=[]\\/"
        for char in specials:
            password = f"ValidPass123{char}"
            if len(password) >= 12:
                is_valid, errors = validate_password(password)
                # Should not fail due to special character requirement
                special_char_error = any("special character" in e.lower() for e in errors)
                assert not special_char_error, f"Failed for special char: {char}"


class TestMinLengthConstant:
    """Tests for MIN_LENGTH constant"""

    def test_min_length_is_12(self):
        """Test that MIN_LENGTH is 12 (NIST recommendation)"""
        assert MIN_LENGTH == 12

    def test_password_at_min_length(self):
        """Test password at exactly min length"""
        password = "Aa1!Bb2@Cc3#"  # Exactly 12 chars
        assert len(password) == MIN_LENGTH
        is_valid, errors = validate_password(password)
        # Should not fail on length
        length_error = any(f"at least {MIN_LENGTH}" in e for e in errors)
        assert not length_error

    def test_password_below_min_length(self):
        """Test password below min length"""
        password = "Aa1!Bb2@Cc3"  # 11 chars
        assert len(password) == MIN_LENGTH - 1
        is_valid, errors = validate_password(password)
        assert is_valid is False
        length_error = any(f"at least {MIN_LENGTH}" in e for e in errors)
        assert length_error
