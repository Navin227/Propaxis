from datetime import date, datetime, timezone
from decimal import Decimal
from uuid import uuid4

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import (
    ApprovalAction,
    ApprovalRequest,
    Enquiry,
    Lease,
    MaintenanceRequest,
    Payment,
    PaymentTransaction,
    Property,
    PropertyManagerAssignment,
    PropertyVisitRequest,
    TenantProfile,
    Unit,
    User,
)
from app.models.enums import (
    ApprovalActionType,
    ApprovalStatus,
    ApprovalType,
    AvailabilityStatus,
    EnquirySource,
    LeaseStatus,
    MaintenanceCategory,
    MaintenanceStatus,
    OccupancyStatus,
    PaymentMethod,
    PaymentStatus,
    Priority,
    PropertyStatus,
    PropertyType,
    UserRole,
)
from scripts.seed_demo import seed_demo_data


def _user(session: Session, email: str, role: UserRole) -> User:
    user = User(full_name=email.split("@")[0], email=email, role=role)
    session.add(user)
    session.flush()
    return user


def _property(session: Session, name: str = "Test Residence") -> Property:
    prop = Property(
        property_name=name,
        address=f"{name} address",
        city="Bengaluru",
        state="Karnataka",
        postal_code="560001",
        property_type=PropertyType.RESIDENTIAL,
        total_units=1,
        status=PropertyStatus.ACTIVE,
    )
    session.add(prop)
    session.flush()
    return prop


def _unit(session: Session, prop: Property, number: str = "T-101") -> Unit:
    unit = Unit(
        property_id=prop.id,
        unit_number=number,
        bedrooms=2,
        bathrooms=Decimal("2"),
        area=Decimal("1000"),
        monthly_rent=Decimal("50000"),
        security_deposit=Decimal("150000"),
        occupancy_status=OccupancyStatus.VACANT,
        availability_status=AvailabilityStatus.AVAILABLE,
    )
    session.add(unit)
    session.flush()
    return unit


def test_property_and_unit_relationship(db_session: Session) -> None:
    prop = _property(db_session)
    unit = _unit(db_session, prop)

    db_session.expire_all()
    loaded = db_session.scalar(select(Property).where(Property.id == prop.id))
    assert loaded is not None
    assert loaded.units[0].id == unit.id
    assert loaded.units[0].property.property_name == prop.property_name


def test_manager_assignment_is_property_scoped(db_session: Session) -> None:
    manager = _user(db_session, "manager@example.invalid", UserRole.PROPERTY_MANAGER)
    prop = _property(db_session)
    assignment = PropertyManagerAssignment(manager_id=manager.id, property_id=prop.id)
    db_session.add(assignment)
    db_session.flush()

    db_session.expire_all()
    loaded = db_session.scalar(
        select(PropertyManagerAssignment).where(PropertyManagerAssignment.id == assignment.id)
    )
    assert loaded is not None
    assert loaded.manager.role == UserRole.PROPERTY_MANAGER
    assert loaded.property.id == prop.id


def test_tenant_lease_and_payment_relationships(db_session: Session) -> None:
    user = _user(db_session, "tenant@example.invalid", UserRole.TENANT)
    tenant = TenantProfile(user_id=user.id)
    prop = _property(db_session)
    unit = _unit(db_session, prop)
    db_session.add(tenant)
    db_session.flush()
    lease = Lease(
        tenant_id=tenant.id,
        unit_id=unit.id,
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        monthly_rent=Decimal("50000"),
        security_deposit=Decimal("150000"),
        lease_status=LeaseStatus.ACTIVE,
    )
    db_session.add(lease)
    db_session.flush()
    payment = Payment(
        tenant_id=tenant.id,
        lease_id=lease.id,
        amount=Decimal("50000"),
        payment_status=PaymentStatus.PENDING,
        payment_method=PaymentMethod.UPI,
    )
    db_session.add(payment)
    db_session.flush()
    transaction = PaymentTransaction(
        payment_id=payment.id,
        amount=payment.amount,
        payment_status=PaymentStatus.SUCCESS,
        payment_method=PaymentMethod.UPI,
        gateway_order_id="test-order-1",
        gateway_payment_id="test-payment-1",
    )
    db_session.add(transaction)
    db_session.flush()
    db_session.expire_all()

    loaded = db_session.get(TenantProfile, tenant.id)
    assert loaded is not None
    assert loaded.user.email == "tenant@example.invalid"
    assert loaded.leases[0].unit.id == unit.id
    assert loaded.leases[0].payments[0].transactions[0].gateway_payment_id == "test-payment-1"


