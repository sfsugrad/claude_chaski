"""
Tests for admin search functionality across users, packages, and routes.
"""

import pytest
from fastapi import status
from unittest.mock import patch, AsyncMock

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus, CourierRoute
from app.utils.auth import get_password_hash


# Mock Redis for JWT blacklist checks to avoid event loop issues
@pytest.fixture(autouse=True)
def mock_jwt_redis():
    """Mock Redis-dependent JWT functions to avoid event loop issues in tests"""
    with patch('app.services.jwt_blacklist.JWTBlacklistService.is_token_blacklisted', new_callable=AsyncMock) as mock_blacklist, \
         patch('app.services.jwt_blacklist.JWTBlacklistService.is_token_valid_for_user', new_callable=AsyncMock) as mock_valid:
        mock_blacklist.return_value = False
        mock_valid.return_value = True
        yield


class TestAdminUserSearch:
    """Tests for admin user search endpoint"""

    def test_search_users_by_first_name(self, client, db_session, authenticated_admin):
        """Test searching users by first name"""
        # Create users with distinct names
        user1 = User(
            email="john.doe@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="John",
            last_name="Doe",
            full_name="John Doe",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        user2 = User(
            email="jane.smith@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Jane",
            last_name="Smith",
            full_name="Jane Smith",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([user1, user2])
        db_session.commit()

        # Search for "John"
        response = client.get(
            "/api/admin/users?search=John",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["users"]]
        assert "john.doe@example.com" in emails
        assert "jane.smith@example.com" not in emails

    def test_search_users_by_last_name(self, client, db_session, authenticated_admin):
        """Test searching users by last name"""
        user1 = User(
            email="alice.johnson@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Alice",
            last_name="Johnson",
            full_name="Alice Johnson",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        user2 = User(
            email="bob.williams@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Bob",
            last_name="Williams",
            full_name="Bob Williams",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([user1, user2])
        db_session.commit()

        # Search for "Johnson"
        response = client.get(
            "/api/admin/users?search=Johnson",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["users"]]
        assert "alice.johnson@example.com" in emails
        assert "bob.williams@example.com" not in emails

    def test_search_users_by_email(self, client, db_session, authenticated_admin):
        """Test searching users by email address"""
        user1 = User(
            email="searchable.user@testdomain.com",
            hashed_password=get_password_hash("password123"),
            first_name="Test",
            last_name="User",
            full_name="Test User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        user2 = User(
            email="another.person@otherdomain.com",
            hashed_password=get_password_hash("password123"),
            first_name="Another",
            last_name="Person",
            full_name="Another Person",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([user1, user2])
        db_session.commit()

        # Search for "testdomain"
        response = client.get(
            "/api/admin/users?search=testdomain",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["users"]]
        assert "searchable.user@testdomain.com" in emails
        assert "another.person@otherdomain.com" not in emails

    def test_search_users_case_insensitive(self, client, db_session, authenticated_admin):
        """Test that search is case insensitive"""
        user = User(
            email="casesearch@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="CaSeSeNsItIvE",
            last_name="Test",
            full_name="CaSeSeNsItIvE Test",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(user)
        db_session.commit()

        # Search with different case
        response = client.get(
            "/api/admin/users?search=casesensitive",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["users"]]
        assert "casesearch@example.com" in emails

    def test_search_users_partial_match(self, client, db_session, authenticated_admin):
        """Test that search works with partial matches"""
        user = User(
            email="partialmatch@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Alexander",
            last_name="Hamilton",
            full_name="Alexander Hamilton",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(user)
        db_session.commit()

        # Search with partial name
        response = client.get(
            "/api/admin/users?search=Alex",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["users"]]
        assert "partialmatch@example.com" in emails

    def test_search_users_no_results(self, client, authenticated_admin):
        """Test search with no matching results"""
        response = client.get(
            "/api/admin/users?search=nonexistentuserxyz123",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0
        assert data["users"] == []

    def test_search_users_with_filters(self, client, db_session, authenticated_admin):
        """Test search combined with role filter"""
        user1 = User(
            email="mike.sender@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Mike",
            last_name="Sender",
            full_name="Mike Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        user2 = User(
            email="mike.courier@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Mike",
            last_name="Courier",
            full_name="Mike Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([user1, user2])
        db_session.commit()

        # Search for "Mike" with role filter
        response = client.get(
            "/api/admin/users?search=Mike&role=sender",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        emails = [u["email"] for u in data["users"]]
        assert "mike.sender@example.com" in emails
        assert "mike.courier@example.com" not in emails

    def test_search_users_with_pagination(self, client, db_session, authenticated_admin):
        """Test search with pagination"""
        # Create multiple users with similar names
        for i in range(5):
            user = User(
                email=f"searchpage{i}@example.com",
                hashed_password=get_password_hash("password123"),
                first_name="SearchPage",
                last_name=f"User{i}",
                full_name=f"SearchPage User{i}",
                role=UserRole.SENDER,
                is_active=True,
                is_verified=True,
                max_deviation_km=5
            )
            db_session.add(user)
        db_session.commit()

        # Search with limit
        response = client.get(
            "/api/admin/users?search=SearchPage&limit=2",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 5
        assert len(data["users"]) == 2
        assert data["limit"] == 2


class TestAdminPackageSearch:
    """Tests for admin package search endpoint"""

    def test_search_packages_by_tracking_id(self, client, db_session, authenticated_admin):
        """Test searching packages by tracking ID"""
        # Create a sender
        sender = User(
            email="pkg.sender@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Package",
            last_name="Sender",
            full_name="Package Sender",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        # Create packages with distinct tracking IDs
        pkg1 = Package(
            tracking_id="PKG-SEARCH-001",
            sender_id=sender.id,
            description="Test package 1",
            size="medium",
            weight_kg=2.0,
            pickup_address="123 Pickup St",
            pickup_lat=34.0522,
            pickup_lng=-118.2437,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=34.0622,
            dropoff_lng=-118.2537,
            status=PackageStatus.NEW
        )
        pkg2 = Package(
            tracking_id="PKG-OTHER-002",
            sender_id=sender.id,
            description="Test package 2",
            size="small",
            weight_kg=1.0,
            pickup_address="789 Another St",
            pickup_lat=34.0722,
            pickup_lng=-118.2637,
            dropoff_address="012 Different Ave",
            dropoff_lat=34.0822,
            dropoff_lng=-118.2737,
            status=PackageStatus.NEW
        )
        db_session.add_all([pkg1, pkg2])
        db_session.commit()

        # Search for tracking ID
        response = client.get(
            "/api/admin/packages?search=PKG-SEARCH",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        tracking_ids = [p["tracking_id"] for p in data["packages"]]
        assert "PKG-SEARCH-001" in tracking_ids
        assert "PKG-OTHER-002" not in tracking_ids

    def test_search_packages_by_sender_first_name(self, client, db_session, authenticated_admin):
        """Test searching packages by sender's first name"""
        # Create senders
        sender1 = User(
            email="jennifer.sender@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Jennifer",
            last_name="Lopez",
            full_name="Jennifer Lopez",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        sender2 = User(
            email="michael.sender@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Michael",
            last_name="Jordan",
            full_name="Michael Jordan",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([sender1, sender2])
        db_session.commit()

        # Create packages
        pkg1 = Package(
            tracking_id="PKG-JEN-001",
            sender_id=sender1.id,
            description="Jennifer's package",
            size="medium",
            weight_kg=2.0,
            pickup_address="123 Pickup St",
            pickup_lat=34.0522,
            pickup_lng=-118.2437,
            dropoff_address="456 Dropoff Ave",
            dropoff_lat=34.0622,
            dropoff_lng=-118.2537,
            status=PackageStatus.NEW
        )
        pkg2 = Package(
            tracking_id="PKG-MIC-002",
            sender_id=sender2.id,
            description="Michael's package",
            size="small",
            weight_kg=1.0,
            pickup_address="789 Another St",
            pickup_lat=34.0722,
            pickup_lng=-118.2637,
            dropoff_address="012 Different Ave",
            dropoff_lat=34.0822,
            dropoff_lng=-118.2737,
            status=PackageStatus.NEW
        )
        db_session.add_all([pkg1, pkg2])
        db_session.commit()

        # Search by sender name
        response = client.get(
            "/api/admin/packages?search=Jennifer",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        tracking_ids = [p["tracking_id"] for p in data["packages"]]
        assert "PKG-JEN-001" in tracking_ids
        assert "PKG-MIC-002" not in tracking_ids

    def test_search_packages_by_sender_last_name(self, client, db_session, authenticated_admin):
        """Test searching packages by sender's last name"""
        sender = User(
            email="steve.wozniak@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Steve",
            last_name="Wozniak",
            full_name="Steve Wozniak",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        pkg = Package(
            tracking_id="PKG-WOZ-001",
            sender_id=sender.id,
            description="Wozniak's package",
            size="large",
            weight_kg=5.0,
            pickup_address="123 Apple St",
            pickup_lat=37.3861,
            pickup_lng=-122.0839,
            dropoff_address="456 Tech Ave",
            dropoff_lat=37.3961,
            dropoff_lng=-122.0939,
            status=PackageStatus.NEW
        )
        db_session.add(pkg)
        db_session.commit()

        # Search by last name
        response = client.get(
            "/api/admin/packages?search=Wozniak",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        tracking_ids = [p["tracking_id"] for p in data["packages"]]
        assert "PKG-WOZ-001" in tracking_ids

    def test_search_packages_case_insensitive(self, client, db_session, authenticated_admin):
        """Test that package search is case insensitive"""
        sender = User(
            email="case.test@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="CaseTest",
            last_name="User",
            full_name="CaseTest User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        pkg = Package(
            tracking_id="PKG-CASETEST-001",
            sender_id=sender.id,
            description="Case test package",
            size="medium",
            weight_kg=2.0,
            pickup_address="123 Test St",
            pickup_lat=34.0522,
            pickup_lng=-118.2437,
            dropoff_address="456 Test Ave",
            dropoff_lat=34.0622,
            dropoff_lng=-118.2537,
            status=PackageStatus.NEW
        )
        db_session.add(pkg)
        db_session.commit()

        # Search with different case
        response = client.get(
            "/api/admin/packages?search=pkg-casetest",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        tracking_ids = [p["tracking_id"] for p in data["packages"]]
        assert "PKG-CASETEST-001" in tracking_ids

    def test_search_packages_no_results(self, client, authenticated_admin):
        """Test package search with no matching results"""
        response = client.get(
            "/api/admin/packages?search=nonexistentpackagexyz123",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0
        assert data["packages"] == []

    def test_search_packages_with_status_filter(self, client, db_session, authenticated_admin):
        """Test package search combined with status filter"""
        sender = User(
            email="filter.test@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="FilterTest",
            last_name="User",
            full_name="FilterTest User",
            role=UserRole.SENDER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(sender)
        db_session.commit()

        pkg1 = Package(
            tracking_id="PKG-FILTER-NEW",
            sender_id=sender.id,
            description="New package",
            size="medium",
            weight_kg=2.0,
            pickup_address="123 Test St",
            pickup_lat=34.0522,
            pickup_lng=-118.2437,
            dropoff_address="456 Test Ave",
            dropoff_lat=34.0622,
            dropoff_lng=-118.2537,
            status=PackageStatus.NEW
        )
        pkg2 = Package(
            tracking_id="PKG-FILTER-DELIVERED",
            sender_id=sender.id,
            description="Delivered package",
            size="small",
            weight_kg=1.0,
            pickup_address="789 Test St",
            pickup_lat=34.0722,
            pickup_lng=-118.2637,
            dropoff_address="012 Test Ave",
            dropoff_lat=34.0822,
            dropoff_lng=-118.2737,
            status=PackageStatus.DELIVERED
        )
        db_session.add_all([pkg1, pkg2])
        db_session.commit()

        # Search with status filter
        response = client.get(
            "/api/admin/packages?search=FilterTest&status=new",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        tracking_ids = [p["tracking_id"] for p in data["packages"]]
        assert "PKG-FILTER-NEW" in tracking_ids
        assert "PKG-FILTER-DELIVERED" not in tracking_ids


class TestAdminRouteSearch:
    """Tests for admin route search endpoint"""

    def test_search_routes_by_courier_first_name(self, client, db_session, authenticated_admin):
        """Test searching routes by courier's first name"""
        # Create couriers
        courier1 = User(
            email="david.courier@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="David",
            last_name="Miller",
            full_name="David Miller",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        courier2 = User(
            email="sarah.courier@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Sarah",
            last_name="Connor",
            full_name="Sarah Connor",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add_all([courier1, courier2])
        db_session.commit()

        # Create routes
        route1 = CourierRoute(
            courier_id=courier1.id,
            start_address="LA",
            start_lat=34.0522,
            start_lng=-118.2437,
            end_address="SF",
            end_lat=37.7749,
            end_lng=-122.4194,
            max_deviation_km=10,
            is_active=True
        )
        route2 = CourierRoute(
            courier_id=courier2.id,
            start_address="NYC",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="Boston",
            end_lat=42.3601,
            end_lng=-71.0589,
            max_deviation_km=15,
            is_active=True
        )
        db_session.add_all([route1, route2])
        db_session.commit()

        # Search by courier name
        response = client.get(
            "/api/admin/routes?search=David",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        courier_emails = [r["courier_email"] for r in data["routes"]]
        assert "david.courier@example.com" in courier_emails
        assert "sarah.courier@example.com" not in courier_emails

    def test_search_routes_by_courier_last_name(self, client, db_session, authenticated_admin):
        """Test searching routes by courier's last name"""
        courier = User(
            email="tom.anderson@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="Tom",
            last_name="Anderson",
            full_name="Tom Anderson",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Seattle",
            start_lat=47.6062,
            start_lng=-122.3321,
            end_address="Portland",
            end_lat=45.5051,
            end_lng=-122.6750,
            max_deviation_km=20,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        # Search by last name
        response = client.get(
            "/api/admin/routes?search=Anderson",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        courier_emails = [r["courier_email"] for r in data["routes"]]
        assert "tom.anderson@example.com" in courier_emails

    def test_search_routes_by_courier_email(self, client, db_session, authenticated_admin):
        """Test searching routes by courier's email"""
        courier = User(
            email="unique.emailsearch@testroute.com",
            hashed_password=get_password_hash("password123"),
            first_name="Unique",
            last_name="Email",
            full_name="Unique Email",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Denver",
            start_lat=39.7392,
            start_lng=-104.9903,
            end_address="Salt Lake City",
            end_lat=40.7608,
            end_lng=-111.8910,
            max_deviation_km=25,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        # Search by email
        response = client.get(
            "/api/admin/routes?search=testroute.com",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        courier_emails = [r["courier_email"] for r in data["routes"]]
        assert "unique.emailsearch@testroute.com" in courier_emails

    def test_search_routes_case_insensitive(self, client, db_session, authenticated_admin):
        """Test that route search is case insensitive"""
        courier = User(
            email="caseroutesearch@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="CaSeRoUtE",
            last_name="Search",
            full_name="CaSeRoUtE Search",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        route = CourierRoute(
            courier_id=courier.id,
            start_address="Chicago",
            start_lat=41.8781,
            start_lng=-87.6298,
            end_address="Detroit",
            end_lat=42.3314,
            end_lng=-83.0458,
            max_deviation_km=30,
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        # Search with different case
        response = client.get(
            "/api/admin/routes?search=caseroute",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 1
        courier_emails = [r["courier_email"] for r in data["routes"]]
        assert "caseroutesearch@example.com" in courier_emails

    def test_search_routes_no_results(self, client, authenticated_admin):
        """Test route search with no matching results"""
        response = client.get(
            "/api/admin/routes?search=nonexistentcourierxyz123",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] == 0
        assert data["routes"] == []

    def test_search_routes_with_active_filter(self, client, db_session, authenticated_admin):
        """Test route search combined with active filter"""
        courier = User(
            email="active.filter@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="ActiveFilter",
            last_name="Test",
            full_name="ActiveFilter Test",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        route1 = CourierRoute(
            courier_id=courier.id,
            start_address="Active Route Start",
            start_lat=34.0522,
            start_lng=-118.2437,
            end_address="Active Route End",
            end_lat=34.0622,
            end_lng=-118.2537,
            max_deviation_km=10,
            is_active=True
        )
        route2 = CourierRoute(
            courier_id=courier.id,
            start_address="Inactive Route Start",
            start_lat=35.0522,
            start_lng=-119.2437,
            end_address="Inactive Route End",
            end_lat=35.0622,
            end_lng=-119.2537,
            max_deviation_km=15,
            is_active=False
        )
        db_session.add_all([route1, route2])
        db_session.commit()

        # Search with active_only filter
        response = client.get(
            "/api/admin/routes?search=ActiveFilter&active_only=true",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Should find only active routes for this courier
        for route in data["routes"]:
            if route["courier_email"] == "active.filter@example.com":
                assert route["is_active"] is True

    def test_search_routes_with_pagination(self, client, db_session, authenticated_admin):
        """Test route search with pagination"""
        courier = User(
            email="pagination.courier@example.com",
            hashed_password=get_password_hash("password123"),
            first_name="PaginationTest",
            last_name="Courier",
            full_name="PaginationTest Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        # Create multiple routes
        for i in range(5):
            route = CourierRoute(
                courier_id=courier.id,
                start_address=f"Start {i}",
                start_lat=34.0522 + i * 0.1,
                start_lng=-118.2437,
                end_address=f"End {i}",
                end_lat=34.0622 + i * 0.1,
                end_lng=-118.2537,
                max_deviation_km=10,
                is_active=True
            )
            db_session.add(route)
        db_session.commit()

        # Search with limit
        response = client.get(
            "/api/admin/routes?search=PaginationTest&limit=2",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["total"] >= 5
        assert len(data["routes"]) == 2
        assert data["limit"] == 2


class TestAdminSearchAuthorization:
    """Tests for search endpoint authorization"""

    def test_users_search_requires_admin(self, client, authenticated_sender):
        """Test that user search requires admin role"""
        response = client.get(
            "/api/admin/users?search=test",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_packages_search_requires_admin(self, client, authenticated_sender):
        """Test that package search requires admin role"""
        response = client.get(
            "/api/admin/packages?search=test",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_routes_search_requires_admin(self, client, authenticated_sender):
        """Test that route search requires admin role"""
        response = client.get(
            "/api/admin/routes?search=test",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_search_requires_authentication(self, client):
        """Test that search requires authentication"""
        response = client.get("/api/admin/users?search=test")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        response = client.get("/api/admin/packages?search=test")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        response = client.get("/api/admin/routes?search=test")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
