import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey
from app.models.enums import ApprovalActionType, ApprovalStatus, ApprovalType, enum_type


class ApprovalRequest(UUIDPrimaryKey, Base):
    __tablename__ = "approval_requests"
    __table_args__ = (
        CheckConstraint(
            "approval_type != 'PROPERTY_VISIT' OR property_visit_request_id IS NOT NULL",
            name="ck_approval_visit_has_visit_request",
        ),
        CheckConstraint(
            "property_visit_request_id IS NULL OR property_visit_request_id = related_entity_id",
            name="ck_approval_related_visit_matches",
        ),
        UniqueConstraint("property_visit_request_id", name="uq_approval_visit_request"),
        Index("ix_approval_requests_status_created", "status", "created_at"),
        Index("ix_approval_requests_approver_status", "assigned_approver_id", "status"),
        Index("ix_approval_requests_related_entity", "related_entity_type", "related_entity_id"),
    )

    approval_type: Mapped[ApprovalType] = mapped_column(
        enum_type(ApprovalType, "approval_type"),
        nullable=False,
    )
    requester_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    assigned_approver_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    related_entity_type: Mapped[str] = mapped_column(String(80), nullable=False)
    related_entity_id: Mapped[uuid.UUID] = mapped_column(nullable=False)
    property_visit_request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("property_visit_requests.id", ondelete="RESTRICT"),
    )
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[ApprovalStatus] = mapped_column(
        enum_type(ApprovalStatus, "approval_status"),
        nullable=False,
        default=ApprovalStatus.PENDING,
        server_default=ApprovalStatus.PENDING.value,
    )
    decision: Mapped[ApprovalActionType | None] = mapped_column(
        enum_type(ApprovalActionType, "approval_action_type"),
    )
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    requester: Mapped[User] = relationship(foreign_keys=[requester_id])
    assigned_approver: Mapped[User | None] = relationship(foreign_keys=[assigned_approver_id])
    visit_request: Mapped[PropertyVisitRequest | None] = relationship(
        back_populates="approval_request",
        foreign_keys=[property_visit_request_id],
    )
    actions: Mapped[list[ApprovalAction]] = relationship(
        back_populates="approval_request",
        cascade="all, delete-orphan",
        order_by="ApprovalAction.created_at",
    )


class ApprovalAction(UUIDPrimaryKey, Base):
    __tablename__ = "approval_actions"

    approval_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("approval_requests.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    action: Mapped[ApprovalActionType] = mapped_column(
        enum_type(ApprovalActionType, "approval_action_type"),
        nullable=False,
    )
    remarks: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    approval_request: Mapped[ApprovalRequest] = relationship(back_populates="actions")
    actor: Mapped[User | None] = relationship(foreign_keys=[actor_id])
