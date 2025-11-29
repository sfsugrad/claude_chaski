"""
Tests for admin package cancellation privileges.

Admins can cancel packages from any non-terminal state, including:
- IN_TRANSIT (regular users cannot)
- FAILED (regular users cannot)

Terminal states (DELIVERED, CANCELED) cannot be cancelled by anyone.
"""

import pytest
from fastapi import status
from app.models.package import Package, PackageStatus
from app.models.user import User, UserRole
from app.models.notification import Notification, NotificationType
from app.services.package_status import can_cancel, can_cancel_with_reason


class TestCanCancelFunction:
    """Unit tests for can_cancel() function with is_admin parameter"""

    def test_sender_cannot_cancel_in_transit(self):
        """Regular user cannot cancel IN_TRANSIT package"""
        result = can_cancel(PackageStatus.IN_TRANSIT, is_admin=False)
        assert result is False

    def test_admin_can_cancel_in_transit(self):
        """Admin can cancel IN_TRANSIT package"""
        result = can_cancel(PackageStatus.IN_TRANSIT, is_admin=True)
        assert result is True

    def test_sender_cannot_cancel_failed(self):
        """Regular user cannot cancel FAILED package"""
        result = can_cancel(PackageStatus.FAILED, is_admin=False)
        assert result is False

    def test_admin_can_cancel_failed(self):
        """Admin can cancel FAILED package"""
        result = can_cancel(PackageStatus.FAILED, is_admin=True)
        assert result is True

    def test_sender_cannot_cancel_delivered(self):
        """Regular user cannot cancel DELIVERED package (terminal)"""
        result = can_cancel(PackageStatus.DELIVERED, is_admin=False)
        assert result is False

    def test_admin_cannot_cancel_delivered(self):
        """Even admin cannot cancel DELIVERED package (terminal state)"""
        result = can_cancel(PackageStatus.DELIVERED, is_admin=True)
        assert result is False

    def test_sender_cannot_cancel_canceled(self):
        """Regular user cannot cancel already CANCELED package"""
        result = can_cancel(PackageStatus.CANCELED, is_admin=False)
        assert result is False

    def test_admin_cannot_cancel_canceled(self):
        """Even admin cannot cancel already CANCELED package (terminal state)"""
        result = can_cancel(PackageStatus.CANCELED, is_admin=True)
        assert result is False

    def test_sender_can_cancel_open_for_bids(self):
        """Regular user can cancel OPEN_FOR_BIDS package"""
        result = can_cancel(PackageStatus.OPEN_FOR_BIDS, is_admin=False)
        assert result is True

    def test_admin_can_cancel_open_for_bids(self):
        """Admin can cancel OPEN_FOR_BIDS package"""
        result = can_cancel(PackageStatus.OPEN_FOR_BIDS, is_admin=True)
        assert result is True

    def test_sender_can_cancel_bid_selected(self):
        """Regular user can cancel BID_SELECTED package"""
        result = can_cancel(PackageStatus.BID_SELECTED, is_admin=False)
        assert result is True

    def test_sender_can_cancel_pending_pickup(self):
        """Regular user can cancel PENDING_PICKUP package"""
        result = can_cancel(PackageStatus.PENDING_PICKUP, is_admin=False)
        assert result is True

    def test_default_is_admin_false(self):
        """Default is_admin parameter is False"""
        # IN_TRANSIT should not be cancellable with default params
        result = can_cancel(PackageStatus.IN_TRANSIT)
        assert result is False


