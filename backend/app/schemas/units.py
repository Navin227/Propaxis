from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import (
    AliasChoices,
    BaseModel,
    ConfigDict,
    Field,
    field_validator,
    field_serializer,
    model_validator,
)

from app.models.enums import AvailabilityStatus, OccupancyStatus


class UnitCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    property_id: UUID | None = Field(
        default=None,
        validation_alias=AliasChoices("property_id", "propertyId"),
        description="Required by the compatibility POST /units route.",
    )
    unit_number: str = Field(
        min_length=1,
        max_length=40,
        validation_alias=AliasChoices("unit_number", "unitNumber"),
    )
    bedrooms: int = Field(ge=0)
    bathrooms: Decimal = Field(ge=0, max_digits=4, decimal_places=1)
    area: Decimal = Field(
        gt=0,
        max_digits=10,
        decimal_places=2,
        validation_alias=AliasChoices("area", "areaSqFt"),
    )
    monthly_rent: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
        validation_alias=AliasChoices("monthly_rent", "monthlyRent"),
    )
    security_deposit: Decimal = Field(
        ge=0,
        max_digits=12,
        decimal_places=2,
        validation_alias=AliasChoices("security_deposit", "securityDeposit"),
    )
    occupancy_status: OccupancyStatus = Field(
        default=OccupancyStatus.VACANT,
        validation_alias=AliasChoices("occupancy_status", "occupancyStatus"),
    )
    availability_status: AvailabilityStatus = Field(
        default=AvailabilityStatus.AVAILABLE,
        validation_alias=AliasChoices("availability_status", "availability"),
    )
    description: str | None = None
    floor: int | None = Field(
        default=None,
        ge=0,
        description="Optional floor number; null when unknown.",
    )

    @field_validator("unit_number", mode="before")
    @classmethod
    def trim_unit_number(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("occupancy_status", mode="before")
    @classmethod
    def normalize_frontend_occupancy(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return {
            "Occupied": OccupancyStatus.OCCUPIED.value,
            "Vacant": OccupancyStatus.VACANT.value,
            "Under Notice": OccupancyStatus.UNDER_NOTICE.value,
        }.get(value, value)

    @field_validator("availability_status", mode="before")
    @classmethod
    def normalize_frontend_availability(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return {
            "Available": AvailabilityStatus.AVAILABLE.value,
            "Leased": AvailabilityStatus.LEASED.value,
            "Maintenance Hold": AvailabilityStatus.MAINTENANCE_HOLD.value,
        }.get(value, value)


class UnitUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    property_id: UUID | None = Field(
        default=None,
        validation_alias=AliasChoices("property_id", "propertyId"),
        description="Accepted for UI compatibility; a unit cannot be moved.",
    )
    unit_number: str | None = Field(
        default=None,
        min_length=1,
        max_length=40,
        validation_alias=AliasChoices("unit_number", "unitNumber"),
        description="Accepted for UI compatibility; a unit number cannot be changed.",
    )
    bedrooms: int | None = Field(default=None, ge=0)
    bathrooms: Decimal | None = Field(default=None, ge=0, max_digits=4, decimal_places=1)
    area: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=10,
        decimal_places=2,
        validation_alias=AliasChoices("area", "areaSqFt"),
    )
    monthly_rent: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
        validation_alias=AliasChoices("monthly_rent", "monthlyRent"),
    )
    security_deposit: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
        validation_alias=AliasChoices("security_deposit", "securityDeposit"),
    )
    occupancy_status: OccupancyStatus | None = Field(
        default=None,
        validation_alias=AliasChoices("occupancy_status", "occupancyStatus"),
    )
    availability_status: AvailabilityStatus | None = Field(
        default=None,
        validation_alias=AliasChoices("availability_status", "availability"),
    )
    description: str | None = None
    floor: int | None = Field(
        default=None,
        ge=0,
        description="Optional floor number; null when unknown.",
    )

    @field_validator("unit_number", mode="before")
    @classmethod
    def trim_unit_number(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("occupancy_status", mode="before")
    @classmethod
    def normalize_frontend_occupancy(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return {
            "Occupied": OccupancyStatus.OCCUPIED.value,
            "Vacant": OccupancyStatus.VACANT.value,
            "Under Notice": OccupancyStatus.UNDER_NOTICE.value,
        }.get(value, value)

    @field_validator("availability_status", mode="before")
    @classmethod
    def normalize_frontend_availability(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return {
            "Available": AvailabilityStatus.AVAILABLE.value,
            "Leased": AvailabilityStatus.LEASED.value,
            "Maintenance Hold": AvailabilityStatus.MAINTENANCE_HOLD.value,
        }.get(value, value)

    @model_validator(mode="after")
    def reject_null_non_nullable_fields(self) -> "UnitUpdate":
        required_fields = {
            "bedrooms",
            "bathrooms",
            "area",
            "monthly_rent",
            "security_deposit",
            "occupancy_status",
            "availability_status",
        }
        for field_name in self.model_fields_set & required_fields:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self


class UnitRead(BaseModel):
    id: UUID
    propertyId: UUID
    propertyName: str
    unitNumber: str
    floor: int | None = Field(default=None, description="Null when the floor is unknown.")
    bedrooms: int
    bathrooms: Decimal
    areaSqFt: Decimal
    monthlyRent: Decimal = Field(
        description="Serialized as a JSON number for the frontend; persisted values remain Decimal."
    )
    securityDeposit: Decimal
    occupancyStatus: Literal["Occupied", "Vacant", "Under Notice"]
    availability: Literal["Available", "Leased", "Maintenance Hold"]
    description: str | None
    tenantId: str | None = None
    tenantName: str | None = None

    @field_serializer("monthlyRent", when_used="json", return_type=float)
    def serialize_monthly_rent(self, value: Decimal) -> float:
        return float(value)
