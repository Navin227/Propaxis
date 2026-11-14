from decimal import Decimal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.demo_auth import (
    require_company_admin,
    require_operational_user,
)
from app.core.demo_users import DEMO_USERS, get_demo_user
from app.models import (
    AuditLog,
    Property,
    PropertyManagerAssignment,
    Unit,
    User,
)
from app.models.enums import OccupancyStatus, PropertyStatus, UserRole
from app.schemas.properties import PropertyCreate, PropertyRead, PropertyUpdate

router = APIRouter(tags=["properties"])


def _property_query(user: User):
    statement = select(Property)
    if user.role == UserRole.PROPERTY_MANAGER:
        statement = statement.where(
            Property.status != PropertyStatus.INACTIVE,
            Property.id.in_(
                select(PropertyManagerAssignment.property_id).where(
                    PropertyManagerAssignment.manager_id == user.id,
                    PropertyManagerAssignment.is_active.is_(True),
                )
            ),
        )
    return statement.options(
        selectinload(Property.manager_assignments).joinedload(PropertyManagerAssignment.manager)
    )


def _unit_counts(
    db: Session,
    property_ids: list[UUID],
) -> dict[UUID, tuple[int, int, Decimal]]:
    if not property_ids:
        return {}
    rows = db.execute(
        select(
            Unit.property_id,
            func.count(Unit.id).label("total"),
            func.count(Unit.id)
            .filter(Unit.occupancy_status == OccupancyStatus.OCCUPIED)
            .label("occupied"),
            func.coalesce(func.sum(Unit.monthly_rent), Decimal("0.00")).label("monthly_rent"),
        )
        .where(Unit.property_id.in_(property_ids), Unit.is_active.is_(True))
        .group_by(Unit.property_id)
    )
    return {
        row.property_id: (int(row.total), int(row.occupied), Decimal(row.monthly_rent))
        for row in rows
    }


def _serialize_property(
    prop: Property,
    counts: dict[UUID, tuple[int, int, Decimal]],
) -> PropertyRead:
    active_total, occupied, monthly_rent = counts.get(
        prop.id,
        (0, 0, Decimal("0.00")),
    )
    assignments = sorted(
        (
            assignment
            for assignment in prop.manager_assignments
            if assignment.is_active and assignment.manager.is_active
        ),
        key=lambda assignment: (assignment.assigned_at, str(assignment.manager_id)),
    )
    manager = assignments[0].manager if assignments else None
    demo_manager_id = next(
        (
            demo_user["id"]
            for demo_user in DEMO_USERS
            if manager is not None and demo_user["email"] == manager.email
        ),
        "",
    )
    status_labels = {
        PropertyStatus.ACTIVE: "Active",
        PropertyStatus.INACTIVE: "Onboarding",
        PropertyStatus.UNDER_MAINTENANCE: "Maintenance",
    }
    return PropertyRead(
        id=prop.id,
        name=prop.property_name,
        address=prop.address,
        city=prop.city,
        state=prop.state,
        postalCode=prop.postal_code,
        description=prop.description,
        type="Residential Tower",
        propertyType=prop.property_type,
        totalUnits=prop.total_units if prop.total_units else active_total,
        occupiedUnits=occupied,
        vacantUnits=max(active_total - occupied, 0),
        managerId=demo_manager_id or (str(manager.id) if manager else ""),
        managerName=manager.full_name if manager else "",
        status=status_labels[prop.status],
        monthlyTargetRent=monthly_rent,
        created_at=prop.created_at,
        updated_at=prop.updated_at,
    )


def _manager_for_demo_id(db: Session, manager_id: str | None) -> User | None:
    if manager_id is None:
        return None
    identity = get_demo_user(manager_id)
    if identity is None or identity["role"] != "manager":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="manager_id must identify a configured demo property manager.",
        )
    manager = db.scalar(select(User).where(User.email == identity["email"]))
    if (
        manager is None
        or not manager.is_active
        or manager.role != UserRole.PROPERTY_MANAGER
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="The selected demo property manager is unavailable.",
        )
    return manager


def _replace_manager_assignment(
    db: Session,
    prop: Property,
    manager_id: str | None,
) -> None:
    assignments = list(
        db.scalars(
            select(PropertyManagerAssignment).where(
                PropertyManagerAssignment.property_id == prop.id,
            )
        ).all()
    )
    manager = _manager_for_demo_id(db, manager_id)
    for assignment in assignments:
        assignment.is_active = manager is not None and assignment.manager_id == manager.id
    if manager is not None and all(item.manager_id != manager.id for item in assignments):
        db.add(
            PropertyManagerAssignment(
                manager_id=manager.id,
                property_id=prop.id,
                is_active=True,
            )
        )


def _get_visible_property(db: Session, user: User, property_id: UUID) -> Property:
    prop = db.scalar(_property_query(user).where(Property.id == property_id))
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )
    return prop


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
            entity_type="property",
            entity_id=entity_id,
            changes=changes,
        )
    )


