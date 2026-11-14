import os

from sqlalchemy import create_engine, inspect
from sqlalchemy.engine import make_url
from sqlalchemy.orm import Session

import pytest

from app.core.config import get_settings
from app.models import Base


def _normalized_host(host: str | None) -> str | None:
    if host is None:
        return None
    return host.replace("-pooler.", ".")


@pytest.fixture(scope="session")
def test_engine():
    test_url_value = os.getenv("TEST_DATABASE_URL")
    if not test_url_value:
        pytest.skip("Set TEST_DATABASE_URL to an isolated PostgreSQL test branch.")

    test_url = make_url(test_url_value).set(drivername="postgresql+psycopg")
    application_url = get_settings().sqlalchemy_database_url
    if (
        _normalized_host(test_url.host) == _normalized_host(application_url.host)
        and test_url.database == application_url.database
        and test_url.port == application_url.port
    ):
        pytest.fail("TEST_DATABASE_URL must point to a separate PostgreSQL database or Neon branch.")

    engine = create_engine(test_url)
    with engine.connect() as connection:
        existing = set(inspect(connection).get_table_names())
        missing = set(Base.metadata.tables) - existing
        if missing:
            pytest.fail(
                "Run `alembic upgrade head` on the isolated test database first; "
                f"missing tables: {', '.join(sorted(missing))}"
            )
    yield engine
    engine.dispose()


@pytest.fixture
def db_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = Session(
        bind=connection,
        join_transaction_mode="create_savepoint",
        expire_on_commit=False,
    )
    try:
        yield session
    finally:
        session.close()
        transaction.rollback()
        connection.close()
