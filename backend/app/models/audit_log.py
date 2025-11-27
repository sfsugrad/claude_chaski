from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from app.models.base import Base
import enum


class AuditAction(str, enum.Enum):
    # Authentication
    LOGIN_SUCCESS = "login_success"
    LOGIN_FAILED = "login_failed"
    LOGOUT = "logout"
    REGISTER = "register"
    PASSWORD_RESET_REQUEST = "password_reset_request"
    PASSWORD_RESET_COMPLETE = "password_reset_complete"
    EMAIL_VERIFICATION = "email_verification"
    OAUTH_LOGIN = "oauth_login"

    # User Management (Admin)
    USER_CREATE = "user_create"
    USER_UPDATE = "user_update"
    USER_ROLE_CHANGE = "user_role_change"
    USER_DEACTIVATE = "user_deactivate"
    USER_ACTIVATE = "user_activate"
    USER_VERIFY = "user_verify"
    USER_UNVERIFY = "user_unverify"
    USER_DELETE = "user_delete"

    # Package Operations
    PACKAGE_CREATE = "package_create"
    PACKAGE_UPDATE = "package_update"
    PACKAGE_STATUS_CHANGE = "package_status_change"
    PACKAGE_CANCEL = "package_cancel"
    PACKAGE_DELETE = "package_delete"
    PACKAGE_DEACTIVATE = "package_deactivate"

    # Courier Operations
    ROUTE_CREATE = "route_create"
    ROUTE_UPDATE = "route_update"
    ROUTE_DELETE = "route_delete"
    PACKAGE_ACCEPT = "package_accept"
    PACKAGE_REJECT = "package_reject"

    # Matching
    MATCHING_JOB_RUN = "matching_job_run"

    # Admin Actions
    ADMIN_STATS_ACCESS = "admin_stats_access"

    # Rating
    RATING_CREATE = "rating_create"


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Who performed the action (nullable for failed login attempts with unknown user)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    user_email = Column(String, nullable=True)  # Stored separately for reference even if user deleted

    # What action was performed
    action = Column(SQLEnum(AuditAction), nullable=False, index=True)

    # Resource being acted upon
    resource_type = Column(String, nullable=True)  # e.g., "user", "package", "route"
    resource_id = Column(Integer, nullable=True, index=True)

    # Additional details about the action (JSON for flexibility)
    details = Column(JSON, nullable=True)

    # Request context
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)

    # Result
    success = Column(String, default="success")  # "success", "failed", "denied"
    error_message = Column(Text, nullable=True)

    # Timestamp
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)

    def __repr__(self):
        return f"<AuditLog {self.action} by user {self.user_id} at {self.created_at}>"
