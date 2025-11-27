"""Tests for the messaging API endpoints."""
import pytest


class TestMessagesAPI:
    """Test suite for messages API"""

    def test_send_message_success(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test sending a message for a package"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus

        # Get sender user
        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create a package with courier assigned
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Send message as sender
        response = client.post(
            f"/api/messages/package/{package.id}",
            json={"content": "Hello, when can you pick up the package?"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "Hello, when can you pick up the package?"
        assert data["sender_id"] == sender.id
        assert data["package_id"] == package.id
        assert data["is_read"] == False

    def test_send_message_as_courier(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test courier can send messages"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            f"/api/messages/package/{package.id}",
            json={"content": "I'll be there in 30 minutes"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "I'll be there in 30 minutes"
        assert data["sender_id"] == courier.id

    def test_send_message_unauthorized_user(self, client, db_session, authenticated_sender, authenticated_courier, authenticated_both_role, test_package_data):
        """Test that unauthorized users cannot send messages"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Try to send message as a different user
        response = client.post(
            f"/api/messages/package/{package.id}",
            json={"content": "I shouldn't be able to send this"},
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == 403

    def test_get_package_messages(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test getting messages for a package"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Add some messages
        msg1 = Message(package_id=package.id, sender_id=sender.id, content="Hello!")
        msg2 = Message(package_id=package.id, sender_id=courier.id, content="Hi there!")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        response = client.get(
            f"/api/messages/package/{package.id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 2
        assert len(data["messages"]) == 2

    def test_get_conversations(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test getting list of conversations"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Add a message to create a conversation
        msg = Message(package_id=package.id, sender_id=courier.id, content="Test message")
        db_session.add(msg)
        db_session.commit()

        response = client.get(
            "/api/messages/conversations",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["conversations"]) == 1
        assert data["conversations"][0]["package_id"] == package.id
        assert data["conversations"][0]["other_user_name"] == courier.full_name

    def test_mark_message_as_read(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test marking a message as read"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Courier sends a message
        msg = Message(package_id=package.id, sender_id=courier.id, content="Test message")
        db_session.add(msg)
        db_session.commit()

        # Sender marks it as read
        response = client.put(
            f"/api/messages/{msg.id}/read",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["is_read"] == True

    def test_mark_all_messages_read(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test marking all messages in a conversation as read"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Courier sends multiple messages
        msg1 = Message(package_id=package.id, sender_id=courier.id, content="Message 1")
        msg2 = Message(package_id=package.id, sender_id=courier.id, content="Message 2")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        # Sender marks all as read
        response = client.put(
            f"/api/messages/package/{package.id}/read-all",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "Marked 2 messages as read" in data["message"]

    def test_get_unread_count(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test getting unread message count"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Courier sends messages
        msg1 = Message(package_id=package.id, sender_id=courier.id, content="Message 1")
        msg2 = Message(package_id=package.id, sender_id=courier.id, content="Message 2")
        db_session.add_all([msg1, msg2])
        db_session.commit()

        # Check sender's unread count
        response = client.get(
            "/api/messages/unread-count",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["unread_count"] == 2

    def test_message_content_validation(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test message content validation"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Empty message should fail
        response = client.post(
            f"/api/messages/package/{package.id}",
            json={"content": ""},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == 422

    def test_message_package_not_found(self, client, authenticated_sender):
        """Test sending message to non-existent package"""
        response = client.post(
            "/api/messages/package/99999",
            json={"content": "Test message"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 404

    def test_admin_cannot_access_messages(self, client, db_session, authenticated_sender, authenticated_courier, authenticated_admin, test_package_data):
        """Test that admins cannot access private messages"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # Admin tries to access messages
        response = client.get(
            f"/api/messages/package/{package.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 403

    def test_courier_can_message_pending_package(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test that any courier can message about pending packages (to ask questions before accepting)"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus

        sender = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create a pending package with NO courier assigned
        package = Package(
            sender_id=sender.id,
            courier_id=None,  # No courier assigned yet
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.PENDING
        )
        db_session.add(package)
        db_session.commit()

        # Courier (not assigned) should be able to send a message
        response = client.post(
            f"/api/messages/package/{package.id}",
            json={"content": "Hi, I have a question about this package before accepting"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "Hi, I have a question about this package before accepting"

    def test_courier_cannot_message_matched_package_if_not_assigned(self, client, db_session, authenticated_sender, authenticated_courier, authenticated_both_role, test_package_data):
        """Test that couriers cannot message about matched packages if they're not the assigned courier"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        # Use the "both role" user as the assigned courier
        assigned_courier = db_session.query(User).filter(User.email == "both@example.com").first()

        # Create a matched package with a DIFFERENT courier assigned
        package = Package(
            sender_id=sender.id,
            courier_id=assigned_courier.id,  # Different courier is assigned
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.MATCHED
        )
        db_session.add(package)
        db_session.commit()

        # A different courier should NOT be able to send a message
        response = client.post(
            f"/api/messages/package/{package.id}",
            json={"content": "I shouldn't be able to send this"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 403

    def test_sender_sees_conversations_from_pending_packages(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test that senders can see conversations even when package has no courier assigned yet"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create a pending package with NO courier assigned
        package = Package(
            sender_id=sender.id,
            courier_id=None,  # No courier assigned
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.PENDING
        )
        db_session.add(package)
        db_session.commit()

        # Courier sends a message about the pending package
        msg = Message(package_id=package.id, sender_id=courier.id, content="Hi, I have a question about this package")
        db_session.add(msg)
        db_session.commit()

        # Sender should see this conversation in their list
        response = client.get(
            "/api/messages/conversations",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["conversations"]) == 1
        assert data["conversations"][0]["package_id"] == package.id
        assert data["conversations"][0]["other_user_name"] == courier.full_name
        assert data["conversations"][0]["unread_count"] == 1

    def test_courier_sees_conversations_for_pending_packages_they_messaged(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test that couriers can see conversations for pending packages they messaged about"""
        from app.models.user import User
        from app.models.package import Package, PackageStatus
        from app.models.message import Message

        sender = db_session.query(User).filter(User.email == "test@example.com").first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()

        # Create a pending package with NO courier assigned
        package = Package(
            sender_id=sender.id,
            courier_id=None,  # No courier assigned
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"],
            status=PackageStatus.PENDING
        )
        db_session.add(package)
        db_session.commit()

        # Courier sends a message about the pending package
        msg1 = Message(package_id=package.id, sender_id=courier.id, content="Hi, I have a question")
        db_session.add(msg1)
        db_session.commit()

        # Sender responds
        msg2 = Message(package_id=package.id, sender_id=sender.id, content="Sure, what's your question?")
        db_session.add(msg2)
        db_session.commit()

        # Courier should see this conversation in their list
        response = client.get(
            "/api/messages/conversations",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 1
        assert len(data["conversations"]) == 1
        assert data["conversations"][0]["package_id"] == package.id
        assert data["conversations"][0]["other_user_name"] == sender.full_name
        assert data["conversations"][0]["unread_count"] == 1  # Sender's response is unread