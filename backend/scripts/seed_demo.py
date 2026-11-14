from __future__ import annotations

import logging
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import (
    ApprovalAction,
    ApprovalRequest,
    Enquiry,
    EnquiryFollowup,
    EnquiryPropertyMatch,
    Lease,
    MaintenanceAssignment,
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
    EnquiryStatus,
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

logger = logging.getLogger(__name__)

DEMO_USERS = (
    {
        "email": "ananya.deshmukh@propaxis.in",
        "full_name": "Ananya Deshmukh",
        "role": UserRole.COMPANY_ADMIN,
        "phone": "+91 98201 44120",
    },
    {
        "email": "rohan.mehta@propaxis.in",
        "full_name": "Rohan Mehta",
        "role": UserRole.PROPERTY_MANAGER,
        "phone": "+91 98450 22910",
    },
    {
        "email": "kavita.kulkarni@propaxis.in",
        "full_name": "Kavita Kulkarni",
        "role": UserRole.PROPERTY_MANAGER,
        "phone": "+91 98112 77341",
    },
    {
        "email": "priya.nair@gmail.com",
        "full_name": "Priya Nair",
        "role": UserRole.TENANT,
        "phone": "+91 99001 56234",
    },
)

DEMO_PROPERTIES = (
    {
        "property_name": "Oakwood Residences",
        "address": "14th Main, Indiranagar HAL 2nd Stage",
        "city": "Bengaluru",
        "state": "Karnataka",
        "postal_code": "560038",
        "manager": "rohan.mehta@propaxis.in",
        "units": (("A-402", 2, Decimal("2"), Decimal("1180"), Decimal("52000")), ("A-403", 2, Decimal("2"), Decimal("1100"), Decimal("48000")), ("A-404", 1, Decimal("1"), Decimal("760"), Decimal("35000"))),
    },
    {
        "property_name": "Skyline Heights",
        "address": "Plot 28, Worli Sea Face Road",
        "city": "Mumbai",
        "state": "Maharashtra",
        "postal_code": "400018",
        "manager": "kavita.kulkarni@propaxis.in",
        "units": (("SH-1104", 3, Decimal("3"), Decimal("1700"), Decimal("88000")), ("SH-1105", 2, Decimal("2"), Decimal("1280"), Decimal("68000")), ("SH-1201", 1, Decimal("1"), Decimal("790"), Decimal("42000"))),
    },
    {
        "property_name": "Emerald Court",
        "address": "Lane 7, Koregaon Park",
        "city": "Pune",
        "state": "Maharashtra",
        "postal_code": "411001",
        "manager": "rohan.mehta@propaxis.in",
        "units": (("EC-102", 2, Decimal("2"), Decimal("1050"), Decimal("42000")), ("EC-201", 2, Decimal("2"), Decimal("1150"), Decimal("47000")), ("EC-304", 3, Decimal("2"), Decimal("1480"), Decimal("62000"))),
    },
    {
        "property_name": "Cyberhub Suites",
        "address": "DLF Phase III, Sector 24",
        "city": "Gurugram",
        "state": "Haryana",
        "postal_code": "122002",
        "manager": "kavita.kulkarni@propaxis.in",
        "units": (("CS-701", 2, Decimal("2"), Decimal("1040"), Decimal("56000")), ("CS-702", 1, Decimal("1"), Decimal("720"), Decimal("39000")), ("CS-801", 3, Decimal("3"), Decimal("1620"), Decimal("82000"))),
    },
)


def _one_or_create(session: Session, model: type, criteria: dict, values: dict):
    record = session.scalar(select(model).filter_by(**criteria))
    if record is None:
        record = model(**values)
        session.add(record)
        session.flush()
    return record


def seed_demo_data(session: Session) -> dict[str, int]:
    users = {
        entry["email"]: _one_or_create(
            session,
            User,
            {"email": entry["email"]},
            {**entry, "is_active": True},
        )
        for entry in DEMO_USERS
    }

    properties: dict[str, Property] = {}
    units: dict[tuple[str, str], Unit] = {}
    for data in DEMO_PROPERTIES:
        prop = _one_or_create(
            session,
            Property,
            {
                "property_name": data["property_name"],
                "address": data["address"],
            },
            {
                "property_name": data["property_name"],
                "address": data["address"],
                "city": data["city"],
                "state": data["state"],
                "postal_code": data["postal_code"],
                "property_type": PropertyType.RESIDENTIAL,
                "total_units": len(data["units"]),
                "status": PropertyStatus.ACTIVE,
                "description": f"Demo residential community in {data['city']}.",
            },
        )
        properties[data["property_name"]] = prop
        assignment_criteria = {
            "manager_id": users[data["manager"]].id,
            "property_id": prop.id,
        }
        _one_or_create(
            session,
            PropertyManagerAssignment,
            assignment_criteria,
            assignment_criteria,
        )

        for index, (unit_number, bedrooms, bathrooms, area, rent) in enumerate(data["units"]):
            occupied = data["property_name"] == "Oakwood Residences" and unit_number == "A-402"
            criteria = {"property_id": prop.id, "unit_number": unit_number}
            values = {
                **criteria,
                "bedrooms": bedrooms,
                "bathrooms": bathrooms,
                "area": area,
                "monthly_rent": rent,
                "security_deposit": rent * 3,
                "occupancy_status": OccupancyStatus.OCCUPIED if occupied else OccupancyStatus.VACANT,
                "availability_status": AvailabilityStatus.LEASED if occupied else AvailabilityStatus.AVAILABLE,
                "description": f"{bedrooms} bedroom residential unit.",
            }
            units[(data["property_name"], unit_number)] = _one_or_create(
                session,
                Unit,
                criteria,
                values,
            )

    tenant_user = users["priya.nair@gmail.com"]
    tenant = _one_or_create(
        session,
        TenantProfile,
        {"user_id": tenant_user.id},
        {"user_id": tenant_user.id},
    )
    active_unit = units[("Oakwood Residences", "A-402")]
    active_start = date(2026, 1, 1)
    active_end = date(2027, 1, 1)
    active_lease = _one_or_create(
        session,
        Lease,
        {"tenant_id": tenant.id, "unit_id": active_unit.id, "start_date": active_start},
        {
            "tenant_id": tenant.id,
            "unit_id": active_unit.id,
            "start_date": active_start,
            "end_date": active_end,
            "monthly_rent": active_unit.monthly_rent,
            "security_deposit": active_unit.security_deposit,
            "lease_status": LeaseStatus.ACTIVE,
        },
    )
    historical_start = date(2024, 1, 1)
    _one_or_create(
        session,
        Lease,
        {"tenant_id": tenant.id, "unit_id": active_unit.id, "start_date": historical_start},
        {
            "tenant_id": tenant.id,
            "unit_id": active_unit.id,
            "start_date": historical_start,
            "end_date": date(2025, 1, 1),
            "monthly_rent": Decimal("48000"),
            "security_deposit": Decimal("144000"),
            "lease_status": LeaseStatus.EXPIRED,
        },
    )

    payment_criteria = {"transaction_reference": "DEMO-RENT-2026-11"}
    paid_payment = _one_or_create(
        session,
        Payment,
        payment_criteria,
        {
            "tenant_id": tenant.id,
            "lease_id": active_lease.id,
            "amount": active_lease.monthly_rent,
            "payment_status": PaymentStatus.SUCCESS,
            "payment_method": PaymentMethod.UPI,
            "gateway_payment_id": "DEMO-GATEWAY-PAYMENT-2026-11",
            "transaction_reference": payment_criteria["transaction_reference"],
            "paid_at": datetime(2026, 11, 5, 9, tzinfo=timezone.utc),
        },
    )
    _one_or_create(
        session,
        PaymentTransaction,
        {"provider_reference": "DEMO-TXN-2026-11"},
        {
            "payment_id": paid_payment.id,
            "amount": paid_payment.amount,
            "payment_status": PaymentStatus.SUCCESS,
            "payment_method": PaymentMethod.UPI,
            "gateway_payment_id": "DEMO-GATEWAY-PAYMENT-2026-11",
            "provider_reference": "DEMO-TXN-2026-11",
        },
    )
    pending_payment = _one_or_create(
        session,
        Payment,
        {"gateway_order_id": "DEMO-ORDER-2026-12"},
        {
            "tenant_id": tenant.id,
            "lease_id": active_lease.id,
            "amount": active_lease.monthly_rent,
            "payment_status": PaymentStatus.PENDING,
            "payment_method": PaymentMethod.UPI,
            "gateway_order_id": "DEMO-ORDER-2026-12",
        },
    )
    _one_or_create(
        session,
        PaymentTransaction,
        {"gateway_order_id": "DEMO-ORDER-2026-12"},
        {
            "payment_id": pending_payment.id,
            "amount": pending_payment.amount,
            "payment_status": PaymentStatus.PENDING,
            "payment_method": PaymentMethod.UPI,
            "gateway_order_id": "DEMO-ORDER-2026-12",
        },
    )

    maintenance_description = "Demo maintenance request: kitchen tap is leaking."
    maintenance_request = _one_or_create(
        session,
        MaintenanceRequest,
        {
            "tenant_id": tenant.id,
            "unit_id": active_unit.id,
            "description": maintenance_description,
        },
        {
            "tenant_id": tenant.id,
            "property_id": active_unit.property_id,
            "unit_id": active_unit.id,
            "category": MaintenanceCategory.PLUMBING,
            "description": maintenance_description,
            "priority": Priority.MEDIUM,
            "status": MaintenanceStatus.IN_PROGRESS,
        },
    )
    _one_or_create(
        session,
        MaintenanceAssignment,
        {
            "maintenance_request_id": maintenance_request.id,
            "technician_name": "Suresh Kumar",
            "vendor_name": "ClearFlow Plumbing Services",
        },
        {
            "maintenance_request_id": maintenance_request.id,
            "technician_name": "Suresh Kumar",
            "vendor_name": "ClearFlow Plumbing Services",
            "contact_phone": "+91 98000 44556",
            "notes": "Visit scheduled for the next business day.",
        },
    )

    enquiry_email = "demo-enquiry@example.invalid"
    enquiry = _one_or_create(
        session,
        Enquiry,
        {"email": enquiry_email, "name": "Aarav Sharma"},
        {
            "name": "Aarav Sharma",
            "email": enquiry_email,
            "phone": "+91 98000 12345",
            "budget_min": Decimal("45000"),
            "budget_max": Decimal("65000"),
            "preferred_location": "Bengaluru",
            "preferred_bedrooms": 2,
            "source_channel": EnquirySource.WEBSITE,
            "enquiry_status": EnquiryStatus.VISIT_REQUESTED,
            "assigned_manager_id": users["rohan.mehta@propaxis.in"].id,
        },
    )
    _one_or_create(
        session,
        EnquiryPropertyMatch,
        {"enquiry_id": enquiry.id, "property_id": active_unit.property_id},
        {"enquiry_id": enquiry.id, "property_id": active_unit.property_id, "match_score": Decimal("94.00")},
    )
    _one_or_create(
        session,
        EnquiryFollowup,
        {"enquiry_id": enquiry.id, "note": "Initial enquiry received through the website."},
        {
            "enquiry_id": enquiry.id,
            "note": "Initial enquiry received through the website.",
            "created_by_id": users["rohan.mehta@propaxis.in"].id,
        },
    )

    pending_requested_at = datetime(2026, 12, 15, 10, tzinfo=timezone.utc)
    approved_requested_at = datetime(2026, 11, 20, 10, tzinfo=timezone.utc)
    for requested_at, status in (
        (pending_requested_at, ApprovalStatus.PENDING),
        (approved_requested_at, ApprovalStatus.APPROVED),
    ):
        visit = _one_or_create(
            session,
            PropertyVisitRequest,
            {"enquiry_id": enquiry.id, "requested_at": requested_at},
            {
                "enquiry_id": enquiry.id,
                "property_id": active_unit.property_id,
                "requested_at": requested_at,
                "approval_status": status,
                "decided_by_id": users["rohan.mehta@propaxis.in"].id if status == ApprovalStatus.APPROVED else None,
                "decided_at": requested_at - timedelta(days=1) if status == ApprovalStatus.APPROVED else None,
                "remarks": "Approved for the requested property tour." if status == ApprovalStatus.APPROVED else None,
            },
        )
        approval = _one_or_create(
            session,
            ApprovalRequest,
            {
                "related_entity_type": "property_visit_request",
                "related_entity_id": visit.id,
            },
            {
                "approval_type": ApprovalType.PROPERTY_VISIT,
                "requester_id": users["rohan.mehta@propaxis.in"].id,
                "assigned_approver_id": users["ananya.deshmukh@propaxis.in"].id,
                "related_entity_type": "property_visit_request",
                "related_entity_id": visit.id,
                "property_visit_request_id": visit.id,
                "title": f"Property visit for {enquiry.name}",
                "description": "Review the requested property visit.",
                "status": status,
                "decision": ApprovalActionType.APPROVED if status == ApprovalStatus.APPROVED else None,
                "remarks": "Approved for the requested property tour." if status == ApprovalStatus.APPROVED else None,
                "decided_at": requested_at - timedelta(days=1) if status == ApprovalStatus.APPROVED else None,
            },
        )
        if status == ApprovalStatus.APPROVED:
            _one_or_create(
                session,
                ApprovalAction,
                {
                    "approval_request_id": approval.id,
                    "action": ApprovalActionType.APPROVED,
                    "actor_id": users["ananya.deshmukh@propaxis.in"].id,
                },
                {
                    "approval_request_id": approval.id,
                    "action": ApprovalActionType.APPROVED,
                    "actor_id": users["ananya.deshmukh@propaxis.in"].id,
                    "remarks": "Approved for the requested property tour.",
                },
            )

    session.flush()
    return {
        "users": len(users),
        "properties": len(properties),
        "units": len(units),
        "leases": session.scalar(
            select(func.count()).select_from(Lease).where(Lease.tenant_id == tenant.id)
        )
        or 0,
    }


def main() -> None:
    settings = get_settings()
    if settings.app_env.lower() in {"prod", "production"}:
        raise SystemExit("Demo seeding is disabled when APP_ENV is production.")

    with SessionLocal.begin() as session:
        summary = seed_demo_data(session)
    logger.info("Demo data seeded idempotently: %s", summary)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
