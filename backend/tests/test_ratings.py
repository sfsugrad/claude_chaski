"""Tests for the ratings API endpoints."""
import pytest
from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus
from app.models.rating import Rating
from app.utils.auth import get_password_hash, create_access_token


class TestCreateRating:
    """Tests for POST /api/ratings endpoint."""

    @pytest.fixture
    def delivered_package_setup(self, db_session):
        """Create sender, courier, and delivered package for rating tests."""
        # Create sender
        sender = User(
            email="sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Test Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        # Create courier
        courier = User(
            email="courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Test Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)
        db_session.commit()

        # Create delivered package
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Oak Ave",
            dropoff_lat=40.7200,
            dropoff_lng=-74.0100,
            price=25.00
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(sender)
        db_session.refresh(courier)
        db_session.refresh(package)

        sender_token = create_access_token(data={"sub": sender.email})
        courier_token = create_access_token(data={"sub": courier.email})

        return {
            "sender": sender,
            "courier": courier,
            "package": package,
            "sender_token": sender_token,
            "courier_token": courier_token
        }

    def test_sender_can_rate_courier(self, client, delivered_package_setup):
        """Sender can rate the courier after delivery."""
        setup = delivered_package_setup

        response = client.post(
            "/api/ratings/",
            json={
                "package_id": setup["package"].id,
                "score": 5,
                "comment": "Great delivery service!"
            },
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["score"] == 5
        assert data["comment"] == "Great delivery service!"
        assert data["rater_id"] == setup["sender"].id
        assert data["rated_user_id"] == setup["courier"].id
        assert data["package_id"] == setup["package"].id

    def test_courier_can_rate_sender(self, client, delivered_package_setup):
        """Courier can rate the sender after delivery."""
        setup = delivered_package_setup

        response = client.post(
            "/api/ratings/",
            json={
                "package_id": setup["package"].id,
                "score": 4,
                "comment": "Easy pickup"
            },
            headers={"Authorization": f"Bearer {setup['courier_token']}"}
        )

        assert response.status_code == 201
        data = response.json()
        assert data["score"] == 4
        assert data["rater_id"] == setup["courier"].id
        assert data["rated_user_id"] == setup["sender"].id

    def test_cannot_rate_non_delivered_package(self, client, db_session, authenticated_sender, test_package_data):
        """Cannot rate a package that hasn't been delivered."""
        # Get sender user
        sender = db_session.query(User).filter(User.email == "test@example.com").first()

        # Create pending package
        package = Package(
            sender_id=sender.id,
            description=test_package_data["description"],
            size=test_package_data["size"],
            weight_kg=test_package_data["weight_kg"],
            status=PackageStatus.PENDING,
            pickup_address=test_package_data["pickup_address"],
            pickup_lat=test_package_data["pickup_lat"],
            pickup_lng=test_package_data["pickup_lng"],
            dropoff_address=test_package_data["dropoff_address"],
            dropoff_lat=test_package_data["dropoff_lat"],
            dropoff_lng=test_package_data["dropoff_lng"]
        )
        db_session.add(package)
        db_session.commit()

        response = client.post(
            "/api/ratings/",
            json={"package_id": package.id, "score": 5},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 400
        assert "delivered" in response.json()["detail"].lower()

    def test_cannot_rate_package_not_involved_in(self, client, db_session, delivered_package_setup):
        """Cannot rate a package you weren't involved in."""
        # Create another user
        other_user = User(
            email="other@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Other User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(other_user)
        db_session.commit()
        other_token = create_access_token(data={"sub": other_user.email})

        setup = delivered_package_setup

        response = client.post(
            "/api/ratings/",
            json={"package_id": setup["package"].id, "score": 5},
            headers={"Authorization": f"Bearer {other_token}"}
        )

        assert response.status_code == 403
        assert "involved" in response.json()["detail"].lower()

    def test_cannot_rate_same_package_twice(self, client, delivered_package_setup):
        """Cannot rate the same package twice."""
        setup = delivered_package_setup

        # First rating
        response1 = client.post(
            "/api/ratings/",
            json={"package_id": setup["package"].id, "score": 5},
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )
        assert response1.status_code == 201

        # Second rating attempt
        response2 = client.post(
            "/api/ratings/",
            json={"package_id": setup["package"].id, "score": 3},
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )
        assert response2.status_code == 400
        assert "already rated" in response2.json()["detail"].lower()

    def test_score_must_be_between_1_and_5(self, client, delivered_package_setup):
        """Rating score must be between 1 and 5."""
        setup = delivered_package_setup

        # Score too low
        response = client.post(
            "/api/ratings/",
            json={"package_id": setup["package"].id, "score": 0},
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )
        assert response.status_code == 422

        # Score too high
        response = client.post(
            "/api/ratings/",
            json={"package_id": setup["package"].id, "score": 6},
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )
        assert response.status_code == 422

    def test_rating_without_comment(self, client, delivered_package_setup):
        """Rating without comment should work."""
        setup = delivered_package_setup

        response = client.post(
            "/api/ratings/",
            json={"package_id": setup["package"].id, "score": 4},
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )

        assert response.status_code == 201
        assert response.json()["comment"] is None

    def test_rating_nonexistent_package(self, client, authenticated_sender):
        """Rating a nonexistent package returns 404."""
        response = client.post(
            "/api/ratings/",
            json={"package_id": 9999, "score": 5},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 404


class TestGetUserRatings:
    """Tests for GET /api/ratings/user/{user_id} endpoint."""

    @pytest.fixture
    def user_with_ratings(self, db_session):
        """Create a user with multiple ratings."""
        # Create rated user (courier)
        courier = User(
            email="ratedcourier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Rated Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)

        # Create multiple senders who will rate the courier
        senders = []
        for i in range(3):
            sender = User(
                email=f"sender{i}@test.com",
                hashed_password=get_password_hash("password123"),
                full_name=f"Sender {i}",
                role=UserRole.SENDER,
                is_active=True,
                is_verified=True,
                max_deviation_km=5
            )
            db_session.add(sender)
            senders.append(sender)
        db_session.commit()

        # Create packages and ratings
        packages = []
        for i, sender in enumerate(senders):
            package = Package(
                sender_id=sender.id,
                courier_id=courier.id,
                description=f"Package {i}",
                size="small",
                weight_kg=1.0,
                status=PackageStatus.DELIVERED,
                pickup_address="123 Main St",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="456 Oak Ave",
                dropoff_lat=40.7200,
                dropoff_lng=-74.0100
            )
            db_session.add(package)
            packages.append(package)
        db_session.commit()

        # Create ratings (4, 5, 3 stars)
        scores = [4, 5, 3]
        for i, (sender, package, score) in enumerate(zip(senders, packages, scores)):
            rating = Rating(
                rater_id=sender.id,
                rated_user_id=courier.id,
                package_id=package.id,
                score=score,
                comment=f"Comment {i}" if i < 2 else None
            )
            db_session.add(rating)
        db_session.commit()

        db_session.refresh(courier)
        auth_token = create_access_token(data={"sub": senders[0].email})

        return {
            "courier": courier,
            "senders": senders,
            "packages": packages,
            "auth_token": auth_token
        }

    def test_get_user_ratings(self, client, user_with_ratings):
        """Get all ratings for a user."""
        setup = user_with_ratings

        response = client.get(
            f"/api/ratings/user/{setup['courier'].id}",
            headers={"Authorization": f"Bearer {setup['auth_token']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["ratings"]) == 3
        assert data["average_rating"] == 4.0  # (4+5+3)/3

    def test_get_user_ratings_pagination(self, client, user_with_ratings):
        """Test pagination of user ratings."""
        setup = user_with_ratings

        response = client.get(
            f"/api/ratings/user/{setup['courier'].id}?skip=0&limit=2",
            headers={"Authorization": f"Bearer {setup['auth_token']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 3
        assert len(data["ratings"]) == 2

    def test_get_nonexistent_user_ratings(self, client, authenticated_sender):
        """Getting ratings for nonexistent user returns 404."""
        response = client.get(
            "/api/ratings/user/9999",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 404


class TestGetUserRatingSummary:
    """Tests for GET /api/ratings/user/{user_id}/summary endpoint."""

    @pytest.fixture
    def user_with_varied_ratings(self, db_session):
        """Create a user with ratings of different scores."""
        courier = User(
            email="summarycourier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Summary Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)

        # Create senders
        senders = []
        for i in range(5):
            sender = User(
                email=f"summarysender{i}@test.com",
                hashed_password=get_password_hash("password123"),
                full_name=f"Summary Sender {i}",
                role=UserRole.SENDER,
                is_active=True,
                is_verified=True,
                max_deviation_km=5
            )
            db_session.add(sender)
            senders.append(sender)
        db_session.commit()

        # Create packages and ratings with different scores
        scores = [5, 5, 4, 4, 3]  # Two 5s, two 4s, one 3
        for i, (sender, score) in enumerate(zip(senders, scores)):
            package = Package(
                sender_id=sender.id,
                courier_id=courier.id,
                description=f"Package {i}",
                size="small",
                weight_kg=1.0,
                status=PackageStatus.DELIVERED,
                pickup_address="123 Main St",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="456 Oak Ave",
                dropoff_lat=40.7200,
                dropoff_lng=-74.0100
            )
            db_session.add(package)
            db_session.commit()

            rating = Rating(
                rater_id=sender.id,
                rated_user_id=courier.id,
                package_id=package.id,
                score=score
            )
            db_session.add(rating)
        db_session.commit()

        db_session.refresh(courier)
        auth_token = create_access_token(data={"sub": senders[0].email})

        return {"courier": courier, "auth_token": auth_token}

    def test_get_rating_summary(self, client, user_with_varied_ratings):
        """Get rating summary with breakdown."""
        setup = user_with_varied_ratings

        response = client.get(
            f"/api/ratings/user/{setup['courier'].id}/summary",
            headers={"Authorization": f"Bearer {setup['auth_token']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["user_id"] == setup["courier"].id
        assert data["total_ratings"] == 5
        assert data["average_rating"] == 4.2  # (5+5+4+4+3)/5
        assert data["rating_breakdown"]["5"] == 2
        assert data["rating_breakdown"]["4"] == 2
        assert data["rating_breakdown"]["3"] == 1
        assert data["rating_breakdown"]["2"] == 0
        assert data["rating_breakdown"]["1"] == 0


class TestGetPackageRatings:
    """Tests for GET /api/ratings/package/{package_id} endpoint."""

    @pytest.fixture
    def package_with_both_ratings(self, db_session):
        """Create a package with ratings from both sender and courier."""
        sender = User(
            email="pkgsender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Pkg Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        courier = User(
            email="pkgcourier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Pkg Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add_all([sender, courier])
        db_session.commit()

        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Rated Package",
            size="medium",
            weight_kg=2.0,
            status=PackageStatus.DELIVERED,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Oak Ave",
            dropoff_lat=40.7200,
            dropoff_lng=-74.0100
        )
        db_session.add(package)
        db_session.commit()

        # Sender rates courier
        rating1 = Rating(
            rater_id=sender.id,
            rated_user_id=courier.id,
            package_id=package.id,
            score=5,
            comment="Excellent courier!"
        )
        # Courier rates sender
        rating2 = Rating(
            rater_id=courier.id,
            rated_user_id=sender.id,
            package_id=package.id,
            score=4,
            comment="Good sender"
        )
        db_session.add_all([rating1, rating2])
        db_session.commit()

        auth_token = create_access_token(data={"sub": sender.email})

        return {
            "sender": sender,
            "courier": courier,
            "package": package,
            "auth_token": auth_token
        }

    def test_get_package_ratings(self, client, package_with_both_ratings):
        """Get all ratings for a package."""
        setup = package_with_both_ratings

        response = client.get(
            f"/api/ratings/package/{setup['package'].id}",
            headers={"Authorization": f"Bearer {setup['auth_token']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        # Verify both ratings are present
        scores = [r["score"] for r in data]
        assert 5 in scores
        assert 4 in scores


class TestGetMyPendingRatings:
    """Tests for GET /api/ratings/my-pending endpoint."""

    @pytest.fixture
    def user_with_pending_ratings(self, db_session):
        """Create a user with packages to rate."""
        sender = User(
            email="pendingsender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Pending Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        courier = User(
            email="pendingcourier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Pending Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add_all([sender, courier])
        db_session.commit()

        # Create two delivered packages
        packages = []
        for i in range(2):
            package = Package(
                sender_id=sender.id,
                courier_id=courier.id,
                description=f"Pending Package {i}",
                size="small",
                weight_kg=1.0,
                status=PackageStatus.DELIVERED,
                pickup_address="123 Main St",
                pickup_lat=40.7128,
                pickup_lng=-74.0060,
                dropoff_address="456 Oak Ave",
                dropoff_lat=40.7200,
                dropoff_lng=-74.0100
            )
            db_session.add(package)
            packages.append(package)
        db_session.commit()

        # Rate one package
        rating = Rating(
            rater_id=sender.id,
            rated_user_id=courier.id,
            package_id=packages[0].id,
            score=5
        )
        db_session.add(rating)
        db_session.commit()

        auth_token = create_access_token(data={"sub": sender.email})

        return {
            "sender": sender,
            "courier": courier,
            "packages": packages,
            "auth_token": auth_token
        }

    def test_get_pending_ratings(self, client, user_with_pending_ratings):
        """Get packages where user can rate."""
        setup = user_with_pending_ratings

        response = client.get(
            "/api/ratings/my-pending",
            headers={"Authorization": f"Bearer {setup['auth_token']}"}
        )

        assert response.status_code == 200
        data = response.json()
        # Should only have 1 pending (second package not rated)
        assert len(data) == 1
        assert data[0]["package_id"] == setup["packages"][1].id
        assert data[0]["user_to_rate_role"] == "courier"


class TestRatingCreatesNewRatingNotification:
    """Tests that rating creates NEW_RATING notification type."""

    @pytest.fixture
    def delivered_package_for_notification(self, db_session):
        """Create sender, courier, and delivered package for notification tests."""
        # Create sender
        sender = User(
            email="notif_sender@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Notification Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        # Create courier
        courier = User(
            email="notif_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Notification Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)
        db_session.commit()

        # Create delivered package
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package for notification",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Oak Ave",
            dropoff_lat=40.7200,
            dropoff_lng=-74.0100,
            price=25.00
        )
        db_session.add(package)
        db_session.commit()
        db_session.refresh(sender)
        db_session.refresh(courier)
        db_session.refresh(package)

        sender_token = create_access_token(data={"sub": sender.email})
        courier_token = create_access_token(data={"sub": courier.email})

        return {
            "sender": sender,
            "courier": courier,
            "package": package,
            "sender_token": sender_token,
            "courier_token": courier_token
        }

    def test_rating_creates_new_rating_notification_type(self, client, db_session, delivered_package_for_notification):
        """When sender rates courier, courier receives NEW_RATING notification."""
        from app.models.notification import Notification, NotificationType

        setup = delivered_package_for_notification

        response = client.post(
            "/api/ratings/",
            json={
                "package_id": setup["package"].id,
                "score": 5,
                "comment": "Great service!"
            },
            headers={"Authorization": f"Bearer {setup['sender_token']}"}
        )

        assert response.status_code == 201

        # Check notification was created with NEW_RATING type
        notification = db_session.query(Notification).filter(
            Notification.user_id == setup["courier"].id,
            Notification.type == NotificationType.NEW_RATING
        ).first()

        assert notification is not None
        assert "5-star rating" in notification.message
        assert notification.package_id is None  # Should not link to package

    def test_rating_notification_has_no_package_id(self, client, db_session, delivered_package_for_notification):
        """Rating notification should not have package_id (routes to reviews page)."""
        from app.models.notification import Notification, NotificationType

        setup = delivered_package_for_notification

        response = client.post(
            "/api/ratings/",
            json={
                "package_id": setup["package"].id,
                "score": 4
            },
            headers={"Authorization": f"Bearer {setup['courier_token']}"}
        )

        assert response.status_code == 201

        # Check notification was created without package_id
        notification = db_session.query(Notification).filter(
            Notification.user_id == setup["sender"].id,
            Notification.type == NotificationType.NEW_RATING
        ).first()

        assert notification is not None
        assert notification.package_id is None


class TestAverageRatingInAuthMe:
    """Tests for average_rating in /api/auth/me response."""

    @pytest.fixture
    def user_with_rating(self, db_session):
        """Create a user that has been rated."""
        # The rated user
        rated_user = User(
            email="rateduser@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Rated User",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        # The rater
        rater = User(
            email="rateruser@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Rater User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([rated_user, rater])
        db_session.commit()

        # Create delivered package
        package = Package(
            sender_id=rater.id,
            courier_id=rated_user.id,
            description="Test Package",
            size="small",
            weight_kg=1.0,
            status=PackageStatus.DELIVERED,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Oak Ave",
            dropoff_lat=40.7200,
            dropoff_lng=-74.0100
        )
        db_session.add(package)
        db_session.commit()

        # Create rating
        rating = Rating(
            rater_id=rater.id,
            rated_user_id=rated_user.id,
            package_id=package.id,
            score=4
        )
        db_session.add(rating)
        db_session.commit()

        rated_user_token = create_access_token(data={"sub": rated_user.email})

        return {"rated_user": rated_user, "token": rated_user_token}

    def test_auth_me_includes_average_rating(self, client, user_with_rating):
        """GET /api/auth/me should include average_rating."""
        setup = user_with_rating

        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {setup['token']}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "average_rating" in data
        assert "total_ratings" in data
        assert data["average_rating"] == 4.0
        assert data["total_ratings"] == 1

    def test_auth_me_no_ratings(self, client, authenticated_sender):
        """GET /api/auth/me with no ratings should return null average."""
        response = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "average_rating" in data
        assert "total_ratings" in data
        assert data["average_rating"] is None
        assert data["total_ratings"] == 0
