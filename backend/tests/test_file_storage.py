"""
Comprehensive tests for file storage service.
Tests S3 upload, download, verification, and URL generation.
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
from datetime import datetime
from botocore.exceptions import ClientError

from app.services.file_storage import FileStorageService, StorageError, get_file_storage


@pytest.fixture
def mock_s3_client():
    """Mock boto3 S3 client."""
    with patch('boto3.client') as mock_boto_client:
        mock_client = MagicMock()
        mock_boto_client.return_value = mock_client
        yield mock_client


@pytest.fixture
def storage_service(mock_s3_client):
    """Create FileStorageService with mocked S3 client."""
    service = FileStorageService()
    # Force client initialization with our mock
    service._client = mock_s3_client
    return service


class TestKeyGeneration:
    """Tests for S3 key generation."""

    def test_generate_key_format(self, storage_service):
        """Generated key follows correct format with date partitioning."""
        key = storage_service._generate_key("photos", 123, "photo")

        # Should have format: photos/YYYY/MM/DD/123/photo_UNIQUEID
        parts = key.split("/")
        assert parts[0] == "photos"
        assert len(parts) == 6
        assert parts[4] == "123"  # package_id
        assert parts[5].startswith("photo_")  # file_type prefix

    def test_generate_key_uniqueness(self, storage_service):
        """Each call generates a unique key."""
        key1 = storage_service._generate_key("photos", 123, "photo")
        key2 = storage_service._generate_key("photos", 123, "photo")

        assert key1 != key2  # Should have different unique IDs

    def test_generate_key_date_partitioning(self, storage_service):
        """Key includes correct date partitioning."""
        now = datetime.utcnow()
        key = storage_service._generate_key("signatures", 456, "signature")

        # Extract date parts from key
        parts = key.split("/")
        assert parts[1] == str(now.year)
        assert parts[2] == f"{now.month:02d}"
        assert parts[3] == f"{now.day:02d}"


class TestPresignedUploadURL:
    """Tests for generate_presigned_upload_url."""

    @pytest.mark.asyncio
    async def test_generate_upload_url_success(self, storage_service, mock_s3_client):
        """Successfully generates presigned upload URL."""
        mock_response = {
            "url": "https://s3.amazonaws.com/bucket/upload",
            "fields": {
                "key": "photos/2025/01/01/123/photo_abc123",
                "AWSAccessKeyId": "TESTKEY",
                "policy": "BASE64POLICY",
                "signature": "SIGNATURE"
            }
        }
        mock_s3_client.generate_presigned_post.return_value = mock_response

        result = await storage_service.generate_presigned_upload_url(
            package_id=123,
            file_type="photo"
        )

        assert "upload_url" in result
        assert "key" in result
        assert "fields" in result
        assert result["upload_url"] == "https://s3.amazonaws.com/bucket/upload"
        assert "photos" in result["key"]

    @pytest.mark.asyncio
    async def test_generate_upload_url_signature_type(self, storage_service, mock_s3_client):
        """Correctly handles signature file type."""
        mock_response = {
            "url": "https://s3.amazonaws.com/bucket/upload",
            "fields": {}
        }
        mock_s3_client.generate_presigned_post.return_value = mock_response

        result = await storage_service.generate_presigned_upload_url(
            package_id=123,
            file_type="signature"
        )

        assert "signatures" in result["key"]

    @pytest.mark.asyncio
    async def test_generate_upload_url_custom_content_type(self, storage_service, mock_s3_client):
        """Respects custom content type parameter."""
        mock_s3_client.generate_presigned_post.return_value = {
            "url": "test", "fields": {}
        }

        await storage_service.generate_presigned_upload_url(
            package_id=123,
            content_type="image/png"
        )

        # Verify content type was passed to generate_presigned_post
        call_args = mock_s3_client.generate_presigned_post.call_args
        assert call_args[1]["Fields"]["Content-Type"] == "image/png"

    @pytest.mark.asyncio
    async def test_generate_upload_url_error(self, storage_service, mock_s3_client):
        """Raises StorageError on S3 client error."""
        mock_s3_client.generate_presigned_post.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access denied"}},
            "GeneratePresignedPost"
        )

        with pytest.raises(StorageError) as exc_info:
            await storage_service.generate_presigned_upload_url(package_id=123)

        assert "Failed to generate upload URL" in str(exc_info.value)


class TestPresignedDownloadURL:
    """Tests for generate_presigned_download_url."""

    @pytest.mark.asyncio
    async def test_generate_download_url_success(self, storage_service, mock_s3_client):
        """Successfully generates presigned download URL."""
        expected_url = "https://s3.amazonaws.com/bucket/file?signature=abc123"
        mock_s3_client.generate_presigned_url.return_value = expected_url

        result = await storage_service.generate_presigned_download_url(
            key="photos/2025/01/01/123/photo_abc.jpg"
        )

        assert result == expected_url
        mock_s3_client.generate_presigned_url.assert_called_once()

    @pytest.mark.asyncio
    async def test_generate_download_url_custom_expiry(self, storage_service, mock_s3_client):
        """Respects custom expiry parameter."""
        mock_s3_client.generate_presigned_url.return_value = "https://test.com"

        await storage_service.generate_presigned_download_url(
            key="test.jpg",
            expiry=7200  # 2 hours
        )

        call_args = mock_s3_client.generate_presigned_url.call_args
        assert call_args[1]["ExpiresIn"] == 7200

    @pytest.mark.asyncio
    async def test_generate_download_url_error(self, storage_service, mock_s3_client):
        """Raises StorageError on S3 client error."""
        mock_s3_client.generate_presigned_url.side_effect = ClientError(
            {"Error": {"Code": "NoSuchKey", "Message": "Key not found"}},
            "GetObject"
        )

        with pytest.raises(StorageError) as exc_info:
            await storage_service.generate_presigned_download_url(key="nonexistent.jpg")

        assert "Failed to generate download URL" in str(exc_info.value)


class TestPublicURL:
    """Tests for get_public_url."""

    @patch('app.services.file_storage.settings')
    def test_get_public_url_cloudfront(self, mock_settings, storage_service):
        """Returns CloudFront URL when configured."""
        mock_settings.AWS_CLOUDFRONT_DOMAIN = "d123456.cloudfront.net"

        url = storage_service.get_public_url("photos/2025/01/01/123/photo.jpg")

        assert url == "https://d123456.cloudfront.net/photos/2025/01/01/123/photo.jpg"

    @patch('app.services.file_storage.settings')
    def test_get_public_url_direct_s3(self, mock_settings, storage_service):
        """Returns direct S3 URL when CloudFront not configured."""
        mock_settings.AWS_CLOUDFRONT_DOMAIN = None
        mock_settings.AWS_S3_BUCKET = "my-bucket"
        mock_settings.AWS_S3_REGION = "us-east-1"

        url = storage_service.get_public_url("photos/test.jpg")

        assert url == "https://my-bucket.s3.us-east-1.amazonaws.com/photos/test.jpg"

    @patch('app.services.file_storage.settings')
    def test_get_public_url_preserves_key(self, mock_settings, storage_service):
        """Preserves full key path in URL."""
        mock_settings.AWS_CLOUDFRONT_DOMAIN = "cdn.example.com"

        key = "photos/2025/01/15/999/photo_unique123.jpg"
        url = storage_service.get_public_url(key)

        assert key in url


class TestVerifyUpload:
    """Tests for verify_upload."""

    @pytest.mark.asyncio
    async def test_verify_upload_file_exists(self, storage_service, mock_s3_client):
        """Returns True when file exists."""
        mock_s3_client.head_object.return_value = {
            "ContentLength": 12345,
            "ContentType": "image/jpeg"
        }

        result = await storage_service.verify_upload("photos/test.jpg")

        assert result is True
        mock_s3_client.head_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_verify_upload_file_not_found(self, storage_service, mock_s3_client):
        """Returns False when file doesn't exist."""
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}},
            "HeadObject"
        )

        result = await storage_service.verify_upload("nonexistent.jpg")

        assert result is False

    @pytest.mark.asyncio
    async def test_verify_upload_other_error(self, storage_service, mock_s3_client):
        """Raises StorageError on non-404 S3 errors."""
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access denied"}},
            "HeadObject"
        )

        with pytest.raises(StorageError) as exc_info:
            await storage_service.verify_upload("test.jpg")

        assert "Failed to verify upload" in str(exc_info.value)


