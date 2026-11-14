from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.core.database import get_db
from app.main import app


class FakeDatabaseSession:
    def execute(self, _statement: object) -> object:
        return object()

    def close(self) -> None:
        return None


class BrokenDatabaseSession(FakeDatabaseSession):
    def execute(self, _statement: object) -> object:
        raise SQLAlchemyError("sensitive connection details")


def override_get_db() -> FakeDatabaseSession:
    return FakeDatabaseSession()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def test_root_returns_api_information() -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert response.json() == {
        "name": "PropAxis API",
        "version": "0.1.0",
        "status": "ok",
    }


def test_health_returns_ok() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_database_health_uses_overridden_session() -> None:
    response = client.get("/health/db")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "database": "ok"}


def test_database_health_hides_connection_error(monkeypatch) -> None:
    monkeypatch.setitem(
        app.dependency_overrides,
        get_db,
        lambda: BrokenDatabaseSession(),
    )
    response = client.get("/health/db")

    assert response.status_code == 503
    assert "sensitive connection details" not in response.text


def test_demo_users_returns_expected_identities() -> None:
    response = client.get("/api/v1/demo/users")

    assert response.status_code == 200
    assert [(user["id"], user["name"], user["roleLabel"]) for user in response.json()] == [
        ("usr-admin-1", "Ananya Deshmukh", "Company Admin"),
        ("usr-mgr-1", "Rohan Mehta", "Property Manager"),
        ("usr-mgr-2", "Kavita Kulkarni", "Property Manager"),
        ("usr-tenant-1", "Priya Nair", "Tenant"),
    ]


def test_unknown_demo_user_id_is_rejected() -> None:
    response = client.get("/api/v1/demo/users/not-a-demo-user")

    assert response.status_code == 404
    assert response.json()["error"]["message"] == "Unknown demo user ID."


def test_demo_user_role_comes_from_user_id_not_role_header() -> None:
    response = client.get(
        "/api/v1/demo/users/usr-tenant-1",
        headers={"x-user-role": "admin"},
    )

    assert response.status_code == 200
    assert response.json()["role"] == "tenant"
