from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Enum as SQLEnum, JSON
from sqlalchemy.sql import func
from app.models.base import Base
import enum


class AuditAction(str, enum.Enum):
    # Authentication
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    REGISTER = "REGISTER"
    PASSWORD_RESET_REQUEST = "PASSWORD_RESET_REQUEST"
    PASSWORD_RESET_COMPLETE = "PASSWORD_RESET_COMPLETE"
    EMAIL_VERIFICATION = "EMAIL_VERIFICATION"
    OAUTH_LOGIN = "OAUTH_LOGIN"

    # User Management (Admin)
    USER_CREATE = "USER_CREATE"
    USER_UPDATE = "USER_UPDATE"
    USER_ROLE_CHANGE = "USER_ROLE_CHANGE"
    USER_DEACTIVATE = "USER_DEACTIVATE"
    USER_ACTIVATE = "USER_ACTIVATE"
    USER_VERIFY = "USER_VERIFY"
    USER_UNVERIFY = "USER_UNVERIFY"
    USER_DELETE = "USER_DELETE"

    # Package Operations
    PACKAGE_CREATE = "PACKAGE_CREATE"
    PACKAGE_UPDATE = "PACKAGE_UPDATE"
    PACKAGE_STATUS_CHANGE = "PACKAGE_STATUS_CHANGE"
    PACKAGE_CANCEL = "PACKAGE_CANCEL"
    PACKAGE_DELETE = "PACKAGE_DELETE"
    PACKAGE_DEACTIVATE = "PACKAGE_DEACTIVATE"

    # Courier Operations
    ROUTE_CREATE = "ROUTE_CREATE"
    ROUTE_UPDATE = "ROUTE_UPDATE"
    ROUTE_DELETE = "ROUTE_DELETE"
    PACKAGE_ACCEPT = "PACKAGE_ACCEPT"
    PACKAGE_REJECT = "PACKAGE_REJECT"

    # Matching
    MATCHING_JOB_RUN = "MATCHING_JOB_RUN"

    # Admin Actions
    ADMIN_STATS_ACCESS = "ADMIN_STATS_ACCESS"

    # Rating
    RATING_CREATE = "RATING_CREATE"

    # Bidding
    BID_CREATED = "BID_CREATED"
    BID_WITHDRAWN = "BID_WITHDRAWN"
    BID_SELECTED = "BID_SELECTED"


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
