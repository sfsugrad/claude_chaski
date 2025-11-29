"""
Migration script to backfill token hashes for existing users

This script reads existing plain text tokens and populates the corresponding
hash columns. This is part of the security migration to move from plain text
to hashed token storage.

Run this script after add_token_hash_columns.py migration.
Usage: python migrations/backfill_token_hashes.py
"""

import hashlib
from sqlalchemy import create_engine, text
from app.config import settings

def hash_token(token: str) -> str:
    """Hash a token using SHA-256"""
    return hashlib.sha256(token.encode('utf-8')).hexdigest()


def upgrade():
    """Backfill token hashes from existing plain text tokens"""
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Count users with tokens that need hashing
        result = conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE verification_token IS NOT NULL AND verification_token_hash IS NULL) as verification_count,
                COUNT(*) FILTER (WHERE password_reset_token IS NOT NULL AND password_reset_token_hash IS NULL) as reset_count,
                COUNT(*) FILTER (WHERE phone_verification_code IS NOT NULL) as phone_count
            FROM users
        """))

        counts = result.fetchone()
        verification_count = counts[0]
        reset_count = counts[1]
        phone_count = counts[2]

        print(f"\n{'='*60}")
        print("Token Hash Backfill Migration")
        print(f"{'='*60}")
        print(f"Found {verification_count} verification tokens to hash")
        print(f"Found {reset_count} password reset tokens to hash")
        print(f"Found {phone_count} phone verification codes to hash")
        print(f"{'='*60}\n")

        if verification_count == 0 and reset_count == 0 and phone_count == 0:
            print("✓ All tokens are already hashed. No migration needed.")
            return

        # Backfill verification token hashes
        if verification_count > 0:
            print(f"Hashing {verification_count} verification tokens...")
            users_with_verification = conn.execute(text("""
                SELECT id, verification_token
                FROM users
                WHERE verification_token IS NOT NULL
                AND verification_token_hash IS NULL
            """)).fetchall()

            for user_id, token in users_with_verification:
                token_hash = hash_token(token)
                conn.execute(
                    text("UPDATE users SET verification_token_hash = :hash WHERE id = :id"),
                    {"hash": token_hash, "id": user_id}
                )

            print(f"✓ Successfully hashed {verification_count} verification tokens")

        # Backfill password reset token hashes
        if reset_count > 0:
            print(f"Hashing {reset_count} password reset tokens...")
            users_with_reset = conn.execute(text("""
                SELECT id, password_reset_token
                FROM users
                WHERE password_reset_token IS NOT NULL
                AND password_reset_token_hash IS NULL
            """)).fetchall()

            for user_id, token in users_with_reset:
                token_hash = hash_token(token)
                conn.execute(
                    text("UPDATE users SET password_reset_token_hash = :hash WHERE id = :id"),
                    {"hash": token_hash, "id": user_id}
                )

            print(f"✓ Successfully hashed {reset_count} password reset tokens")

        # Backfill phone verification code hashes
        # Note: Phone codes are typically short-lived, so this may not capture many
        if phone_count > 0:
            print(f"Hashing {phone_count} phone verification codes...")
            users_with_phone = conn.execute(text("""
                SELECT id, phone_verification_code
                FROM users
                WHERE phone_verification_code IS NOT NULL
            """)).fetchall()

            hashed_count = 0
            for user_id, code in users_with_phone:
                # Only hash if it looks like a plain text code (6 digits)
                # Already hashed values will be 64 characters (SHA-256 hex)
                if code and len(code) <= 10:  # Plain text codes are ~6 digits
                    code_hash = hash_token(code)
                    conn.execute(
                        text("UPDATE users SET phone_verification_code = :hash WHERE id = :id"),
                        {"hash": code_hash, "id": user_id}
                    )
                    hashed_count += 1

            if hashed_count > 0:
                print(f"✓ Successfully hashed {hashed_count} phone verification codes")
            else:
                print("✓ All phone verification codes already hashed or invalid")

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ Token hash backfill completed successfully!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("  1. Verify hashed tokens work correctly")
        print("  2. Monitor for any issues in production")
        print("  3. After validation period, plain text columns can be dropped")
        print(f"{'='*60}\n")


def downgrade():
    """
    Clear token hashes (revert to plain text only)

    WARNING: This does not restore plain text tokens if they were deleted.
    Only use this if plain text tokens are still in the database.
    """
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Clear all token hashes
        conn.execute(text("""
            UPDATE users
            SET verification_token_hash = NULL,
                password_reset_token_hash = NULL
            WHERE verification_token_hash IS NOT NULL
               OR password_reset_token_hash IS NOT NULL
        """))

        conn.commit()
        print("Token hashes cleared. Reverted to plain text tokens only.")


if __name__ == "__main__":
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
