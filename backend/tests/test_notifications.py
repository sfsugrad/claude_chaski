import pytest
from fastapi import status
from app.models.notification import Notification, NotificationType
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.routes.notifications import create_notification
from app.utils.tracking_id import generate_tracking_id


class TestGetNotifications:
    """Tests for GET /api/notifications/ endpoint"""

    def test_get_notifications_empty(self, client, authenticated_sender):
        """Test getting notifications when user has none"""
        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["notifications"] == []
        assert data["total"] == 0
        assert data["unread_count"] == 0

    def test_get_notifications_with_data(self, client, db_session, authenticated_sender):
        """Test getting notifications when user has some"""
        # Get the user
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create notifications
        for i in range(3):
            notification = Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Test notification {i}",
                read=False
            )
            db_session.add(notification)
        db_session.commit()

        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["notifications"]) == 3
        assert data["total"] == 3
        assert data["unread_count"] == 3

    def test_get_notifications_pagination(self, client, db_session, authenticated_sender):
        """Test notification pagination"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create 15 notifications
        for i in range(15):
            notification = Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Test notification {i}",
                read=False
            )
            db_session.add(notification)
        db_session.commit()

        # Get first page
        response = client.get(
            "/api/notifications/?skip=0&limit=10",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["notifications"]) == 10
        assert data["total"] == 15

        # Get second page
        response = client.get(
            "/api/notifications/?skip=10&limit=10",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["notifications"]) == 5
        assert data["total"] == 15

    def test_get_notifications_unread_only(self, client, db_session, authenticated_sender):
        """Test filtering to unread notifications only"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create mix of read and unread notifications
        for i in range(3):
            notification = Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Unread notification {i}",
                read=False
            )
            db_session.add(notification)

        for i in range(2):
            notification = Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Read notification {i}",
                read=True
            )
            db_session.add(notification)
        db_session.commit()

        # Get all notifications
        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.json()["total"] == 5

        # Get unread only
        response = client.get(
            "/api/notifications/?unread_only=true",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["notifications"]) == 3
        assert data["total"] == 3
        assert all(n["read"] is False for n in data["notifications"])

    def test_get_notifications_unauthorized(self, client):
        """Test getting notifications without authentication"""
        response = client.get("/api/notifications/")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_notifications_ordered_by_newest(self, client, db_session, authenticated_sender):
        """Test that notifications are ordered by newest first (by id desc as proxy for created_at)"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create notifications - in SQLite test DB, id order is reliable
        n1 = Notification(user_id=user.id, type=NotificationType.SYSTEM, message="First")
        db_session.add(n1)
        db_session.commit()

        n2 = Notification(user_id=user.id, type=NotificationType.SYSTEM, message="Second")
        db_session.add(n2)
        db_session.commit()

        n3 = Notification(user_id=user.id, type=NotificationType.SYSTEM, message="Third")
        db_session.add(n3)
        db_session.commit()

        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        data = response.json()
        # Verify ordering is by id descending (newest first)
        ids = [n["id"] for n in data["notifications"]]
        assert ids == sorted(ids, reverse=True), "Notifications should be ordered newest first"
        assert len(data["notifications"]) == 3


class TestGetUnreadCount:
    """Tests for GET /api/notifications/unread-count endpoint"""

    def test_get_unread_count_zero(self, client, authenticated_sender):
        """Test unread count when no notifications"""
        response = client.get(
            "/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["unread_count"] == 0

    def test_get_unread_count_with_notifications(self, client, db_session, authenticated_sender):
        """Test unread count with mix of read/unread"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create 3 unread and 2 read
        for i in range(3):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Unread {i}",
                read=False
            ))
        for i in range(2):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Read {i}",
                read=True
            ))
        db_session.commit()

        response = client.get(
            "/api/notifications/unread-count",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["unread_count"] == 3

    def test_get_unread_count_unauthorized(self, client):
        """Test unread count without authentication"""
        response = client.get("/api/notifications/unread-count")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestGetNotificationById:
    """Tests for GET /api/notifications/{notification_id} endpoint"""

    def test_get_notification_success(self, client, db_session, authenticated_sender):
        """Test getting a specific notification"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        notification = Notification(
            user_id=user.id,
            type=NotificationType.PACKAGE_MATCHED,
            message="Your package was matched!",
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        response = client.get(
            f"/api/notifications/{notification.id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == notification.id
        assert data["message"] == "Your package was matched!"
        assert data["type"].lower() == "package_matched"
        assert data["read"] is False

    def test_get_notification_not_found(self, client, authenticated_sender):
        """Test getting a non-existent notification"""
        response = client.get(
            "/api/notifications/99999",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_notification_other_users_notification(self, client, db_session, authenticated_sender, authenticated_courier):
        """Test that users cannot access other users' notifications"""
        # Get courier user
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create notification for courier
        notification = Notification(
            user_id=courier.id,
            type=NotificationType.SYSTEM,
            message="Courier notification",
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        # Try to access as sender
        response = client.get(
            f"/api/notifications/{notification.id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestMarkNotificationRead:
    """Tests for PUT /api/notifications/{notification_id}/read endpoint"""

    def test_mark_notification_read_success(self, client, db_session, authenticated_sender):
        """Test marking a notification as read"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        notification = Notification(
            user_id=user.id,
            type=NotificationType.SYSTEM,
            message="Test notification",
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        response = client.put(
            f"/api/notifications/{notification.id}/read",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["read"] is True

        # Verify in database
        db_session.refresh(notification)
        assert notification.read is True

    def test_mark_notification_read_already_read(self, client, db_session, authenticated_sender):
        """Test marking an already read notification"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        notification = Notification(
            user_id=user.id,
            type=NotificationType.SYSTEM,
            message="Test notification",
            read=True
        )
        db_session.add(notification)
        db_session.commit()

        response = client.put(
            f"/api/notifications/{notification.id}/read",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["read"] is True

    def test_mark_notification_read_not_found(self, client, authenticated_sender):
        """Test marking a non-existent notification as read"""
        response = client.put(
            "/api/notifications/99999/read",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_mark_notification_read_other_user(self, client, db_session, authenticated_sender, authenticated_courier):
        """Test that users cannot mark other users' notifications as read"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        notification = Notification(
            user_id=courier.id,
            type=NotificationType.SYSTEM,
            message="Courier notification",
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        response = client.put(
            f"/api/notifications/{notification.id}/read",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestMarkMultipleNotificationsRead:
    """Tests for PUT /api/notifications/mark-read endpoint"""

    def test_mark_all_notifications_read(self, client, db_session, authenticated_sender):
        """Test marking all notifications as read"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create unread notifications
        for i in range(5):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Notification {i}",
                read=False
            ))
        db_session.commit()

        response = client.put(
            "/api/notifications/mark-read",
            json={},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert "5" in response.json()["message"]

        # Verify all are read
        unread_count = db_session.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.read == False
        ).count()
        assert unread_count == 0

    def test_mark_specific_notifications_read(self, client, db_session, authenticated_sender):
        """Test marking specific notifications as read"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create notifications
        notifications = []
        for i in range(5):
            n = Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Notification {i}",
                read=False
            )
            db_session.add(n)
            db_session.flush()
            notifications.append(n)
        db_session.commit()

        # Mark only first 2 as read
        response = client.put(
            "/api/notifications/mark-read",
            json={"notification_ids": [notifications[0].id, notifications[1].id]},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert "2" in response.json()["message"]

        # Verify only 2 are read
        db_session.expire_all()
        read_count = db_session.query(Notification).filter(
            Notification.user_id == user.id,
            Notification.read == True
        ).count()
        assert read_count == 2

    def test_mark_notifications_read_empty_list(self, client, db_session, authenticated_sender):
        """Test marking with empty notification_ids marks all"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        for i in range(3):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Notification {i}",
                read=False
            ))
        db_session.commit()

        response = client.put(
            "/api/notifications/mark-read",
            json={"notification_ids": None},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK


class TestDeleteNotification:
    """Tests for DELETE /api/notifications/{notification_id} endpoint"""

    def test_delete_notification_success(self, client, db_session, authenticated_sender):
        """Test deleting a notification"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        notification = Notification(
            user_id=user.id,
            type=NotificationType.SYSTEM,
            message="Test notification",
            read=False
        )
        db_session.add(notification)
        db_session.commit()
        notification_id = notification.id

        response = client.delete(
            f"/api/notifications/{notification_id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify deleted
        deleted = db_session.query(Notification).filter(
            Notification.id == notification_id
        ).first()
        assert deleted is None

    def test_delete_notification_not_found(self, client, authenticated_sender):
        """Test deleting a non-existent notification"""
        response = client.delete(
            "/api/notifications/99999",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_notification_other_user(self, client, db_session, authenticated_sender, authenticated_courier):
        """Test that users cannot delete other users' notifications"""
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        notification = Notification(
            user_id=courier.id,
            type=NotificationType.SYSTEM,
            message="Courier notification",
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        response = client.delete(
            f"/api/notifications/{notification.id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND


class TestDeleteAllNotifications:
    """Tests for DELETE /api/notifications/ endpoint"""

    def test_delete_all_notifications(self, client, db_session, authenticated_sender):
        """Test deleting all notifications"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        for i in range(5):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Notification {i}",
                read=i % 2 == 0  # Some read, some unread
            ))
        db_session.commit()

        response = client.delete(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert "5" in response.json()["message"]

        # Verify all deleted
        count = db_session.query(Notification).filter(
            Notification.user_id == user.id
        ).count()
        assert count == 0

    def test_delete_read_notifications_only(self, client, db_session, authenticated_sender):
        """Test deleting only read notifications"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create 3 read and 2 unread
        for i in range(3):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Read {i}",
                read=True
            ))
        for i in range(2):
            db_session.add(Notification(
                user_id=user.id,
                type=NotificationType.SYSTEM,
                message=f"Unread {i}",
                read=False
            ))
        db_session.commit()

        response = client.delete(
            "/api/notifications/?read_only=true",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert "3" in response.json()["message"]

        # Verify only unread remain
        remaining = db_session.query(Notification).filter(
            Notification.user_id == user.id
        ).all()
        assert len(remaining) == 2
        assert all(n.read is False for n in remaining)


class TestNotificationTypes:
    """Tests for different notification types"""

    def test_all_notification_types(self, client, db_session, authenticated_sender):
        """Test creating notifications with all types"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        types_and_messages = [
            (NotificationType.PACKAGE_MATCHED, "Package matched with courier"),
            (NotificationType.PACKAGE_ACCEPTED, "Courier accepted your package"),
            (NotificationType.PACKAGE_DECLINED, "Courier declined your package"),
            (NotificationType.PACKAGE_PICKED_UP, "Package was picked up"),
            (NotificationType.PACKAGE_IN_TRANSIT, "Package is in transit"),
            (NotificationType.PACKAGE_DELIVERED, "Package was delivered"),
            (NotificationType.PACKAGE_CANCELLED, "Package was cancelled"),
            (NotificationType.ROUTE_MATCH_FOUND, "Found packages along your route"),
            (NotificationType.SYSTEM, "System notification"),
        ]

        for ntype, message in types_and_messages:
            db_session.add(Notification(
                user_id=user.id,
                type=ntype,
                message=message,
                read=False
            ))
        db_session.commit()

        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data["notifications"]) == 9

        # Verify all types are present
        types_in_response = {n["type"] for n in data["notifications"]}
        expected_types = {t.value for t, _ in types_and_messages}
        assert types_in_response == expected_types


class TestNotificationWithPackage:
    """Tests for notifications associated with packages"""

    def test_notification_with_package_reference(self, client, db_session, authenticated_sender, test_package_data):
        """Test notification with package_id"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create a package
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=user.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            price=test_package_data["price"],
            status=PackageStatus.OPEN_FOR_BIDS
        )
        db_session.add(package)
        db_session.commit()

        # Create notification with package reference
        notification = Notification(
            user_id=user.id,
            type=NotificationType.PACKAGE_MATCHED,
            message="Your package was matched!",
            package_id=package.id,
            read=False
        )
        db_session.add(notification)
        db_session.commit()

        response = client.get(
            f"/api/notifications/{notification.id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["package_id"] == package.id


class TestCreateNotificationUtility:
    """Tests for the create_notification utility function"""

    def test_create_notification_utility(self, db_session, authenticated_sender):
        """Test the create_notification utility function"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        notification = create_notification(
            db=db_session,
            user_id=user.id,
            notification_type=NotificationType.PACKAGE_DELIVERED,
            message="Your package has been delivered!",
            package_id=None
        )

        assert notification.id is not None
        assert notification.user_id == user.id
        assert notification.type == NotificationType.PACKAGE_DELIVERED
        assert notification.message == "Your package has been delivered!"
        assert notification.read is False

    def test_create_notification_with_package(self, db_session, authenticated_sender, test_package_data):
        """Test creating notification with package reference"""
        user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create package
        package = Package(
            tracking_id=generate_tracking_id(),
            sender_id=user.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            price=test_package_data["price"],
            status=PackageStatus.OPEN_FOR_BIDS
        )
        db_session.add(package)
        db_session.commit()

        notification = create_notification(
            db=db_session,
            user_id=user.id,
            notification_type=NotificationType.PACKAGE_MATCHED,
            message="Package matched!",
            package_id=package.id
        )

        assert notification.package_id == package.id


class TestNotificationIsolation:
    """Tests to ensure users can only access their own notifications"""

    def test_user_notification_isolation(self, client, db_session, authenticated_sender, authenticated_courier):
        """Test that users can only see their own notifications"""
        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create notifications for both users
        for i in range(3):
            db_session.add(Notification(
                user_id=sender.id,
                type=NotificationType.SYSTEM,
                message=f"Sender notification {i}",
                read=False
            ))
        for i in range(5):
            db_session.add(Notification(
                user_id=courier.id,
                type=NotificationType.SYSTEM,
                message=f"Courier notification {i}",
                read=False
            ))
        db_session.commit()

        # Sender should only see 3 notifications
        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.json()["total"] == 3

        # Courier should only see 5 notifications
        response = client.get(
            "/api/notifications/",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )
        assert response.json()["total"] == 5
