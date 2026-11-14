from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.demo_auth import (
    require_company_admin,
    require_operational_user,
)
from app.models import AuditLog, Property, PropertyManagerAssignment, Unit, User
from app.models.enums import PropertyStatus, UserRole
from app.schemas.units import UnitCreate, UnitRead, UnitUpdate

router = APIRouter(tags=["units"])


def _unit_query(user: User, property_id: UUID | None = None):
    statement = (
        select(Unit)
        .options(joinedload(Unit.property))
        .where(
            Unit.is_active.is_(True),
            Unit.property.has(Property.status != PropertyStatus.INACTIVE),
        )
    )
    if property_id is not None:
        statement = statement.where(Unit.property_id == property_id)
    if user.role == UserRole.PROPERTY_MANAGER:
        statement = statement.where(
            Unit.property_id.in_(
                select(PropertyManagerAssignment.property_id).where(
                    PropertyManagerAssignment.manager_id == user.id,
                    PropertyManagerAssignment.is_active.is_(True),
                )
            )
        )
    return statement


def _get_accessible_unit(db: Session, user: User, unit_id: UUID) -> Unit:
    unit = db.scalar(_unit_query(user).where(Unit.id == unit_id))
    if unit is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Unit not found.",
        )
    return unit


def _serialize_unit(unit: Unit) -> UnitRead:
    occupancy_labels = {
        "OCCUPIED": "Occupied",
        "VACANT": "Vacant",
        "UNDER_NOTICE": "Under Notice",
    }
    availability_labels = {
        "AVAILABLE": "Available",
        "LEASED": "Leased",
        "MAINTENANCE_HOLD": "Maintenance Hold",
    }
    return UnitRead(
        id=unit.id,
        propertyId=unit.property_id,
        propertyName=unit.property.property_name,
        unitNumber=unit.unit_number,
        bedrooms=unit.bedrooms,
        bathrooms=unit.bathrooms,
        areaSqFt=unit.area,
        monthlyRent=unit.monthly_rent,
        securityDeposit=unit.security_deposit,
        floor=unit.floor,
        occupancyStatus=occupancy_labels[unit.occupancy_status.value],
        availability=availability_labels[unit.availability_status.value],
        description=unit.description,
    )


def _record_audit(
    db: Session,
    user: User,
    action: str,
    entity_id: UUID,
    changes: dict[str, object],
) -> None:
    db.add(
        AuditLog(
            actor_id=user.id,
            action=action,
            entity_type="unit",
            entity_id=entity_id,
            changes=changes,
        )
    )


def _create_unit(
    property_id: UUID,
    payload: UnitCreate,
    user: User,
    db: Session,
) -> UnitRead:
    prop = db.get(Property, property_id)
    if prop is None or prop.status == PropertyStatus.INACTIVE:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Active property not found.",
        )
    if payload.property_id is not None and payload.property_id != property_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The body property_id must match the property in the URL.",
        )
    values = payload.model_dump(exclude={"property_id"})
    unit = Unit(property_id=property_id, **values)
    db.add(unit)
    try:
        db.flush()
        _record_audit(
            db,
            user,
            "unit.created",
            unit.id,
            {"unit_number": unit.unit_number, "property_id": str(property_id)},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A unit with this number already exists at the property.",
        ) from None
    unit = db.scalar(
        select(Unit)
        .options(joinedload(Unit.property))
        .where(Unit.id == unit.id)
    )
    assert unit is not None
    return _serialize_unit(unit)


@router.get(
    "/properties/{property_id}/units",
    response_model=list[UnitRead],
    summary="List units for a property",
)
def list_property_units(
    property_id: UUID,
    response: Response,
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=80),
    user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> list[UnitRead]:
    if user.role == UserRole.PROPERTY_MANAGER:
        assigned_property = db.scalar(
            select(Property.id).where(
                Property.id == property_id,
                Property.status != PropertyStatus.INACTIVE,
                Property.id.in_(
                    select(PropertyManagerAssignment.property_id).where(
                        PropertyManagerAssignment.manager_id == user.id,
                        PropertyManagerAssignment.is_active.is_(True),
                    )
                ),
            )
        )
        if assigned_property is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Property not found.",
            )
    elif db.get(Property, property_id) is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )

    statement = _unit_query(user, property_id)
    if search:
        statement = statement.where(Unit.unit_number.ilike(f"%{search.strip()}%"))
    total = int(
        db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    )
    units = list(
        db.scalars(
            statement.order_by(Unit.unit_number, Unit.id).limit(limit).offset(offset)
        ).unique().all()
    )
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page-Limit"] = str(limit)
    response.headers["X-Page-Offset"] = str(offset)
    return [_serialize_unit(unit) for unit in units]