class TestDeleteFile:
    """Tests for delete_file."""

    @pytest.mark.asyncio
    async def test_delete_file_success(self, storage_service, mock_s3_client):
        """Successfully deletes file from S3."""
        mock_s3_client.delete_object.return_value = {}

        result = await storage_service.delete_file("photos/test.jpg")

        assert result is True
        mock_s3_client.delete_object.assert_called_once()

    @pytest.mark.asyncio
    async def test_delete_file_with_key_path(self, storage_service, mock_s3_client):
        """Correctly passes key to delete_object."""
        mock_s3_client.delete_object.return_value = {}

        key = "photos/2025/01/15/999/photo_abc.jpg"
        await storage_service.delete_file(key)

        call_args = mock_s3_client.delete_object.call_args
        assert call_args[1]["Key"] == key

    @pytest.mark.asyncio
    async def test_delete_file_error(self, storage_service, mock_s3_client):
        """Raises StorageError on S3 client error."""
        mock_s3_client.delete_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access denied"}},
            "DeleteObject"
        )

        with pytest.raises(StorageError) as exc_info:
            await storage_service.delete_file("test.jpg")

        assert "Failed to delete file" in str(exc_info.value)


class TestUploadFile:
    """Tests for upload_file."""

    @pytest.mark.asyncio
    async def test_upload_file_success(self, storage_service, mock_s3_client):
        """Successfully uploads file to S3."""
        mock_s3_client.upload_fileobj.return_value = None

        file_data = b"fake image data"
        key = await storage_service.upload_file(
            file_data=file_data,
            package_id=123,
            file_type="photo"
        )

        assert "photos" in key
        assert "123" in key
        mock_s3_client.upload_fileobj.assert_called_once()

    @pytest.mark.asyncio
    async def test_upload_file_signature_type(self, storage_service, mock_s3_client):
        """Correctly handles signature file uploads."""
        mock_s3_client.upload_fileobj.return_value = None

        file_data = b"signature data"
        key = await storage_service.upload_file(
            file_data=file_data,
            package_id=456,
            file_type="signature"
        )

        assert "signatures" in key

    @pytest.mark.asyncio
    async def test_upload_file_custom_content_type(self, storage_service, mock_s3_client):
        """Respects custom content type parameter."""
        mock_s3_client.upload_fileobj.return_value = None

        await storage_service.upload_file(
            file_data=b"png data",
            package_id=123,
            content_type="image/png"
        )

        call_args = mock_s3_client.upload_fileobj.call_args
        assert call_args[1]["ExtraArgs"]["ContentType"] == "image/png"

    @pytest.mark.asyncio
    async def test_upload_file_error(self, storage_service, mock_s3_client):
        """Raises StorageError on S3 upload failure."""
        mock_s3_client.upload_fileobj.side_effect = ClientError(
            {"Error": {"Code": "NetworkError", "Message": "Network failed"}},
            "UploadFileobj"
        )

        with pytest.raises(StorageError) as exc_info:
            await storage_service.upload_file(
                file_data=b"data",
                package_id=123
            )

        assert "Failed to upload file" in str(exc_info.value)


