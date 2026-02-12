"""Tests that endpoints enforce correct role access."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_athlete_cannot_access_coach_athletes(auth_client: AsyncClient):
    """Athlete user should get 403 on coach-only endpoints."""
    response = await auth_client.get("/api/coach/athletes")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_athlete_cannot_access_coach_entries(auth_client: AsyncClient):
    response = await auth_client.get("/api/coach/entries")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_coach_cannot_access_training_log(coach_client: AsyncClient):
    """Coach user (no athlete profile) should get 400 on training endpoints."""
    response = await coach_client.get("/api/training-log")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_coach_cannot_create_training_log(coach_client: AsyncClient):
    response = await coach_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-01",
            "type": "sparring",
            "duration_minutes": 60,
            "intensity": "high",
        },
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_coach_cannot_get_training_stats(coach_client: AsyncClient):
    response = await coach_client.get("/api/training-log/stats")
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_athlete_cannot_enter_athletes(auth_client: AsyncClient):
    """Athlete cannot use the coach enter-athletes endpoint."""
    import uuid

    fake_tid = uuid.uuid4()
    response = await auth_client.post(
        f"/api/tournaments/{fake_tid}/enter",
        json={"athlete_ids": [str(uuid.uuid4())], "age_category": "Seniors"},
    )
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_athlete_cannot_remove_entry(auth_client: AsyncClient):
    import uuid

    response = await auth_client.delete(f"/api/tournaments/{uuid.uuid4()}/entries/{uuid.uuid4()}")
    assert response.status_code == 403
