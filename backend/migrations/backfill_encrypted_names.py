"""
Migration script to backfill encrypted first_name, middle_name, last_name data

This script reads existing plain text name fields and populates the corresponding
encrypted columns.

Run this script after add_name_fields.py migration.
Usage: PYTHONPATH=. python migrations/backfill_encrypted_names.py
"""

import sys
from sqlalchemy import create_engine, text
from app.config import settings
from app.utils.encryption import EncryptionService, EncryptionError


def upgrade():
    """Backfill encrypted name fields from existing plain text data"""

    # Initialize encryption service
    if not settings.ENCRYPTION_KEY:
        print("\n❌ ERROR: ENCRYPTION_KEY not set in environment")
        print("Please set ENCRYPTION_KEY in your .env file")
        print("Generate a key with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"")
        sys.exit(1)

    try:
        encryption_service = EncryptionService(settings.ENCRYPTION_KEY.encode())
    except EncryptionError as e:
        print(f"\n❌ ERROR: Failed to initialize encryption service: {e}")
        sys.exit(1)

    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        # Count users with name fields that need encryption
        result = conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE first_name IS NOT NULL AND first_name_encrypted IS NULL) as first_name_count,
                COUNT(*) FILTER (WHERE middle_name IS NOT NULL AND middle_name_encrypted IS NULL) as middle_name_count,
                COUNT(*) FILTER (WHERE last_name IS NOT NULL AND last_name_encrypted IS NULL) as last_name_count
            FROM users
        """))

        counts = result.fetchone()
        first_name_count = counts[0]
        middle_name_count = counts[1]
        last_name_count = counts[2]

        print(f"\n{'='*60}")
        print("Name Fields Encryption Backfill Migration")
        print(f"{'='*60}")
        print(f"Found {first_name_count} first names to encrypt")
        print(f"Found {middle_name_count} middle names to encrypt")
        print(f"Found {last_name_count} last names to encrypt")
        print(f"{'='*60}\n")

        if first_name_count == 0 and middle_name_count == 0 and last_name_count == 0:
            print("✓ All name fields are already encrypted. No migration needed.")
            return

        # Backfill encrypted first names
        if first_name_count > 0:
            print(f"Encrypting {first_name_count} first names...")
            users_with_first_name = conn.execute(text("""
                SELECT id, first_name
                FROM users
                WHERE first_name IS NOT NULL
                AND first_name_encrypted IS NULL
            """)).fetchall()

            encrypted_count = 0
            failed_count = 0

            for user_id, first_name in users_with_first_name:
                try:
                    encrypted_first_name = encryption_service.encrypt(first_name)
                    conn.execute(
                        text("UPDATE users SET first_name_encrypted = :encrypted WHERE id = :id"),
                        {"encrypted": encrypted_first_name, "id": user_id}
                    )
                    encrypted_count += 1

                    if encrypted_count % 100 == 0:
                        print(f"  Progress: {encrypted_count}/{first_name_count} first names encrypted...")

                except Exception as e:
                    print(f"  ⚠️  Failed to encrypt first_name for user {user_id}: {e}")
                    failed_count += 1

            if failed_count > 0:
                print(f"✓ Encrypted {encrypted_count} first names ({failed_count} failed)")
            else:
                print(f"✓ Successfully encrypted {encrypted_count} first names")

        # Backfill encrypted middle names
        if middle_name_count > 0:
            print(f"\nEncrypting {middle_name_count} middle names...")
            users_with_middle_name = conn.execute(text("""
                SELECT id, middle_name
                FROM users
                WHERE middle_name IS NOT NULL
                AND middle_name_encrypted IS NULL
            """)).fetchall()

            encrypted_count = 0
            failed_count = 0

            for user_id, middle_name in users_with_middle_name:
                try:
                    encrypted_middle_name = encryption_service.encrypt(middle_name)
                    conn.execute(
                        text("UPDATE users SET middle_name_encrypted = :encrypted WHERE id = :id"),
                        {"encrypted": encrypted_middle_name, "id": user_id}
                    )
                    encrypted_count += 1

                    if encrypted_count % 100 == 0:
                        print(f"  Progress: {encrypted_count}/{middle_name_count} middle names encrypted...")

                except Exception as e:
                    print(f"  ⚠️  Failed to encrypt middle_name for user {user_id}: {e}")
                    failed_count += 1

            if failed_count > 0:
                print(f"✓ Encrypted {encrypted_count} middle names ({failed_count} failed)")
            else:
                print(f"✓ Successfully encrypted {encrypted_count} middle names")

        # Backfill encrypted last names
        if last_name_count > 0:
            print(f"\nEncrypting {last_name_count} last names...")
            users_with_last_name = conn.execute(text("""
                SELECT id, last_name
                FROM users
                WHERE last_name IS NOT NULL
                AND last_name_encrypted IS NULL
            """)).fetchall()

            encrypted_count = 0
            failed_count = 0

            for user_id, last_name in users_with_last_name:
                try:
                    encrypted_last_name = encryption_service.encrypt(last_name)
                    conn.execute(
                        text("UPDATE users SET last_name_encrypted = :encrypted WHERE id = :id"),
                        {"encrypted": encrypted_last_name, "id": user_id}
                    )
                    encrypted_count += 1

                    if encrypted_count % 100 == 0:
                        print(f"  Progress: {encrypted_count}/{last_name_count} last names encrypted...")

                except Exception as e:
                    print(f"  ⚠️  Failed to encrypt last_name for user {user_id}: {e}")
                    failed_count += 1

            if failed_count > 0:
                print(f"✓ Encrypted {encrypted_count} last names ({failed_count} failed)")
            else:
                print(f"✓ Successfully encrypted {encrypted_count} last names")

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ Name fields encryption backfill completed successfully!")
        print(f"{'='*60}\n")


def downgrade():
    """
    Clear encrypted name fields (revert to plain text only)

    WARNING: This does not restore plain text data if it was deleted.
    Only use this if plain text name fields are still in the database.
    """
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Clearing Encrypted Name Fields Data")
        print(f"{'='*60}\n")

        conn.execute(text("""
            UPDATE users
            SET first_name_encrypted = NULL,
                middle_name_encrypted = NULL,
                last_name_encrypted = NULL
            WHERE first_name_encrypted IS NOT NULL
               OR middle_name_encrypted IS NOT NULL
               OR last_name_encrypted IS NOT NULL
        """))

        conn.commit()

        print("✓ Encrypted name fields cleared. Reverted to plain text only.")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
