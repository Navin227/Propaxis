import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy import and_
from sqlalchemy.orm import foreign
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey
from app.models.enums import MaintenanceCategory, MaintenanceStatus, Priority, enum_type
from app.models.properties import Property, Unit


class MaintenanceRequest(UUIDPrimaryKey, Base):
    __tablename__ = "maintenance_requests"
    __table_args__ = (
        ForeignKeyConstraint(
            ["property_id", "unit_id"],
            ["units.property_id", "units.id"],
            name="fk_maintenance_requests_property_unit",
            ondelete="RESTRICT",
        ),
        CheckConstraint(
            "completed_at IS NULL OR completed_at >= submitted_at",
            name="ck_maintenance_completed_after_submitted",
        ),
        Index("ix_maintenance_property_status", "property_id", "status"),
        Index("ix_maintenance_tenant_submitted", "tenant_id", "submitted_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenant_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    unit_id: Mapped[uuid.UUID] = mapped_column(nullable=False, index=True)
    category: Mapped[MaintenanceCategory] = mapped_column(
        enum_type(MaintenanceCategory, "maintenance_category"),
        nullable=False,
    )
    description: Mapped[str] = mapped_column(Text, nullable=False)
    priority: Mapped[Priority] = mapped_column(
        enum_type(Priority, "maintenance_priority"),
        nullable=False,
        default=Priority.MEDIUM,
        server_default=Priority.MEDIUM.value,
    )
    status: Mapped[MaintenanceStatus] = mapped_column(
        enum_type(MaintenanceStatus, "maintenance_status"),
        nullable=False,
        default=MaintenanceStatus.SUBMITTED,
        server_default=MaintenanceStatus.SUBMITTED.value,
    )
    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    tenant: Mapped[TenantProfile] = relationship()
    property: Mapped[Property] = relationship(back_populates="maintenance_requests")
    unit: Mapped[Unit] = relationship(
        primaryjoin=lambda: and_(
            Unit.id == foreign(MaintenanceRequest.unit_id),
            Unit.property_id == MaintenanceRequest.property_id,
        ),
    )
    assignments: Mapped[list[MaintenanceAssignment]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
    )
    updates: Mapped[list[MaintenanceUpdate]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="MaintenanceUpdate.created_at",
    )
    attachments: Mapped[list[MaintenanceAttachment]] = relationship(
        back_populates="request",
        cascade="all, delete-orphan",
    )


class MaintenanceAssignment(UUIDPrimaryKey, Base):
    __tablename__ = "maintenance_assignments"

    maintenance_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("maintenance_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    technician_name: Mapped[str] = mapped_column(String(160), nullable=False)
    vendor_name: Mapped[str | None] = mapped_column(String(180))
    contact_phone: Mapped[str | None] = mapped_column(String(32))
    contact_email: Mapped[str | None] = mapped_column(String(320))
    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    notes: Mapped[str | None] = mapped_column(Text)

    request: Mapped[MaintenanceRequest] = relationship(back_populates="assignments")
    assigned_by: Mapped[User | None] = relationship(foreign_keys=[assigned_by_id])


class MaintenanceUpdate(UUIDPrimaryKey, Base):
    __tablename__ = "maintenance_updates"

    maintenance_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("maintenance_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    author_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    previous_status: Mapped[MaintenanceStatus | None] = mapped_column(
        enum_type(MaintenanceStatus, "maintenance_update_previous_status"),
    )
    new_status: Mapped[MaintenanceStatus | None] = mapped_column(
        enum_type(MaintenanceStatus, "maintenance_update_new_status"),
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    request: Mapped[MaintenanceRequest] = relationship(back_populates="updates")
    author: Mapped[User | None] = relationship(foreign_keys=[author_id])


class MaintenanceAttachment(UUIDPrimaryKey, Base):
    __tablename__ = "maintenance_attachments"
    __table_args__ = (UniqueConstraint("storage_key", name="uq_maintenance_attachments_storage_key"),)

    maintenance_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("maintenance_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(160))
    file_size_bytes: Mapped[int | None] = mapped_column()
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    request: Mapped[MaintenanceRequest] = relationship(back_populates="attachments")
