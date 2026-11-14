from __future__ import annotations

import uuid

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, UniqueConstraint, func, text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.enums import UserRole, enum_type


class User(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("uq_users_email_lower", text("lower(email)"), unique=True),)

    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    role: Mapped[UserRole] = mapped_column(
        enum_type(UserRole, "user_role"),
        nullable=False,
        index=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    tenant_profile: Mapped[TenantProfile | None] = relationship(
        back_populates="user",
        uselist=False,
        passive_deletes=True,
    )
    manager_assignments: Mapped[list[PropertyManagerAssignment]] = relationship(
        back_populates="manager",
        foreign_keys="PropertyManagerAssignment.manager_id",
        passive_deletes=True,
    )


class PropertyManagerAssignment(UUIDPrimaryKey, Base):
    __tablename__ = "property_manager_assignments"
    __table_args__ = (
        UniqueConstraint("manager_id", "property_id", name="uq_manager_property_assignment"),
    )

    manager_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    manager: Mapped[User] = relationship(
        back_populates="manager_assignments",
        foreign_keys=[manager_id],
    )
    property: Mapped[Property] = relationship(back_populates="manager_assignments")
