"""
Comprehensive tests for package notes API endpoints.
Tests note creation, retrieval, authorization, and notifications.
"""
import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, PackageSize
from app.models.package_note import PackageNote, NoteAuthorType
from app.models.notification import Notification, NotificationType
from app.utils.tracking_id import generate_tracking_id
from main import app


@pytest.fixture
def sender_user(db_session, authenticated_sender):
    """Get the sender user object created by authenticated_sender fixture."""
    return db_session.query(User).filter(User.email == "test@example.com").first()


@pytest.fixture
def courier_user(db_session, authenticated_courier):
    """Get the courier user object created by authenticated_courier fixture."""
    return db_session.query(User).filter(User.email == "courier@example.com").first()


@pytest.fixture
def admin_user(db_session, authenticated_admin):
    """Get the admin user object created by authenticated_admin fixture."""
    return db_session.query(User).filter(User.email == "admin@example.com").first()


@pytest.fixture
def package_with_courier(db_session, sender_user, courier_user):
    """Create a package with both sender and courier assigned."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        courier_id=courier_user.id,
        status=PackageStatus.IN_TRANSIT,
        description="Test package for notes",
        weight_kg=2.5,
        pickup_address="123 Main St",
        dropoff_address="456 Oak Ave",
        pickup_lat=37.7749,
        pickup_lng=-122.4194,
        dropoff_lat=37.7849,
        dropoff_lng=-122.4094,
        size=PackageSize.SMALL,
        price=25.00,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


@pytest.fixture
def package_without_courier(db_session, sender_user):
    """Create a package without courier assigned."""
    package = Package(
        tracking_id=generate_tracking_id(),
        sender_id=sender_user.id,
        status=PackageStatus.OPEN_FOR_BIDS,
        description="Test package without courier",
        weight_kg=1.5,
        pickup_address="123 Main St",
        dropoff_address="456 Oak Ave",
        pickup_lat=37.7749,
        pickup_lng=-122.4194,
        dropoff_lat=37.7849,
        dropoff_lng=-122.4094,
        size=PackageSize.SMALL,
        price=15.00,
        is_active=True
    )
    db_session.add(package)
    db_session.commit()
    db_session.refresh(package)
    return package


class TestGetPackageNotes:
    """Tests for GET /{package_id}/notes endpoint."""

    def test_sender_can_view_notes(self, client, authenticated_sender, db_session, package_with_courier, sender_user):
        """Sender can view notes for their package."""
        # Create a note
        note = PackageNote(
            package_id=package_with_courier.id,
            author_id=sender_user.id,
            author_type=NoteAuthorType.SENDER,
            content="Test note from sender"
        )
        db_session.add(note)
        db_session.commit()

        response = client.get(
            f"/api/packages/{package_with_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["content"] == "Test note from sender"
        assert data[0]["author_type"] == "SENDER"

    def test_courier_can_view_notes_if_assigned(self, client, authenticated_courier, db_session, package_with_courier, sender_user):
        """Courier can view notes for package they're assigned to."""
        # Create a note
        note = PackageNote(
            package_id=package_with_courier.id,
            author_id=sender_user.id,
            author_type=NoteAuthorType.SENDER,
            content="Test note"
        )
        db_session.add(note)
        db_session.commit()

        response = client.get(
            f"/api/packages/{package_with_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1

    def test_courier_cannot_view_notes_if_not_assigned(self, client, authenticated_courier, db_session, package_without_courier):
        """Courier cannot view notes for package they're not assigned to."""
        response = client.get(
            f"/api/packages/{package_without_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 403

    def test_admin_can_view_notes(self, client, authenticated_admin, db_session, package_with_courier, sender_user):
        """Admin can view notes for any package."""
        # Create a note
        note = PackageNote(
            package_id=package_with_courier.id,
            author_id=sender_user.id,
            author_type=NoteAuthorType.SENDER,
            content="Test note"
        )
        db_session.add(note)
        db_session.commit()

        response = client.get(
            f"/api/packages/{package_with_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200

    def test_package_not_found(self, client, authenticated_sender):
        """Returns 404 when package doesn't exist."""
        response = client.get(
            "/api/packages/99999/notes",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 404

    def test_notes_ordered_by_created_at(self, client, authenticated_sender, db_session, package_with_courier, sender_user):
        """Notes are returned in chronological order."""
        # Create multiple notes with different timestamps
        for i in range(3):
            note = PackageNote(
                package_id=package_with_courier.id,
                author_id=sender_user.id,
                author_type=NoteAuthorType.SENDER,
                content=f"Note {i}"
            )
            db_session.add(note)
        db_session.commit()

        response = client.get(
            f"/api/packages/{package_with_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        # Should be ordered by created_at ascending
        assert data[0]["content"] == "Note 0"
        assert data[1]["content"] == "Note 1"
        assert data[2]["content"] == "Note 2"

    def test_author_name_included_in_response(self, client, authenticated_sender, db_session, package_with_courier, sender_user):
        """Response includes author name."""
        note = PackageNote(
            package_id=package_with_courier.id,
            author_id=sender_user.id,
            author_type=NoteAuthorType.SENDER,
            content="Test note"
        )
        db_session.add(note)
        db_session.commit()

        response = client.get(
            f"/api/packages/{package_with_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data[0]["author_name"] == sender_user.full_name

    def test_system_note_author_name(self, client, authenticated_sender, db_session, package_with_courier):
        """System notes show 'System' as author name."""
        note = PackageNote(
            package_id=package_with_courier.id,
            author_id=None,
            author_type=NoteAuthorType.SYSTEM,
            content="System generated note"
        )
        db_session.add(note)
        db_session.commit()

        response = client.get(
            f"/api/packages/{package_with_courier.id}/notes",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data[0]["author_name"] == "System"


class TestAddPackageNote:
    """Tests for POST /{package_id}/notes endpoint."""

    def test_sender_can_add_note(self, client, authenticated_sender, db_session, package_with_courier):
        """Sender can add a note to their package."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "Important note from sender"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["content"] == "Important note from sender"
        assert data["author_type"] == "SENDER"

        # Verify note was created in database
        note = db_session.query(PackageNote).filter(
            PackageNote.package_id == package_with_courier.id
        ).first()
        assert note is not None

    def test_courier_can_add_note_if_assigned(self, client, authenticated_courier, db_session, package_with_courier):
        """Courier can add note to package they're assigned to."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "Note from courier"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["author_type"] == "COURIER"

    def test_courier_cannot_add_note_if_not_assigned(self, client, authenticated_courier, db_session, package_without_courier):
        """Courier cannot add note to package they're not assigned to."""
        response = client.post(
            f"/api/packages/{package_without_courier.id}/notes",
            json={"content": "Unauthorized note"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 403

    def test_admin_can_add_note_as_system(self, client, authenticated_admin, db_session, package_with_courier):
        """Admin can add notes which are recorded as SYSTEM type."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "Admin note"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["author_type"] == "SYSTEM"

    def test_empty_content_validation(self, client, authenticated_sender, db_session, package_with_courier):
        """Empty note content is rejected."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "   "},  # Whitespace only
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 400
        assert "empty" in response.json()["detail"].lower()

    def test_content_length_validation(self, client, authenticated_sender, db_session, package_with_courier):
        """Note content exceeding 1000 characters is rejected."""
        long_content = "x" * 1001

        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": long_content},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 400
        assert "1000 characters" in response.json()["detail"]

    def test_notification_created_for_courier(self, client, authenticated_sender, db_session, package_with_courier, courier_user):
        """Notification is created for courier when sender adds note."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "Note from sender"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 201

        # Check notification was created for courier
        notification = db_session.query(Notification).filter(
            Notification.user_id == courier_user.id,
            Notification.type == NotificationType.NEW_NOTE_ADDED
        ).first()

        assert notification is not None
        assert "added a note" in notification.message

    def test_notification_created_for_sender(self, client, authenticated_courier, db_session, package_with_courier, sender_user):
        """Notification is created for sender when courier adds note."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "Note from courier"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == 201

        # Check notification was created for sender
        notification = db_session.query(Notification).filter(
            Notification.user_id == sender_user.id,
            Notification.type == NotificationType.NEW_NOTE_ADDED
        ).first()

        assert notification is not None

    def test_author_not_notified_about_own_note(self, client, authenticated_sender, db_session, package_with_courier, sender_user):
        """Author is not notified about their own note."""
        response = client.post(
            f"/api/packages/{package_with_courier.id}/notes",
            json={"content": "My own note"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 201

        # Check that sender was not notified
        notifications = db_session.query(Notification).filter(
            Notification.user_id == sender_user.id,
            Notification.type == NotificationType.NEW_NOTE_ADDED
        ).all()

        assert len(notifications) == 0

    def test_package_not_found(self, client, authenticated_sender):
        """Returns 404 when package doesn't exist."""
        response = client.post(
            "/api/packages/99999/notes",
            json={"content": "Note for nonexistent package"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 404
