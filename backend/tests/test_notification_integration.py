"""
Integration tests for notification creation during package and route events.

These tests verify that notifications are automatically created when:
- A courier accepts a package
- A courier declines a package
- Package status is updated (picked_up, in_transit, delivered)
- A package is cancelled
- A courier creates a route with matching packages
"""
import pytest
from fastapi import status
from sqlalchemy.orm import Session
from unittest.mock import patch, AsyncMock

from app.models.package import Package, PackageStatus
from app.models.notification import Notification, NotificationType
from app.models.user import User


class TestAcceptPackageNotification:
    """Test that accepting a package creates notification for sender"""

    def test_accept_package_creates_notification(
        self, client, authenticated_courier, db_session, test_package_data
    ):
        """Test that accepting a package creates a notification for the sender"""
        # Create a sender and package
        sender = User(
            email="sender_notify@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()
        db_session.refresh(sender)

        package = Package(
            sender_id=sender.id,
            description="Test package for notification",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        # Accept the package as courier
        with patch('app.routes.matching.send_package_accepted_email', new_callable=AsyncMock):
            response = client.post(
                f"/api/matching/accept-package/{package.id}",
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_200_OK

        # Verify notification was created for sender
        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_MATCHED
        ).first()

        assert notification is not None
        assert notification.package_id == package.id
        assert "matched" in notification.message.lower()
        assert notification.read is False

    def test_accept_package_notification_contains_courier_name(
        self, client, authenticated_courier, db_session
    ):
        """Test that notification message contains courier name"""
        # Create sender
        sender = User(
            email="sender_name@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.matching.send_package_accepted_email', new_callable=AsyncMock):
            client.post(
                f"/api/matching/accept-package/{package.id}",
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id
        ).first()

        # Courier name should be in the message
        assert "Test Courier" in notification.message


class TestDeclinePackageNotification:
    """Test that declining a package creates notification for sender"""

    def test_decline_package_creates_notification(
        self, client, authenticated_courier, db_session
    ):
        """Test that declining a package creates a notification for the sender"""
        # Get courier user
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create sender
        sender = User(
            email="sender_decline@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        # Create matched package
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Package to decline",
            size="medium",
            weight_kg=2.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.MATCHED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.matching.send_package_declined_email', new_callable=AsyncMock):
            response = client.post(
                f"/api/matching/decline-package/{package.id}",
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_200_OK

        # Verify notification was created
        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_DECLINED
        ).first()

        assert notification is not None
        assert notification.package_id == package.id
        assert "declined" in notification.message.lower()


class TestStatusUpdateNotification:
    """Test that status updates create notifications"""

    def test_picked_up_status_creates_notification(
        self, client, authenticated_courier, db_session
    ):
        """Test that changing status to picked_up creates notification"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        sender = User(
            email="sender_status@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Package for pickup",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.MATCHED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.packages.send_package_picked_up_email', new_callable=AsyncMock):
            response = client.put(
                f"/api/packages/{package.id}/status",
                json={"status": "picked_up"},
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_200_OK

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_PICKED_UP
        ).first()

        assert notification is not None
        assert "picked up" in notification.message.lower()

    def test_in_transit_status_creates_notification(
        self, client, authenticated_courier, db_session
    ):
        """Test that changing status to in_transit creates notification"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        sender = User(
            email="sender_transit@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Package in transit",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PICKED_UP,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.packages.send_package_in_transit_email', new_callable=AsyncMock):
            response = client.put(
                f"/api/packages/{package.id}/status",
                json={"status": "in_transit"},
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_200_OK

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_IN_TRANSIT
        ).first()

        assert notification is not None
        assert "in transit" in notification.message.lower()

    def test_delivered_status_creates_notification(
        self, client, authenticated_courier, db_session
    ):
        """Test that changing status to delivered creates notification"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        sender = User(
            email="sender_delivered@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Package to deliver",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.IN_TRANSIT,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.packages.send_package_delivered_email', new_callable=AsyncMock):
            response = client.put(
                f"/api/packages/{package.id}/status",
                json={"status": "delivered"},
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_200_OK

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_DELIVERED
        ).first()

        assert notification is not None
        assert "delivered" in notification.message.lower()


class TestCancelPackageNotification:
    """Test that cancelling a package creates notifications"""

    def test_cancel_package_creates_sender_notification(
        self, client, authenticated_sender, db_session
    ):
        """Test that cancelling a package creates notification for sender"""
        sender = db_session.query(User).filter(User.email == "sender@example.com").first()

        package = Package(
            sender_id=sender.id,
            description="Package to cancel",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        response = client.put(
            f"/api/packages/{package.id}/cancel",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_CANCELLED
        ).first()

        assert notification is not None
        assert "cancelled" in notification.message.lower()

    def test_cancel_matched_package_notifies_courier(
        self, client, authenticated_sender, db_session
    ):
        """Test that cancelling a matched package notifies the courier"""
        sender = db_session.query(User).filter(User.email == "sender@example.com").first()

        courier = User(
            email="courier_cancel@example.com",
            hashed_password="hashed",
            full_name="Courier User",
            role="courier",
            is_verified=True,
            is_active=True
        )
        db_session.add(courier)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Matched package to cancel",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.MATCHED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.packages.send_package_cancelled_email', new_callable=AsyncMock):
            response = client.put(
                f"/api/packages/{package.id}/cancel",
                headers={"Authorization": f"Bearer {authenticated_sender}"}
            )

        assert response.status_code == status.HTTP_200_OK

        # Check courier notification
        courier_notification = db_session.query(Notification).filter(
            Notification.user_id == courier.id,
            Notification.type == NotificationType.PACKAGE_CANCELLED
        ).first()

        assert courier_notification is not None
        assert "cancelled" in courier_notification.message.lower()

        # Check sender notification
        sender_notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id,
            Notification.type == NotificationType.PACKAGE_CANCELLED
        ).first()

        assert sender_notification is not None


class TestRouteCreationNotification:
    """Test that creating a route with matching packages creates notification"""

    def test_route_with_matching_packages_creates_notification(
        self, client, authenticated_courier, db_session
    ):
        """Test that creating a route notifies courier of matching packages"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create a sender and pending package along the route
        sender = User(
            email="sender_route@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        # Package very close to route (NYC to Boston route, package near NYC)
        package = Package(
            sender_id=sender.id,
            description="Package along route",
            size="small",
            weight_kg=1.0,
            pickup_address="Near NYC",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="Near NYC dropoff",
            dropoff_lat=40.7500,
            dropoff_lng=-73.9900,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        route_data = {
            "start_address": "New York, NY",
            "start_lat": 40.7128,
            "start_lng": -74.0060,
            "end_address": "Boston, MA",
            "end_lat": 42.3601,
            "end_lng": -71.0589,
            "max_deviation_km": 10
        }

        with patch('app.routes.couriers.send_route_match_found_email', new_callable=AsyncMock):
            response = client.post(
                "/api/couriers/routes",
                json=route_data,
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        assert response.status_code == status.HTTP_201_CREATED

        # Check if notification was created for courier
        notification = db_session.query(Notification).filter(
            Notification.user_id == courier.id,
            Notification.type == NotificationType.ROUTE_MATCH_FOUND
        ).first()

        assert notification is not None
        assert "package" in notification.message.lower()
        assert "route" in notification.message.lower()

    def test_route_without_matching_packages_no_notification(
        self, client, authenticated_courier, db_session
    ):
        """Test that creating a route without matching packages doesn't create notification"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Clear any existing notifications
        db_session.query(Notification).filter(Notification.user_id == courier.id).delete()
        db_session.commit()

        # Create route in area with no packages (Antarctica)
        route_data = {
            "start_address": "Antarctic Base 1",
            "start_lat": -75.0,
            "start_lng": 0.0,
            "end_address": "Antarctic Base 2",
            "end_lat": -80.0,
            "end_lng": 10.0,
            "max_deviation_km": 5
        }

        response = client.post(
            "/api/couriers/routes",
            json=route_data,
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_201_CREATED

        # Check no notification was created
        notification = db_session.query(Notification).filter(
            Notification.user_id == courier.id,
            Notification.type == NotificationType.ROUTE_MATCH_FOUND
        ).first()

        assert notification is None


class TestNotificationReadStatus:
    """Test that automatically created notifications are unread"""

    def test_auto_created_notifications_are_unread(
        self, client, authenticated_courier, db_session
    ):
        """Test that all auto-created notifications start as unread"""
        sender = User(
            email="sender_unread@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.matching.send_package_accepted_email', new_callable=AsyncMock):
            client.post(
                f"/api/matching/accept-package/{package.id}",
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id
        ).first()

        assert notification is not None
        assert notification.read is False


class TestNotificationPackageReference:
    """Test that notifications correctly reference packages"""

    def test_notification_has_correct_package_id(
        self, client, authenticated_courier, db_session
    ):
        """Test that notification references the correct package"""
        sender = User(
            email="sender_ref@example.com",
            hashed_password="hashed",
            full_name="Sender User",
            role="sender",
            is_verified=True,
            is_active=True
        )
        db_session.add(sender)
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            description="Referenced package",
            size="large",
            weight_kg=5.0,
            pickup_address="123 Pickup St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=40.7580,
            dropoff_lng=-73.9855,
            status=PackageStatus.PENDING,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(package)

        with patch('app.routes.matching.send_package_accepted_email', new_callable=AsyncMock):
            client.post(
                f"/api/matching/accept-package/{package.id}",
                headers={"Authorization": f"Bearer {authenticated_courier}"}
            )

        notification = db_session.query(Notification).filter(
            Notification.user_id == sender.id
        ).first()

        assert notification.package_id == package.id
