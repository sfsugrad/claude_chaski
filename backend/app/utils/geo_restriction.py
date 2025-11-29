"""
IP-based geolocation for registration restrictions.
Uses ip-api.com (free tier, 45 req/min) with Redis caching.
"""

import httpx
import redis
from typing import Optional
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Cache IP lookups for 24 hours to reduce API calls
IP_GEO_CACHE_TTL = 86400  # 24 hours

# Synchronous Redis client for caching (geo lookup is sync)
_redis_client = None


def get_redis_client() -> redis.Redis:
    """Get synchronous Redis client for geo caching"""
    global _redis_client
    if _redis_client is None:
        try:
            _redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
        except Exception as e:
            logger.warning(f"Failed to connect to Redis: {e}")
            # Create a dummy client that always returns None
            _redis_client = type('obj', (object,), {
                'get': lambda self, key: None,
                'setex': lambda self, key, ttl, value: None
            })()
    return _redis_client


async def get_country_from_ip(ip_address: str) -> Optional[str]:
    """
    Get country code from IP address using ip-api.com.

    Args:
        ip_address: IP address to look up

    Returns:
        Two-letter country code (e.g., "US", "CA", "GB") or None if lookup fails
    """
    # Check Redis cache first
    redis_client = get_redis_client()
    cache_key = f"geo:ip:{ip_address}"

    try:
        cached_country = redis_client.get(cache_key)
        if cached_country:
            logger.info(f"Cache hit for IP {ip_address}: {cached_country}")
            return cached_country
    except Exception as e:
        logger.warning(f"Redis cache read failed for {ip_address}: {e}")
        # Continue to API call if cache fails

    # Call ip-api.com
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"http://ip-api.com/json/{ip_address}",
                params={"fields": "status,country,countryCode"},
                timeout=3.0  # 3 second timeout
            )

            if response.status_code == 200:
                data = response.json()

                if data.get("status") == "success":
                    country_code = data.get("countryCode")

                    # Cache the result
                    try:
                        redis_client.setex(cache_key, IP_GEO_CACHE_TTL, country_code)
                    except Exception as e:
                        logger.warning(f"Redis cache write failed for {ip_address}: {e}")

                    logger.info(f"Geo lookup for {ip_address}: {country_code}")
                    return country_code
                else:
                    logger.warning(f"Geo API returned failure for {ip_address}: {data}")
                    return None
            else:
                logger.error(f"Geo API returned {response.status_code} for {ip_address}")
                return None

    except httpx.TimeoutException:
        logger.error(f"Geo lookup timeout for {ip_address} (3s)")
        return None
    except Exception as e:
        logger.error(f"Geo lookup failed for {ip_address}: {e}")
        return None


def is_country_allowed(country_code: Optional[str]) -> bool:
    """
    Check if country code is in allowlist.

    Args:
        country_code: Two-letter country code or None

    Returns:
        True if allowed, False if blocked
    """
    # If admin override enabled, allow all
    if settings.ALLOW_INTERNATIONAL_REGISTRATION:
        logger.info("Admin override enabled - allowing all countries")
        return True

    # If geo lookup failed, fail-secure (block registration)
    if country_code is None:
        logger.warning("Geo lookup failed - blocking registration (fail-secure)")
        return False

    # Check against allowlist
    allowed_countries = settings.REGISTRATION_COUNTRY_ALLOWLIST.split(",")
    allowed_countries = [c.strip().upper() for c in allowed_countries]

    is_allowed = country_code.upper() in allowed_countries

    if is_allowed:
        logger.info(f"Country {country_code} is allowed")
    else:
        logger.info(f"Country {country_code} is blocked (allowlist: {allowed_countries})")

    return is_allowed
