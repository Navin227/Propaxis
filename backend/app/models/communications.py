import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, UUIDPrimaryKey
from app.models.enums import (
    CommunicationChannel,
    CommunicationEventType,
    DeliveryStatus,
    MessageDirection,
    enum_type,
)

json_metadata_type = JSON().with_variant(JSONB, "postgresql")


class Conversation(UUIDPrimaryKey, Base):
    __tablename__ = "conversations"

    subject: Mapped[str | None] = mapped_column(String(200))
    external_reference: Mapped[str | None] = mapped_column(String(200), index=True)
    created_by_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
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

    created_by: Mapped[User | None] = relationship(foreign_keys=[created_by_id])
    participants: Mapped[list[ConversationParticipant]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
    )
    messages: Mapped[list[Message]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="Message.created_at",
    )
    events: Mapped[list[CommunicationEvent]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="CommunicationEvent.occurred_at",
    )


class ConversationParticipant(UUIDPrimaryKey, Base):
    __tablename__ = "conversation_participants"
    __table_args__ = (
        CheckConstraint(
            "user_id IS NOT NULL OR external_name IS NOT NULL "
            "OR external_email IS NOT NULL OR external_phone IS NOT NULL",
            name="ck_conversation_participants_identity",
        ),
        UniqueConstraint(
            "conversation_id",
            "user_id",
            name="uq_conversation_participant_user",
        ),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="RESTRICT"),
        index=True,
    )
    external_name: Mapped[str | None] = mapped_column(String(160))
    external_email: Mapped[str | None] = mapped_column(String(320))
    external_phone: Mapped[str | None] = mapped_column(String(32))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    conversation: Mapped[Conversation] = relationship(back_populates="participants")
    user: Mapped[User | None] = relationship()


class Message(UUIDPrimaryKey, Base):
    __tablename__ = "messages"
    __table_args__ = (
        UniqueConstraint(
            "channel",
            "provider_reference",
            name="uq_messages_channel_provider_reference",
        ),
        Index("ix_messages_conversation_created", "conversation_id", "created_at"),
        Index("ix_messages_delivery_status", "delivery_status"),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    recipient_user_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        index=True,
    )
    sender_external: Mapped[str | None] = mapped_column(String(320))
    recipient_external: Mapped[str | None] = mapped_column(String(320))
    content: Mapped[str] = mapped_column(Text, nullable=False)
    channel: Mapped[CommunicationChannel] = mapped_column(
        enum_type(CommunicationChannel, "communication_channel"),
        nullable=False,
    )
    direction: Mapped[MessageDirection] = mapped_column(
        enum_type(MessageDirection, "message_direction"),
        nullable=False,
    )
    delivery_status: Mapped[DeliveryStatus] = mapped_column(
        enum_type(DeliveryStatus, "delivery_status"),
        nullable=False,
        default=DeliveryStatus.PENDING,
        server_default=DeliveryStatus.PENDING.value,
    )
    provider_reference: Mapped[str | None] = mapped_column(String(220))
    conversation_reference: Mapped[str | None] = mapped_column(String(220))
    channel_metadata: Mapped[dict[str, object]] = mapped_column(
        "channel_metadata",
        json_metadata_type,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    is_ai_generated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    human_assistance_requested: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
    )
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    sender_user: Mapped[User | None] = relationship(foreign_keys=[sender_user_id])
    recipient_user: Mapped[User | None] = relationship(foreign_keys=[recipient_user_id])


class CommunicationEvent(UUIDPrimaryKey, Base):
    __tablename__ = "communication_events"
    __table_args__ = (
        Index("ix_communication_events_conversation_time", "conversation_id", "occurred_at"),
        UniqueConstraint(
            "channel",
            "provider_reference",
            name="uq_communication_events_channel_provider_reference",
        ),
    )

    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    channel: Mapped[CommunicationChannel] = mapped_column(
        enum_type(CommunicationChannel, "communication_event_channel"),
        nullable=False,
    )
    event_type: Mapped[CommunicationEventType] = mapped_column(
        enum_type(CommunicationEventType, "communication_event_type"),
        nullable=False,
    )
    provider_reference: Mapped[str | None] = mapped_column(String(220))
    event_metadata: Mapped[dict[str, object]] = mapped_column(
        json_metadata_type,
        nullable=False,
        default=dict,
        server_default="{}",
    )
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )

    conversation: Mapped[Conversation] = relationship(back_populates="events")
