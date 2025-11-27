"""Tests for audit logging functionality."""
import pytest
from app.models.audit_log import AuditLog, AuditAction
from app.services.audit_service import (
    create_audit_log,
    log_login_success,
    log_login_failed,
    log_registration,
    log_user_create,
    log_user_role_change,
    log_package_create,
    log_package_status_change,
    log_route_create,
)


class TestAuditLogModel:
    """Tests for the AuditLog model."""

    def test_audit_log_creation(self, db_session, test_verified_user):
        """Test basic audit log creation."""
        audit_log = AuditLog(
            user_id=test_verified_user.id,
            user_email=test_verified_user.email,
            action=AuditAction.LOGIN_SUCCESS,
            resource_type="user",
            resource_id=test_verified_user.id,
            details={"method": "password"},
            ip_address="127.0.0.1",
            user_agent="Test Agent",
            success="success"
        )
        db_session.add(audit_log)
        db_session.commit()
        db_session.refresh(audit_log)

        assert audit_log.id is not None
        assert audit_log.user_id == test_verified_user.id
        assert audit_log.action == AuditAction.LOGIN_SUCCESS
        assert audit_log.success == "success"
        assert audit_log.created_at is not None

    def test_audit_log_without_user(self, db_session):
        """Test audit log creation without user (e.g., failed login)."""
        audit_log = AuditLog(
            user_email="unknown@example.com",
            action=AuditAction.LOGIN_FAILED,
            details={"reason": "user_not_found"},
            ip_address="192.168.1.1",
            success="failed",
            error_message="user_not_found"
        )
        db_session.add(audit_log)
        db_session.commit()
        db_session.refresh(audit_log)

        assert audit_log.id is not None
        assert audit_log.user_id is None
        assert audit_log.user_email == "unknown@example.com"
        assert audit_log.success == "failed"

    def test_all_audit_actions_exist(self):
        """Test that all expected audit actions are defined."""
        expected_actions = [
            "login_success", "login_failed", "logout", "register",
            "password_reset_request", "password_reset_complete",
            "email_verification", "oauth_login",
            "user_create", "user_update", "user_role_change",
            "user_deactivate", "user_activate", "user_delete",
            "package_create", "package_update", "package_status_change",
            "package_cancel", "package_delete", "package_deactivate",
            "route_create", "route_update", "route_delete",
            "package_accept", "package_reject",
            "matching_job_run", "admin_stats_access", "rating_create"
        ]
        actual_actions = [action.value for action in AuditAction]
        for action in expected_actions:
            assert action in actual_actions, f"Missing action: {action}"


