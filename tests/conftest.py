import hashlib
import hmac
import json
import time
from datetime import date
from urllib.parse import urlencode

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from bot.config import settings
from db.base import Base, get_session
from db.models import Athlete, Coach, CoachAthlete, User

# Use in-memory SQLite for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
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
        belt="Black 1 Dan",
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
    # Load coach and athlete from their users
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
