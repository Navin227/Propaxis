# PropAxis Backend

FastAPI backend foundation for PropAxis with a normalized SQLAlchemy 2.0 schema
on Neon PostgreSQL. The React frontend is maintained separately and is not
modified by this backend.

## Prerequisites

- Python 3.11 or newer
- Access to the existing Neon project

## Virtual environment and dependencies

From the `backend` directory:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Use another installed Python version if it is 3.11 or newer.

## Environment configuration

Copy `.env.example` to `.env`, then set `DATABASE_URL` to the pooled Neon
connection string. Use the `DATABASE_URL` (pooler) variable for application
traffic. Set `DATABASE_URL_UNPOOLED` to Neon's direct connection string for
Alembic migrations and admin work. The settings loader accepts either
`postgresql://` or `postgresql+psycopg://` and selects Psycopg 3.

`REDIS_URL`, `LLM_PROVIDER`, and `LLM_API_KEY` are optional and are not used in
this initialization. `FRONTEND_URL` defaults to `http://localhost:5173` and
configures development CORS. Production should set it to the exact frontend
origin; wildcard origins are not enabled.

The local `.env` file is git-ignored. Never commit credentials or paste them
into logs or support output.

## Database migrations and demo data

The first migration is an empty baseline. The next migration creates the
relational tables documented in [docs/database-schema.md](./docs/database-schema.md).
The migration is additive and leaves the existing `propaxis_app_state` table
and data untouched.

```powershell
alembic upgrade head
alembic current
```

Alembic uses SQLAlchemy metadata from `app.models` and prefers
`DATABASE_URL_UNPOOLED`, falling back to `DATABASE_URL` when no direct URL is
provided. Do not run integration tests against the application database. Set
`TEST_DATABASE_URL` to a separate PostgreSQL database or Neon branch first.

Demo data is never seeded automatically. Run this explicit development-only
command after migrations:

```powershell
python -m scripts.seed_demo
```

The seed command is idempotent and refuses to run when `APP_ENV=production`.

## Schema

The initial schema contains 27 tables covering users and manager assignments,
residential properties and units, tenants and lease history, payments and
transactions, maintenance, enquiries and visit approvals, multi-channel
conversations, approvals, notifications, and audit logs. The complete Mermaid
ER diagram, table inventory, relationships, and constraints are in
[docs/database-schema.md](./docs/database-schema.md).

## Run the API

```powershell
uvicorn app.main:app --reload
```

The API listens on `http://127.0.0.1:8000` by default. Schema migrations are
run explicitly with Alembic; FastAPI startup does not create business tables or
seed demo records.

## Endpoints

- `GET /` — API name and version.
- `GET /health` — application process health.
- `GET /health/db` — executes `SELECT 1` against Neon; returns HTTP 503 if the
  database is unavailable.
- `GET /api/v1/demo/users` — predefined development/demo identities.
- `GET /api/v1/demo/users/{user_id}` — validates a known demo user ID and
  returns the user with its configured role.
- `GET /api/v1/users` — returns only active configured property-manager
  options (`id`, `name`, and `role`) for assignment.
- `GET /api/v1/properties` — accessible property list; supports `limit`,
  `offset`, `search`, `city`, and `status` filters. Returns an array and
  pagination totals in `X-Total-Count`, `X-Page-Limit`, and `X-Page-Offset`.
- `GET /api/v1/properties/{property_id}` — property details.
- `POST /api/v1/properties` — create a property.
- `PATCH /api/v1/properties/{property_id}` — update property details.
- `DELETE /api/v1/properties/{property_id}` — archives by setting status to
  `INACTIVE`; it does not delete related records.
- `GET /api/v1/properties/{property_id}/units` — paginated units for one
  accessible property; supports `limit`, `offset`, and `search`.
- `GET /api/v1/units` — paginated units across accessible properties; optional
  `property_id` filter.
- `GET /api/v1/units/{unit_id}` — unit details.
- `POST /api/v1/properties/{property_id}/units` — create a unit in a property.
- `PATCH /api/v1/units/{unit_id}` — update unit details.
- `DELETE /api/v1/units/{unit_id}` — archives by setting `is_active=false`;
  leases and other dependent records are retained.
- `POST /api/v1/units` — compatibility endpoint for clients that send
  `propertyId` in the request body; the property-scoped endpoint is preferred.

### Demo-mode authorization

Every property/unit endpoint requires `x-user-id` with one of the configured
demo IDs: `usr-admin-1`, `usr-mgr-1`, or `usr-mgr-2`. The account must also
exist and be active in the database, so seed only an isolated development/test
database with `python -m scripts.seed_demo`. `x-user-role` is ignored; the
backend loads the user's role from the database and rejects unknown IDs.
This mechanism is explicitly demo-only and is not production authentication.

Company Admins can read and manage all properties and units. Property Managers
can read assigned properties and update units at those properties; they cannot
create/archive records. Tenants receive HTTP 403 for these operational routes.
An unassigned property is returned as HTTP 404 to a manager.

### Example requests and responses