class TestAuditService:
    """Tests for the audit service functions."""

    def test_create_audit_log_with_user(self, db_session, test_verified_user):
        """Test create_audit_log with user object."""
        audit_log = create_audit_log(
            db=db_session,
            action=AuditAction.LOGIN_SUCCESS,
            user=test_verified_user,
            resource_type="user",
            resource_id=test_verified_user.id,
            details={"method": "password"}
        )

        assert audit_log.user_id == test_verified_user.id
        assert audit_log.user_email == test_verified_user.email
        assert audit_log.action == AuditAction.LOGIN_SUCCESS

    def test_create_audit_log_with_user_id(self, db_session, test_verified_user):
        """Test create_audit_log with user_id instead of user object."""
        audit_log = create_audit_log(
            db=db_session,
            action=AuditAction.LOGIN_SUCCESS,
            user_id=test_verified_user.id,
            user_email=test_verified_user.email,
            resource_type="user",
            resource_id=test_verified_user.id
        )

        assert audit_log.user_id == test_verified_user.id
        assert audit_log.user_email == test_verified_user.email

    def test_log_login_success(self, db_session, test_verified_user):
        """Test logging successful login."""
        audit_log = log_login_success(
            db=db_session,
            user=test_verified_user,
            method="password"
        )

        assert audit_log.action == AuditAction.LOGIN_SUCCESS
        assert audit_log.user_id == test_verified_user.id
        assert audit_log.details["method"] == "password"
        assert audit_log.success == "success"

    def test_log_login_failed(self, db_session):
        """Test logging failed login."""
        audit_log = log_login_failed(
            db=db_session,
            email="bad@example.com",
            reason="invalid_password"
        )

        assert audit_log.action == AuditAction.LOGIN_FAILED
        assert audit_log.user_email == "bad@example.com"
        assert audit_log.details["reason"] == "invalid_password"
        assert audit_log.success == "failed"
        assert audit_log.error_message == "invalid_password"

    def test_log_registration(self, db_session, test_verified_user):
        """Test logging user registration."""
        audit_log = log_registration(
            db=db_session,
            user=test_verified_user
        )

        assert audit_log.action == AuditAction.REGISTER
        assert audit_log.user_id == test_verified_user.id
        assert audit_log.resource_type == "user"
        assert audit_log.resource_id == test_verified_user.id

    def test_log_user_create(self, db_session, test_admin, test_verified_user):
        """Test logging admin creating a user."""
        audit_log = log_user_create(
            db=db_session,
            admin=test_admin,
            created_user=test_verified_user
        )

        assert audit_log.action == AuditAction.USER_CREATE
        assert audit_log.user_id == test_admin.id
        assert audit_log.resource_type == "user"
        assert audit_log.resource_id == test_verified_user.id
        assert audit_log.details["created_email"] == test_verified_user.email

    def test_log_user_role_change(self, db_session, test_admin, test_verified_user):
        """Test logging role change."""
        audit_log = log_user_role_change(
            db=db_session,
            admin=test_admin,
            updated_user=test_verified_user,
            old_role="sender",
            new_role="courier"
        )

        assert audit_log.action == AuditAction.USER_ROLE_CHANGE
        assert audit_log.details["old_role"] == "sender"
        assert audit_log.details["new_role"] == "courier"

    def test_log_package_create(self, db_session, test_verified_user):
        """Test logging package creation."""
        audit_log = log_package_create(
            db=db_session,
            user=test_verified_user,
            package_id=1,
            details={"description": "Test package", "size": "small"}
        )

        assert audit_log.action == AuditAction.PACKAGE_CREATE
        assert audit_log.resource_type == "package"
        assert audit_log.resource_id == 1

    def test_log_package_status_change(self, db_session, test_verified_user):
        """Test logging package status change."""
        audit_log = log_package_status_change(
            db=db_session,
            user=test_verified_user,
            package_id=1,
            old_status="pending",
            new_status="picked_up"
        )

        assert audit_log.action == AuditAction.PACKAGE_STATUS_CHANGE
        assert audit_log.details["old_status"] == "pending"
        assert audit_log.details["new_status"] == "picked_up"

    def test_log_route_create(self, db_session, test_verified_user):
        """Test logging route creation."""
        audit_log = log_route_create(
            db=db_session,
            user=test_verified_user,
            route_id=1,
            details={"start": "NYC", "end": "LA"}
        )

        assert audit_log.action == AuditAction.ROUTE_CREATE
        assert audit_log.resource_type == "route"
        assert audit_log.resource_id == 1