class TestFileMetadata:
    """Tests for get_file_metadata."""

    @pytest.mark.asyncio
    async def test_get_metadata_success(self, storage_service, mock_s3_client):
        """Successfully retrieves file metadata."""
        mock_response = {
            "ContentLength": 12345,
            "ContentType": "image/jpeg",
            "LastModified": datetime(2025, 1, 15, 10, 30, 0)
        }
        mock_s3_client.head_object.return_value = mock_response

        metadata = await storage_service.get_file_metadata("photos/test.jpg")

        assert metadata is not None
        assert metadata["size"] == 12345
        assert metadata["content_type"] == "image/jpeg"
        assert metadata["last_modified"] == datetime(2025, 1, 15, 10, 30, 0)

    @pytest.mark.asyncio
    async def test_get_metadata_file_not_found(self, storage_service, mock_s3_client):
        """Returns None when file doesn't exist."""
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "404", "Message": "Not Found"}},
            "HeadObject"
        )

        metadata = await storage_service.get_file_metadata("nonexistent.jpg")

        assert metadata is None

    @pytest.mark.asyncio
    async def test_get_metadata_other_error(self, storage_service, mock_s3_client):
        """Raises StorageError on non-404 S3 errors."""
        mock_s3_client.head_object.side_effect = ClientError(
            {"Error": {"Code": "AccessDenied", "Message": "Access denied"}},
            "HeadObject"
        )

        with pytest.raises(StorageError) as exc_info:
            await storage_service.get_file_metadata("test.jpg")

        assert "Failed to get file metadata" in str(exc_info.value)


class TestSingleton:
    """Tests for get_file_storage singleton."""

    def test_get_file_storage_returns_instance(self):
        """Returns FileStorageService instance."""
        service = get_file_storage()

        assert isinstance(service, FileStorageService)

    def test_get_file_storage_singleton(self):
        """Returns same instance on multiple calls."""
        service1 = get_file_storage()
        service2 = get_file_storage()

        assert service1 is service2
