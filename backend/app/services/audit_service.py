from sqlalchemy.orm import Session
from fastapi import Request
from typing import Optional, Any
from app.models.audit_log import AuditLog, AuditAction
from app.models.user import User
import logging

logger = logging.getLogger(__name__)


def get_client_ip(request: Optional[Request]) -> Optional[str]:
    """Extract client IP from request, handling proxies."""
    if not request:
        return None
    # Check for forwarded header (behind proxy/load balancer)
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return None


def get_user_agent(request: Optional[Request]) -> Optional[str]:
    """Extract user agent from request."""
    if not request:
        return None
    return request.headers.get("user-agent")


def create_audit_log(
    db: Session,
    action: AuditAction,
    user: Optional[User] = None,
    user_id: Optional[int] = None,
    user_email: Optional[str] = None,
    resource_type: Optional[str] = None,
    resource_id: Optional[int] = None,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
    success: str = "success",
    error_message: Optional[str] = None,
) -> AuditLog:
    """
    Create an audit log entry.

    Args:
        db: Database session
        action: The action being performed
        user: User object performing the action (optional)
        user_id: User ID if user object not available
        user_email: User email if user object not available
        resource_type: Type of resource being acted upon (e.g., "user", "package")
        resource_id: ID of the resource being acted upon
        details: Additional JSON details about the action
        request: FastAPI request object for IP/user agent
        success: "success", "failed", or "denied"
        error_message: Error message if action failed

    Returns:
        Created AuditLog object
    """
    audit_log = AuditLog(
        user_id=user.id if user else user_id,
        user_email=user.email if user else user_email,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details,
        ip_address=get_client_ip(request),
        user_agent=get_user_agent(request),
        success=success,
        error_message=error_message,
    )

    db.add(audit_log)
    db.commit()
    db.refresh(audit_log)

    logger.info(
        f"Audit: {action.value} by user_id={audit_log.user_id} "
        f"on {resource_type}:{resource_id} - {success}"
    )

    return audit_log


# Convenience functions for common operations

def log_login_success(
    db: Session,
    user: User,
    request: Optional[Request] = None,
    method: str = "password",
) -> AuditLog:
    """Log successful login."""
    return create_audit_log(
        db=db,
        action=AuditAction.LOGIN_SUCCESS,
        user=user,
        resource_type="user",
        resource_id=user.id,
        details={"method": method},
        request=request,
    )


def log_login_failed(
    db: Session,
    email: str,
    request: Optional[Request] = None,
    reason: str = "invalid_credentials",
) -> AuditLog:
    """Log failed login attempt."""
    return create_audit_log(
        db=db,
        action=AuditAction.LOGIN_FAILED,
        user_email=email,
        details={"reason": reason},
        request=request,
        success="failed",
        error_message=reason,
    )


