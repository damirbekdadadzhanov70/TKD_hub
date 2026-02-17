import asyncio
import hashlib
import hmac
import json
import time
from datetime import date, timedelta
from urllib.parse import urlencode

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from bot.config import settings
from db.base import Base, get_session
from db.models import Athlete, Coach, CoachAthlete, Tournament, User

# Force default asyncio policy — uvloop (pulled by uvicorn[standard])
# raises RuntimeError on Python 3.11+ when no current event loop exists.
asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)


@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_conn, connection_record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestSession = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def override_get_session():
    async with TestSession() as session:
        yield session


def make_init_data(telegram_id: int = 123456789, first_name: str = "Test") -> str:
    """Build a valid Telegram initData string signed with BOT_TOKEN."""
    user_data = json.dumps({"id": telegram_id, "first_name": first_name})
    auth_date = str(int(time.time()))

    params = {
        "user": user_data,
        "auth_date": auth_date,
    }
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))

    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
    hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    params["hash"] = hash_value
    return urlencode(params)


@pytest_asyncio.fixture
async def db_session():
    """Create all tables, yield session, then drop."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with TestSession() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user with athlete profile."""
    user = User(telegram_id=123456789, username="testuser", language="en")
    db_session.add(user)
    await db_session.flush()

    athlete = Athlete(
        user_id=user.id,
        full_name="Test Athlete",
        date_of_birth=date(2000, 1, 1),
        gender="M",
        weight_category="68kg",
        current_weight=68,
        sport_rank="Black 1 Dan",
        country="KG",
        city="Bishkek",
        club="TKD Club",
    )
    db_session.add(athlete)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def coach_user(db_session: AsyncSession) -> User:
    """Create a test user with coach profile."""
    user = User(telegram_id=987654321, username="testcoach", language="en")
    db_session.add(user)
    await db_session.flush()

    coach = Coach(
        user_id=user.id,
        full_name="Test Coach",
        date_of_birth=date(1985, 5, 15),
        gender="M",
        country="KG",
        city="Bishkek",
        club="TKD Club",
        qualification="International Master",
        is_verified=True,
    )
    db_session.add(coach)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def coach_with_athlete(db_session: AsyncSession, test_user: User, coach_user: User) -> tuple[User, User]:
    """Coach linked to athlete. Returns (coach_user, athlete_user)."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    coach_result = await db_session.execute(
        select(User).where(User.id == coach_user.id).options(selectinload(User.coach))
    )
    coach_u = coach_result.scalar_one()

    athlete_result = await db_session.execute(
        select(User).where(User.id == test_user.id).options(selectinload(User.athlete))
    )
    athlete_u = athlete_result.scalar_one()

    link = CoachAthlete(
        coach_id=coach_u.coach.id,
        athlete_id=athlete_u.athlete.id,
        status="accepted",
    )
    db_session.add(link)
    await db_session.commit()
    return coach_u, athlete_u


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """Async HTTP client with overridden DB session."""
    from api.main import app

    app.dependency_overrides[get_session] = override_get_session
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient, test_user: User):
    """Client authenticated as athlete."""
    init_data = make_init_data(telegram_id=test_user.telegram_id)
    client.headers["Authorization"] = f"tma {init_data}"
    return client


@pytest_asyncio.fixture
async def coach_client(client: AsyncClient, coach_user: User):
    """Client authenticated as coach."""
    init_data = make_init_data(telegram_id=coach_user.telegram_id)
    client.headers["Authorization"] = f"tma {init_data}"
    return client


# ── New fixtures ──────────────────────────────────────────────


ADMIN_TELEGRAM_ID = 111111111


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession, monkeypatch) -> User:
    """Create a user recognized as admin via settings.admin_ids."""
    monkeypatch.setattr(settings, "ADMIN_IDS", str(ADMIN_TELEGRAM_ID))

    user = User(telegram_id=ADMIN_TELEGRAM_ID, username="admin", language="en")
    db_session.add(user)
    await db_session.flush()

    athlete = Athlete(
        user_id=user.id,
        full_name="Admin User",
        date_of_birth=date(1990, 1, 1),
        gender="M",
        weight_category="80kg",
        current_weight=80,
        sport_rank="Black 3 Dan",
        country="RU",
        city="Moscow",
        club="Admin Club",
    )
    db_session.add(athlete)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_client(client: AsyncClient, admin_user: User):
    """Client authenticated as admin."""
    init_data = make_init_data(telegram_id=admin_user.telegram_id)
    client.headers["Authorization"] = f"tma {init_data}"
    return client


@pytest_asyncio.fixture
async def bare_user(db_session: AsyncSession) -> User:
    """User WITHOUT athlete or coach profile (for registration tests)."""
    user = User(telegram_id=555555555, username="bareuser", language="en")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def bare_client(client: AsyncClient, bare_user: User):
    """Client authenticated as bare user (no profiles)."""
    init_data = make_init_data(telegram_id=bare_user.telegram_id)
    client.headers["Authorization"] = f"tma {init_data}"
    return client


@pytest_asyncio.fixture
async def dual_profile_user(db_session: AsyncSession) -> User:
    """User with BOTH athlete and coach profiles (for name sync tests)."""
    user = User(telegram_id=777777777, username="dualuser", language="en")
    db_session.add(user)
    await db_session.flush()

    athlete = Athlete(
        user_id=user.id,
        full_name="Dual User",
        date_of_birth=date(1995, 6, 15),
        gender="M",
        weight_category="74kg",
        current_weight=74,
        sport_rank="Black 2 Dan",
        country="RU",
        city="Kazan",
        club="Dual Club",
    )
    db_session.add(athlete)

    coach = Coach(
        user_id=user.id,
        full_name="Dual User",
        date_of_birth=date(1995, 6, 15),
        gender="M",
        country="RU",
        city="Kazan",
        club="Dual Club",
        qualification="Master of Sport",
        is_verified=True,
    )
    db_session.add(coach)

    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def dual_client(client: AsyncClient, dual_profile_user: User):
    """Client authenticated as dual-profile user."""
    init_data = make_init_data(telegram_id=dual_profile_user.telegram_id)
    client.headers["Authorization"] = f"tma {init_data}"
    return client


async def create_tournament(db_session: AsyncSession, user: User, **overrides) -> Tournament:
    """Helper to create a tournament with sensible defaults."""
    defaults = dict(
        name="Test Tournament",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=32),
        city="Bishkek",
        country="KG",
        venue="Sports Hall",
        registration_deadline=date.today() + timedelta(days=20),
        status="upcoming",
        importance_level=1,
        created_by=user.id,
        age_categories=["Seniors"],
        weight_categories=["68kg", "74kg"],
    )
    defaults.update(overrides)
    t = Tournament(**defaults)
    db_session.add(t)
    await db_session.commit()
    await db_session.refresh(t)
    return t
