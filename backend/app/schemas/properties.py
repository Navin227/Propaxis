from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.models.enums import PropertyStatus, PropertyType


class PropertyCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    property_name: str = Field(
        min_length=1,
        max_length=180,
        validation_alias=AliasChoices("property_name", "name"),
    )
    address: str = Field(min_length=1, max_length=320)
    city: str = Field(min_length=1, max_length=120)
    state: str = Field(min_length=1, max_length=120)
    postal_code: str = Field(
        min_length=1,
        max_length=20,
        validation_alias=AliasChoices("postal_code", "postalCode"),
    )
    description: str | None = None
    property_type: PropertyType = Field(
        default=PropertyType.RESIDENTIAL,
        validation_alias=AliasChoices("property_type", "propertyType", "type"),
    )
    total_units: int = Field(
        default=0,
        ge=0,
        validation_alias=AliasChoices("total_units", "totalUnits"),
    )
    status: PropertyStatus = PropertyStatus.ACTIVE
    manager_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("manager_id", "managerId"),
    )
    monthly_target_rent: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
        exclude=True,
        validation_alias=AliasChoices("monthly_target_rent", "monthlyTargetRent"),
        description="Accepted for legacy UI compatibility; no target-rent column exists.",
    )

    @field_validator("property_name", "address", "city", "state", "postal_code", mode="before")
    @classmethod
    def trim_required_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("property_type", mode="before")
    @classmethod
    def normalize_frontend_property_type(cls, value: object) -> object:
        if isinstance(value, str) and value in {
            "Residential Tower",
            "Boutique Apartments",
            "Serviced Residences",
        }:
            return PropertyType.RESIDENTIAL.value
        return value

    @field_validator("status", mode="before")
    @classmethod
    def normalize_frontend_status(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return {
            "Active": PropertyStatus.ACTIVE.value,
            "Maintenance": PropertyStatus.UNDER_MAINTENANCE.value,
        }.get(value, value)


class PropertyUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    property_name: str | None = Field(
        default=None,
        min_length=1,
        max_length=180,
        validation_alias=AliasChoices("property_name", "name"),
    )
    address: str | None = Field(default=None, min_length=1, max_length=320)
    city: str | None = Field(default=None, min_length=1, max_length=120)
    state: str | None = Field(default=None, min_length=1, max_length=120)
    postal_code: str | None = Field(
        default=None,
        min_length=1,
        max_length=20,
        validation_alias=AliasChoices("postal_code", "postalCode"),
    )
    description: str | None = None
    property_type: PropertyType | None = Field(
        default=None,
        validation_alias=AliasChoices("property_type", "propertyType", "type"),
    )
    total_units: int | None = Field(
        default=None,
        ge=0,
        validation_alias=AliasChoices("total_units", "totalUnits"),
    )
    status: PropertyStatus | None = None
    manager_id: str | None = Field(
        default=None,
        validation_alias=AliasChoices("manager_id", "managerId"),
    )
    monthly_target_rent: Decimal | None = Field(
        default=None,
        ge=0,
        max_digits=12,
        decimal_places=2,
        exclude=True,
        validation_alias=AliasChoices("monthly_target_rent", "monthlyTargetRent"),
        description="Accepted for legacy UI compatibility; no target-rent column exists.",
    )

    @field_validator("property_name", "address", "city", "state", "postal_code", mode="before")
    @classmethod
    def trim_optional_text(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("property_type", mode="before")
    @classmethod
    def normalize_frontend_property_type(cls, value: object) -> object:
        if isinstance(value, str) and value in {
            "Residential Tower",
            "Boutique Apartments",
            "Serviced Residences",
        }:
            return PropertyType.RESIDENTIAL.value
        return value

    @field_validator("status", mode="before")
    @classmethod
    def normalize_frontend_status(cls, value: object) -> object:
        if not isinstance(value, str):
            return value
        return {
            "Active": PropertyStatus.ACTIVE.value,
            "Maintenance": PropertyStatus.UNDER_MAINTENANCE.value,
        }.get(value, value)

    @model_validator(mode="after")
    def reject_null_non_nullable_fields(self) -> "PropertyUpdate":
        required_fields = {
            "property_name",
            "address",
            "city",
            "state",
            "postal_code",
            "property_type",
            "total_units",
            "status",
        }
        for field_name in self.model_fields_set & required_fields:
            if getattr(self, field_name) is None:
                raise ValueError(f"{field_name} cannot be null.")
        return self


class PropertyRead(BaseModel):
    id: UUID
    name: str
    address: str
    city: str
    state: str
    postalCode: str
    description: str | None
    type: Literal["Residential Tower"]
    propertyType: PropertyType
    totalUnits: int
    occupiedUnits: int
    vacantUnits: int
    managerId: str
    managerName: str
    status: Literal["Active", "Maintenance", "Onboarding"]
    imageUrl: str = Field(
        default="",
        description="Empty because property image metadata is not part of the current schema.",
    )
    amenities: list[str] = Field(
        default_factory=list,
        description="Empty because property amenities are not part of the current schema.",
    )
    monthlyTargetRent: Decimal = Field(
        description="Computed sum of active unit rents; there is no stored target-rent field."
    )
    created_at: datetime
    updated_at: datetime
