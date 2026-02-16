from datetime import date, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import Tournament, TournamentEntry, User


@pytest.mark.asyncio
async def test_coach_athletes_list(coach_client: AsyncClient, coach_with_athlete):
    response = await coach_client.get("/api/coach/athletes")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) == 1
    assert data[0]["full_name"] == "Test Athlete"
    assert data[0]["weight_category"] == "68kg"


@pytest.mark.asyncio
async def test_coach_athletes_empty(coach_client: AsyncClient, coach_user: User):
    """Coach with no linked athletes."""
    response = await coach_client.get("/api/coach/athletes")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) == 0


@pytest.mark.asyncio
async def test_coach_entries_list(
    coach_client: AsyncClient,
    coach_with_athlete: tuple,
    db_session: AsyncSession,
):
    coach_u, athlete_u = coach_with_athlete

    # Create tournament and entry
    t = Tournament(
        name="Test Open",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=32),
        city="Bishkek",
        country="KG",
        venue="Arena",
        registration_deadline=date.today() + timedelta(days=20),
        created_by=coach_u.id,
    )
    db_session.add(t)
    await db_session.flush()

    entry = TournamentEntry(
        tournament_id=t.id,
        athlete_id=athlete_u.athlete.id,
        coach_id=coach_u.coach.id,
        weight_category="68kg",
        age_category="Seniors",
    )
    db_session.add(entry)
    await db_session.commit()

    response = await coach_client.get("/api/coach/entries")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) == 1
    assert data[0]["tournament_name"] == "Test Open"
    assert data[0]["athlete_name"] == "Test Athlete"


@pytest.mark.asyncio
async def test_coach_enter_athletes(
    coach_client: AsyncClient,
    coach_with_athlete: tuple,
    db_session: AsyncSession,
):
    coach_u, athlete_u = coach_with_athlete

    t = Tournament(
        name="Enter Test",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=32),
        city="Bishkek",
        country="KG",
        venue="Arena",
        registration_deadline=date.today() + timedelta(days=20),
        created_by=coach_u.id,
        age_categories=["Seniors"],
        weight_categories=["68kg"],
    )
    db_session.add(t)
    await db_session.commit()

    response = await coach_client.post(
        f"/api/tournaments/{t.id}/enter",
        json={"athlete_ids": [str(athlete_u.athlete.id)], "age_category": "Seniors"},
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data) == 1
    assert data[0]["athlete_name"] == "Test Athlete"


@pytest.mark.asyncio
async def test_coach_remove_entry(
    coach_client: AsyncClient,
    coach_with_athlete: tuple,
    db_session: AsyncSession,
):
    coach_u, athlete_u = coach_with_athlete

    t = Tournament(
        name="Remove Test",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=32),
        city="Bishkek",
        country="KG",
        venue="Arena",
        registration_deadline=date.today() + timedelta(days=20),
        created_by=coach_u.id,
    )
    db_session.add(t)
    await db_session.flush()

    entry = TournamentEntry(
        tournament_id=t.id,
        athlete_id=athlete_u.athlete.id,
        coach_id=coach_u.coach.id,
        weight_category="68kg",
        age_category="Seniors",
    )
    db_session.add(entry)
    await db_session.commit()

    response = await coach_client.delete(f"/api/tournaments/{t.id}/entries/{entry.id}")
    assert response.status_code == 204
