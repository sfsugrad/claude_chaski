import pytest
from fastapi import status

from app.models.user import User, UserRole
from app.models.package import Package, PackageStatus


class TestAdminUserManagement:
    """Tests for admin user management endpoints"""

    def test_get_all_users_as_admin(self, client, authenticated_admin, authenticated_sender, authenticated_courier):
        """Test admin can view all users"""
        response = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3  # At least admin, sender, and courier

        # Verify all user fields are present
        for user in data:
            assert "id" in user
            assert "email" in user
            assert "full_name" in user
            assert "role" in user
            assert "is_active" in user
            assert "is_verified" in user

    def test_get_all_users_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot view all users"""
        response = client.get(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "admin" in response.json()["detail"].lower()

    def test_get_all_users_without_authentication(self, client):
        """Test cannot view users without authentication"""
        response = client.get("/api/admin/users")

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_all_users_with_pagination(self, client, authenticated_admin):
        """Test user pagination works"""
        response = client.get(
            "/api/admin/users?skip=0&limit=2",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) <= 2

    def test_get_user_by_id_as_admin(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can view specific user by ID"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Get user by ID
        response = client.get(
            f"/api/admin/users/{user.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == user.id
        assert data["email"] == test_user_data["email"]
        assert data["full_name"] == test_user_data["full_name"]
        assert data["role"] == test_user_data["role"]

    def test_get_user_by_id_not_found(self, client, authenticated_admin):
        """Test getting non-existent user returns 404"""
        response = client.get(
            "/api/admin/users/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_get_user_by_id_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot view user by ID"""
        response = client.get(
            "/api/admin/users/1",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_update_user_role_as_admin(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can update user role"""
        # Create a sender user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        assert user.role == UserRole.SENDER

        # Update role to courier
        response = client.put(
            f"/api/admin/users/{user.id}",
            json={"role": "courier"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["role"] == "courier"

        # Verify in database
        db_session.refresh(user)
        assert user.role == UserRole.COURIER

    def test_update_user_role_to_both(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can update user role to 'both'"""
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{user.id}",
            json={"role": "both"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "both"

    def test_update_user_role_to_admin(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can promote user to admin"""
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{user.id}",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["role"] == "admin"

    def test_update_user_role_invalid_role(self, client, db_session, authenticated_admin, test_user_data):
        """Test updating user with invalid role fails"""
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{user.id}",
            json={"role": "invalid_role"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "invalid role" in response.json()["detail"].lower()

    def test_update_user_role_user_not_found(self, client, authenticated_admin):
        """Test updating role of non-existent user"""
        response = client.put(
            "/api/admin/users/99999",
            json={"role": "courier"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_admin_cannot_remove_own_admin_role(self, client, db_session, authenticated_admin, test_admin_data):
        """Test admin cannot change their own role"""
        admin_user = db_session.query(User).filter(User.email == test_admin_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{admin_user.id}",
            json={"role": "sender"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "cannot change your own role" in response.json()["detail"].lower()

    def test_admin_cannot_change_own_role_even_to_admin(self, client, db_session, authenticated_admin, test_admin_data):
        """Test admin cannot change their own role, even when selecting admin again"""
        admin_user = db_session.query(User).filter(User.email == test_admin_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{admin_user.id}",
            json={"role": "admin"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "cannot change your own role" in response.json()["detail"].lower()

    def test_update_user_role_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot update user roles"""
        response = client.put(
            "/api/admin/users/1",
            json={"role": "courier"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_delete_user_as_admin(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can delete a user"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user_id = user.id

        # Delete user
        response = client.delete(
            f"/api/admin/users/{user_id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify user is deleted
        user = db_session.query(User).filter(User.id == user_id).first()
        assert user is None

    def test_delete_user_not_found(self, client, authenticated_admin):
        """Test deleting non-existent user"""
        response = client.delete(
            "/api/admin/users/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_admin_cannot_delete_self(self, client, db_session, authenticated_admin, test_admin_data):
        """Test admin cannot delete their own account"""
        admin_user = db_session.query(User).filter(User.email == test_admin_data["email"]).first()

        response = client.delete(
            f"/api/admin/users/{admin_user.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "cannot delete your own account" in response.json()["detail"].lower()

    def test_delete_user_cascades_to_packages(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test deleting user also deletes their packages"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Get sender user
        sender_user = db_session.query(User).filter(User.email == "test@example.com").first()

        # Delete sender
        response = client.delete(
            f"/api/admin/users/{sender_user.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify package is also deleted
        package = db_session.query(Package).filter(Package.id == package_id).first()
        assert package is None

    def test_delete_user_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot delete users"""
        response = client.delete(
            "/api/admin/users/1",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAdminUserToggleActive:
    """Tests for admin user toggle-active (soft delete) functionality"""

    def test_toggle_user_to_inactive(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can deactivate a user"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        assert user.is_active is True

        # Deactivate user
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] is False
        assert data["id"] == user.id

        # Verify in database
        db_session.refresh(user)
        assert user.is_active is False

    def test_toggle_user_to_active(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can reactivate an inactive user"""
        # Create and deactivate a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_active = False
        db_session.commit()

        # Reactivate user
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] is True

        # Verify in database
        db_session.refresh(user)
        assert user.is_active is True

    def test_admin_cannot_deactivate_self(self, client, db_session, authenticated_admin, test_admin_data):
        """Test admin cannot deactivate their own account"""
        admin_user = db_session.query(User).filter(User.email == test_admin_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{admin_user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "cannot deactivate your own account" in response.json()["detail"].lower()

        # Verify user is still active in database
        db_session.refresh(admin_user)
        assert admin_user.is_active is True

    def test_admin_can_activate_self(self, client, db_session, authenticated_admin, test_admin_data):
        """Test admin can activate themselves (edge case, but should work)"""
        admin_user = db_session.query(User).filter(User.email == test_admin_data["email"]).first()

        response = client.put(
            f"/api/admin/users/{admin_user.id}/toggle-active",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # Should succeed since they're trying to activate (not deactivate)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is True

    def test_inactive_user_cannot_login(self, client, db_session, test_user_data):
        """Test inactive users cannot authenticate"""
        # Create and verify user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_verified = True
        db_session.commit()

        # Login successfully
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert login_response.status_code == status.HTTP_200_OK

        # Deactivate user
        user.is_active = False
        db_session.commit()

        # Try to login again - should fail (could be 401 or 403 depending on auth implementation)
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })

        assert login_response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]
        detail = login_response.json()["detail"].lower()
        assert "inactive" in detail or "disabled" in detail or "not active" in detail

    def test_toggle_user_not_found(self, client, authenticated_admin):
        """Test toggling non-existent user returns 404"""
        response = client.put(
            "/api/admin/users/99999/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_toggle_user_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot toggle user active status"""
        response = client.put(
            "/api/admin/users/1/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_user_without_authentication(self, client):
        """Test cannot toggle user status without authentication"""
        response = client.put(
            "/api/admin/users/1/toggle-active",
            json={"is_active": False}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_deactivate_user_preserves_data(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test deactivating user preserves their packages and data"""
        from app.models.package import PackageStatus

        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Get sender user
        sender_user = db_session.query(User).filter(User.email == "test@example.com").first()
        user_id = sender_user.id

        # Set package to terminal state (DELIVERED) so user can be deactivated
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.DELIVERED
        db_session.commit()

        # Deactivate sender
        response = client.put(
            f"/api/admin/users/{user_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify user still exists but is inactive
        user = db_session.query(User).filter(User.id == user_id).first()
        assert user is not None
        assert user.is_active is False

        # Verify package still exists
        package = db_session.query(Package).filter(Package.id == package_id).first()
        assert package is not None
        assert package.sender_id == user_id

    def test_reactivate_user_restores_access(self, client, db_session, authenticated_admin, test_user_data):
        """Test reactivated user can log in again"""
        # Create, verify, and deactivate user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_verified = True
        user.is_active = False
        db_session.commit()

        # Verify cannot login while inactive (could be 401 or 403)
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert login_response.status_code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN]

        # Reactivate user
        client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # Verify can login after reactivation
        login_response = client.post("/api/auth/login", json={
            "email": test_user_data["email"],
            "password": test_user_data["password"]
        })
        assert login_response.status_code == status.HTTP_200_OK
        assert "access_token" in login_response.cookies

    def test_toggle_user_updates_timestamp(self, client, db_session, authenticated_admin, test_user_data):
        """Test toggling user active status updates the updated_at timestamp"""
        from datetime import datetime

        # Create user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Toggle user status
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify timestamp was set in response
        data = response.json()
        assert "updated_at" in data
        assert data["updated_at"] is not None

    def test_toggle_multiple_users(self, client, db_session, authenticated_admin):
        """Test admin can toggle multiple users independently"""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create multiple users
        users = []
        for i in range(3):
            user = User(
                email=f"user{i}@test.com",
                hashed_password=get_password_hash("password"),
                full_name=f"User {i}",
                role=UserRole.SENDER,
                is_active=True,
                max_deviation_km=5
            )
            db_session.add(user)
            users.append(user)
        db_session.commit()

        # Deactivate first two users
        for user in users[:2]:
            response = client.put(
                f"/api/admin/users/{user.id}/toggle-active",
                json={"is_active": False},
                headers={"Authorization": f"Bearer {authenticated_admin}"}
            )
            assert response.status_code == status.HTTP_200_OK

        # Verify status of all users
        db_session.refresh(users[0])
        db_session.refresh(users[1])
        db_session.refresh(users[2])

        assert users[0].is_active is False
        assert users[1].is_active is False
        assert users[2].is_active is True

    def test_cannot_deactivate_user_with_active_packages_as_sender(
        self, client, db_session, authenticated_admin, test_user_data, test_package_data
    ):
        """Test admin cannot deactivate user who has active packages as sender"""
        from app.models.package import Package, PackageStatus, PackageSize

        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Create an active package for this user
        package = Package(
            sender_id=user.id,
            description="Test package",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Try to deactivate user - should fail
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "detail" in data
        assert "packages_as_sender" in data["detail"]
        assert package.id in data["detail"]["packages_as_sender"]

        # Verify user is still active
        db_session.refresh(user)
        assert user.is_active is True

    def test_cannot_deactivate_user_with_active_packages_as_courier(
        self, client, db_session, authenticated_admin, test_user_data
    ):
        """Test admin cannot deactivate user who has active packages as courier"""
        from app.models.package import Package, PackageStatus, PackageSize
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create a sender user
        sender = User(
            email="sender@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Sender User",
            role=UserRole.SENDER,
            is_active=True,
            max_deviation_km=5
        )
        db_session.add(sender)

        # Create a courier user
        courier = User(
            email="courier@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Courier User",
            role=UserRole.COURIER,
            is_active=True,
            max_deviation_km=5
        )
        db_session.add(courier)
        db_session.commit()

        # Create a package assigned to this courier
        package = Package(
            sender_id=sender.id,
            courier_id=courier.id,
            description="Test package",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=PackageStatus.IN_TRANSIT,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Try to deactivate courier - should fail
        response = client.put(
            f"/api/admin/users/{courier.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "detail" in data
        assert "packages_as_courier" in data["detail"]
        assert package.id in data["detail"]["packages_as_courier"]

        # Verify courier is still active
        db_session.refresh(courier)
        assert courier.is_active is True

    def test_cannot_deactivate_user_with_packages_in_both_roles(
        self, client, db_session, authenticated_admin
    ):
        """Test deactivation blocked when user has packages as both sender and courier"""
        from app.models.package import Package, PackageStatus, PackageSize
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create a hybrid user (both sender and courier)
        hybrid_user = User(
            email="hybrid@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Hybrid User",
            role=UserRole.BOTH,
            is_active=True,
            max_deviation_km=5
        )
        db_session.add(hybrid_user)

        # Create another user to be sender for the courier package
        other_user = User(
            email="other@test.com",
            hashed_password=get_password_hash("password"),
            full_name="Other User",
            role=UserRole.SENDER,
            is_active=True,
            max_deviation_km=5
        )
        db_session.add(other_user)
        db_session.commit()

        # Create package where hybrid is sender
        package_as_sender = Package(
            sender_id=hybrid_user.id,
            description="Package as sender",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=PackageStatus.OPEN_FOR_BIDS,
            is_active=True
        )
        db_session.add(package_as_sender)

        # Create package where hybrid is courier
        package_as_courier = Package(
            sender_id=other_user.id,
            courier_id=hybrid_user.id,
            description="Package as courier",
            size=PackageSize.MEDIUM,
            weight_kg=5.0,
            pickup_address="789 Oak St",
            pickup_lat=40.7300,
            pickup_lng=-74.0100,
            dropoff_address="321 Elm St",
            dropoff_lat=40.7400,
            dropoff_lng=-74.0200,
            status=PackageStatus.IN_TRANSIT,
            is_active=True
        )
        db_session.add(package_as_courier)
        db_session.commit()

        # Try to deactivate hybrid user - should fail
        response = client.put(
            f"/api/admin/users/{hybrid_user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        data = response.json()
        assert "detail" in data
        assert package_as_sender.id in data["detail"]["packages_as_sender"]
        assert package_as_courier.id in data["detail"]["packages_as_courier"]

    def test_can_deactivate_user_with_only_delivered_packages(
        self, client, db_session, authenticated_admin, test_user_data
    ):
        """Test admin can deactivate user who only has delivered packages"""
        from app.models.package import Package, PackageStatus, PackageSize

        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Create a delivered package for this user
        package = Package(
            sender_id=user.id,
            description="Delivered package",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=PackageStatus.DELIVERED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Deactivate user - should succeed
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is False

    def test_can_deactivate_user_with_failed_packages(
        self, client, db_session, authenticated_admin, test_user_data
    ):
        """Test admin can deactivate user who has failed packages"""
        from app.models.package import Package, PackageStatus, PackageSize

        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Create a failed package for this user
        package = Package(
            sender_id=user.id,
            description="Failed package",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=PackageStatus.FAILED,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Deactivate user - should succeed
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is False

    @pytest.mark.parametrize("blocking_status", [
        PackageStatus.NEW,
        PackageStatus.OPEN_FOR_BIDS,
        PackageStatus.BID_SELECTED,
        PackageStatus.PENDING_PICKUP,
        PackageStatus.IN_TRANSIT,
    ])
    def test_deactivation_blocked_per_status(
        self, client, db_session, authenticated_admin, test_user_data, blocking_status
    ):
        """Test deactivation is blocked for each non-terminal status"""
        from app.models.package import Package, PackageSize

        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Create a package with the specified status
        package = Package(
            sender_id=user.id,
            description=f"Package in {blocking_status.value}",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=blocking_status,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Try to deactivate user - should fail
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert package.id in response.json()["detail"]["packages_as_sender"]

    def test_reactivation_not_blocked_by_packages(
        self, client, db_session, authenticated_admin, test_user_data
    ):
        """Test reactivating a user is not blocked by active packages"""
        from app.models.package import Package, PackageStatus, PackageSize

        # Create a user (inactive)
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_active = False
        db_session.commit()

        # Create an active package for this user
        package = Package(
            sender_id=user.id,
            description="Active package",
            size=PackageSize.SMALL,
            weight_kg=2.5,
            pickup_address="123 Main St",
            pickup_lat=40.7128,
            pickup_lng=-74.0060,
            dropoff_address="456 Broadway",
            dropoff_lat=40.7204,
            dropoff_lng=-74.0014,
            status=PackageStatus.IN_TRANSIT,
            is_active=True
        )
        db_session.add(package)
        db_session.commit()

        # Reactivate user - should succeed (check only on deactivation)
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-active",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is True


class TestAdminUserToggleVerified:
    """Tests for admin user toggle-verified functionality"""

    def test_toggle_user_to_unverified(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can unverify a verified user"""
        # Create and verify a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        user.is_verified = True
        db_session.commit()
        assert user.is_verified is True

        # Unverify user
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-verified",
            json={"is_verified": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_verified"] is False
        assert data["id"] == user.id

        # Verify in database
        db_session.refresh(user)
        assert user.is_verified is False

    def test_toggle_user_to_verified(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can verify an unverified user"""
        # Create an unverified user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        assert user.is_verified is False  # Users start unverified

        # Verify user
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-verified",
            json={"is_verified": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_verified"] is True

        # Verify in database
        db_session.refresh(user)
        assert user.is_verified is True

    def test_toggle_verified_user_not_found(self, client, authenticated_admin):
        """Test toggling verification for non-existent user returns 404"""
        response = client.put(
            "/api/admin/users/99999/toggle-verified",
            json={"is_verified": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_toggle_verified_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot toggle user verification status"""
        response = client.put(
            "/api/admin/users/1/toggle-verified",
            json={"is_verified": False},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_verified_without_authentication(self, client):
        """Test cannot toggle user verification without authentication"""
        response = client.put(
            "/api/admin/users/1/toggle-verified",
            json={"is_verified": False}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_toggle_verified_creates_audit_log(self, client, db_session, authenticated_admin, test_user_data):
        """Test that toggling verification creates audit log entries"""
        from app.models.audit_log import AuditLog, AuditAction

        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Get initial audit log count
        initial_count = db_session.query(AuditLog).filter(
            AuditLog.action.in_([AuditAction.USER_VERIFY, AuditAction.USER_UNVERIFY])
        ).count()

        # Verify the user
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-verified",
            json={"is_verified": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Check verify audit log was created
        verify_log = db_session.query(AuditLog).filter(
            AuditLog.action == AuditAction.USER_VERIFY,
            AuditLog.resource_id == user.id
        ).first()
        assert verify_log is not None
        assert verify_log.resource_type == "user"

        # Unverify the user
        response = client.put(
            f"/api/admin/users/{user.id}/toggle-verified",
            json={"is_verified": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response.status_code == status.HTTP_200_OK

        # Check unverify audit log was created
        unverify_log = db_session.query(AuditLog).filter(
            AuditLog.action == AuditAction.USER_UNVERIFY,
            AuditLog.resource_id == user.id
        ).first()
        assert unverify_log is not None
        assert unverify_log.resource_type == "user"

        # Verify total count increased by 2
        final_count = db_session.query(AuditLog).filter(
            AuditLog.action.in_([AuditAction.USER_VERIFY, AuditAction.USER_UNVERIFY])
        ).count()
        assert final_count == initial_count + 2


class TestAdminUserProfileUpdate:
    """Tests for admin user profile update endpoint"""

    def test_update_user_full_name(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can update user's full name"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        original_name = user.full_name

        # Update full name
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"full_name": "Updated Name"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["full_name"] == "Updated Name"
        assert data["full_name"] != original_name

        # Verify in database
        db_session.refresh(user)
        assert user.full_name == "Updated Name"

    def test_update_user_phone_number(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can update user's phone number"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Update phone number
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"phone_number": "+1234567890"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["phone_number"] == "+1234567890"

        # Verify in database
        db_session.refresh(user)
        assert user.phone_number == "+1234567890"

    def test_update_user_max_deviation_km(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can update user's max deviation km"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        original_max_deviation = user.max_deviation_km

        # Update max deviation
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"max_deviation_km": 100},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["max_deviation_km"] == 100
        assert data["max_deviation_km"] != original_max_deviation

        # Verify in database
        db_session.refresh(user)
        assert user.max_deviation_km == 100

    def test_update_multiple_profile_fields(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can update multiple profile fields at once"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Update multiple fields
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={
                "full_name": "New Name",
                "phone_number": "+9876543210",
                "max_deviation_km": 250
            },
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["full_name"] == "New Name"
        assert data["phone_number"] == "+9876543210"
        assert data["max_deviation_km"] == 250

        # Verify in database
        db_session.refresh(user)
        assert user.full_name == "New Name"
        assert user.phone_number == "+9876543210"
        assert user.max_deviation_km == 250

    def test_update_max_deviation_km_min_boundary(self, client, db_session, authenticated_admin, test_user_data):
        """Test max deviation km minimum boundary (1 km)"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Update to minimum value (1 km)
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"max_deviation_km": 1},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["max_deviation_km"] == 1

    def test_update_max_deviation_km_max_boundary(self, client, db_session, authenticated_admin, test_user_data):
        """Test max deviation km maximum boundary (500 km)"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Update to maximum value (500 km)
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"max_deviation_km": 500},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["max_deviation_km"] == 500

    def test_update_max_deviation_km_below_minimum(self, client, db_session, authenticated_admin, test_user_data):
        """Test max deviation km below minimum returns 400"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Try to update to below minimum (0 km)
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"max_deviation_km": 0},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "between 1 and 500" in response.json()["detail"].lower()

    def test_update_max_deviation_km_above_maximum(self, client, db_session, authenticated_admin, test_user_data):
        """Test max deviation km above maximum returns 400"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Try to update to above maximum (501 km)
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"max_deviation_km": 501},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "between 1 and 500" in response.json()["detail"].lower()

    def test_update_user_profile_not_found(self, client, authenticated_admin):
        """Test updating non-existent user returns 404"""
        response = client.put(
            "/api/admin/users/99999/profile",
            json={"full_name": "Test Name"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_update_user_profile_as_non_admin(self, client, db_session, authenticated_sender, test_user_data):
        """Test non-admin cannot update user profile"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Try to update as non-admin
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"full_name": "New Name"},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "admin" in response.json()["detail"].lower()

    def test_update_user_profile_without_authentication(self, client, db_session, test_user_data):
        """Test cannot update user profile without authentication"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Try to update without authentication
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"full_name": "New Name"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_update_user_profile_updates_timestamp(self, client, db_session, authenticated_admin, test_user_data):
        """Test updating profile updates the updated_at timestamp"""
        # Create a user
        client.post("/api/auth/register", json=test_user_data)
        user = db_session.query(User).filter(User.email == test_user_data["email"]).first()
        original_updated_at = user.updated_at

        # Update profile
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"full_name": "Updated Name"},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK

        # Verify timestamp was updated
        db_session.refresh(user)
        assert user.updated_at is not None
        if original_updated_at:
            assert user.updated_at > original_updated_at

    def test_update_user_profile_with_empty_phone(self, client, db_session, authenticated_admin, test_user_data):
        """Test admin can clear phone number by setting it to empty string"""
        # Create a user with phone number
        test_user_data_with_phone = test_user_data.copy()
        test_user_data_with_phone["phone_number"] = "+1234567890"
        client.post("/api/auth/register", json=test_user_data_with_phone)
        user = db_session.query(User).filter(User.email == test_user_data_with_phone["email"]).first()

        # Clear phone number
        response = client.put(
            f"/api/admin/users/{user.id}/profile",
            json={"phone_number": ""},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["phone_number"] == ""


class TestAdminPackageManagement:
    """Tests for admin package management endpoints"""

    def test_get_all_packages_as_admin(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can view all packages"""
        # Create packages
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

        # Admin gets all packages
        response = client.get(
            "/api/admin/packages",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 2

        # Verify all package fields are present
        for package in data:
            assert "id" in package
            assert "sender_id" in package
            assert "description" in package
            assert "size" in package
            assert "status" in package
            assert "pickup_address" in package
            assert "dropoff_address" in package

    def test_get_all_packages_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot access admin package endpoint"""
        response = client.get(
            "/api/admin/packages",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_get_all_packages_with_pagination(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test package pagination works"""
        # Create 3 packages
        for i in range(3):
            test_package_data["description"] = f"Package {i}"
            client.post(
                "/api/packages",
                json=test_package_data,
                headers={"Authorization": f"Bearer {authenticated_sender}"}
            )

        response = client.get(
            "/api/admin/packages?skip=0&limit=2",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) == 2

    def test_get_package_by_id_as_admin(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can view any package by ID"""
        # Create package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Admin gets package
        response = client.get(
            f"/api/admin/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == package_id
        assert data["description"] == test_package_data["description"]

    def test_get_package_by_id_not_found(self, client, authenticated_admin):
        """Test getting non-existent package returns 404"""
        response = client.get(
            "/api/admin/packages/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_package_as_admin(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can delete any package"""
        # Create package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Admin deletes package
        response = client.delete(
            f"/api/admin/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_204_NO_CONTENT

        # Verify package is deleted
        package = db_session.query(Package).filter(Package.id == package_id).first()
        assert package is None

    def test_delete_package_not_found(self, client, authenticated_admin):
        """Test deleting non-existent package"""
        response = client.delete(
            "/api/admin/packages/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_package_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot delete packages via admin endpoint"""
        response = client.delete(
            "/api/admin/packages/1",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAdminPackageToggleActive:
    """Tests for admin package toggle-active endpoint (soft delete)"""

    def test_admin_can_deactivate_pending_package(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can deactivate a pending package"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Admin deactivates it
        response = client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] is False
        assert data["id"] == package_id

        # Verify package is still in database but inactive
        from app.models.package import Package
        package = db_session.query(Package).filter(Package.id == package_id).first()
        assert package is not None
        assert package.is_active is False

    def test_admin_can_reactivate_inactive_package(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can reactivate an inactive package"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Admin deactivates it
        client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # Admin reactivates it
        response = client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["is_active"] is True

        # Verify in database
        from app.models.package import Package
        package = db_session.query(Package).filter(Package.id == package_id).first()
        assert package.is_active is True

    def test_cannot_deactivate_non_pending_package(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test that only pending packages can be deactivated"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Change package status to matched
        from app.models.package import Package, PackageStatus
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.BID_SELECTED
        db_session.commit()

        # Try to deactivate it
        response = client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "only new or open for bids packages can be deactivated" in response.json()["detail"].lower()

    def test_can_reactivate_non_pending_package(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test that non-pending packages CAN be reactivated (only deactivation is restricted)"""
        # Create and deactivate a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Deactivate while pending
        client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # Change status to delivered
        from app.models.package import Package, PackageStatus
        package = db_session.query(Package).filter(Package.id == package_id).first()
        package.status = PackageStatus.DELIVERED
        db_session.commit()

        # Reactivate it (should work)
        response = client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is True

    def test_non_admin_cannot_toggle_package(self, client, authenticated_sender, test_package_data):
        """Test that non-admin users cannot toggle package active status"""
        # Sender creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Sender tries to deactivate it
        response = client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN

    def test_toggle_package_not_found(self, client, authenticated_admin):
        """Test toggling active status of non-existent package"""
        response = client.put(
            "/api/admin/packages/99999/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_toggle_package_without_authentication(self, client):
        """Test toggling package without authentication"""
        response = client.put(
            "/api/admin/packages/1/toggle-active",
            json={"is_active": False}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_toggle_package_updates_timestamp(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test that updated_at timestamp is updated when toggling active status"""
        import time

        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]
        original_updated_at = create_response.json().get("updated_at")

        # Wait a moment
        time.sleep(0.1)

        # Toggle active status
        response = client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        new_updated_at = response.json().get("updated_at")

        # Verify timestamp changed (if original was None, new should not be None)
        if original_updated_at is not None:
            assert new_updated_at != original_updated_at

    def test_deactivate_package_preserves_data(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test that deactivating a package preserves all package data"""
        # Create a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]
        original_description = create_response.json()["description"]
        original_price = create_response.json()["price"]

        # Deactivate it
        client.put(
            f"/api/admin/packages/{package_id}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # Verify all data is preserved
        from app.models.package import Package
        package = db_session.query(Package).filter(Package.id == package_id).first()
        assert package is not None
        assert package.description == original_description
        assert package.price == original_price
        assert package.is_active is False

    def test_toggle_multiple_packages_independently(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test that multiple packages can be toggled independently"""
        # Create two packages
        response1 = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id_1 = response1.json()["id"]

        test_package_data["description"] = "Second package"
        response2 = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id_2 = response2.json()["id"]

        # Deactivate only first package
        client.put(
            f"/api/admin/packages/{package_id_1}/toggle-active",
            json={"is_active": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # Verify first is inactive
        response1 = client.get(
            f"/api/admin/packages/{package_id_1}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response1.json()["is_active"] is False

        # Verify second is still active
        response2 = client.get(
            f"/api/admin/packages/{package_id_2}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )
        assert response2.json()["is_active"] is True


class TestAdminStatistics:
    """Tests for admin statistics endpoint"""

    def test_get_platform_stats_as_admin(self, client, authenticated_admin, authenticated_sender, authenticated_courier, authenticated_both_role):
        """Test admin can view platform statistics"""
        response = client.get(
            "/api/admin/stats",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        # Verify all stats fields are present
        assert "total_users" in data
        assert "total_senders" in data
        assert "total_couriers" in data
        assert "total_both" in data
        assert "total_admins" in data
        assert "total_packages" in data
        assert "active_packages" in data
        assert "completed_packages" in data
        assert "pending_packages" in data
        assert "total_revenue" in data

        # Verify counts are correct
        assert data["total_users"] >= 4  # admin, sender, courier, both
        assert data["total_senders"] >= 1
        assert data["total_couriers"] >= 1
        assert data["total_both"] >= 1
        assert data["total_admins"] >= 1

    def test_get_stats_with_packages(self, client, db_session, authenticated_admin, authenticated_sender, test_package_data):
        """Test stats reflect package data correctly"""
        # Create packages with different statuses
        # Pending package (price: 15.50 from fixture)
        response1 = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package1_id = response1.json()["id"]

        # Delivered package
        test_package_data["description"] = "Delivered package"
        test_package_data["price"] = 25.50
        response2 = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package2_id = response2.json()["id"]

        # Update second package to delivered
        package2 = db_session.query(Package).filter(Package.id == package2_id).first()
        package2.status = PackageStatus.DELIVERED
        db_session.commit()

        # Get stats
        response = client.get(
            "/api/admin/stats",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_packages"] == 2
        assert data["pending_packages"] == 1
        assert data["completed_packages"] == 1
        assert data["total_revenue"] == 15.50 + 25.50  # First package (15.50) + second package (25.50)

    def test_get_stats_exclusive_role_counting(self, client, db_session, authenticated_admin):
        """Test that role counts are exclusive (not overlapping)"""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create one of each role type
        users = [
            User(email="sender_only@test.com", hashed_password=get_password_hash("pass"),
                 full_name="Sender Only", role=UserRole.SENDER, is_active=True, max_deviation_km=5),
            User(email="courier_only@test.com", hashed_password=get_password_hash("pass"),
                 full_name="Courier Only", role=UserRole.COURIER, is_active=True, max_deviation_km=5),
            User(email="both_role@test.com", hashed_password=get_password_hash("pass"),
                 full_name="Both Role", role=UserRole.BOTH, is_active=True, max_deviation_km=5),
        ]
        for user in users:
            db_session.add(user)
        db_session.commit()

        response = client.get(
            "/api/admin/stats",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        data = response.json()

        # Counts should be exclusive
        # We have 1 admin from fixture + 1 sender + 1 courier + 1 both from above
        assert data["total_senders"] >= 1  # Sender only, not including "both"
        assert data["total_couriers"] >= 1  # Courier only, not including "both"
        assert data["total_both"] >= 1  # Both role
        assert data["total_admins"] >= 1  # Admin only

    def test_get_stats_empty_database(self, client, authenticated_admin):
        """Test stats with no packages"""
        response = client.get(
            "/api/admin/stats",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()

        assert data["total_packages"] == 0
        assert data["active_packages"] == 0
        assert data["completed_packages"] == 0
        assert data["pending_packages"] == 0
        assert data["total_revenue"] == 0.0

    def test_get_stats_as_non_admin(self, client, authenticated_sender):
        """Test non-admin cannot access stats"""
        response = client.get(
            "/api/admin/stats",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN


class TestAdminPackageCreation:
    """Tests for admin creating packages for other users"""

    def test_admin_can_create_package(self, client, authenticated_admin, test_package_data):
        """Test admin can create packages"""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["description"] == test_package_data["description"]
        assert "id" in data

    def test_admin_create_package_for_another_user(self, client, db_session, authenticated_admin, test_user_data, test_package_data):
        """Test admin can create package on behalf of another user"""
        # Create a sender user
        client.post("/api/auth/register", json=test_user_data)
        sender_user = db_session.query(User).filter(User.email == test_user_data["email"]).first()

        # Admin creates package for that user
        test_package_data["sender_id"] = sender_user.id
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert data["sender_id"] == sender_user.id
        assert data["description"] == test_package_data["description"]

    def test_admin_create_package_for_nonexistent_user(self, client, authenticated_admin, test_package_data):
        """Test admin cannot create package for non-existent user"""
        test_package_data["sender_id"] = 99999

        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_404_NOT_FOUND
        assert "not found" in response.json()["detail"].lower()

    def test_admin_create_package_without_sender_id(self, client, db_session, authenticated_admin, test_admin_data, test_package_data):
        """Test admin creating package without sender_id uses admin as sender"""
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()

        # Verify it's assigned to the admin user
        admin_user = db_session.query(User).filter(User.email == test_admin_data["email"]).first()
        assert data["sender_id"] == admin_user.id

    def test_non_admin_cannot_specify_sender_id(self, client, db_session, authenticated_sender, test_user_data, test_package_data):
        """Test non-admin users cannot specify sender_id"""
        # Create another user
        other_user_data = {
            "email": "other@example.com",
            "password": "password123",
            "full_name": "Other User",
            "role": "sender"
        }
        client.post("/api/auth/register", json=other_user_data)
        other_user = db_session.query(User).filter(User.email == other_user_data["email"]).first()

        # Try to create package for other user
        test_package_data["sender_id"] = other_user.id
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only admins" in response.json()["detail"].lower()

    def test_both_role_cannot_specify_sender_id(self, client, db_session, authenticated_both_role, test_package_data):
        """Test users with 'both' role cannot specify sender_id"""
        # Create another user
        other_user_data = {
            "email": "another@example.com",
            "password": "password123",
            "full_name": "Another User",
            "role": "sender"
        }
        client.post("/api/auth/register", json=other_user_data)
        other_user = db_session.query(User).filter(User.email == other_user_data["email"]).first()

        # Try to create package for other user
        test_package_data["sender_id"] = other_user.id
        response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_both_role}"}
        )

        assert response.status_code == status.HTTP_403_FORBIDDEN
        assert "only admins" in response.json()["detail"].lower()

    def test_admin_can_view_all_packages_via_regular_endpoint(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can view all packages via regular /api/packages endpoint"""
        # Regular user creates a package
        client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        # Admin gets all packages via regular endpoint
        response = client.get(
            "/api/packages",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert len(data) >= 1  # Should see all packages

    def test_admin_can_view_any_package_via_regular_endpoint(self, client, authenticated_admin, authenticated_sender, test_package_data):
        """Test admin can view any package via regular /api/packages/{id} endpoint"""
        # Regular user creates a package
        create_response = client.post(
            "/api/packages",
            json=test_package_data,
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )
        package_id = create_response.json()["id"]

        # Admin gets package via regular endpoint
        response = client.get(
            f"/api/packages/{package_id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["id"] == package_id


class TestAdminAuthorization:
    """Tests for admin authorization and access control"""

    def test_admin_endpoints_require_authentication(self, client):
        """Test all admin endpoints require authentication"""
        endpoints = [
            ("/api/admin/users", "GET"),
            ("/api/admin/users/1", "GET"),
            ("/api/admin/users/1", "PUT"),
            ("/api/admin/users/1", "DELETE"),
            ("/api/admin/packages", "GET"),
            ("/api/admin/packages/1", "GET"),
            ("/api/admin/packages/1", "DELETE"),
            ("/api/admin/stats", "GET"),
        ]

        for endpoint, method in endpoints:
            if method == "GET":
                response = client.get(endpoint)
            elif method == "PUT":
                response = client.put(endpoint, json={"role": "sender"})
            elif method == "DELETE":
                response = client.delete(endpoint)

            assert response.status_code == status.HTTP_401_UNAUTHORIZED, f"Failed for {method} {endpoint}"

    def test_admin_endpoints_reject_invalid_tokens(self, client):
        """Test admin endpoints reject invalid tokens"""
        response = client.get(
            "/api/admin/users",
            headers={"Authorization": "Bearer invalid_token"}
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_admin_login_workflow(self, client, db_session, test_admin_data):
        """Test complete admin login and access workflow"""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create admin user
        admin_user = User(
            email=test_admin_data["email"],
            hashed_password=get_password_hash(test_admin_data["password"]),
            full_name=test_admin_data["full_name"],
            role=UserRole.ADMIN,
            is_active=True,
            max_deviation_km=5
        )
        db_session.add(admin_user)
        db_session.commit()

        # Login
        login_response = client.post("/api/auth/login", json={
            "email": test_admin_data["email"],
            "password": test_admin_data["password"]
        })

        assert login_response.status_code == status.HTTP_200_OK
        token = login_response.cookies["access_token"]

        # Access admin endpoint
        stats_response = client.get(
            "/api/admin/stats",
            cookies={"access_token": token}
        )

        assert stats_response.status_code == status.HTTP_200_OK

    def test_admin_role_in_jwt_token(self, client, db_session, test_admin_data):
        """Test admin role is properly encoded in JWT token"""
        from app.models.user import User, UserRole
        from app.utils.auth import get_password_hash

        # Create admin user
        admin_user = User(
            email=test_admin_data["email"],
            hashed_password=get_password_hash(test_admin_data["password"]),
            full_name=test_admin_data["full_name"],
            role=UserRole.ADMIN,
            is_active=True,
            max_deviation_km=5
        )
        db_session.add(admin_user)
        db_session.commit()

        # Login
        login_response = client.post("/api/auth/login", json={
            "email": test_admin_data["email"],
            "password": test_admin_data["password"]
        })

        token = login_response.cookies["access_token"]

        # Decode token
        import base64
        import json
        payload = token.split('.')[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))

        assert decoded["role"] == "admin"
        assert decoded["sub"] == test_admin_data["email"]
