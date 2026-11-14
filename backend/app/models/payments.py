import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey
from app.models.enums import DeliveryStatus, PaymentMethod, PaymentStatus, enum_type


class Payment(UUIDPrimaryKey, Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payments_amount_positive"),
        UniqueConstraint("gateway_order_id", name="uq_payments_gateway_order_id"),
        UniqueConstraint("gateway_payment_id", name="uq_payments_gateway_payment_id"),
        UniqueConstraint("transaction_reference", name="uq_payments_transaction_reference"),
        Index("ix_payments_tenant_status", "tenant_id", "payment_status"),
        Index("ix_payments_lease_due", "lease_id", "due_at"),
    )

    tenant_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("tenant_profiles.id", ondelete="RESTRICT"),
        nullable=False,
    )
    lease_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("leases.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="INR", server_default="INR")
    payment_status: Mapped[PaymentStatus] = mapped_column(
        enum_type(PaymentStatus, "payment_status"),
        nullable=False,
        default=PaymentStatus.PENDING,
        server_default=PaymentStatus.PENDING.value,
    )
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        enum_type(PaymentMethod, "payment_method"),
    )
    gateway_order_id: Mapped[str | None] = mapped_column(String(180))
    gateway_payment_id: Mapped[str | None] = mapped_column(String(180))
    transaction_reference: Mapped[str | None] = mapped_column(String(180))
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
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

    tenant: Mapped[TenantProfile] = relationship()
    lease: Mapped[Lease] = relationship(back_populates="payments")
    transactions: Mapped[list[PaymentTransaction]] = relationship(
        back_populates="payment",
        passive_deletes="all",
        order_by="PaymentTransaction.created_at",
    )
    receipt: Mapped[PaymentReceipt | None] = relationship(
        back_populates="payment",
        uselist=False,
    )


class PaymentTransaction(UUIDPrimaryKey, Base):
    __tablename__ = "payment_transactions"
    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_payment_transactions_amount_positive"),
        UniqueConstraint("gateway_order_id", name="uq_payment_transactions_gateway_order_id"),
        UniqueConstraint("gateway_payment_id", name="uq_payment_transactions_gateway_payment_id"),
        UniqueConstraint("provider_reference", name="uq_payment_transactions_provider_reference"),
        Index("ix_payment_transactions_payment_created", "payment_id", "created_at"),
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payment_status: Mapped[PaymentStatus] = mapped_column(
        enum_type(PaymentStatus, "payment_transaction_status"),
        nullable=False,
    )
    payment_method: Mapped[PaymentMethod | None] = mapped_column(
        enum_type(PaymentMethod, "payment_transaction_method"),
    )
    gateway_order_id: Mapped[str | None] = mapped_column(String(180))
    gateway_payment_id: Mapped[str | None] = mapped_column(String(180))
    provider_reference: Mapped[str | None] = mapped_column(String(180))
    response_code: Mapped[str | None] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    payment: Mapped[Payment] = relationship(back_populates="transactions")


class PaymentReceipt(UUIDPrimaryKey, Base):
    __tablename__ = "payment_receipts"
    __table_args__ = (
        UniqueConstraint("payment_id", name="uq_payment_receipts_payment_id"),
        UniqueConstraint("receipt_reference", name="uq_payment_receipts_reference"),
        UniqueConstraint("storage_key", name="uq_payment_receipts_storage_key"),
    )

    payment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"),
        nullable=False,
    )
    receipt_reference: Mapped[str] = mapped_column(String(180), nullable=False)
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    issued_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    payment: Mapped[Payment] = relationship(back_populates="receipt")