def test_active_lease_is_unique_per_unit(db_session: Session) -> None:
    user = _user(db_session, "tenant@example.invalid", UserRole.TENANT)
    tenant = TenantProfile(user_id=user.id)
    prop = _property(db_session)
    unit = _unit(db_session, prop)
    db_session.add(tenant)
    db_session.flush()
    lease_values = {
        "tenant_id": tenant.id,
        "unit_id": unit.id,
        "start_date": date(2026, 1, 1),
        "end_date": date(2027, 1, 1),
        "monthly_rent": Decimal("50000"),
        "security_deposit": Decimal("150000"),
        "lease_status": LeaseStatus.ACTIVE,
    }
    db_session.add(Lease(**lease_values))
    db_session.flush()
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(Lease(**lease_values))
            db_session.flush()


def test_payment_transaction_history_blocks_payment_deletion(db_session: Session) -> None:
    user = _user(db_session, "tenant@example.invalid", UserRole.TENANT)
    tenant = TenantProfile(user_id=user.id)
    prop = _property(db_session)
    unit = _unit(db_session, prop)
    db_session.add(tenant)
    db_session.flush()
    lease = Lease(
        tenant_id=tenant.id,
        unit_id=unit.id,
        start_date=date(2026, 1, 1),
        end_date=date(2027, 1, 1),
        monthly_rent=Decimal("50000"),
        security_deposit=Decimal("150000"),
        lease_status=LeaseStatus.ACTIVE,
    )
    payment = Payment(
        tenant_id=tenant.id,
        lease=lease,
        amount=Decimal("50000"),
        payment_status=PaymentStatus.SUCCESS,
        payment_method=PaymentMethod.UPI,
    )
    db_session.add_all([lease, payment])
    db_session.flush()
    db_session.add(
        PaymentTransaction(
            payment_id=payment.id,
            amount=payment.amount,
            payment_status=PaymentStatus.SUCCESS,
            payment_method=PaymentMethod.UPI,
            provider_reference="preserve-this-transaction",
        )
    )
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.delete(payment)
            db_session.flush()


def test_maintenance_request_links_tenant_property_and_unit(db_session: Session) -> None:
    user = _user(db_session, "tenant@example.invalid", UserRole.TENANT)
    tenant = TenantProfile(user_id=user.id)
    prop = _property(db_session)
    unit = _unit(db_session, prop)
    db_session.add(tenant)
    db_session.flush()
    request = MaintenanceRequest(
        tenant_id=tenant.id,
        property_id=prop.id,
        unit_id=unit.id,
        category=MaintenanceCategory.PLUMBING,
        description="Leaking sink",
        priority=Priority.MEDIUM,
        status=MaintenanceStatus.SUBMITTED,
    )
    db_session.add(request)
    db_session.flush()
    db_session.expire_all()

    loaded = db_session.get(MaintenanceRequest, request.id)
    assert loaded is not None
    assert loaded.property.id == prop.id
    assert loaded.unit.id == unit.id
    assert loaded.tenant.user.id == user.id


