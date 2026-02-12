import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_me(auth_client: AsyncClient):
    response = await auth_client.get("/api/me")
    assert response.status_code == 200
    data = response.json()
    assert data["telegram_id"] == 123456789
    assert data["role"] == "athlete"
    assert data["athlete"] is not None
    assert data["athlete"]["full_name"] == "Test Athlete"


@pytest.mark.asyncio
async def test_update_me(auth_client: AsyncClient):
    response = await auth_client.put(
        "/api/me",
        json={"club": "New Club"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["athlete"]["club"] == "New Club"
