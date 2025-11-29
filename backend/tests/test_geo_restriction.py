"""Tests for geo-restriction functionality"""
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from app.utils.geo_restriction import get_country_from_ip, is_country_allowed
from app.config import settings


@pytest.mark.asyncio
async def test_get_country_from_ip_success():
    """Test successful IP geolocation"""
    with patch('app.utils.geo_restriction.get_redis_client') as mock_redis:
        # Mock Redis cache miss
        mock_redis.return_value.get.return_value = None

        with patch('httpx.AsyncClient') as mock_client:
            # Mock HTTP response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "success",
                "countryCode": "US"
            }

            async_mock_client = AsyncMock()
            async_mock_client.get = AsyncMock(return_value=mock_response)
            mock_client.return_value.__aenter__.return_value = async_mock_client

            country = await get_country_from_ip("8.8.8.8")
            assert country == "US"


@pytest.mark.asyncio
async def test_get_country_from_ip_cache_hit():
    """Test IP geolocation with cache hit"""
    with patch('app.utils.geo_restriction.get_redis_client') as mock_redis:
        # Mock Redis cache hit (returns string with decode_responses=True)
        mock_redis.return_value.get.return_value = "CA"

        country = await get_country_from_ip("1.2.3.4")
        assert country == "CA"


@pytest.mark.asyncio
async def test_get_country_from_ip_api_failure():
    """Test geo lookup failure (should return None)"""
    with patch('app.utils.geo_restriction.get_redis_client') as mock_redis:
        mock_redis.return_value.get.return_value = None

        with patch('httpx.AsyncClient') as mock_client:
            # Mock HTTP error
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=Exception("API timeout"))

            country = await get_country_from_ip("1.2.3.4")
            assert country is None


@pytest.mark.asyncio
async def test_get_country_from_ip_api_unsuccessful_status():
    """Test geo lookup with unsuccessful API response"""
    with patch('app.utils.geo_restriction.get_redis_client') as mock_redis:
        mock_redis.return_value.get.return_value = None

        with patch('httpx.AsyncClient') as mock_client:
            # Mock unsuccessful response
            mock_response = AsyncMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {
                "status": "fail",
                "message": "Invalid IP"
            }

            mock_client.return_value.__aenter__.return_value.get = AsyncMock(return_value=mock_response)

            country = await get_country_from_ip("invalid-ip")
            assert country is None


@pytest.mark.asyncio
async def test_get_country_from_ip_timeout():
    """Test geo lookup timeout"""
    with patch('app.utils.geo_restriction.get_redis_client') as mock_redis:
        mock_redis.return_value.get.return_value = None

        with patch('httpx.AsyncClient') as mock_client:
            # Mock timeout
            import httpx
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(side_effect=httpx.TimeoutException("Timeout"))

            country = await get_country_from_ip("1.2.3.4")
            assert country is None


def test_is_country_allowed_us():
    """Test US is allowed"""
    # Temporarily set config
    original_value = settings.ALLOW_INTERNATIONAL_REGISTRATION
    settings.ALLOW_INTERNATIONAL_REGISTRATION = False

    try:
        assert is_country_allowed("US") is True
    finally:
        settings.ALLOW_INTERNATIONAL_REGISTRATION = original_value


def test_is_country_allowed_canada():
    """Test Canada is blocked"""
    original_value = settings.ALLOW_INTERNATIONAL_REGISTRATION
    settings.ALLOW_INTERNATIONAL_REGISTRATION = False

    try:
        assert is_country_allowed("CA") is False
    finally:
        settings.ALLOW_INTERNATIONAL_REGISTRATION = original_value


def test_is_country_allowed_none_fails_secure():
    """Test None (lookup failure) blocks registration"""
    original_value = settings.ALLOW_INTERNATIONAL_REGISTRATION
    settings.ALLOW_INTERNATIONAL_REGISTRATION = False

    try:
        assert is_country_allowed(None) is False
    finally:
        settings.ALLOW_INTERNATIONAL_REGISTRATION = original_value


def test_is_country_allowed_case_insensitive():
    """Test country code is case-insensitive"""
    original_value = settings.ALLOW_INTERNATIONAL_REGISTRATION
    settings.ALLOW_INTERNATIONAL_REGISTRATION = False

    try:
        assert is_country_allowed("us") is True
        assert is_country_allowed("US") is True
        assert is_country_allowed("Us") is True
    finally:
        settings.ALLOW_INTERNATIONAL_REGISTRATION = original_value


def test_admin_override_allows_all_countries():
    """Test admin override allows all countries"""
    original_value = settings.ALLOW_INTERNATIONAL_REGISTRATION
    settings.ALLOW_INTERNATIONAL_REGISTRATION = True

    try:
        assert is_country_allowed("CA") is True
        assert is_country_allowed("GB") is True
        assert is_country_allowed("FR") is True
        assert is_country_allowed(None) is True  # Even None is allowed with override
    finally:
        settings.ALLOW_INTERNATIONAL_REGISTRATION = original_value


def test_multiple_countries_in_allowlist():
    """Test with multiple countries in allowlist"""
    original_allowlist = settings.REGISTRATION_COUNTRY_ALLOWLIST
    original_override = settings.ALLOW_INTERNATIONAL_REGISTRATION

    settings.REGISTRATION_COUNTRY_ALLOWLIST = "US,CA,GB"
    settings.ALLOW_INTERNATIONAL_REGISTRATION = False

    try:
        assert is_country_allowed("US") is True
        assert is_country_allowed("CA") is True
        assert is_country_allowed("GB") is True
        assert is_country_allowed("FR") is False
    finally:
        settings.REGISTRATION_COUNTRY_ALLOWLIST = original_allowlist
        settings.ALLOW_INTERNATIONAL_REGISTRATION = original_override
