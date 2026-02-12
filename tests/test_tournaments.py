import uuid
from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Tournament, User


async def _create_tournament(db_session: AsyncSession, user: User, **overrides) -> Tournament:
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


@pytest.mark.asyncio
async def test_list_tournaments(auth_client: AsyncClient, db_session: AsyncSession, test_user: User):
    await _create_tournament(db_session, test_user)
    await _create_tournament(db_session, test_user, name="Second Tournament")

    response = await auth_client.get("/api/tournaments")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2
    assert data["total"] == 2
    assert data["page"] == 1
    assert data["has_next"] is False


@pytest.mark.asyncio
async def test_get_tournament_detail(auth_client: AsyncClient, db_session: AsyncSession, test_user: User):
    t = await _create_tournament(db_session, test_user)

    response = await auth_client.get(f"/api/tournaments/{t.id}")
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test Tournament"
    assert data["city"] == "Bishkek"
    assert len(data["entries"]) == 0


@pytest.mark.asyncio
async def test_tournament_not_found(auth_client: AsyncClient):
    fake_id = uuid.uuid4()
    response = await auth_client.get(f"/api/tournaments/{fake_id}")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_mark_interest(auth_client: AsyncClient, db_session: AsyncSession, test_user: User):
    t = await _create_tournament(db_session, test_user)

    response = await auth_client.post(f"/api/tournaments/{t.id}/interest")
    assert response.status_code == 200
    data = response.json()
    assert data["created"] is True

    # Second time — not created again
    response2 = await auth_client.post(f"/api/tournaments/{t.id}/interest")
    assert response2.json()["created"] is False


@pytest.mark.asyncio
async def test_list_tournaments_with_filter(auth_client: AsyncClient, db_session: AsyncSession, test_user: User):
    await _create_tournament(db_session, test_user, country="KG")
    await _create_tournament(db_session, test_user, country="KZ", name="KZ Tournament")

    response = await auth_client.get("/api/tournaments?country=KG")
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["country"] == "KG"
