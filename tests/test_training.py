import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_training_log(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-01",
            "type": "sparring",
            "duration_minutes": 90,
            "intensity": "high",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["type"] == "sparring"
    assert data["duration_minutes"] == 90
    assert data["intensity"] == "high"
    return data["id"]


@pytest.mark.asyncio
async def test_list_training_logs(auth_client: AsyncClient):
    # Create one first
    await auth_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-01",
            "type": "poomsae",
            "duration_minutes": 45,
            "intensity": "low",
        },
    )
    response = await auth_client.get("/api/training-log")
    assert response.status_code == 200
    data = response.json()["items"]
    assert len(data) >= 1


@pytest.mark.asyncio
async def test_training_stats(auth_client: AsyncClient):
    # Create entries
    for i in range(3):
        await auth_client.post(
            "/api/training-log",
            json={
                "date": f"2025-06-0{i + 1}",
                "type": "sparring",
                "duration_minutes": 60,
                "intensity": "medium",
            },
        )

    response = await auth_client.get("/api/training-log/stats?month=6&year=2025")
    assert response.status_code == 200
    data = response.json()
    assert data["total_sessions"] == 3
    assert data["total_minutes"] == 180
    assert data["avg_intensity"] == "medium"
    assert data["training_days"] == 3


@pytest.mark.asyncio
async def test_update_training_log(auth_client: AsyncClient):
    # Create
    create_resp = await auth_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-10",
            "type": "sparring",
            "duration_minutes": 60,
            "intensity": "low",
        },
    )
    log_id = create_resp.json()["id"]

    # Update
    response = await auth_client.put(
        f"/api/training-log/{log_id}",
        json={"intensity": "high", "duration_minutes": 90},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["intensity"] == "high"
    assert data["duration_minutes"] == 90


@pytest.mark.asyncio
async def test_delete_training_log(auth_client: AsyncClient):
    # Create
    create_resp = await auth_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-15",
            "type": "stretching",
            "duration_minutes": 30,
            "intensity": "low",
        },
    )
    log_id = create_resp.json()["id"]

    # Delete
    response = await auth_client.delete(f"/api/training-log/{log_id}")
    assert response.status_code == 204

    # Verify gone
    response = await auth_client.get("/api/training-log")
    ids = [item["id"] for item in response.json()["items"]]
    assert log_id not in ids


@pytest.mark.asyncio
async def test_invalid_intensity_rejected(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-01",
            "type": "sparring",
            "duration_minutes": 60,
            "intensity": "extreme",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_negative_duration_rejected(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/training-log",
        json={
            "date": "2025-06-01",
            "type": "sparring",
            "duration_minutes": -10,
            "intensity": "low",
        },
    )
    assert response.status_code == 422
