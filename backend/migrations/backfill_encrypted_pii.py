"""
Migration script to backfill encrypted PII data

This script reads existing plain text PII and populates the corresponding
encrypted columns. This is part of the security migration to move from plain text
to encrypted PII storage.

Run this script after add_encrypted_pii_columns.py migration.
Usage: PYTHONPATH=. python migrations/backfill_encrypted_pii.py
"""

import sys
from sqlalchemy import create_engine, text
from app.config import settings
from app.utils.encryption import EncryptionService, EncryptionError


def upgrade():
    """Backfill encrypted PII from existing plain text data"""

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
        # Count users with PII that needs encryption
        result = conn.execute(text("""
            SELECT
                COUNT(*) FILTER (WHERE email IS NOT NULL AND email_encrypted IS NULL) as email_count,
                COUNT(*) FILTER (WHERE full_name IS NOT NULL AND full_name_encrypted IS NULL) as name_count,
                COUNT(*) FILTER (WHERE phone_number IS NOT NULL AND phone_number_encrypted IS NULL) as phone_count
            FROM users
        """))

        counts = result.fetchone()
        email_count = counts[0]
        name_count = counts[1]
        phone_count = counts[2]

        print(f"\n{'='*60}")
        print("PII Encryption Backfill Migration")
        print(f"{'='*60}")
        print(f"Found {email_count} emails to encrypt")
        print(f"Found {name_count} names to encrypt")
        print(f"Found {phone_count} phone numbers to encrypt")
        print(f"{'='*60}\n")

        if email_count == 0 and name_count == 0 and phone_count == 0:
            print("✓ All PII is already encrypted. No migration needed.")
            return

        # Backfill encrypted emails
        if email_count > 0:
            print(f"Encrypting {email_count} email addresses...")
            users_with_email = conn.execute(text("""
                SELECT id, email
                FROM users
                WHERE email IS NOT NULL
                AND email_encrypted IS NULL
            """)).fetchall()

            encrypted_count = 0
            failed_count = 0

            for user_id, email in users_with_email:
                try:
                    encrypted_email = encryption_service.encrypt(email)
                    conn.execute(
                        text("UPDATE users SET email_encrypted = :encrypted WHERE id = :id"),
                        {"encrypted": encrypted_email, "id": user_id}
                    )
                    encrypted_count += 1

                    # Progress indicator every 100 records
                    if encrypted_count % 100 == 0:
                        print(f"  Progress: {encrypted_count}/{email_count} emails encrypted...")

                except Exception as e:
                    print(f"  ⚠️  Failed to encrypt email for user {user_id}: {e}")
                    failed_count += 1

            if failed_count > 0:
                print(f"✓ Encrypted {encrypted_count} emails ({failed_count} failed)")
            else:
                print(f"✓ Successfully encrypted {encrypted_count} emails")

        # Backfill encrypted full names
        if name_count > 0:
            print(f"\nEncrypting {name_count} full names...")
            users_with_name = conn.execute(text("""
                SELECT id, full_name
                FROM users
                WHERE full_name IS NOT NULL
                AND full_name_encrypted IS NULL
            """)).fetchall()

            encrypted_count = 0
            failed_count = 0

            for user_id, full_name in users_with_name:
                try:
                    encrypted_name = encryption_service.encrypt(full_name)
                    conn.execute(
                        text("UPDATE users SET full_name_encrypted = :encrypted WHERE id = :id"),
                        {"encrypted": encrypted_name, "id": user_id}
                    )
                    encrypted_count += 1

                    if encrypted_count % 100 == 0:
                        print(f"  Progress: {encrypted_count}/{name_count} names encrypted...")

                except Exception as e:
                    print(f"  ⚠️  Failed to encrypt name for user {user_id}: {e}")
                    failed_count += 1

            if failed_count > 0:
                print(f"✓ Encrypted {encrypted_count} names ({failed_count} failed)")
            else:
                print(f"✓ Successfully encrypted {encrypted_count} names")

        # Backfill encrypted phone numbers
        if phone_count > 0:
            print(f"\nEncrypting {phone_count} phone numbers...")
            users_with_phone = conn.execute(text("""
                SELECT id, phone_number
                FROM users
                WHERE phone_number IS NOT NULL
                AND phone_number_encrypted IS NULL
            """)).fetchall()

            encrypted_count = 0
            failed_count = 0

            for user_id, phone_number in users_with_phone:
                try:
                    encrypted_phone = encryption_service.encrypt(phone_number)
                    conn.execute(
                        text("UPDATE users SET phone_number_encrypted = :encrypted WHERE id = :id"),
                        {"encrypted": encrypted_phone, "id": user_id}
                    )
                    encrypted_count += 1

                    if encrypted_count % 100 == 0:
                        print(f"  Progress: {encrypted_count}/{phone_count} phone numbers encrypted...")

                except Exception as e:
                    print(f"  ⚠️  Failed to encrypt phone for user {user_id}: {e}")
                    failed_count += 1

            if failed_count > 0:
                print(f"✓ Encrypted {encrypted_count} phone numbers ({failed_count} failed)")
            else:
                print(f"✓ Successfully encrypted {encrypted_count} phone numbers")

        conn.commit()

        print(f"\n{'='*60}")
        print("✓ PII encryption backfill completed successfully!")
        print(f"{'='*60}")
        print("\nNext steps:")
        print("  1. Verify encrypted data can be decrypted correctly")
        print("  2. Update User model with hybrid properties for transparent encryption")
        print("  3. Update application code to use encrypted columns (dual-write)")
        print("  4. After validation period, plain text columns can be dropped")
        print(f"{'='*60}\n")


def downgrade():
    """
    Clear encrypted PII (revert to plain text only)

    WARNING: This does not restore plain text data if it was deleted.
    Only use this if plain text PII is still in the database.
    """
    engine = create_engine(settings.DATABASE_URL)

    with engine.connect() as conn:
        print(f"\n{'='*60}")
        print("Clearing Encrypted PII Data")
        print(f"{'='*60}\n")

        # Clear all encrypted PII
        conn.execute(text("""
            UPDATE users
            SET email_encrypted = NULL,
                full_name_encrypted = NULL,
                phone_number_encrypted = NULL
            WHERE email_encrypted IS NOT NULL
               OR full_name_encrypted IS NOT NULL
               OR phone_number_encrypted IS NOT NULL
        """))

        conn.commit()

        print("✓ Encrypted PII data cleared. Reverted to plain text only.")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "downgrade":
        downgrade()
    else:
        upgrade()
