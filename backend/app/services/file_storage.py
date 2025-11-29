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
        """Generate unique S3 key with date-based partitioning."""
        now = datetime.utcnow()
        unique_id = uuid.uuid4().hex[:12]
        return f"{folder}/{now.year}/{now.month:02d}/{now.day:02d}/{package_id}/{file_type}_{unique_id}"

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

        Args:
            file_data: File bytes
            package_id: Package ID for key generation
            file_type: Type of file ('photo' or 'signature')
            content_type: MIME type

        Returns:
            S3 key of uploaded file
        """
        folder = "photos" if file_type == "photo" else "signatures"
        key = self._generate_key(folder, package_id, file_type)

        try:
            self.client.upload_fileobj(
                BytesIO(file_data),
                settings.AWS_S3_BUCKET,
                key,
                ExtraArgs={"ContentType": content_type}
            )
            return key
        except ClientError as e:
            raise StorageError(f"Failed to upload file: {str(e)}")

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