@router.get(
    "/units",
    response_model=list[UnitRead],
    summary="List accessible units",
    description="Compatibility listing for clients that need units across accessible properties.",
)
def list_units(
    response: Response,
    limit: int = Query(default=100, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    property_id: UUID | None = None,
    search: str | None = Query(default=None, max_length=80),
    user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> list[UnitRead]:
    statement = _unit_query(user, property_id)
    if search:
        statement = statement.where(Unit.unit_number.ilike(f"%{search.strip()}%"))
    total = int(
        db.scalar(select(func.count()).select_from(statement.order_by(None).subquery())) or 0
    )
    units = list(
        db.scalars(
            statement.order_by(Unit.property_id, Unit.unit_number, Unit.id)
            .limit(limit)
            .offset(offset)
        ).unique().all()
    )
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page-Limit"] = str(limit)
    response.headers["X-Page-Offset"] = str(offset)
    return [_serialize_unit(unit) for unit in units]


@router.get("/units/{unit_id}", response_model=UnitRead, summary="Get unit details")
def get_unit(
    unit_id: UUID,
    user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> UnitRead:
    return _serialize_unit(_get_accessible_unit(db, user, unit_id))


@router.post(
    "/properties/{property_id}/units",
    response_model=UnitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a unit in a property",
)
def create_property_unit(
    property_id: UUID,
    payload: UnitCreate,
    user: User = Depends(require_company_admin),
    db: Session = Depends(get_db),
) -> UnitRead:
    return _create_unit(property_id, payload, user, db)


@router.post(
    "/units",
    response_model=UnitRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a unit using a property ID in the body",
    description="Compatibility endpoint; POST /properties/{property_id}/units is preferred.",
)
def create_unit_compatibility(
    payload: UnitCreate,
    user: User = Depends(require_company_admin),
    db: Session = Depends(get_db),
) -> UnitRead:
    if payload.property_id is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="propertyId is required when creating a unit at /units.",
        )
    property_id = payload.property_id
    return _create_unit(property_id, payload, user, db)


@router.patch("/units/{unit_id}", response_model=UnitRead, summary="Update a unit")
def update_unit(
    unit_id: UUID,
    payload: UnitUpdate,
    user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> UnitRead:
    unit = _get_accessible_unit(db, user, unit_id)
    changes = payload.model_dump(exclude_unset=True)
    requested_property_id = changes.pop("property_id", None)
    requested_unit_number = changes.pop("unit_number", None)
    if requested_property_id not in {None, unit.property_id}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A unit cannot be moved to another property.",
        )
    if requested_unit_number not in {None, unit.unit_number}:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A unit number cannot be changed.",
        )
    if not changes:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one unit field must be provided.",
        )
    previous_values = {key: str(getattr(unit, key)) for key in changes}
    for key, value in changes.items():
        setattr(unit, key, value)
    _record_audit(
        db,
        user,
        "unit.updated",
        unit.id,
        {"before": previous_values, "after": {key: str(value) for key, value in changes.items()}},
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The unit update conflicts with an existing record.",
        ) from None
    db.refresh(unit)
    unit = db.scalar(
        select(Unit)
        .options(joinedload(Unit.property))
        .where(Unit.id == unit.id)
    )
    assert unit is not None
    return _serialize_unit(unit)


@router.delete(
    "/units/{unit_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a unit",
    description="Sets is_active to false; leases and other dependent records are retained.",
)
def archive_unit(
    unit_id: UUID,
    user: User = Depends(require_company_admin),
    db: Session = Depends(get_db),
) -> Response:
    unit = _get_accessible_unit(db, user, unit_id)
    unit.is_active = False
    _record_audit(db, user, "unit.archived", unit.id, {"is_active": False})
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
