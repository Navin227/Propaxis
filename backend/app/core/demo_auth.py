"""Demo-only identity validation for operational API endpoints."""

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.demo_users import get_demo_user
from app.models import User
from app.models.enums import UserRole

_DEMO_ROLE_MAP = {
    "admin": UserRole.COMPANY_ADMIN,
    "manager": UserRole.PROPERTY_MANAGER,
    "tenant": UserRole.TENANT,
}


def get_current_demo_user(
    x_user_id: str | None = Header(default=None, alias="x-user-id"),
    db: Session = Depends(get_db),
) -> User:
    """Resolve the configured demo ID to its seeded database identity.

    The x-user-role header is intentionally not accepted or consulted.
    This is development/demo identity handling, not production authentication.
    """
    demo_identity = get_demo_user(x_user_id or "")
    if demo_identity is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="A valid demo user ID is required.",
        )

    expected_role = _DEMO_ROLE_MAP[demo_identity["role"]]
    user = db.scalar(select(User).where(User.email == demo_identity["email"]))
    if user is None or not user.is_active or user.role != expected_role:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="The demo user is unavailable.",
        )
    return user


def require_operational_user(
    user: User = Depends(get_current_demo_user),
) -> User:
    if user.role not in {UserRole.COMPANY_ADMIN, UserRole.PROPERTY_MANAGER}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This endpoint is for property operations users only.",
        )
    return user


def require_company_admin(
    user: User = Depends(get_current_demo_user),
) -> User:
    if user.role != UserRole.COMPANY_ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only Company Admin users may perform this action.",
        )
    return user
