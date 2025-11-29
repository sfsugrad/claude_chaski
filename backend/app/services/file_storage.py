"""
File storage service for S3-based delivery proof storage.
"""
import uuid
from datetime import datetime
from typing import Optional
from io import BytesIO

import boto3
from botocore.exceptions import ClientError
from botocore.config import Config

from app.config import settings
from app.utils.file_validator import validate_image_file, FileValidationError


class FileStorageService:
    """AWS S3 file storage service for delivery proofs."""

    def __init__(self):
        self._client = None
        self._s3_config = Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"}
        )

    @property
    def client(self):
        """Lazy-load S3 client."""
        if self._client is None:
            self._client = boto3.client(
                "s3",
                aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
                aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
                region_name=settings.AWS_S3_REGION,
                config=self._s3_config
            )
        return self._client

    def _generate_key(self, folder: str, package_id: int, file_type: str) -> str:
        """
        Generate cryptographically random S3 key to prevent enumeration attacks.

        Security: Uses full UUIDs to make file paths unpredictable. This prevents
        attackers from guessing file URLs by enumerating package IDs or dates.

        Structure: folder/xx/yy/file_type_<uuid>_<uuid>
        - xx/yy: First 4 chars of UUID for S3 performance (bucketing)
        - Rest: Fully random, no package ID or date exposure

        Example: photos/a7/3f/photo_b8c9d1e2f3a4b5c6d7e8f9_a1b2c3d4e5f6

        Args:
            folder: Folder name (photos or signatures)
            package_id: Package ID (not exposed in key for security)
            file_type: Type of file (photo or signature)

        Returns:
            Unpredictable S3 key
        """
        # Generate cryptographically random UUID
        random_id = uuid.uuid4().hex  # 32 characters
        # Add second UUID for additional entropy
        random_suffix = uuid.uuid4().hex[:16]  # 16 characters

        # Use first 4 chars for directory bucketing (S3 performance optimization)
        # Rest is completely random - no package ID or date exposure
        return f"{folder}/{random_id[:2]}/{random_id[2:4]}/{file_type}_{random_id[4:]}_{random_suffix}"

    async def generate_presigned_upload_url(
        self,
        package_id: int,
        file_type: str = "photo",
        content_type: str = "image/jpeg"
    ) -> dict:
        """
        Generate pre-signed URL for direct upload to S3.

        Returns:
            dict with 'upload_url', 'key', and 'fields' for form upload
        """
        folder = "photos" if file_type == "photo" else "signatures"
        key = self._generate_key(folder, package_id, file_type)

        try:
            # Generate presigned POST URL for form-based upload
            response = self.client.generate_presigned_post(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key,
                Fields={
                    "Content-Type": content_type,
                },
                Conditions=[
                    {"Content-Type": content_type},
                    ["content-length-range", 1, 10 * 1024 * 1024],  # Max 10MB
                ],
                ExpiresIn=settings.S3_PRESIGNED_URL_EXPIRY
            )

            return {
                "upload_url": response["url"],
                "key": key,
                "fields": response["fields"]
            }
        except ClientError as e:
            raise StorageError(f"Failed to generate upload URL: {str(e)}")

    async def generate_presigned_download_url(
        self,
        key: str,
        expiry: Optional[int] = None
    ) -> str:
        """
        Generate pre-signed URL for downloading/viewing a file.

        Args:
            key: S3 object key
            expiry: URL expiry in seconds (default from settings)

        Returns:
            Pre-signed URL string
        """
        if expiry is None:
            expiry = settings.S3_PRESIGNED_URL_EXPIRY

        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": settings.AWS_S3_BUCKET,
                    "Key": key
                },
                ExpiresIn=expiry
            )
            return url
        except ClientError as e:
            raise StorageError(f"Failed to generate download URL: {str(e)}")

    def get_public_url(self, key: str) -> str:
        """
        Get CloudFront or direct S3 URL for a file.

        Uses CloudFront if configured, otherwise returns S3 URL.
        """
        if settings.AWS_CLOUDFRONT_DOMAIN:
            return f"https://{settings.AWS_CLOUDFRONT_DOMAIN}/{key}"
        return f"https://{settings.AWS_S3_BUCKET}.s3.{settings.AWS_S3_REGION}.amazonaws.com/{key}"

    async def verify_upload(self, key: str) -> bool:
        """
        Verify that a file was successfully uploaded.

        Args:
            key: S3 object key to verify

        Returns:
            True if file exists, False otherwise
        """
        try:
            self.client.head_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key
            )
            return True
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return False
            raise StorageError(f"Failed to verify upload: {str(e)}")

    async def delete_file(self, key: str) -> bool:
        """
        Delete a file from S3.

        Args:
            key: S3 object key to delete

        Returns:
            True if deleted successfully
        """
        try:
            self.client.delete_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key
            )
            return True
        except ClientError as e:
            raise StorageError(f"Failed to delete file: {str(e)}")

    async def upload_file(
        self,
        file_data: bytes,
        package_id: int,
        file_type: str = "photo",
        content_type: str = "image/jpeg"
    ) -> str:
        """
        Upload file directly from server (for signature canvas data).

        Security: Validates file type by magic number before uploading.

        Args:
            file_data: File bytes
            package_id: Package ID for key generation
            file_type: Type of file ('photo' or 'signature')
            content_type: MIME type

        Returns:
            S3 key of uploaded file

        Raises:
            StorageError: If upload fails or file validation fails
        """
        # Validate file type by magic number (security check)
        try:
            detected_mime = validate_image_file(file_data)
        except FileValidationError as e:
            raise StorageError(f"File validation failed: {str(e)}")

        folder = "photos" if file_type == "photo" else "signatures"
        key = self._generate_key(folder, package_id, file_type)

        try:
            # Use detected MIME type instead of trusting client-provided content_type
            self.client.upload_fileobj(
                BytesIO(file_data),
                settings.AWS_S3_BUCKET,
                key,
                ExtraArgs={"ContentType": detected_mime}
            )
            return key
        except ClientError as e:
            raise StorageError(f"Failed to upload file: {str(e)}")

    async def validate_uploaded_file(self, key: str) -> bool:
        """
        Validate a file that was uploaded via pre-signed URL.

        Downloads the first 8KB of the file to check magic number without
        downloading the entire file.

        Args:
            key: S3 object key to validate

        Returns:
            True if file is valid

        Raises:
            StorageError: If file validation fails or file doesn't exist
        """
        try:
            # Download first 8KB (enough to detect file type)
            response = self.client.get_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key,
                Range="bytes=0-8191"  # First 8KB
            )

            # Read the bytes
            file_data = response["Body"].read()

            # Validate file type
            try:
                validate_image_file(file_data)
                return True
            except FileValidationError as e:
                # Invalid file - delete it
                await self.delete_file(key)
                raise StorageError(f"Uploaded file validation failed: {str(e)}")

        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                raise StorageError(f"File not found: {key}")
            raise StorageError(f"Failed to validate file: {str(e)}")

    async def get_file_metadata(self, key: str) -> Optional[dict]:
        """
        Get metadata for a file.

        Returns:
            Dict with 'size', 'content_type', 'last_modified' or None if not found
        """
        try:
            response = self.client.head_object(
                Bucket=settings.AWS_S3_BUCKET,
                Key=key
            )
            return {
                "size": response["ContentLength"],
                "content_type": response["ContentType"],
                "last_modified": response["LastModified"]
            }
        except ClientError as e:
            if e.response["Error"]["Code"] == "404":
                return None
            raise StorageError(f"Failed to get file metadata: {str(e)}")


class StorageError(Exception):
    """Exception for storage operations."""
    pass


# Singleton instance
_storage_service: Optional[FileStorageService] = None


def get_file_storage() -> FileStorageService:
    """Get singleton FileStorageService instance."""
    global _storage_service
    if _storage_service is None:
        _storage_service = FileStorageService()
    return _storage_service
