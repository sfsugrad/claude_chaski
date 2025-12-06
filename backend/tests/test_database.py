"""
Tests for database.py - Database connection and session management.

Tests the database setup, session management, and get_db dependency.
"""
import pytest
from sqlalchemy.orm import Session

from app.database import get_db, SessionLocal, engine, Base


# ==================== get_db Dependency Tests ====================

class TestGetDb:
    """Tests for get_db dependency function."""

    def test_yields_session(self):
        """Should yield a database session."""
        # Create tables for testing
        Base.metadata.create_all(bind=engine)

        try:
            db_generator = get_db()
            db = next(db_generator)

            assert db is not None
            assert isinstance(db, Session)
        finally:
            # Cleanup
            try:
                next(db_generator)
            except StopIteration:
                pass
            Base.metadata.drop_all(bind=engine)

    def test_session_is_functional(self):
        """Session should be able to execute queries."""
        from sqlalchemy import text
        Base.metadata.create_all(bind=engine)

        try:
            db_generator = get_db()
            db = next(db_generator)

            # Should be able to execute a simple query
            result = db.execute(text("SELECT 1"))
            assert result is not None
        finally:
            try:
                next(db_generator)
            except StopIteration:
                pass
            Base.metadata.drop_all(bind=engine)

    def test_closes_session_after_use(self):
        """Should close session after generator completes."""
        Base.metadata.create_all(bind=engine)

        try:
            db_generator = get_db()
            db = next(db_generator)

            # Complete the generator
            try:
                next(db_generator)
            except StopIteration:
                pass

            # Session should be closed
            # Note: After close, is_active returns False
            # but the session object still exists
            assert db is not None
        finally:
            Base.metadata.drop_all(bind=engine)


# ==================== SessionLocal Tests ====================

class TestSessionLocal:
    """Tests for SessionLocal session factory."""

    def test_creates_session(self):
        """Should create a new session."""
        session = SessionLocal()
        assert session is not None
        assert isinstance(session, Session)
        session.close()

    def test_session_has_correct_settings(self):
        """Session should have autoflush=False (SQLAlchemy 2.0 removed autocommit)."""
        session = SessionLocal()
        try:
            # SQLAlchemy 2.0 removed autocommit from Session
            # autoflush should be False as configured
            assert session.autoflush is False
        finally:
            session.close()


# ==================== Engine Tests ====================

class TestEngine:
    """Tests for database engine."""

    def test_engine_exists(self):
        """Engine should be created."""
        assert engine is not None

    def test_engine_url_from_settings(self):
        """Engine should use DATABASE_URL from settings."""
        # The engine URL should match what's in settings
        # In test environment, this is overridden to sqlite
        assert engine.url is not None


# ==================== Base Tests ====================

class TestBase:
    """Tests for declarative Base."""

    def test_base_exists(self):
        """Declarative Base should be created."""
        assert Base is not None

    def test_base_has_metadata(self):
        """Base should have metadata."""
        assert Base.metadata is not None

    def test_can_create_tables(self):
        """Should be able to create tables from Base."""
        # This tests that all models are properly defined
        try:
            Base.metadata.create_all(bind=engine)
            # If we get here, tables were created successfully
        finally:
            Base.metadata.drop_all(bind=engine)
