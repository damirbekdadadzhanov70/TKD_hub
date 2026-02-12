from datetime import date

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Athlete, User


@pytest.mark.asyncio
async def test_get_ratings(auth_client: AsyncClient):
    response = await auth_client.get("/api/ratings")
    assert response.status_code == 200
    body = response.json()
    data = body["items"]
    # test_user's athlete should appear
    assert len(data) >= 1
    assert data[0]["full_name"] == "Test Athlete"
    assert data[0]["rank"] == 1
    assert body["total"] >= 1


@pytest.mark.asyncio
async def test_ratings_filter_by_country(auth_client: AsyncClient, db_session: AsyncSession):
    # Create another athlete from different country
    user2 = User(telegram_id=111222333, username="user2", language="en")
    db_session.add(user2)
    await db_session.flush()
    athlete2 = Athlete(
        user_id=user2.id,
        full_name="KZ Athlete",
        date_of_birth=date(2001, 1, 1),
        gender="M",
        weight_category="74kg",
        current_weight=74,
        belt="Red",
        country="KZ",
        city="Almaty",
        rating_points=100,
    )
    db_session.add(athlete2)
    await db_session.commit()

    response = await auth_client.get("/api/ratings?country=KZ")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) == 1
    assert data[0]["country"] == "KZ"


@pytest.mark.asyncio
async def test_ratings_filter_by_gender(auth_client: AsyncClient):
    response = await auth_client.get("/api/ratings?gender=F")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) == 0  # No female athletes in test data


@pytest.mark.asyncio
async def test_ratings_limit(auth_client: AsyncClient):
    response = await auth_client.get("/api/ratings?limit=1")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) <= 1
