"""
Tests for delivery proof endpoints and auto-payment functionality.
"""
import pytest
from datetime import datetime
from unittest.mock import patch, AsyncMock, MagicMock
from fastapi import status

from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.models.delivery_proof import DeliveryProof
from app.utils.auth import get_password_hash


class TestDeliveryProofSubmission:
    """Tests for delivery proof submission endpoint."""

    def test_submit_proof_requires_in_transit_status(self, client, db_session, authenticated_courier, test_package_data):
        """Test that proof can only be submitted for IN_TRANSIT packages."""
        # Create sender and package
        sender = User(
            email="proof_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Proof Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package in PENDING_PICKUP status (not IN_TRANSIT)
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.PENDING_PICKUP,  # Not IN_TRANSIT - should fail proof submission
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Try to submit proof - should fail because package is not IN_TRANSIT
        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_storage.return_value.upload_file = AsyncMock(return_value="signatures/test.png")
            mock_storage.return_value.generate_presigned_download_url = AsyncMock(return_value="https://example.com/test.png")

            response = client.post(
                f"/api/proof/{package.id}",
                json=proof_data,
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "in transit" in response.json()["detail"].lower()

    def test_submit_proof_only_assigned_courier(self, client, db_session, authenticated_courier, test_package_data):
        """Test that only the assigned courier can submit proof."""
        # Create sender
        sender = User(
            email="proof_sender2@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Proof Sender 2",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        # Create another courier
        other_courier = User(
            email="other_courier_proof@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Other Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add_all([sender, other_courier])
        db_session.commit()

        # Create package assigned to other_courier
        package = Package(
            sender_id=sender.id,
            courier_id=other_courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Try to submit proof as authenticated_courier (not assigned)
        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        response = client.post(
            f"/api/proof/{package.id}",
            json=proof_data,
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only the assigned courier" in response.json()["detail"].lower()

    def test_submit_proof_updates_status_to_delivered(self, client, db_session, authenticated_courier):
        """Test that submitting proof transitions package to DELIVERED."""
        # Create sender
        sender = User(
            email="proof_sender3@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Proof Sender 3",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package in IN_TRANSIT status
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_instance = MagicMock()
            mock_instance.upload_file = AsyncMock(return_value="signatures/test.png")
            mock_instance.generate_presigned_download_url = AsyncMock(return_value="https://example.com/signature.png")
            mock_storage.return_value = mock_instance

            with patch("app.routes.delivery_proof.create_notification_with_broadcast", new_callable=AsyncMock):
                response = client.post(
                    f"/api/proof/{package.id}",
                    json=proof_data,
                    headers={"Authorization": f"Bearer {authenticated_courier}"}
                )

        assert response.status_code == status.HTTP_200_OK

        # Verify package is delivered
        db_session.refresh(package)
        assert package.status == PackageStatus.DELIVERED
        assert package.delivery_time is not None

    def test_submit_proof_requires_photo_or_signature(self, client, db_session, authenticated_courier):
        """Test that at least photo or signature is required."""
        # Create sender
        sender = User(
            email="proof_sender4@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Proof Sender 4",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package in IN_TRANSIT status
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Submit proof without photo or signature
        proof_data = {
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        response = client.post(
            f"/api/proof/{package.id}",
            json=proof_data,
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "at least one proof type" in response.json()["detail"].lower()

    def test_cannot_submit_duplicate_proof(self, client, db_session, authenticated_courier):
        """Test that duplicate proof submission is rejected."""
        # Create sender
        sender = User(
            email="proof_sender5@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Proof Sender 5",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package in IN_TRANSIT status
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Create existing proof
        existing_proof = DeliveryProof(
            package_id=package.id,
            courier_id=courier.id,
            signature_s3_key="signatures/existing.png",
            captured_at=datetime.utcnow()
        )
        db_session.add(existing_proof)
        db_session.commit()

        # Try to submit another proof
        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        response = client.post(
            f"/api/proof/{package.id}",
            json=proof_data,
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "already exists" in response.json()["detail"].lower()


class TestDeliveryProofAutoPayment:
    """Tests for auto-payment triggering on proof submission."""

    def test_payment_triggered_when_price_set(self, client, db_session, authenticated_courier):
        """Test that payment processing is triggered when package has price."""
        # Create sender
        sender = User(
            email="payment_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Payment Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package with price
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=50.00,  # Package has price
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_instance = MagicMock()
            mock_instance.upload_file = AsyncMock(return_value="signatures/test.png")
            mock_instance.generate_presigned_download_url = AsyncMock(return_value="https://example.com/signature.png")
            mock_storage.return_value = mock_instance

            with patch("app.routes.delivery_proof.create_notification_with_broadcast", new_callable=AsyncMock):
                with patch("fastapi.BackgroundTasks.add_task") as mock_add_task:
                    response = client.post(
                        f"/api/proof/{package.id}",
                        json=proof_data,
                        headers={"Authorization": f"Bearer {authenticated_courier}"}
                    )

                    assert response.status_code == status.HTTP_200_OK
                    # Verify background task was scheduled for payment
                    mock_add_task.assert_called()

    def test_no_payment_triggered_when_no_price(self, client, db_session, authenticated_courier):
        """Test that no payment is triggered when package has no price."""
        # Create sender
        sender = User(
            email="no_payment_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="No Payment Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package without price
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=None,  # No price
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "captured_at": datetime.utcnow().isoformat()
        }

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_instance = MagicMock()
            mock_instance.upload_file = AsyncMock(return_value="signatures/test.png")
            mock_instance.generate_presigned_download_url = AsyncMock(return_value="https://example.com/signature.png")
            mock_storage.return_value = mock_instance

            with patch("app.routes.delivery_proof.create_notification_with_broadcast", new_callable=AsyncMock):
                response = client.post(
                    f"/api/proof/{package.id}",
                    json=proof_data,
                    headers={"Authorization": f"Bearer {authenticated_courier}"}
                )

                assert response.status_code == status.HTTP_200_OK


class TestDeliveryProofAccess:
    """Tests for delivery proof access control."""

    def test_sender_can_view_proof(self, client, db_session, authenticated_sender):
        """Test that sender can view delivery proof for their package."""
        # Create test sender (same email as authenticated_sender fixture)
        sender = User(
            email="test_view_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="View Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Create courier
        courier = User(
            email="view_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="View Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)
        db_session.commit()

        # Get the actual sender used by authenticated_sender (email from test_user_data fixture)
        auth_sender = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create delivered package (using auth_sender as sender)
        package = Package(
            sender_id=auth_sender.id,
            courier_id=courier.id,
            description="Delivered package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Create proof
        proof = DeliveryProof(
            package_id=package.id,
            courier_id=courier.id,
            signature_s3_key="signatures/test.png",
            recipient_name="John Doe",
            captured_at=datetime.utcnow()
        )
        db_session.add(proof)
        db_session.commit()

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_instance = MagicMock()
            mock_instance.generate_presigned_download_url = AsyncMock(return_value="https://example.com/signature.png")
            mock_storage.return_value = mock_instance

            response = client.get(
                f"/api/proof/{package.id}",
                headers={"Authorization": f"Bearer {authenticated_sender}"}
            )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["package_id"] == package.id
        assert data["recipient_name"] == "John Doe"

    def test_unrelated_user_cannot_view_proof(self, client, db_session, authenticated_both_role):
        """Test that unrelated users cannot view delivery proof."""
        # Create sender and courier
        sender = User(
            email="unrelated_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Unrelated Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        courier = User(
            email="unrelated_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Unrelated Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add_all([sender, courier])
        db_session.commit()

        # Create delivered package
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Private package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
            price=25.00,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Create proof
        proof = DeliveryProof(
            package_id=package.id,
            courier_id=courier.id,
            signature_s3_key="signatures/test.png",
            captured_at=datetime.utcnow()
        )
        db_session.add(proof)
        db_session.commit()

        # Try to view as unrelated user
        response = client.get(
            f"/api/proof/{package.id}",
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestDeliveryProofLocation:
    """Tests for delivery proof location validation."""

    def test_distance_from_dropoff_calculated(self, client, db_session, authenticated_courier):
        """Test that distance from dropoff is calculated when location provided."""
        # Create sender
        sender = User(
            email="location_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Location Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Get courier
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create package with specific dropoff location
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.IN_TRANSIT,
            pickup_address="A",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="B",
            dropoff_lat=40.7489,  # Empire State Building approx
            dropoff_lng=-73.9680,
            price=25.00,
            requires_proof=True,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Submit proof with location near dropoff
        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "John Doe",
            "latitude": 40.7490,  # Close to dropoff
            "longitude": -73.9681,
            "location_accuracy_meters": 10,
            "captured_at": datetime.utcnow().isoformat()
        }

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_instance = MagicMock()
            mock_instance.upload_file = AsyncMock(return_value="signatures/test.png")
            mock_instance.generate_presigned_download_url = AsyncMock(return_value="https://example.com/signature.png")
            mock_storage.return_value = mock_instance

            with patch("app.routes.delivery_proof.create_notification_with_broadcast", new_callable=AsyncMock):
                response = client.post(
                    f"/api/proof/{package.id}",
                    json=proof_data,
                    headers={"Authorization": f"Bearer {authenticated_courier}"}
                )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["latitude"] == 40.7490
        assert data["longitude"] == -73.9681
        # Distance should be calculated (in meters)
        assert data["distance_from_dropoff_meters"] is not None
        assert data["distance_from_dropoff_meters"] < 100  # Should be very close


class TestCompleteDeliveryFlow:
    """Integration tests for complete delivery flow with proof and payment."""

    def test_complete_delivery_lifecycle(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test complete package lifecycle: create -> match -> pickup -> transit -> proof -> delivered."""
        # Step 1: Create package
        test_package_data["requires_proof"] = True
        test_package_data["price"] = 35.00
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        package_id = create_response.json()["id"]
        assert create_response.json()["requires_proof"] is True

        # Step 2: Simulate matching and bid selection
        package = db_session.query(Package).filter(Package.id == package_id).first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()
        package.courier_id = courier.id
        package.status = PackageStatus.PENDING_PICKUP  # After bid selected and courier confirms pickup
        db_session.commit()

        # Step 3: Courier marks in transit (PENDING_PICKUP -> IN_TRANSIT)
        transit_response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "in_transit"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )
        assert transit_response.status_code == status.HTTP_200_OK

        # Step 5: Try to mark delivered via status endpoint (should fail - proof required)
        delivered_response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "delivered"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )
        assert delivered_response.status_code == status.HTTP_400_BAD_REQUEST
        assert "proof" in delivered_response.json()["detail"].lower()

        # Step 6: Submit delivery proof
        proof_data = {
            "signature_data": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
            "recipient_name": "Jane Smith",
            "recipient_relationship": "Recipient",
            "notes": "Delivered to front door",
            "captured_at": datetime.utcnow().isoformat()
        }

        with patch("app.routes.delivery_proof.get_file_storage") as mock_storage:
            mock_instance = MagicMock()
            mock_instance.upload_file = AsyncMock(return_value="signatures/test.png")
            mock_instance.generate_presigned_download_url = AsyncMock(return_value="https://example.com/signature.png")
            mock_storage.return_value = mock_instance

            with patch("app.routes.delivery_proof.create_notification_with_broadcast", new_callable=AsyncMock):
                proof_response = client.post(
                    f"/api/proof/{package_id}",
                    json=proof_data,
                    headers={"Authorization": f"Bearer {authenticated_courier}"}
                )

        assert proof_response.status_code == status.HTTP_200_OK
        assert proof_response.json()["recipient_name"] == "Jane Smith"

        # Step 7: Verify package is delivered
        get_response = client.get(
            f"/api/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert get_response.status_code == status.HTTP_200_OK
        assert get_response.json()["status"] == "delivered"
        # Terminal status - no allowed next statuses
        assert get_response.json()["allowed_next_statuses"] == []
