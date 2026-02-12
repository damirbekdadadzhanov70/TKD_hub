import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_no_auth_header(client: AsyncClient):
    response = await client.get("/api/me")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_auth_header(client: AsyncClient):
    response = await client.get(
        "/api/me",
        headers={"Authorization": "Bearer invalid"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_invalid_initdata_signature(client: AsyncClient):
    response = await client.get(
        "/api/me",
        headers={"Authorization": "tma user=fake&hash=invalid&auth_date=123"},
    )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_expired_initdata(client: AsyncClient):
    """initData with auth_date far in the past should be rejected."""
    import hashlib
    import hmac
    import json
    import time
    from urllib.parse import urlencode

    from bot.config import settings

    user_data = json.dumps({"id": 123456789, "first_name": "Test"})
    auth_date = str(int(time.time()) - 100000)  # ~28 hours ago

    params = {"user": user_data, "auth_date": auth_date}
    data_check_string = "\n".join(f"{k}={v}" for k, v in sorted(params.items()))
    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()
    hash_value = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()
    params["hash"] = hash_value

    response = await client.get(
        "/api/me",
        headers={"Authorization": f"tma {urlencode(params)}"},
    )
    assert response.status_code == 401
    assert "expired" in response.json()["detail"].lower()