Run the API on port 8000, then use a demo identity:

```powershell
curl.exe -H "x-user-id: usr-admin-1" `
  "http://127.0.0.1:8000/api/v1/properties?limit=20&offset=0&search=Oakwood"
```

Create a property (database-required location fields are `state` and
`postalCode`):

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/v1/properties" `
  -H "Content-Type: application/json" `
  -H "x-user-id: usr-admin-1" `
  -d '{"name":"Oakwood Annex","address":"12 Main Road","city":"Bengaluru","state":"Karnataka","postalCode":"560001","type":"Residential Tower","totalUnits":8,"status":"Active","managerId":"usr-mgr-1"}'
```

Example property response:

```json
{
  "id": "c1be5ebd-7086-4b9f-8a09-66b417d4bc24",
  "name": "Oakwood Annex",
  "address": "12 Main Road",
  "city": "Bengaluru",
  "state": "Karnataka",
  "postalCode": "560001",
  "type": "Residential Tower",
  "propertyType": "RESIDENTIAL",
  "totalUnits": 8,
  "occupiedUnits": 0,
  "vacantUnits": 0,
  "managerId": "usr-mgr-1",
  "managerName": "Rohan Mehta",
  "status": "Active",
  "imageUrl": "",
  "amenities": [],
  "monthlyTargetRent": "0.00",
  "created_at": "2026-11-14T12:00:00Z",
  "updated_at": "2026-11-14T12:00:00Z"
}
```

Create a unit:

```powershell
curl.exe -X POST "http://127.0.0.1:8000/api/v1/properties/<property-uuid>/units" `
  -H "Content-Type: application/json" `
  -H "x-user-id: usr-admin-1" `
  -d '{"unitNumber":"A-101","bedrooms":2,"bathrooms":2,"areaSqFt":1000,"monthlyRent":50000,"securityDeposit":150000,"occupancyStatus":"Vacant","availability":"Available"}'
```

Example unit response:

```json
{
  "id": "8fd307dd-4fdb-4826-8e98-f40ec07680b5",
  "propertyId": "c1be5ebd-7086-4b9f-8a09-66b417d4bc24",
  "propertyName": "Oakwood Annex",
  "unitNumber": "A-101",
  "floor": 2,
  "bedrooms": 2,
  "bathrooms": 2,
  "areaSqFt": "1000.00",
  "monthlyRent": 50000.0,
  "securityDeposit": "150000.00",
  "occupancyStatus": "Vacant",
  "availability": "Available",
  "description": null,
  "tenantId": null,
  "tenantName": null
}
```

`monthlyRent` is emitted as a JSON number to match the React unit contract.
The database column and application-side amount remain `Numeric` and `Decimal`.

Property responses use the existing UI's camelCase names (`name`,
`totalUnits`, `managerId`, etc.). `monthlyTargetRent` is computed from active
unit rents because the database has no target-rent column. `imageUrl` and
`amenities` are empty because the schema has no property image/amenity fields.
Unit responses include the UI's camelCase fields. `floor` is nullable for
legacy units and is stored for new or updated units after applying the
additive `20261114_02` migration. Archived properties and units remain in the
database; archived properties and their units are excluded from normal
operational listings.

The versioned property service uses `/api/v1`; the Vite middleware proxies that
prefix to FastAPI on `http://127.0.0.1:8000`. Other existing frontend services
continue using the Express `/api` endpoints. The property form submits required
`state` and `postalCode` fields, and its manager list uses the restricted
demo-only `/api/v1/users` endpoint. The form only offers property types and
statuses supported by the database schema.

Demo identities are not production authentication. A client's role header is
not used to determine identity or permissions.

## Tests

```powershell
pytest
```

The API tests override the database session dependency. Schema integration
tests run only when `TEST_DATABASE_URL` points to a separate PostgreSQL test
database/branch with migrations already applied. They use a rollback-only
transaction and never connect to or mutate the application database. For
integration tests, apply `alembic upgrade head` to the isolated branch first
using its direct URL, set `TEST_DATABASE_URL` to that branch, then run `pytest`.

### Local integration run

Use the isolated test branch URL only. Keep it in the local environment and
never paste it into source files, terminal output, or chat. In PowerShell, from
`backend`:

```powershell
$env:DATABASE_URL_UNPOOLED = $env:TEST_DATABASE_URL
python -m alembic upgrade head
python -m alembic current
python -m pytest -q
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:FRONTEND_URL = "http://localhost:3000"
python -m uvicorn app.main:app --reload --port 8000
```

In a second PowerShell window, from `frontend`:

```powershell
$env:DATABASE_URL = $env:TEST_DATABASE_URL
$env:PROPAXIS_API_URL = "http://127.0.0.1:8000"
npm run dev
```

Open `http://localhost:3000`. To verify the proxy independently, call
`http://localhost:3000/api/v1/properties` with a configured demo `x-user-id`.
The proxy preserves the `/api/v1` prefix and does not duplicate it.
Never point `TEST_DATABASE_URL` at production.
