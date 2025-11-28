"""Tests for the route cleanup job service."""
import pytest
from datetime import datetime, timedelta, timezone

from app.models.user import User, UserRole
from app.models.package import CourierRoute
from app.utils.auth import get_password_hash
from app.services.route_cleanup_job import run_route_cleanup_job


class TestRouteCleanupJob:
    """Tests for the route cleanup job."""

    @pytest.fixture
    def courier_with_routes(self, db_session):
        """Create a courier with various routes for testing."""
        # Create courier
        courier = User(
            email="cleanup_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Cleanup Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)
        db_session.commit()

        now = datetime.now(timezone.utc)

        # Route 1: Active with past trip_date (should be deactivated)
        past_route = CourierRoute(
            courier_id=courier.id,
            start_address="Past Start",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="Past End",
            end_lat=40.7580,
            end_lng=-73.9855,
            max_deviation_km=5,
            trip_date=now - timedelta(days=1),  # Yesterday
            is_active=True
        )
        db_session.add(past_route)

        # Route 2: Active with future trip_date (should NOT be deactivated)
        future_route = CourierRoute(
            courier_id=courier.id,
            start_address="Future Start",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="Future End",
            end_lat=40.7580,
            end_lng=-73.9855,
            max_deviation_km=5,
            trip_date=now + timedelta(days=1),  # Tomorrow
            is_active=True
        )
        db_session.add(future_route)

        # Route 3: Active with no trip_date (should NOT be deactivated)
        no_date_route = CourierRoute(
            courier_id=courier.id,
            start_address="No Date Start",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="No Date End",
            end_lat=40.7580,
            end_lng=-73.9855,
            max_deviation_km=5,
            trip_date=None,
            is_active=True
        )
        db_session.add(no_date_route)

        # Route 4: Inactive with past trip_date (already inactive, should be skipped)
        inactive_past_route = CourierRoute(
            courier_id=courier.id,
            start_address="Inactive Past Start",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="Inactive Past End",
            end_lat=40.7580,
            end_lng=-73.9855,
            max_deviation_km=5,
            trip_date=now - timedelta(days=2),  # 2 days ago
            is_active=False
        )
        db_session.add(inactive_past_route)

        db_session.commit()

        return {
            'courier': courier,
            'past_route': past_route,
            'future_route': future_route,
            'no_date_route': no_date_route,
            'inactive_past_route': inactive_past_route
        }

    def test_deactivates_routes_with_past_trip_date(self, db_session, courier_with_routes):
        """Job should deactivate active routes with past trip_date."""
        past_route = courier_with_routes['past_route']
        past_route_id = past_route.id

        results = run_route_cleanup_job(dry_run=False, db=db_session)

        # Refresh to get updated values
        db_session.refresh(past_route)

        assert past_route.is_active is False
        assert results['routes_deactivated'] == 1
        assert len(results['deactivated_routes']) == 1
        assert results['deactivated_routes'][0]['route_id'] == past_route_id

    def test_does_not_deactivate_future_routes(self, db_session, courier_with_routes):
        """Job should not deactivate routes with future trip_date."""
        future_route = courier_with_routes['future_route']

        run_route_cleanup_job(dry_run=False, db=db_session)

        db_session.refresh(future_route)

        assert future_route.is_active is True

    def test_does_not_deactivate_routes_without_trip_date(self, db_session, courier_with_routes):
        """Job should not deactivate routes without trip_date."""
        no_date_route = courier_with_routes['no_date_route']

        run_route_cleanup_job(dry_run=False, db=db_session)

        db_session.refresh(no_date_route)

        assert no_date_route.is_active is True

    def test_skips_already_inactive_routes(self, db_session, courier_with_routes):
        """Job should skip routes that are already inactive."""
        inactive_past_route = courier_with_routes['inactive_past_route']
        inactive_route_id = inactive_past_route.id

        results = run_route_cleanup_job(dry_run=False, db=db_session)

        db_session.refresh(inactive_past_route)

        # The inactive route should not be in the results
        deactivated_ids = [r['route_id'] for r in results['deactivated_routes']]
        assert inactive_route_id not in deactivated_ids

    def test_dry_run_does_not_modify_routes(self, db_session, courier_with_routes):
        """Dry run should report but not actually deactivate routes."""
        past_route = courier_with_routes['past_route']

        results = run_route_cleanup_job(dry_run=True, db=db_session)

        db_session.refresh(past_route)

        # Route should still be active (dry run)
        assert past_route.is_active is True
        # But results should show it would be deactivated
        assert results['routes_deactivated'] == 1
        assert results['dry_run'] is True

    def test_returns_correct_result_structure(self, db_session, courier_with_routes):
        """Job should return properly structured results."""
        results = run_route_cleanup_job(dry_run=False, db=db_session)

        assert 'started_at' in results
        assert 'completed_at' in results
        assert 'routes_deactivated' in results
        assert 'dry_run' in results
        assert 'deactivated_routes' in results

    def test_deactivated_route_details(self, db_session, courier_with_routes):
        """Job should return correct details for deactivated routes."""
        past_route = courier_with_routes['past_route']
        courier = courier_with_routes['courier']
        past_route_id = past_route.id
        courier_id = courier.id

        results = run_route_cleanup_job(dry_run=False, db=db_session)

        route_detail = results['deactivated_routes'][0]

        assert route_detail['route_id'] == past_route_id
        assert route_detail['courier_id'] == courier_id
        assert route_detail['trip_date'] is not None
        assert 'Past Start' in route_detail['start_address']
        assert 'Past End' in route_detail['end_address']


class TestMultipleExpiredRoutes:
    """Tests for handling multiple expired routes."""

    @pytest.fixture
    def multiple_expired_routes(self, db_session):
        """Create multiple couriers with expired routes."""
        now = datetime.now(timezone.utc)
        routes = []

        for i in range(3):
            courier = User(
                email=f"courier_{i}@test.com",
                hashed_password=get_password_hash("password123"),
                full_name=f"Courier {i}",
                role=UserRole.COURIER,
                is_active=True,
                is_verified=True,
                max_deviation_km=10
            )
            db_session.add(courier)
            db_session.commit()

            route = CourierRoute(
                courier_id=courier.id,
                start_address=f"Start {i}",
                start_lat=40.7128 + i * 0.01,
                start_lng=-74.0060,
                end_address=f"End {i}",
                end_lat=40.7580,
                end_lng=-73.9855,
                max_deviation_km=5,
                trip_date=now - timedelta(days=i + 1),  # Past dates
                is_active=True
            )
            db_session.add(route)
            routes.append(route)

        db_session.commit()
        return routes

    def test_deactivates_all_expired_routes(self, db_session, multiple_expired_routes):
        """Job should deactivate all expired routes in one run."""
        results = run_route_cleanup_job(dry_run=False, db=db_session)

        for route in multiple_expired_routes:
            db_session.refresh(route)
            assert route.is_active is False

        assert results['routes_deactivated'] == 3


class TestEmptyDatabase:
    """Tests for edge cases with no routes."""

    def test_no_routes_to_process(self, db_session):
        """Job should handle empty database gracefully."""
        results = run_route_cleanup_job(dry_run=False, db=db_session)

        assert results['routes_deactivated'] == 0
        assert results['deactivated_routes'] == []


class TestAdminEndpoint:
    """Tests for the admin endpoint to trigger route cleanup."""

    def test_admin_can_run_cleanup_job(self, client, authenticated_admin, db_session):
        """Admin should be able to trigger route cleanup job."""
        # Create an expired route
        courier = User(
            email="admin_test_courier@test.com",
            hashed_password=get_password_hash("password123"),
            full_name="Admin Test Courier",
            role=UserRole.COURIER,
            is_active=True,
            is_verified=True,
            max_deviation_km=10
        )
        db_session.add(courier)
        db_session.commit()

        now = datetime.now(timezone.utc)
        route = CourierRoute(
            courier_id=courier.id,
            start_address="Admin Test Start",
            start_lat=40.7128,
            start_lng=-74.0060,
            end_address="Admin Test End",
            end_lat=40.7580,
            end_lng=-73.9855,
            max_deviation_km=5,
            trip_date=now - timedelta(days=1),
            is_active=True
        )
        db_session.add(route)
        db_session.commit()

        response = client.post(
            "/api/admin/jobs/run-route-cleanup",
            json={"dry_run": False},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['routes_deactivated'] >= 1

    def test_admin_dry_run(self, client, authenticated_admin, db_session):
        """Admin should be able to run cleanup in dry-run mode."""
        response = client.post(
            "/api/admin/jobs/run-route-cleanup",
            json={"dry_run": True},
            headers={"Authorization": f"Bearer {authenticated_admin}"}
        )

        assert response.status_code == 200
        data = response.json()
        assert data['dry_run'] is True

    def test_non_admin_cannot_run_cleanup_job(self, client, authenticated_sender):
        """Non-admin users should not be able to run cleanup job."""
        response = client.post(
            "/api/admin/jobs/run-route-cleanup",
            json={"dry_run": False},
            headers={"Authorization": f"Bearer {authenticated_sender}"}
        )

        assert response.status_code == 403
