from datetime import date
from decimal import Decimal
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.demo_users import DEMO_USERS_BY_ID
from app.main import app
from app.models import (
    Lease,
    Property,
    PropertyManagerAssignment,
    TenantProfile,
    Unit,
    User,
)
from app.models.enums import (
    AvailabilityStatus,
    OccupancyStatus,
    PropertyStatus,
    PropertyType,
    UserRole,
)
from app.schemas.properties import PropertyCreate
from app.schemas.units import UnitCreate, UnitRead


def test_unknown_demo_identity_is_rejected_even_with_admin_role_header() -> None:
    with TestClient(app) as client:
        response = client.get(
            "/api/v1/properties",
            headers={"x-user-id": "unknown", "x-user-role": "admin"},
        )
    assert response.status_code == 401


@pytest.fixture
def api_client(db_session: Session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.pop(get_db, None)


def _demo_user(db_session: Session, demo_id: str) -> User:
    identity = DEMO_USERS_BY_ID[demo_id]
    existing = db_session.scalar(select(User).where(User.email == identity["email"]))
    if existing is not None:
        return existing
    roles = {
        "admin": UserRole.COMPANY_ADMIN,
        "manager": UserRole.PROPERTY_MANAGER,
        "tenant": UserRole.TENANT,
    }
    user = User(
        full_name=identity["name"],
        email=identity["email"],
        role=roles[identity["role"]],
        is_active=True,
    )
    db_session.add(user)
    db_session.flush()
    return user


def _property(
    db_session: Session,
    name: str | None = None,
    *,
    manager_id: str | None = None,
    city: str = "Bengaluru",
) -> Property:
    suffix = uuid4().hex[:8]
    prop = Property(
        property_name=name or f"API Residence {suffix}",
        address=f"{suffix} Main Road",
        city=city,
        state="Karnataka",
        postal_code="560001",
        property_type=PropertyType.RESIDENTIAL,
        total_units=1,
        status=PropertyStatus.ACTIVE,
    )
    db_session.add(prop)
    db_session.flush()
    if manager_id is not None:
        manager = _demo_user(db_session, manager_id)
        db_session.add(
            PropertyManagerAssignment(
                manager_id=manager.id,
                property_id=prop.id,
                is_active=True,
            )
        )
        db_session.flush()
    return prop


def _unit(db_session: Session, prop: Property, number: str = "A-101") -> Unit:
    unit = Unit(
        property_id=prop.id,
        unit_number=f"{number}-{uuid4().hex[:5]}",
        bedrooms=2,
        bathrooms=2,
        area=1000,
        monthly_rent=50000,
        security_deposit=150000,
        occupancy_status=OccupancyStatus.VACANT,
        availability_status=AvailabilityStatus.AVAILABLE,
    )
    db_session.add(unit)
    db_session.flush()
    return unit


def _headers(demo_id: str, role_header: str = "not-trusted") -> dict[str, str]:
    return {"x-user-id": demo_id, "x-user-role": role_header}


def _property_payload(name: str = "API Created Residence") -> dict[str, object]:
    return {
        "name": name,
        "address": "12 Test Main Road",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postalCode": "560001",
        "type": "Residential Tower",
        "totalUnits": 2,
        "status": "Active",
        "monthlyTargetRent": 100000,
    }


def _unit_payload(
    property_id: str,
    unit_number: str = "B-201",
) -> dict[str, object]:
    return {
        "propertyId": property_id,
        "unitNumber": unit_number,
        "floor": 2,
        "bedrooms": 2,
        "bathrooms": 2,
        "areaSqFt": 1000,
        "monthlyRent": 50000,
        "securityDeposit": 150000,
        "occupancyStatus": "Vacant",
        "availability": "Available",
    }


def _assert_json_number(value: object, expected: float) -> None:
    assert type(value) in (int, float)
    assert value == expected


def test_admin_property_crud_and_archive_preserves_related_unit(
    api_client: TestClient,
    db_session: Session,
) -> None:
    admin = _demo_user(db_session, "usr-admin-1")
    _demo_user(db_session, "usr-mgr-1")
    prop = _property(db_session)
    unit = _unit(db_session, prop)
    db_session.flush()

    response = api_client.get("/api/v1/properties", headers=_headers("usr-admin-1"))
    assert response.status_code == 200
    assert any(item["id"] == str(prop.id) for item in response.json())
    assert response.headers["x-total-count"]

    created = api_client.post(
        "/api/v1/properties",
        headers=_headers("usr-admin-1"),
        json={**_property_payload(), "managerId": "usr-mgr-1"},
    )
    assert created.status_code == 201
    assert created.json()["name"] == "API Created Residence"
    assert created.json()["totalUnits"] == 2
    assert created.json()["managerId"] == "usr-mgr-1"
    created_id = created.json()["id"]

    updated = api_client.patch(
        f"/api/v1/properties/{created_id}",
        headers=_headers("usr-admin-1"),
        json={"name": "Updated API Residence", "city": "Pune"},
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Updated API Residence"
    assert updated.json()["city"] == "Pune"

    archived = api_client.delete(
        f"/api/v1/properties/{prop.id}",
        headers=_headers("usr-admin-1"),
    )
    assert archived.status_code == 204
    db_session.refresh(prop)
    db_session.refresh(unit)
    assert prop.status == PropertyStatus.INACTIVE
    assert unit.property_id == prop.id
    assert db_session.get(User, admin.id) is not None
    active_units = api_client.get("/api/v1/units", headers=_headers("usr-admin-1"))
    assert all(item["id"] != str(unit.id) for item in active_units.json())


def test_admin_can_create_update_and_archive_unit(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-admin-1")
    tenant_user = _demo_user(db_session, "usr-tenant-1")
    prop = _property(db_session)

    created = api_client.post(
        f"/api/v1/properties/{prop.id}/units",
        headers=_headers("usr-admin-1"),
        json=_unit_payload(str(prop.id)),
    )
    assert created.status_code == 201
    unit_id = created.json()["id"]
    assert created.json()["propertyId"] == str(prop.id)
    assert created.json()["floor"] == 2
    _assert_json_number(created.json()["monthlyRent"], 50000)
    unit = db_session.get(Unit, unit_id)
    assert unit is not None
    assert unit.floor == 2
    tenant = db_session.scalar(
        select(TenantProfile).where(TenantProfile.user_id == tenant_user.id)
    )
    if tenant is None:
        tenant = TenantProfile(user_id=tenant_user.id)
        db_session.add(tenant)
        db_session.flush()
    lease = Lease(
        tenant_id=tenant.id,
        unit_id=unit.id,
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        monthly_rent=Decimal("50000"),
        security_deposit=Decimal("150000"),
    )
    db_session.add(lease)
    db_session.flush()

    updated = api_client.patch(
        f"/api/v1/units/{unit_id}",
        headers=_headers("usr-admin-1"),
        json={**_unit_payload(str(prop.id)), "floor": 4, "monthlyRent": 57500},
    )
    assert updated.status_code == 200
    _assert_json_number(updated.json()["monthlyRent"], 57500)
    assert updated.json()["floor"] == 4
    assert unit.floor == 4

    archived = api_client.delete(
        f"/api/v1/units/{unit_id}",
        headers=_headers("usr-admin-1"),
    )
    assert archived.status_code == 204
    unit = db_session.get(Unit, unit_id)
    assert unit is not None
    assert unit.is_active is False
    assert db_session.get(Lease, lease.id) is not None


def test_legacy_global_unit_routes_use_body_property_id(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-admin-1")
    prop = _property(db_session)

    created = api_client.post(
        "/api/v1/units",
        headers=_headers("usr-admin-1"),
        json=_unit_payload(str(prop.id), "C-301"),
    )
    assert created.status_code == 201
    assert created.json()["propertyId"] == str(prop.id)
    listed = api_client.get("/api/v1/units", headers=_headers("usr-admin-1"))
    assert any(unit["id"] == created.json()["id"] for unit in listed.json())


def test_manager_can_only_view_assigned_properties_and_update_their_units(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-mgr-1")
    assigned = _property(db_session, manager_id="usr-mgr-1")
    unassigned = _property(db_session)
    unit = _unit(db_session, assigned)
    _unit(db_session, unassigned)

    listing = api_client.get("/api/v1/properties", headers=_headers("usr-mgr-1"))
    assert listing.status_code == 200
    visible_property_ids = {item["id"] for item in listing.json()}
    assert str(assigned.id) in visible_property_ids
    assert str(unassigned.id) not in visible_property_ids
    assert (
        api_client.get(
            f"/api/v1/properties/{unassigned.id}",
            headers=_headers("usr-mgr-1"),
        ).status_code
        == 404
    )
    unassigned_unit = _unit(db_session, unassigned)
    assert (
        api_client.get(
            f"/api/v1/units/{unassigned_unit.id}",
            headers=_headers("usr-mgr-1"),
        ).status_code
        == 404
    )
    assert (
        api_client.get(
            f"/api/v1/properties/{assigned.id}/units",
            headers=_headers("usr-mgr-1"),
        ).status_code
        == 200
    )

    updated = api_client.patch(
        f"/api/v1/units/{unit.id}",
        headers=_headers("usr-mgr-1", role_header="admin"),
        json={"monthlyRent": 54000},
    )
    assert updated.status_code == 200
    _assert_json_number(updated.json()["monthlyRent"], 54000)


def test_unit_response_serializes_monthly_rent_as_json_number() -> None:
    unit = UnitRead(
        id=uuid4(),
        propertyId=uuid4(),
        propertyName="API Residence",
        unitNumber="A-101",
        floor=1,
        bedrooms=2,
        bathrooms=Decimal("1.5"),
        areaSqFt=Decimal("1000.00"),
        monthlyRent=Decimal("57500.25"),
        securityDeposit=Decimal("150000.00"),
        occupancyStatus="Vacant",
        availability="Available",
        description=None,
    )

    json_payload = unit.model_dump(mode="json")

    _assert_json_number(json_payload["monthlyRent"], 57500.25)


def test_manager_cannot_create_or_archive_properties_or_units(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-mgr-1")
    prop = _property(db_session, manager_id="usr-mgr-1")
    unit = _unit(db_session, prop)
    headers = _headers("usr-mgr-1")

    assert (
        api_client.post(
            "/api/v1/properties",
            headers=headers,
            json=_property_payload(),
        ).status_code
        == 403
    )
    assert (
        api_client.post(
            f"/api/v1/properties/{prop.id}/units",
            headers=headers,
            json=_unit_payload(str(prop.id)),
        ).status_code
        == 403
    )
    assert api_client.delete(f"/api/v1/properties/{prop.id}", headers=headers).status_code == 403
    assert api_client.delete(f"/api/v1/units/{unit.id}", headers=headers).status_code == 403


def test_tenant_is_denied_and_client_role_header_is_not_authoritative(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-tenant-1")
    _property(db_session)

    denied = api_client.get(
        "/api/v1/properties",
        headers=_headers("usr-tenant-1", role_header="admin"),
    )
    assert denied.status_code == 403
    assert (
        api_client.get(
            "/api/v1/units",
            headers=_headers("usr-tenant-1"),
        ).status_code
        == 403
    )
    assert (
        api_client.get(
            "/api/v1/properties",
            headers={"x-user-role": "admin"},
        ).status_code
        == 401
    )


def test_manager_options_only_include_active_configured_managers(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-admin-1")
    _demo_user(db_session, "usr-mgr-1")
    inactive_manager = _demo_user(db_session, "usr-mgr-2")
    inactive_manager.is_active = False

    response = api_client.get("/api/v1/users", headers=_headers("usr-admin-1"))

    assert response.status_code == 200
    assert response.json() == [
        {"id": "usr-mgr-1", "name": "Rohan Mehta", "role": "manager"}
    ]
    assert "email" not in response.text


def test_duplicate_unit_number_is_rejected(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-admin-1")
    prop = _property(db_session)
    headers = _headers("usr-admin-1")
    payload = _unit_payload(str(prop.id), "DUP-1")

    first = api_client.post(f"/api/v1/properties/{prop.id}/units", headers=headers, json=payload)
    duplicate = api_client.post(
        f"/api/v1/properties/{prop.id}/units",
        headers=headers,
        json=payload,
    )

    assert first.status_code == 201
    assert duplicate.status_code == 409


def test_unit_migrations_are_present_and_preserve_existing_active_rows(
    db_session: Session,
) -> None:
    columns = {column["name"]: column for column in inspect(db_session.bind).get_columns("units")}
    assert columns["is_active"]["nullable"] is False
    assert columns["floor"]["nullable"] is True
    inactive_rows = db_session.scalar(
        select(Unit.id).where(Unit.is_active.is_(False)).limit(1)
    )
    assert inactive_rows is None


def test_property_filters_search_pagination_and_invalid_requests(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-admin-1")
    first = _property(db_session, "Alpha API Residence", city="Bengaluru")
    second = _property(db_session, "Beta API Residence", city="Bengaluru")
    _property(db_session, "Gamma API Residence", city="Pune")
    headers = _headers("usr-admin-1")

    response = api_client.get(
        "/api/v1/properties?search=API%20Residence&city=Bengaluru&status=ACTIVE&limit=1&offset=0",
        headers=headers,
    )
    assert response.status_code == 200
    assert len(response.json()) == 1
    assert response.headers["x-total-count"] == "2"
    assert response.json()[0]["id"] in {str(first.id), str(second.id)}

    assert api_client.get("/api/v1/properties/not-a-uuid", headers=headers).status_code == 422
    assert api_client.get("/api/v1/units/not-a-uuid", headers=headers).status_code == 422
    assert api_client.get(f"/api/v1/properties/{uuid4()}", headers=headers).status_code == 404
    assert api_client.get(f"/api/v1/units/{uuid4()}", headers=headers).status_code == 404
    assert (
        api_client.post(
            "/api/v1/properties",
            headers=headers,
            json={"name": "", "address": "x"},
        ).status_code
        == 422
    )


def test_unit_input_rejects_mismatched_property_and_bad_values(
    api_client: TestClient,
    db_session: Session,
) -> None:
    _demo_user(db_session, "usr-admin-1")
    first = _property(db_session)
    second = _property(db_session)

    response = api_client.post(
        f"/api/v1/properties/{first.id}/units",
        headers=_headers("usr-admin-1"),
        json=_unit_payload(str(second.id)),
    )
    assert response.status_code == 422

    invalid = _unit_payload(str(first.id))
    invalid["monthlyRent"] = -1
    response = api_client.post(
        f"/api/v1/properties/{first.id}/units",
        headers=_headers("usr-admin-1"),
        json=invalid,
    )
    assert response.status_code == 422


def test_frontend_request_aliases_validate_without_persisting_unsupported_columns() -> None:
    property_payload = PropertyCreate.model_validate(_property_payload())
    assert property_payload.property_name == "API Created Residence"
    assert property_payload.property_type == PropertyType.RESIDENTIAL

    unit_payload = UnitCreate.model_validate(_unit_payload(str(uuid4())))
    assert unit_payload.area == 1000
    assert unit_payload.floor == 2
    assert unit_payload.occupancy_status == OccupancyStatus.VACANT
    assert unit_payload.availability_status == AvailabilityStatus.AVAILABLE
