from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.demo_auth import require_operational_user
from app.core.demo_users import DEMO_USERS
from app.models import User
from app.models.enums import UserRole

router = APIRouter(tags=["demo-only"])


class PropertyManagerOption(BaseModel):
    id: str
    name: str
    role: Literal["manager"] = "manager"


@router.get(
    "/users",
    response_model=list[PropertyManagerOption],
    summary="List active demo property managers",
    description=(
        "Demo-only manager options for property assignment. Requires x-user-id; "
        "only configured, active property managers are returned."
    ),
)
def list_property_managers(
    _user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> list[PropertyManagerOption]:
    configured_managers = [identity for identity in DEMO_USERS if identity["role"] == "manager"]
    if not configured_managers:
        return []

    active_emails = set(
        db.scalars(
            select(User.email).where(
                User.email.in_([manager["email"] for manager in configured_managers]),
                User.role == UserRole.PROPERTY_MANAGER,
                User.is_active.is_(True),
            )
        ).all()
    )
    return [
        PropertyManagerOption(id=manager["id"], name=manager["name"])
        for manager in configured_managers
        if manager["email"] in active_emails
    ]