def test_maintenance_rejects_unit_from_another_property(db_session: Session) -> None:
    user = _user(db_session, "tenant@example.invalid", UserRole.TENANT)
    tenant = TenantProfile(user_id=user.id)
    property_one = _property(db_session, "Property One")
    property_two = _property(db_session, "Property Two")
    unit = _unit(db_session, property_two, "T-202")
    db_session.add(tenant)
    db_session.flush()

    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(
                MaintenanceRequest(
                    tenant_id=tenant.id,
                    property_id=property_one.id,
                    unit_id=unit.id,
                    category=MaintenanceCategory.ELECTRICAL,
                    description="Mismatched property and unit",
                    priority=Priority.LOW,
                    status=MaintenanceStatus.SUBMITTED,
                )
            )
            db_session.flush()


def test_approval_workflow_links_visit_and_action(db_session: Session) -> None:
    admin = _user(db_session, "admin@example.invalid", UserRole.COMPANY_ADMIN)
    manager = _user(db_session, "manager@example.invalid", UserRole.PROPERTY_MANAGER)
    prop = _property(db_session)
    enquiry = Enquiry(
        name="Prospective Tenant",
        email="prospect@example.invalid",
        budget_min=Decimal("40000"),
        budget_max=Decimal("60000"),
        source_channel=EnquirySource.WEBSITE,
        assigned_manager_id=manager.id,
    )
    db_session.add(enquiry)
    db_session.flush()
    visit = PropertyVisitRequest(
        enquiry_id=enquiry.id,
        property_id=prop.id,
        requested_at=datetime.now(timezone.utc),
        approval_status=ApprovalStatus.PENDING,
    )
    db_session.add(visit)
    db_session.flush()
    request = ApprovalRequest(
        approval_type=ApprovalType.PROPERTY_VISIT,
        requester_id=manager.id,
        assigned_approver_id=admin.id,
        related_entity_type="property_visit_request",
        related_entity_id=visit.id,
        property_visit_request_id=visit.id,
        title="Approve a property visit",
        status=ApprovalStatus.PENDING,
    )
    db_session.add(request)
    db_session.flush()
    action = ApprovalAction(
        approval_request_id=request.id,
        actor_id=admin.id,
        action=ApprovalActionType.APPROVED,
        remarks="Approved after reviewing manager availability.",
    )
    db_session.add(action)
    db_session.flush()
    db_session.expire_all()

    loaded = db_session.get(ApprovalRequest, request.id)
    assert loaded is not None
    assert loaded.visit_request.id == visit.id
    assert loaded.actions[0].actor.id == admin.id
    assert visit.approval_status == ApprovalStatus.PENDING


def test_foreign_key_and_unique_constraints(db_session: Session) -> None:
    prop = _property(db_session)
    _unit(db_session, prop)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(
                Unit(
                    property_id=uuid4(),
                    unit_number="ORPHAN",
                    bedrooms=1,
                    bathrooms=Decimal("1"),
                    area=Decimal("500"),
                    monthly_rent=Decimal("10000"),
                    security_deposit=Decimal("30000"),
                )
            )
            db_session.flush()

    first = _user(db_session, "unique@example.invalid", UserRole.COMPANY_ADMIN)
    with pytest.raises(IntegrityError):
        with db_session.begin_nested():
            db_session.add(
                User(
                    full_name="Duplicate Email",
                    email=first.email.upper(),
                    role=UserRole.COMPANY_ADMIN,
                )
            )
            db_session.flush()


def test_demo_seed_script_is_idempotent(db_session: Session) -> None:
    first_summary = seed_demo_data(db_session)
    counts_after_first = {
        model.__tablename__: db_session.scalar(select(func.count()).select_from(model))
        for model in (User, Property, Unit, TenantProfile, Lease, Payment)
    }
    second_summary = seed_demo_data(db_session)
    counts_after_second = {
        model.__tablename__: db_session.scalar(select(func.count()).select_from(model))
        for model in (User, Property, Unit, TenantProfile, Lease, Payment)
    }

    assert first_summary == second_summary
    assert counts_after_first == counts_after_second
    assert counts_after_second["users"] == 4
    assert counts_after_second["properties"] == 4
    assert counts_after_second["units"] == 12