class TestCanCancelWithReasonFunction:
    """Unit tests for can_cancel_with_reason() with is_admin parameter"""

    def test_sender_in_transit_returns_error_message(self, db_session):
        """Regular user gets error message for IN_TRANSIT"""
        package = Package(
            sender_id=1,
            status=PackageStatus.IN_TRANSIT,
            description="Test",
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
        )
        can_cancel_result, error = can_cancel_with_reason(package, is_admin=False)
        assert can_cancel_result is False
        assert "in transit" in error.lower()

    def test_admin_in_transit_returns_success(self, db_session):
        """Admin gets success for IN_TRANSIT"""
        package = Package(
            sender_id=1,
            status=PackageStatus.IN_TRANSIT,
            description="Test",
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
        )
        can_cancel_result, error = can_cancel_with_reason(package, is_admin=True)
        assert can_cancel_result is True
        assert error == ""

    def test_sender_failed_returns_error_message(self, db_session):
        """Regular user gets error message for FAILED"""
        package = Package(
            sender_id=1,
            status=PackageStatus.FAILED,
            description="Test",
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
        )
        can_cancel_result, error = can_cancel_with_reason(package, is_admin=False)
        assert can_cancel_result is False
        assert "failed" in error.lower()

    def test_admin_failed_returns_success(self, db_session):
        """Admin gets success for FAILED"""
        package = Package(
            sender_id=1,
            status=PackageStatus.FAILED,
            description="Test",
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
        )
        can_cancel_result, error = can_cancel_with_reason(package, is_admin=True)
        assert can_cancel_result is True
        assert error == ""

    def test_admin_delivered_returns_error(self, db_session):
        """Admin gets error for DELIVERED (terminal)"""
        package = Package(
            sender_id=1,
            status=PackageStatus.DELIVERED,
            description="Test",
            pickup_address="A",
            pickup_lat=0,
            pickup_lng=0,
            dropoff_address="B",
            dropoff_lat=0,
            dropoff_lng=0,
        )
        can_cancel_result, error = can_cancel_with_reason(package, is_admin=True)
        assert can_cancel_result is False
        assert "delivered" in error.lower()


class TestAdminCancellationEndpoint:
    """Integration tests for admin cancellation via API endpoint"""

    def test_admin_can_cancel_in_transit_package(
        self, client, db_session, authenticated_sender, authenticated_admin, test_package_data
    ):
        """Admin can cancel a package that is IN_TRANSIT"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set status to IN_TRANSIT
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.IN_TRANSIT
        db_session.commit()

        # Admin cancels the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == PackageStatus.CANCELED.value

    def test_admin_can_cancel_failed_package(
        self, client, db_session, authenticated_sender, authenticated_admin, test_package_data
    ):
        """Admin can cancel a package that is FAILED"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set status to FAILED
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.FAILED
        db_session.commit()

        # Admin cancels the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == PackageStatus.CANCELED.value

    def test_admin_cannot_cancel_delivered_package(
        self, client, db_session, authenticated_sender, authenticated_admin, test_package_data
    ):
        """Admin cannot cancel a DELIVERED package (terminal state)"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set status to DELIVERED
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.DELIVERED
        db_session.commit()

        # Admin tries to cancel the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "delivered" in response.json()["detail"].lower()

    def test_admin_cannot_cancel_already_canceled_package(
        self, client, db_session, authenticated_sender, authenticated_admin, test_package_data
    ):
        """Admin cannot cancel an already CANCELED package"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set status to CANCELED
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.CANCELED
        db_session.commit()

        # Admin tries to cancel the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "canceled" in response.json()["detail"].lower()

    def test_sender_still_cannot_cancel_in_transit(
        self, client, db_session, authenticated_sender, test_package_data
    ):
        """Regular sender still cannot cancel IN_TRANSIT package"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set status to IN_TRANSIT
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.IN_TRANSIT
        db_session.commit()

        # Sender tries to cancel the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "in transit" in response.json()["detail"].lower()

    def test_sender_still_cannot_cancel_failed(
        self, client, db_session, authenticated_sender, test_package_data
    ):
        """Regular sender still cannot cancel FAILED package"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set status to FAILED
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.FAILED
        db_session.commit()

        # Sender tries to cancel the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "failed" in response.json()["detail"].lower()