def log_registration(
    db: Session,
    user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log user registration."""
    return create_audit_log(
        db=db,
        action=AuditAction.REGISTER,
        user=user,
        resource_type="user",
        resource_id=user.id,
        details={"role": user.role.value},
        request=request,
    )


def log_password_reset_request(
    db: Session,
    user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log password reset request."""
    return create_audit_log(
        db=db,
        action=AuditAction.PASSWORD_RESET_REQUEST,
        user=user,
        resource_type="user",
        resource_id=user.id,
        request=request,
    )


def log_password_reset_complete(
    db: Session,
    user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log password reset completion."""
    return create_audit_log(
        db=db,
        action=AuditAction.PASSWORD_RESET_COMPLETE,
        user=user,
        resource_type="user",
        resource_id=user.id,
        request=request,
    )


def log_email_verification(
    db: Session,
    user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log email verification."""
    return create_audit_log(
        db=db,
        action=AuditAction.EMAIL_VERIFICATION,
        user=user,
        resource_type="user",
        resource_id=user.id,
        request=request,
    )


def log_oauth_login(
    db: Session,
    user: User,
    provider: str,
    is_new_user: bool,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log OAuth login."""
    return create_audit_log(
        db=db,
        action=AuditAction.OAUTH_LOGIN,
        user=user,
        resource_type="user",
        resource_id=user.id,
        details={"provider": provider, "is_new_user": is_new_user},
        request=request,
    )


def log_user_create(
    db: Session,
    admin: User,
    created_user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin creating a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_CREATE,
        user=admin,
        resource_type="user",
        resource_id=created_user.id,
        details={
            "created_email": created_user.email,
            "created_role": created_user.role.value,
        },
        request=request,
    )


def log_user_update(
    db: Session,
    admin: User,
    updated_user: User,
    changes: dict,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin updating a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_UPDATE,
        user=admin,
        resource_type="user",
        resource_id=updated_user.id,
        details={"changes": changes, "target_email": updated_user.email},
        request=request,
    )


def log_user_role_change(
    db: Session,
    admin: User,
    updated_user: User,
    old_role: str,
    new_role: str,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin changing user role."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_ROLE_CHANGE,
        user=admin,
        resource_type="user",
        resource_id=updated_user.id,
        details={
            "target_email": updated_user.email,
            "old_role": old_role,
            "new_role": new_role,
        },
        request=request,
    )


def log_user_deactivate(
    db: Session,
    admin: User,
    deactivated_user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin deactivating a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_DEACTIVATE,
        user=admin,
        resource_type="user",
        resource_id=deactivated_user.id,
        details={"target_email": deactivated_user.email},
        request=request,
    )


def log_user_activate(
    db: Session,
    admin: User,
    activated_user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin activating a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_ACTIVATE,
        user=admin,
        resource_type="user",
        resource_id=activated_user.id,
        details={"target_email": activated_user.email},
        request=request,
    )


def log_user_verify(
    db: Session,
    admin: User,
    verified_user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin verifying a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_VERIFY,
        user=admin,
        resource_type="user",
        resource_id=verified_user.id,
        details={"target_email": verified_user.email},
        request=request,
    )


def log_user_unverify(
    db: Session,
    admin: User,
    unverified_user: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin unverifying a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_UNVERIFY,
        user=admin,
        resource_type="user",
        resource_id=unverified_user.id,
        details={"target_email": unverified_user.email},
        request=request,
    )


def log_user_delete(
    db: Session,
    admin: User,
    deleted_user_id: int,
    deleted_user_email: str,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin deleting a user."""
    return create_audit_log(
        db=db,
        action=AuditAction.USER_DELETE,
        user=admin,
        resource_type="user",
        resource_id=deleted_user_id,
        details={"deleted_email": deleted_user_email},
        request=request,
    )


def log_package_create(
    db: Session,
    user: User,
    package_id: int,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log package creation."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_CREATE,
        user=user,
        resource_type="package",
        resource_id=package_id,
        details=details,
        request=request,
    )


def log_package_update(
    db: Session,
    user: User,
    package_id: int,
    changes: dict,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log package update."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_UPDATE,
        user=user,
        resource_type="package",
        resource_id=package_id,
        details={"changes": changes},
        request=request,
    )


def log_package_status_change(
    db: Session,
    user: User,
    package_id: int,
    old_status: str,
    new_status: str,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log package status change."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_STATUS_CHANGE,
        user=user,
        resource_type="package",
        resource_id=package_id,
        details={"old_status": old_status, "new_status": new_status},
        request=request,
    )


def log_package_cancel(
    db: Session,
    user: User,
    package_id: int,
    reason: Optional[str] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log package cancellation."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_CANCEL,
        user=user,
        resource_type="package",
        resource_id=package_id,
        details={"reason": reason} if reason else None,
        request=request,
    )


def log_package_delete(
    db: Session,
    admin: User,
    package_id: int,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin deleting a package."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_DELETE,
        user=admin,
        resource_type="package",
        resource_id=package_id,
        request=request,
    )


def log_package_deactivate(
    db: Session,
    admin: User,
    package_id: int,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin deactivating a package."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_DEACTIVATE,
        user=admin,
        resource_type="package",
        resource_id=package_id,
        request=request,
    )


def log_route_create(
    db: Session,
    user: User,
    route_id: int,
    details: Optional[dict] = None,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log courier route creation."""
    return create_audit_log(
        db=db,
        action=AuditAction.ROUTE_CREATE,
        user=user,
        resource_type="route",
        resource_id=route_id,
        details=details,
        request=request,
    )


def log_route_update(
    db: Session,
    user: User,
    route_id: int,
    changes: dict,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log courier route update."""
    return create_audit_log(
        db=db,
        action=AuditAction.ROUTE_UPDATE,
        user=user,
        resource_type="route",
        resource_id=route_id,
        details={"changes": changes},
        request=request,
    )


def log_route_delete(
    db: Session,
    user: User,
    route_id: int,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log courier route deletion."""
    return create_audit_log(
        db=db,
        action=AuditAction.ROUTE_DELETE,
        user=user,
        resource_type="route",
        resource_id=route_id,
        request=request,
    )


def log_package_accept(
    db: Session,
    courier: User,
    package_id: int,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log courier accepting a package."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_ACCEPT,
        user=courier,
        resource_type="package",
        resource_id=package_id,
        request=request,
    )


def log_package_reject(
    db: Session,
    courier: User,
    package_id: int,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log courier rejecting a package."""
    return create_audit_log(
        db=db,
        action=AuditAction.PACKAGE_REJECT,
        user=courier,
        resource_type="package",
        resource_id=package_id,
        request=request,
    )


def log_matching_job_run(
    db: Session,
    admin: Optional[User] = None,
    matches_created: int = 0,
    dry_run: bool = False,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log matching job execution."""
    return create_audit_log(
        db=db,
        action=AuditAction.MATCHING_JOB_RUN,
        user=admin,
        details={"matches_created": matches_created, "dry_run": dry_run},
        request=request,
    )


def log_admin_stats_access(
    db: Session,
    admin: User,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log admin accessing platform statistics."""
    return create_audit_log(
        db=db,
        action=AuditAction.ADMIN_STATS_ACCESS,
        user=admin,
        request=request,
    )


def log_rating_create(
    db: Session,
    user: User,
    rating_id: int,
    rated_user_id: int,
    package_id: int,
    score: int,
    request: Optional[Request] = None,
) -> AuditLog:
    """Log rating creation."""
    return create_audit_log(
        db=db,
        action=AuditAction.RATING_CREATE,
        user=user,
        resource_type="rating",
        resource_id=rating_id,
        details={
            "rated_user_id": rated_user_id,
            "package_id": package_id,
            "score": score,
        },
        request=request,
    )
