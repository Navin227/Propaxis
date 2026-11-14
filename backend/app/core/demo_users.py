from typing import TypedDict


class DemoUser(TypedDict):
    id: str
    name: str
    email: str
    role: str
    roleLabel: str
    status: str
    assignedPropertyIds: list[str]
    designation: str
    tenantId: str


DEMO_USERS: tuple[DemoUser, ...] = (
    {
        "id": "usr-admin-1",
        "name": "Ananya Deshmukh",
        "email": "ananya.deshmukh@propaxis.in",
        "role": "admin",
        "roleLabel": "Company Admin",
        "status": "Active",
        "assignedPropertyIds": ["prop-1", "prop-2", "prop-3", "prop-4"],
        "designation": "VP of Portfolio Operations",
        "tenantId": "",
    },
    {
        "id": "usr-mgr-1",
        "name": "Rohan Mehta",
        "email": "rohan.mehta@propaxis.in",
        "role": "manager",
        "roleLabel": "Property Manager",
        "status": "Active",
        "assignedPropertyIds": ["prop-1", "prop-3"],
        "designation": "Senior Property Manager · Bengaluru & Pune",
        "tenantId": "",
    },
    {
        "id": "usr-mgr-2",
        "name": "Kavita Kulkarni",
        "email": "kavita.kulkarni@propaxis.in",
        "role": "manager",
        "roleLabel": "Property Manager",
        "status": "Active",
        "assignedPropertyIds": ["prop-2", "prop-4"],
        "designation": "Cluster Manager · Mumbai & NCR",
        "tenantId": "",
    },
    {
        "id": "usr-tenant-1",
        "name": "Priya Nair",
        "email": "priya.nair@gmail.com",
        "role": "tenant",
        "roleLabel": "Tenant",
        "status": "Active",
        "assignedPropertyIds": ["prop-1"],
        "designation": "Resident · Unit A-402",
        "tenantId": "ten-1",
    },
)

DEMO_USERS_BY_ID = {user["id"]: user for user in DEMO_USERS}


def get_demo_user(user_id: str) -> DemoUser | None:
    return DEMO_USERS_BY_ID.get(user_id)
