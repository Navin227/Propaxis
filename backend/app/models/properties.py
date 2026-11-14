import uuid
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base, TimestampMixin, UUIDPrimaryKey
from app.models.enums import (
    AvailabilityStatus,
    OccupancyStatus,
    PropertyStatus,
    PropertyType,
    enum_type,
)


class Property(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "properties"
    __table_args__ = (
        CheckConstraint("total_units >= 0", name="ck_properties_total_units_nonnegative"),
        UniqueConstraint("property_name", "address", name="uq_properties_name_address"),
        Index("ix_properties_city_name", "city", "property_name"),
        Index("ix_properties_status", "status"),
    )

    property_name: Mapped[str] = mapped_column(String(180), nullable=False)
    address: Mapped[str] = mapped_column(String(320), nullable=False)
    city: Mapped[str] = mapped_column(String(120), nullable=False)
    state: Mapped[str] = mapped_column(String(120), nullable=False)
    postal_code: Mapped[str] = mapped_column(String(20), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    property_type: Mapped[PropertyType] = mapped_column(
        enum_type(PropertyType, "property_type"),
        nullable=False,
        default=PropertyType.RESIDENTIAL,
        server_default=PropertyType.RESIDENTIAL.value,
    )
    total_units: Mapped[int] = mapped_column(nullable=False, default=0, server_default="0")
    status: Mapped[PropertyStatus] = mapped_column(
        enum_type(PropertyStatus, "property_status"),
        nullable=False,
        default=PropertyStatus.ACTIVE,
        server_default=PropertyStatus.ACTIVE.value,
    )

    units: Mapped[list[Unit]] = relationship(back_populates="property", passive_deletes=True)
    manager_assignments: Mapped[list[PropertyManagerAssignment]] = relationship(
        back_populates="property",
        passive_deletes=True,
    )
    enquiry_matches: Mapped[list[EnquiryPropertyMatch]] = relationship(back_populates="property")
    maintenance_requests: Mapped[list[MaintenanceRequest]] = relationship(back_populates="property")


class Unit(UUIDPrimaryKey, TimestampMixin, Base):
    __tablename__ = "units"
    __table_args__ = (
        UniqueConstraint("property_id", "unit_number", name="uq_units_property_unit_number"),
        UniqueConstraint("property_id", "id", name="uq_units_property_id_id"),
        CheckConstraint("bedrooms >= 0", name="ck_units_bedrooms_nonnegative"),
        CheckConstraint("bathrooms >= 0", name="ck_units_bathrooms_nonnegative"),
        CheckConstraint("area > 0", name="ck_units_area_positive"),
        CheckConstraint("monthly_rent >= 0", name="ck_units_monthly_rent_nonnegative"),
        CheckConstraint("security_deposit >= 0", name="ck_units_deposit_nonnegative"),
        CheckConstraint(
            "floor IS NULL OR floor >= 0",
            name="ck_units_floor_nonnegative",
        ),
        Index("ix_units_property_occupancy", "property_id", "occupancy_status"),
        Index("ix_units_property_active", "property_id", "is_active"),
    )

    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="RESTRICT"),
        nullable=False,
    )
    unit_number: Mapped[str] = mapped_column(String(40), nullable=False)
    floor: Mapped[int | None] = mapped_column(nullable=True)
    bedrooms: Mapped[int] = mapped_column(nullable=False)
    bathrooms: Mapped[Decimal] = mapped_column(Numeric(4, 1), nullable=False)
    area: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    monthly_rent: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    security_deposit: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    occupancy_status: Mapped[OccupancyStatus] = mapped_column(
        enum_type(OccupancyStatus, "occupancy_status"),
        nullable=False,
        default=OccupancyStatus.VACANT,
        server_default=OccupancyStatus.VACANT.value,
    )
    availability_status: Mapped[AvailabilityStatus] = mapped_column(
        enum_type(AvailabilityStatus, "availability_status"),
        nullable=False,
        default=AvailabilityStatus.AVAILABLE,
        server_default=AvailabilityStatus.AVAILABLE.value,
    )
    is_active: Mapped[bool] = mapped_column(nullable=False, default=True, server_default="true")
    description: Mapped[str | None] = mapped_column(Text)

    property: Mapped[Property] = relationship(back_populates="units")
    leases: Mapped[list[Lease]] = relationship(back_populates="unit", passive_deletes=True)
