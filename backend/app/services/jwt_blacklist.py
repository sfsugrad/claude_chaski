"""
JWT Token Blacklist Service using Redis.

This service manages revoked/blacklisted JWT tokens for:
- User logout (immediate token revocation)
- Password changes (invalidate all existing sessions)
- Compromised account protection
- Force logout functionality

Uses Redis for:
- Fast O(1) token lookup
- Automatic expiration (TTL matches JWT expiration)
- Distributed blacklist (works across multiple instances)
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional
from jose import jwt, JWTError

from app.config import settings
from app.services.redis_client import RedisClient

logger = logging.getLogger(__name__)

# Redis key prefixes
BLACKLIST_PREFIX = "jwt:blacklist:"
USER_REVOKE_PREFIX = "jwt:revoke_before:"


class JWTBlacklistService:
    """
    Service for managing blacklisted JWT tokens.

    Tokens are stored in Redis with TTL matching their expiration time,
    so they automatically cleanup when they would have expired anyway.
    """

    @staticmethod
    def _hash_token(token: str) -> str:
        """
        Hash the JWT token for storage (privacy + shorter keys).

        Args:
            token: The JWT token string

        Returns:
            SHA256 hash of the token
        """
        return hashlib.sha256(token.encode()).hexdigest()

    @staticmethod
    def _get_token_exp(token: str) -> Optional[int]:
        """
        Extract expiration timestamp from JWT token.

        Args:
            token: The JWT token string

        Returns:
            Expiration timestamp (seconds since epoch) or None if invalid
        """
        try:
            # Decode without verification to get exp claim
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_signature": False}  # Just reading exp, not verifying
            )
            return payload.get("exp")
        except JWTError:
            logger.warning("Failed to decode token for expiration")
            return None

    @staticmethod
    async def blacklist_token(token: str, reason: str = "logout") -> bool:
        """
        Add a token to the blacklist.

        Args:
            token: The JWT token to blacklist
            reason: Reason for blacklisting (for logging)

        Returns:
            True if successfully blacklisted, False otherwise
        """
        redis = await RedisClient.get_instance()

        # Hash the token for privacy
        token_hash = JWTBlacklistService._hash_token(token)
        key = f"{BLACKLIST_PREFIX}{token_hash}"

        # Get token expiration to set appropriate TTL
        exp = JWTBlacklistService._get_token_exp(token)
        if not exp:
            # If we can't get expiration, blacklist for default duration
            ttl = settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60
        else:
            # Calculate remaining time until expiration
            now = int(datetime.now(timezone.utc).timestamp())
            ttl = max(exp - now, 60)  # At least 1 minute

        # Store in Redis with TTL
        success = await redis.set(
            key,
            reason,  # Store reason for audit purposes
            ttl=ttl
        )

        if success:
            logger.info(f"Token blacklisted: reason={reason}, ttl={ttl}s")
        else:
            logger.error(f"Failed to blacklist token: reason={reason}")

        return success

    @staticmethod
    async def is_token_blacklisted(token: str) -> bool:
        """
        Check if a token is blacklisted.

        Args:
            token: The JWT token to check

        Returns:
            True if blacklisted, False otherwise
        """
        redis = await RedisClient.get_instance()

        token_hash = JWTBlacklistService._hash_token(token)
        key = f"{BLACKLIST_PREFIX}{token_hash}"

        return await redis.exists(key)

    @staticmethod
    async def revoke_all_user_tokens(user_id: int, revoke_before: Optional[datetime] = None) -> bool:
        """
        Revoke all tokens for a user issued before a specific time.

        This is used when:
        - User changes password (revoke all existing sessions)
        - Account compromise detected
        - Admin forces logout

        Args:
            user_id: The user ID
            revoke_before: Revoke tokens issued before this time (default: now)

        Returns:
            True if successfully set revocation time
        """
        redis = await RedisClient.get_instance()

        if revoke_before is None:
            revoke_before = datetime.now(timezone.utc)

        key = f"{USER_REVOKE_PREFIX}{user_id}"
        timestamp = int(revoke_before.timestamp())

        # Store revocation timestamp with long TTL (7 days - covers remember_me duration)
        # This will cause is_token_valid_for_user to reject tokens issued before this time
        ttl = 7 * 24 * 60 * 60  # 7 days

        success = await redis.set(key, str(timestamp), ttl=ttl)

        if success:
            logger.info(f"Revoked all tokens for user {user_id} before {revoke_before}")
        else:
            logger.error(f"Failed to revoke tokens for user {user_id}")

        return success

    @staticmethod
    async def is_token_valid_for_user(token: str, user_id: int) -> bool:
        """
        Check if token is valid for a specific user (not revoked globally).

        Args:
            token: The JWT token
            user_id: The user ID

        Returns:
            True if token is valid for this user, False if revoked
        """
        redis = await RedisClient.get_instance()

        key = f"{USER_REVOKE_PREFIX}{user_id}"
        revoke_before_str = await redis.get(key)

        if not revoke_before_str:
            # No global revocation for this user
            return True

        try:
            revoke_before = int(revoke_before_str)

            # Decode token to get issued-at time
            payload = jwt.decode(
                token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
                options={"verify_signature": False}
            )

            issued_at = payload.get("iat")
            if not issued_at:
                # No iat claim, can't verify
                return True

            # Check if token was issued before revocation time
            if issued_at < revoke_before:
                logger.info(f"Token revoked for user {user_id} (issued before {revoke_before})")
                return False

            return True

        except (ValueError, JWTError) as e:
            logger.warning(f"Error checking token validity for user {user_id}: {e}")
            return True  # Fail open to avoid breaking auth

    @staticmethod
    async def clear_user_revocation(user_id: int) -> bool:
        """
        Clear the global token revocation for a user.

        This is rarely needed, but useful for testing or
        if revocation was set incorrectly.

        Args:
            user_id: The user ID

        Returns:
            True if successfully cleared
        """
        redis = await RedisClient.get_instance()

        key = f"{USER_REVOKE_PREFIX}{user_id}"
        result = await redis.delete(key)

        logger.info(f"Cleared token revocation for user {user_id}")
        return result > 0