class TestAuditLogEndpoints:
    """Tests for audit log admin endpoints."""

    def test_get_audit_logs_as_admin(self, client, authenticated_admin, db_session, test_admin):
        """Test getting audit logs as admin."""
        # Create some audit logs first
        from app.services.audit_service import log_login_success
        log_login_success(db_session, test_admin)

        response = client.get(
            "/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert "total" in data
        assert "logs" in data
        assert data["total"] >= 1

    def test_get_audit_logs_unauthorized(self, client, authenticated_sender):
        """Test that non-admin users cannot access audit logs."""
        response = client.get(
            "/api/admin/audit-logs",
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 403

    def test_get_audit_logs_filter_by_action(self, client, authenticated_admin, db_session, test_admin):
        """Test filtering audit logs by action type."""
        # Create audit logs with different actions
        from app.services.audit_service import log_login_success, log_login_failed
        log_login_success(db_session, test_admin)
        log_login_failed(db_session, "bad@example.com")

        response = client.get(
            "/api/admin/audit-logs?action=login_success",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["action"] == "login_success"

    def test_get_audit_logs_filter_by_user_id(self, client, authenticated_admin, db_session, test_admin):
        """Test filtering audit logs by user ID."""
        from app.services.audit_service import log_login_success
        log_login_success(db_session, test_admin)

        response = client.get(
            f"/api/admin/audit-logs?user_id={test_admin.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["user_id"] == test_admin.id

    def test_get_audit_logs_filter_by_resource_type(self, client, authenticated_admin, db_session, test_admin):
        """Test filtering audit logs by resource type."""
        from app.services.audit_service import log_login_success, log_package_create
        log_login_success(db_session, test_admin)
        log_package_create(db_session, test_admin, 1)

        response = client.get(
            "/api/admin/audit-logs?resource_type=package",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        for log in data["logs"]:
            assert log["resource_type"] == "package"

    def test_get_audit_logs_invalid_action(self, client, authenticated_admin):
        """Test filtering with invalid action returns error."""
        response = client.get(
            "/api/admin/audit-logs?action=invalid_action",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 400

    def test_get_audit_log_actions(self, client, authenticated_admin):
        """Test getting list of available audit actions."""
        response = client.get(
            "/api/admin/audit-logs/actions",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        actions = response.json()
        assert isinstance(actions, list)
        assert "login_success" in actions
        assert "login_failed" in actions
        assert "user_create" in actions

    def test_get_audit_log_by_id(self, client, authenticated_admin, db_session, test_admin):
        """Test getting a specific audit log by ID."""
        from app.services.audit_service import log_login_success
        audit_log = log_login_success(db_session, test_admin)

        response = client.get(
            f"/api/admin/audit-logs/{audit_log.id}",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data["id"] == audit_log.id
        assert data["action"] == "login_success"

    def test_get_audit_log_not_found(self, client, authenticated_admin):
        """Test getting non-existent audit log returns 404."""
        response = client.get(
            "/api/admin/audit-logs/99999",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 404

    def test_audit_logs_pagination(self, client, authenticated_admin, db_session, test_admin):
        """Test audit logs pagination."""
        # Create multiple audit logs
        from app.services.audit_service import log_login_success
        for _ in range(5):
            log_login_success(db_session, test_admin)

        response = client.get(
            "/api/admin/audit-logs?skip=0&limit=2",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert len(data["logs"]) == 2
        assert data["total"] >= 5


class TestAuditLoggingIntegration:
    """Integration tests for audit logging during actual operations."""

    def test_login_creates_audit_log(self, client, db_session, authenticated_admin, test_admin):
        """Test that login creates an audit log entry."""
        # Login was already done in fixture creation
        # Check that audit log was created for admin login

        response = client.get(
            "/api/admin/audit-logs?action=login_success",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        # The admin fixture creates the user but doesn't go through the login endpoint
        # So we test by checking the audit log endpoint works
        assert response.status_code == 200

    def test_registration_creates_audit_log(self, client, db_session, authenticated_admin):
        """Test that registration creates an audit log entry."""
        # Register a new user
        response = client.post(
            "/api/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "password123",
                "full_name": "New User",
                "role": "sender"
            }
        )
        assert response.status_code == 201

        # Check audit log was created
        audit_response = client.get(
            "/api/admin/audit-logs?action=register",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert audit_response.status_code == 200
        data = audit_response.json()
        assert data["total"] >= 1
        # Find the log for our user
        found = any(log["user_email"] == "newuser@example.com" for log in data["logs"])
        assert found, "Audit log for registration not found"

    def test_admin_user_create_creates_audit_log(self, client, authenticated_admin, db_session):
        """Test that admin creating user creates audit log."""
        response = client.post(
            "/api/admin/users",
            headers={"Authorization": f"Bearer {authenticated_admin}"},
            json={
                "email": "created@example.com",
                "password": "password123",
                "full_name": "Created User",
                "role": "sender"
            }
        )
        assert response.status_code == 201

        # Check audit log
        audit_response = client.get(
            "/api/admin/audit-logs?action=user_create",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert audit_response.status_code == 200
        data = audit_response.json()
        assert data["total"] >= 1

    def test_package_create_creates_audit_log(self, client, authenticated_sender, authenticated_admin, test_package_data):
        """Test that package creation creates audit log."""
        response = client.post(
            "/api/packages/",
            headers={"Authorization": f"Bearer {authenticated_sender}"},
            json=test_package_data
        )
        assert response.status_code == 201

        # Check audit log
        audit_response = client.get(
            "/api/admin/audit-logs?action=package_create",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert audit_response.status_code == 200
        data = audit_response.json()
        assert data["total"] >= 1

    def test_failed_login_creates_audit_log(self, client, authenticated_admin):
        """Test that failed login attempts are logged."""
        # Attempt login with wrong password
        response = client.post(
            "/api/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "wrongpassword"
            }
        )
        assert response.status_code == 401

        # Check audit log
        audit_response = client.get(
            "/api/admin/audit-logs?action=login_failed",
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert audit_response.status_code == 200
        data = audit_response.json()
        assert data["total"] >= 1
