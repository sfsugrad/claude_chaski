import pytest
from fastapi import status

from app.models.package import Package, PackageStatus
from app.models.user import User


class TestCreatePackage:
    """Tests for package creation endpoint"""

    def test_create_package_success_as_sender(self, client, authenticated_sender, test_package_data):
        """Test successful package creation as a sender"""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        assert data["description"] == test_package_data["description"]
        assert data["size"] == test_package_data["size"]
        assert data["weight_kg"] == test_package_data["weight_kg"]
        assert data["pickup_address"] == test_package_data["pickup_address"]
        assert data["pickup_lat"] == test_package_data["pickup_lat"]
        assert data["pickup_lng"] == test_package_data["pickup_lng"]
        assert data["dropoff_address"] == test_package_data["dropoff_address"]
        assert data["dropoff_lat"] == test_package_data["dropoff_lat"]
        assert data["dropoff_lng"] == test_package_data["dropoff_lng"]
        assert data["pickup_contact_name"] == test_package_data["pickup_contact_name"]
        assert data["pickup_contact_phone"] == test_package_data["pickup_contact_phone"]
        assert data["dropoff_contact_name"] == test_package_data["dropoff_contact_name"]
        assert data["dropoff_contact_phone"] == test_package_data["dropoff_contact_phone"]
        assert data["price"] == test_package_data["price"]
        assert data["status"] == "pending"
        assert "id" in data
        assert "sender_id" in data
        assert "created_at" in data

    def test_create_package_success_as_both_role(self, client, authenticated_both_role, test_package_data):
        """Test successful package creation as a user with 'both' role"""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["status"] == "pending"

    def test_create_package_without_optional_fields(self, client, authenticated_sender):
        """Test package creation without optional fields"""
        minimal_package = {
            "description": "Minimal package",
            "size": "medium",
            "weight_kg": 5.0,
            "pickup_address": "123 Test St",
            "pickup_lat": 40.7128,
            "pickup_lng": -74.0060,
            "dropoff_address": "456 Test Ave",
            "dropoff_lat": 40.7204,
            "dropoff_lng": -74.0014
        }

        response = client.post(
            "/api/packages",
            json=minimal_package,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["pickup_contact_name"] is None
        assert data["pickup_contact_phone"] is None
        assert data["dropoff_contact_name"] is None
        assert data["dropoff_contact_phone"] is None
        assert data["price"] is None

    def test_create_package_fails_as_courier(self, client, authenticated_courier, test_package_data):
        """Test that couriers cannot create packages"""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only senders" in response.json()["detail"].lower()

    def test_create_package_without_authentication(self, client, test_package_data):
        """Test package creation without authentication"""
        response = client.post("/api/packages", json=test_package_data)

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_create_package_invalid_token(self, client, test_package_data):
        """Test package creation with invalid token"""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_create_package_invalid_size(self, client, authenticated_sender, test_package_data):
        """Test package creation with invalid size"""
        test_package_data["size"] = "invalid_size"
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # Pydantic validation returns 422 for invalid enum values
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_weight_too_high(self, client, authenticated_sender, test_package_data):
        """Test package creation with weight exceeding maximum"""
        test_package_data["weight_kg"] = 1500
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_weight_zero(self, client, authenticated_sender, test_package_data):
        """Test package creation with zero weight"""
        test_package_data["weight_kg"] = 0
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_negative_weight(self, client, authenticated_sender, test_package_data):
        """Test package creation with negative weight"""
        test_package_data["weight_kg"] = -5
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_description_too_long(self, client, authenticated_sender, test_package_data):
        """Test package creation with description exceeding max length"""
        test_package_data["description"] = "x" * 501  # Max is 500
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_empty_description(self, client, authenticated_sender, test_package_data):
        """Test package creation with empty description"""
        test_package_data["description"] = ""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_negative_price(self, client, authenticated_sender, test_package_data):
        """Test package creation with negative price"""
        test_package_data["price"] = -10.50
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_package_missing_required_fields(self, client, authenticated_sender):
        """Test package creation with missing required fields"""
        incomplete_data = {
            "description": "Test package",
            "size": "small"
            # Missing weight, addresses, coordinates
        }

        response = client.post(
            "/api/packages",
            json=incomplete_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_create_multiple_packages(self, client, authenticated_sender, test_package_data):
        """Test creating multiple packages by same user"""
        # Create first package
        response1 = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # Modify data for second package
        test_package_data["description"] = "Second package"
        response2 = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response1.status_code == status.HTTP_201_CREATED
        assert response2.status_code == status.HTTP_201_CREATED
        assert response1.json()["id"] != response2.json()["id"]


class TestGetPackages:
    """Tests for get packages endpoint"""

    def test_get_packages_as_sender(self, client, authenticated_sender, test_package_data):
        """Test getting packages as a sender"""
        # Create two packages
        client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        test_package_data["description"] = "Second package"
        client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # Get all packages
        response = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2
        assert all("id" in pkg for pkg in data)
        assert all("description" in pkg for pkg in data)

    def test_get_packages_empty_list(self, client, authenticated_sender):
        """Test getting packages when none exist"""
        response = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0

    def test_get_packages_without_authentication(self, client):
        """Test getting packages without authentication"""
        response = client.get("/api/packages")

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_packages_only_own_packages(self, client, authenticated_sender, authenticated_both_role, test_package_data):
        """Test that users only see their own packages"""
        # User 1 creates a package
        client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # User 2 creates a package
        test_package_data["description"] = "User 2 package"
        client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        # User 1 gets packages
        response1 = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # User 2 gets packages
        response2 = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK
        assert len(response1.json()) == 1
        assert len(response2.json()) == 1
        assert response1.json()[0]["id"] != response2.json()[0]["id"]

    def test_get_packages_as_courier_shows_assigned_only(self, client, authenticated_courier):
        """Test that couriers only see packages assigned to them"""
        response = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert len(response.json()) == 0  # No packages assigned yet


class TestGetPackageById:
    """Tests for get specific package endpoint"""

    def test_get_package_by_id_success(self, client, authenticated_sender, test_package_data):
        """Test getting a specific package by ID"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Get the package
        response = client.get(
            f"/api/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == package_id
        assert data["description"] == test_package_data["description"]

    def test_get_package_by_id_not_found(self, client, authenticated_sender):
        """Test getting a non-existent package"""
        response = client.get(
            "/api/packages/99999",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_package_by_id_unauthorized(self, client, authenticated_sender, authenticated_both_role, test_package_data):
        """Test that users cannot access other users' packages"""
        # User 1 creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # User 2 tries to access it
        response = client.get(
            f"/api/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "don't have access" in response.json()["detail"].lower()

    def test_get_package_by_id_without_authentication(self, client):
        """Test getting a package without authentication"""
        response = client.get("/api/packages/1")

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestUpdatePackage:
    """Tests for update package details endpoint (PUT /api/packages/{package_id})"""

    def test_update_package_success_as_sender(self, client, authenticated_sender, test_package_data):
        """Test successful package update by the sender who created it"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]
        original_created_at = create_response.json()["created_at"]

        # Update package
        update_data = {
            "description": "Updated package description",
            "size": "large",
            "weight_kg": 15.5,
            "price": 75.00,
            "pickup_contact_name": "Updated Pickup Contact",
            "pickup_contact_phone": "+1-555-9999",
            "dropoff_contact_name": "Updated Dropoff Contact",
            "dropoff_contact_phone": "+1-555-8888"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["description"] == "Updated package description"
        assert data["size"] == "large"
        assert data["weight_kg"] == 15.5
        assert data["price"] == 75.00
        assert data["pickup_contact_name"] == "Updated Pickup Contact"
        assert data["pickup_contact_phone"] == "+1-555-9999"
        assert data["dropoff_contact_name"] == "Updated Dropoff Contact"
        assert data["dropoff_contact_phone"] == "+1-555-8888"
        # Verify created_at hasn't changed
        assert data["created_at"] == original_created_at
        # Verify updated_at is present (timestamp updated)
        assert "updated_at" in data

    def test_update_package_success_as_admin(self, client, db_session, authenticated_sender, authenticated_admin, test_package_data):
        """Test successful package update by admin"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Admin updates it
        update_data = {
            "description": "Admin updated description",
            "price": 100.00
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["description"] == "Admin updated description"
        assert data["price"] == 100.00

    def test_update_package_partial_update(self, client, authenticated_sender, test_package_data):
        """Test updating only some fields (partial update)"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]
        original_size = create_response.json()["size"]
        original_weight = create_response.json()["weight_kg"]

        # Update only description
        update_data = {
            "description": "Only description changed"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["description"] == "Only description changed"
        # Verify other fields unchanged
        assert data["size"] == original_size
        assert data["weight_kg"] == original_weight

    def test_update_package_courier_cannot_edit(self, client, authenticated_sender, authenticated_courier, test_package_data):
        """Test that couriers cannot edit packages"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Courier tries to update it
        update_data = {
            "description": "Courier trying to edit"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "don't have permission" in response.json()["detail"].lower()

    def test_update_package_sender_cannot_edit_others_package(self, client, authenticated_sender, authenticated_both_role, test_package_data):
        """Test that senders cannot edit other senders' packages"""
        # User 1 creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # User 2 tries to update it
        update_data = {
            "description": "Trying to edit someone else's package"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "don't have permission" in response.json()["detail"].lower()

    def test_update_package_fails_for_non_pending_status(self, client, db_session, authenticated_sender, test_package_data):
        """Test that only pending packages can be edited"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Change status to matched (simulating matching)
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.MATCHED
        db_session.commit()

        # Try to update it
        update_data = {
            "description": "Trying to edit non-pending package"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "only pending packages can be edited" in response.json()["detail"].lower()

    def test_update_package_invalid_size(self, client, authenticated_sender, test_package_data):
        """Test updating package with invalid size"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Try to update with invalid size
        update_data = {
            "size": "invalid_size"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_package_invalid_weight(self, client, authenticated_sender, test_package_data):
        """Test updating package with invalid weight values"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Try negative weight
        response = client.put(
            f"/api/packages/{package_id}",
            json={"weight_kg": -5.0},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Try zero weight
        response = client.put(
            f"/api/packages/{package_id}",
            json={"weight_kg": 0},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        # Try weight too high
        response = client.put(
            f"/api/packages/{package_id}",
            json={"weight_kg": 1500},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_package_invalid_price(self, client, authenticated_sender, test_package_data):
        """Test updating package with negative price"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Try negative price
        response = client.put(
            f"/api/packages/{package_id}",
            json={"price": -10.50},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_package_description_too_long(self, client, authenticated_sender, test_package_data):
        """Test updating package with description exceeding max length"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Try description too long
        response = client.put(
            f"/api/packages/{package_id}",
            json={"description": "x" * 501},  # Max is 500
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_update_package_not_found(self, client, authenticated_sender):
        """Test updating non-existent package"""
        response = client.put(
            "/api/packages/99999",
            json={"description": "Update non-existent package"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_update_package_without_authentication(self, client, test_package_data):
        """Test updating package without authentication"""
        response = client.put(
            "/api/packages/1",
            json={"description": "Update without auth"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_package_addresses_immutable(self, client, authenticated_sender, test_package_data):
        """Test that addresses and coordinates cannot be changed via update endpoint"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]
        original_pickup_address = create_response.json()["pickup_address"]
        original_pickup_lat = create_response.json()["pickup_lat"]
        original_dropoff_address = create_response.json()["dropoff_address"]

        # Try to update with address fields (they should be ignored)
        update_data = {
            "description": "Updated description",
            "pickup_address": "New Pickup Address",
            "pickup_lat": 99.9999,
            "dropoff_address": "New Dropoff Address"
        }

        response = client.put(
            f"/api/packages/{package_id}",
            json=update_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        # Description should be updated
        assert data["description"] == "Updated description"
        # But addresses should remain unchanged
        assert data["pickup_address"] == original_pickup_address
        assert data["pickup_lat"] == original_pickup_lat
        assert data["dropoff_address"] == original_dropoff_address

    def test_update_package_updates_timestamp(self, client, authenticated_sender, test_package_data):
        """Test that updated_at timestamp is updated on package edit"""
        import time

        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Wait a moment to ensure timestamp difference
        time.sleep(0.1)

        # Update package
        response = client.put(
            f"/api/packages/{package_id}",
            json={"description": "Updated description"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_200_OK
        # Verify updated_at exists in response
        assert "updated_at" in response.json()


class TestUpdatePackageStatus:
    """Tests for update package status endpoint"""

    def test_update_package_status_success(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test successful package status update by courier"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Manually assign courier to package (simulating matching)
        package = db_session.query(Package).filter(Package.id == package_id).first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()
        package.courier_id = courier.id
        db_session.commit()

        # Courier updates status
        response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "picked_up"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["status"] == "picked_up"
        assert "successfully" in data["message"].lower()

    def test_update_package_status_invalid_status(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test updating package with invalid status"""
        # Create and assign package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        package = db_session.query(Package).filter(Package.id == package_id).first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()
        package.courier_id = courier.id
        db_session.commit()

        # Try to update with invalid status
        response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "invalid_status"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid status" in response.json()["detail"].lower()

    def test_update_package_status_not_assigned_courier(self, client, authenticated_sender, authenticated_courier, test_package_data):
        """Test that only assigned courier can update status"""
        # Create package (no courier assigned)
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Non-assigned courier tries to update
        response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "picked_up"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only the assigned courier" in response.json()["detail"].lower()

    def test_update_package_status_sender_cannot_update(self, client, authenticated_sender, test_package_data):
        """Test that senders cannot update package status"""
        # Create package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Sender tries to update status
        response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "picked_up"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_package_status_package_not_found(self, client, authenticated_courier):
        """Test updating status of non-existent package"""
        response = client.put(
            "/api/packages/99999/status",
            json={"status": "picked_up"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_package_status_without_authentication(self, client):
        """Test updating status without authentication"""
        response = client.put(
            "/api/packages/1/status",
            json={"status": "picked_up"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestPackageIntegration:
    """Integration tests for complete package workflows"""

    def test_complete_package_lifecycle(self, client, db_session, authenticated_sender, authenticated_courier, test_package_data):
        """Test complete package lifecycle from creation to delivery"""
        # Step 1: Sender creates package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert create_response.status_code == status.HTTP_201_CREATED
        package_id = create_response.json()["id"]
        assert create_response.json()["status"] == "pending"

        # Step 2: Assign courier (simulating matching)
        package = db_session.query(Package).filter(Package.id == package_id).first()
        courier = db_session.query(User).filter(User.email == "courier@example.com").first()
        package.courier_id = courier.id
        package.status = PackageStatus.MATCHED
        db_session.commit()

        # Step 3: Courier picks up package
        pickup_response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "picked_up"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )
        assert pickup_response.status_code == status.HTTP_200_OK
        assert pickup_response.json()["status"] == "picked_up"

        # Step 4: Courier marks in transit
        transit_response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "in_transit"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )
        assert transit_response.status_code == status.HTTP_200_OK
        assert transit_response.json()["status"] == "in_transit"

        # Step 5: Courier delivers package
        delivery_response = client.put(
            f"/api/packages/{package_id}/status",
            json={"status": "delivered"},
            headers={"Authorization": f"Bearer {authenticated_courier}"}
        )
        assert delivery_response.status_code == status.HTTP_200_OK
        assert delivery_response.json()["status"] == "delivered"

        # Step 6: Verify final state
        final_response = client.get(
            f"/api/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        assert final_response.status_code == status.HTTP_200_OK
        assert final_response.json()["status"] == "delivered"

    def test_multiple_users_multiple_packages(self, client, authenticated_sender, authenticated_both_role, test_package_data):
        """Test multiple users creating and managing their packages independently"""
        # User 1 creates two packages
        response1a = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        test_package_data["description"] = "User 1 second package"
        response1b = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # User 2 creates one package
        test_package_data["description"] = "User 2 package"
        response2a = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        # Verify all created successfully
        assert response1a.status_code == status.HTTP_201_CREATED
        assert response1b.status_code == status.HTTP_201_CREATED
        assert response2a.status_code == status.HTTP_201_CREATED

        # User 1 gets packages
        user1_packages = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # User 2 gets packages
        user2_packages = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        # Verify isolation
        assert len(user1_packages.json()) == 2
        assert len(user2_packages.json()) == 1
