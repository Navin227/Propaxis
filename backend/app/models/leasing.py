import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.enums import (
    ApprovalStatus,
    EnquirySource,
    EnquiryStatus,
    LeaseStatus,
    enum_type,
)


class TenantProfile(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "tenant_profiles"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        unique=True,
    )
    emergency_contact_name: Mapped[str | None] = mapped_column(String(160))
    emergency_contact_phone: Mapped[str | None] = mapped_column(String(32))

    user: Mapped[User] = relationship(back_populates="tenant_profile")
    leases: Mapped[list[Lease]] = relationship(back_populates="tenant", passive_deletes=True)
    documents: Mapped[list[LeaseDocument]] = relationship(back_populates="tenant")
    enquiries: Mapped[list[Enquiry]] = relationship(back_populates="converted_tenant")


class Lease(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "leases"
    __table_args__ = (
        CheckConstraint("end_date > start_date", name="ck_leases_end_after_start"),
        CheckConstraint("monthly_rent >= 0", name="ck_leases_rent_nonnegative"),
        CheckConstraint("security_deposit >= 0", name="ck_leases_deposit_nonnegative"),
        UniqueConstraint("tenant_id", "unit_id", "start_date", name="uq_leases_tenant_unit_start"),
        Index(
            "uq_leases_active_unit",
            "unit_id",
            unique=True,
            postgresql_where=text("lease_status = 'ACTIVE'"),
        ),
        Index("ix_leases_tenant_status", "tenant_id", "lease_status"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenant_profiles.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    unit_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("units.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    monthly_rent: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    security_deposit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    lease_status: Mapped[LeaseStatus] = mapped_column(
        "lease_status",
        enum_type(LeaseStatus, "lease_status"),
        nullable=False,
        default=LeaseStatus.DRAFT,
        server_default=LeaseStatus.DRAFT.value,
    )

    tenant: Mapped[TenantProfile] = relationship(back_populates="leases")
    unit: Mapped[Unit] = relationship(back_populates="leases")
    documents: Mapped[list[LeaseDocument]] = relationship(back_populates="lease")
    payments: Mapped[list[Payment]] = relationship(back_populates="lease")


class LeaseDocument(UUIDPrimaryKey, Base):
    __tablename__ = "lease_documents"
    __table_args__ = (
        CheckConstraint(
            "tenant_id IS NOT NULL OR lease_id IS NOT NULL",
            name="ck_lease_documents_has_owner",
        ),
        CheckConstraint(
            "file_size_bytes IS NULL OR file_size_bytes >= 0",
            name="ck_lease_documents_file_size_nonnegative",
        ),
        UniqueConstraint("storage_key", name="uq_lease_documents_storage_key"),
    )

    tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tenant_profiles.id", ondelete="RESTRICT"),
        index=True,
    )
    lease_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("leases.id", ondelete="RESTRICT"),
        index=True,
    )
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(160))
    file_size_bytes: Mapped[int | None] = mapped_column()
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    uploaded_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )

    tenant: Mapped[TenantProfile | None] = relationship(back_populates="documents")
    lease: Mapped[Lease | None] = relationship(back_populates="documents")


class Enquiry(UUIDPrimaryKey, Base):
    __tablename__ = "enquiries"
    __table_args__ = (
        CheckConstraint("budget_min >= 0", name="ck_enquiries_budget_min_nonnegative"),
        CheckConstraint("budget_max >= budget_min", name="ck_enquiries_budget_range"),
        CheckConstraint(
            "preferred_bedrooms IS NULL OR preferred_bedrooms >= 0",
            name="ck_enquiries_bedrooms_nonnegative",
        ),
        Index("ix_enquiries_status_created", "enquiry_status", "created_at"),
        Index("ix_enquiries_email", "email"),
    )

    name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(32))
    budget_min: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    budget_max: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    preferred_location: Mapped[str | None] = mapped_column(String(160))
    preferred_bedrooms: Mapped[int | None] = mapped_column()
    source_channel: Mapped[EnquirySource] = mapped_column(
        enum_type(EnquirySource, "enquiry_source"),
        nullable=False,
    )
    enquiry_status: Mapped[EnquiryStatus] = mapped_column(
        enum_type(EnquiryStatus, "enquiry_status"),
        nullable=False,
        default=EnquiryStatus.NEW,
        server_default=EnquiryStatus.NEW.value,
    )
    assigned_manager_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    converted_tenant_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("tenant_profiles.id", ondelete="SET NULL"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    assigned_manager: Mapped[User | None] = relationship(foreign_keys=[assigned_manager_id])
    converted_tenant: Mapped[TenantProfile | None] = relationship(back_populates="enquiries")
    property_matches: Mapped[list[EnquiryPropertyMatch]] = relationship(
        back_populates="enquiry",
        cascade="all, delete-orphan",
    )
    visit_requests: Mapped[list[PropertyVisitRequest]] = relationship(
        back_populates="enquiry",
        passive_deletes=True,
    )
    followups: Mapped[list[EnquiryFollowup]] = relationship(
        back_populates="enquiry",
        cascade="all, delete-orphan",
    )


class EnquiryPropertyMatch(UUIDPrimaryKey, Base):
    __tablename__ = "enquiry_property_matches"
    __table_args__ = (
        UniqueConstraint("enquiry_id", "property_id", name="uq_enquiry_property_match"),
    )

    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("enquiries.id", ondelete="CASCADE"),
        nullable=False,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    match_score: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    enquiry: Mapped[Enquiry] = relationship(back_populates="property_matches")
    property: Mapped[Property] = relationship(back_populates="enquiry_matches")


class PropertyVisitRequest(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "property_visit_requests"

    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("enquiries.id", ondelete="RESTRICT"),
        nullable=False,
    )
    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
    )
    requested_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    approval_status: Mapped[ApprovalStatus] = mapped_column(
        enum_type(ApprovalStatus, "visit_approval_status"),
        nullable=False,
        default=ApprovalStatus.PENDING,
        server_default=ApprovalStatus.PENDING.value,
    )
    decided_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    remarks: Mapped[str | None] = mapped_column(Text)

    enquiry: Mapped[Enquiry] = relationship(back_populates="visit_requests")
    property: Mapped[Property] = relationship()
    decided_by: Mapped[User | None] = relationship(foreign_keys=[decided_by_id])
    approval_request: Mapped[ApprovalRequest | None] = relationship(
        back_populates="visit_request",
        foreign_keys="ApprovalRequest.property_visit_request_id",
        uselist=False,
    )


class EnquiryFollowup(UUIDPrimaryKey, Base):
    __tablename__ = "enquiry_followups"

    enquiry_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("enquiries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    note: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    enquiry: Mapped[Enquiry] = relationship(back_populates="followups")
    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
