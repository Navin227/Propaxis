import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.communications import json_metadata_type
from app.models.enums import DeliveryStatus, NotificationChannel, enum_type


class Notification(UUIDPrimaryKey, Base):
    __tablename__ = "notifications"
    __table_args__ = (
        Index("ix_notifications_recipient_status", "recipient_id", "delivery_status"),
        Index("ix_notifications_event_created", "event_type", "created_at"),
    )

    recipient_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        enum_type(NotificationChannel, "notification_channel"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        enum_type(DeliveryStatus, "notification_delivery_status"),
        nullable=False,
        default=DeliveryStatus.PENDING,
        server_default=DeliveryStatus.PENDING.value,
    )
    payload: Mapped[dict[str, object]] = mapped_column(
        json_metadata_type,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    recipient: Mapped[User] = relationship()


class NotificationPreference(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "notification_preferences"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "channel",
            "event_type",
            name="uq_notification_preference_user_channel_event",
        ),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
    )
    channel: Mapped[NotificationChannel] = mapped_column(
        enum_type(NotificationChannel, "notification_preference_channel"),
        nullable=False,
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    user: Mapped[User] = relationship()