class TestAdminCancellationNotifications:
    """Tests for notifications when admin cancels a package"""

    def test_admin_cancellation_creates_notification_for_sender(
        self, client, db_session, authenticated_sender, authenticated_admin, test_package_data
    ):
        """When admin cancels, sender receives notification mentioning admin"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Get sender_id from the package
        package = db_session.query(Package).filter(Package.id == package_id).first()
        sender_id = package.sender_id

        # Clear any existing notifications
        db_session.query(Notification).filter(Notification.user_id == sender_id).delete()
        db_session.commit()

        # Admin cancels the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Check notification was created for sender
        notification = db_session.query(Notification).filter(
            Notification.user_id == sender_id,
            Notification.type == NotificationType.PACKAGE_CANCELLED
        ).first()

        assert notification is not None
        assert "admin" in notification.message.lower()

    def test_admin_cancellation_notifies_courier_with_admin_label(
        self, client, db_session, authenticated_sender, authenticated_admin,
        authenticated_courier, test_package_data
    ):
        """When admin cancels matched package, courier notification mentions admin"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Get courier from database (authenticated_courier fixture creates a courier user)
        courier = db_session.query(User).filter(User.role == UserRole.COURIER).first()
        courier_id = courier.id

        # Set package to IN_TRANSIT with courier assigned
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.IN_TRANSIT
        package.courier_id = courier_id
        db_session.commit()

        # Clear courier notifications
        db_session.query(Notification).filter(Notification.user_id == courier_id).delete()
        db_session.commit()

        # Admin cancels the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Check notification was created for courier
        notification = db_session.query(Notification).filter(
            Notification.user_id == courier_id,
            Notification.type == NotificationType.PACKAGE_CANCELLED
        ).first()

        assert notification is not None
        assert "admin" in notification.message.lower()

    def test_sender_cancellation_does_not_mention_admin(
        self, client, db_session, authenticated_sender, test_package_data
    ):
        """When sender cancels their own package, notification does not mention admin"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Get sender_id from the package
        package = db_session.query(Package).filter(Package.id == package_id).first()
        sender_id = package.sender_id

        # Clear any existing notifications
        db_session.query(Notification).filter(Notification.user_id == sender_id).delete()
        db_session.commit()

        # Sender cancels their own package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Check notification - should NOT mention admin
        notification = db_session.query(Notification).filter(
            Notification.user_id == sender_id,
            Notification.type == NotificationType.PACKAGE_CANCELLED
        ).first()

        assert notification is not None
        # Sender's own cancellation should say "has been cancelled" not "by admin"
        assert "by admin" not in notification.message.lower()


class TestAdminCancellationAllStates:
    """Test admin can cancel all non-terminal states"""

    @pytest.mark.parametrize("initial_status", [
        PackageStatus.NEW,
        PackageStatus.OPEN_FOR_BIDS,
        PackageStatus.BID_SELECTED,
        PackageStatus.PENDING_PICKUP,
        PackageStatus.IN_TRANSIT,
        PackageStatus.FAILED,
    ])
    def test_admin_can_cancel_non_terminal_states(
        self, client, db_session, authenticated_sender, authenticated_admin,
        test_package_data, initial_status
    ):
        """Admin can cancel packages in any non-terminal state"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set to the test status
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = initial_status
        db_session.commit()

        # Admin cancels the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == PackageStatus.CANCELED.value

    @pytest.mark.parametrize("terminal_status", [
        PackageStatus.DELIVERED,
        PackageStatus.CANCELED,
    ])
    def test_admin_cannot_cancel_terminal_states(
        self, client, db_session, authenticated_sender, authenticated_admin,
        test_package_data, terminal_status
    ):
        """Admin cannot cancel packages in terminal states"""
        # Create a package as sender
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Set to terminal status
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = terminal_status
        db_session.commit()

        # Admin tries to cancel the package
        response = client.put(
            f"/api/packages/{package_id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