@router.get(
    "/properties",
    response_model=list[PropertyRead],
    summary="List accessible properties",
    description=(
        "Demo-only. Send x-user-id with a configured demo identity. "
        "x-user-role is ignored. Pagination is returned as response headers."
    ),
)
def list_properties(
    response: Response,
    limit: int = Query(default=50, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    search: str | None = Query(default=None, max_length=120),
    city: str | None = Query(default=None, max_length=120),
    property_status: PropertyStatus | None = Query(default=None, alias="status"),
    user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> list[PropertyRead]:
    statement = _property_query(user)
    if search:
        search_pattern = f"%{search.strip()}%"
        statement = statement.where(
            Property.property_name.ilike(search_pattern)
            | Property.address.ilike(search_pattern)
            | Property.city.ilike(search_pattern)
        )
    if city:
        statement = statement.where(func.lower(Property.city) == city.strip().lower())
    if property_status is not None:
        statement = statement.where(Property.status == property_status)
    elif user.role == UserRole.COMPANY_ADMIN:
        statement = statement.where(Property.status != PropertyStatus.INACTIVE)

    count_statement = select(func.count()).select_from(statement.order_by(None).subquery())
    total = int(db.scalar(count_statement) or 0)
    properties = list(
        db.scalars(
            statement.order_by(Property.property_name, Property.id)
            .limit(limit)
            .offset(offset)
        ).all()
    )
    counts = _unit_counts(db, [prop.id for prop in properties])
    response.headers["X-Total-Count"] = str(total)
    response.headers["X-Page-Limit"] = str(limit)
    response.headers["X-Page-Offset"] = str(offset)
    return [_serialize_property(prop, counts) for prop in properties]


@router.get(
    "/properties/{property_id}",
    response_model=PropertyRead,
    summary="Get property details",
)
def get_property(
    property_id: UUID,
    user: User = Depends(require_operational_user),
    db: Session = Depends(get_db),
) -> PropertyRead:
    prop = _get_visible_property(db, user, property_id)
    return _serialize_property(prop, _unit_counts(db, [prop.id]))


@router.post(
    "/properties",
    response_model=PropertyRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a property",
)
def create_property(
    payload: PropertyCreate,
    user: User = Depends(require_company_admin),
    db: Session = Depends(get_db),
) -> PropertyRead:
    values = payload.model_dump(exclude={"manager_id", "monthly_target_rent"})
    prop = Property(**values)
    db.add(prop)
    try:
        db.flush()
        _replace_manager_assignment(db, prop, payload.manager_id)
        _record_audit(
            db,
            user,
            "property.created",
            prop.id,
            {"property_name": prop.property_name},
        )
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A property with these identifying details already exists.",
        ) from None
    db.expire(prop, ["manager_assignments"])
    prop = db.scalar(_property_query(user).where(Property.id == prop.id))
    assert prop is not None
    return _serialize_property(prop, _unit_counts(db, [prop.id]))


@router.patch(
    "/properties/{property_id}",
    response_model=PropertyRead,
    summary="Update property details",
)
def update_property(
    property_id: UUID,
    payload: PropertyUpdate,
    user: User = Depends(require_company_admin),
    db: Session = Depends(get_db),
) -> PropertyRead:
    prop = db.scalar(_property_query(user).where(Property.id == property_id))
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )
    changes = payload.model_dump(exclude_unset=True)
    manager_id = changes.pop("manager_id", None)
    if not changes and "manager_id" not in payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="At least one property field must be provided.",
        )
    previous_values = {key: str(getattr(prop, key)) for key in changes}
    for key, value in changes.items():
        setattr(prop, key, value)
    if "manager_id" in payload.model_fields_set:
        _replace_manager_assignment(db, prop, manager_id)
    _record_audit(
        db,
        user,
        "property.updated",
        prop.id,
        {
            "before": previous_values,
            "after": {key: str(value) for key, value in changes.items()},
            "manager_id": manager_id,
        },
    )
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The property update conflicts with an existing record.",
        ) from None
    db.expire(prop, ["manager_assignments"])
    prop = db.scalar(_property_query(user).where(Property.id == prop.id))
    assert prop is not None
    return _serialize_property(prop, _unit_counts(db, [prop.id]))


@router.delete(
    "/properties/{property_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Archive a property",
    description="Sets status to INACTIVE; property, units, leases, and payments are retained.",
)
def archive_property(
    property_id: UUID,
    user: User = Depends(require_company_admin),
    db: Session = Depends(get_db),
) -> Response:
    prop = db.get(Property, property_id)
    if prop is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Property not found.",
        )
    prop.status = PropertyStatus.INACTIVE
    _record_audit(db, user, "property.archived", prop.id, {"status": "INACTIVE"})
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
