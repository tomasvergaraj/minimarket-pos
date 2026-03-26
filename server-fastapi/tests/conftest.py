"""Shared fixtures for integration tests.

Uses an in-memory SQLite database so no external PostgreSQL is required.
Each test gets a fresh database (function-scoped engine) to guarantee isolation.
The get_db and require_operational_license dependencies are overridden for
every test that uses the `client` fixture.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

import app.models  # noqa: F401 — registers all ORM classes with Base
from app.db.base import Base
from app.db.session import get_db
from app.api.deps import require_operational_license
from app.main import app
from app.models.cash_register import CashRegister, CashSession, SessionStatus
from app.models.product import Product
from app.models.user import User
from app.core.security import hash_pin


# ── Engine — function-scoped so each test gets an empty database ─────────────

@pytest.fixture()
def engine():
    # StaticPool forces all connections to reuse the same physical SQLite
    # connection, which is required for in-memory databases to share state.
    e = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(e)
    yield e
    Base.metadata.drop_all(e)
    e.dispose()


# ── DB session ────────────────────────────────────────────────────────────────

@pytest.fixture()
def db(engine):
    TestingSession = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    session = TestingSession()
    try:
        yield session
    finally:
        session.close()


# ── FastAPI test client with overridden dependencies ─────────────────────────

@pytest.fixture()
def client(db):
    def _override_db():
        yield db

    def _noop_license():
        pass

    app.dependency_overrides[get_db] = _override_db
    app.dependency_overrides[require_operational_license] = _noop_license

    # Reset rate-limit counters so each test starts with a clean slate
    from app.core.limiter import limiter
    limiter._storage.reset()

    with TestClient(app, raise_server_exceptions=False) as c:
        yield c
    app.dependency_overrides.clear()


# ── Domain fixtures ───────────────────────────────────────────────────────────

@pytest.fixture()
def admin_user(db):
    user = User(
        username="test_admin",
        full_name="Admin Test",
        role="admin",
        pin=hash_pin("9999"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def cashier_user(db):
    user = User(
        username="test_cashier",
        full_name="Cashier Test",
        role="cashier",
        pin=hash_pin("1111"),
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@pytest.fixture()
def admin_token(client, admin_user):
    res = client.post("/api/users/login/pin", json={"pin": "9999"})
    assert res.status_code == 200, res.text
    return res.json()["data"]["access_token"]


@pytest.fixture()
def auth_headers(admin_token):
    return {"Authorization": f"Bearer {admin_token}"}


@pytest.fixture()
def register(db):
    r = CashRegister(name="Caja Test")
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@pytest.fixture()
def open_session(db, register, admin_user):
    s = CashSession(
        register_id=register.id,
        user_id=admin_user.id,
        opening_amount=50000.0,
        status=SessionStatus.OPEN,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@pytest.fixture()
def product(db):
    p = Product(
        name="Producto Test",
        sku="TEST-SKU-001",
        sell_price=1000.0,
        cost_price=500.0,
        stock=50,
        tax_rate=19.0,
        is_active=True,
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p
