import hashlib
import hmac
import json
import logging
import time
from dataclasses import dataclass
from urllib.parse import parse_qs, unquote

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bot.config import settings
from db.base import get_session
from db.models import User

logger = logging.getLogger(__name__)

INIT_DATA_MAX_AGE = 14400  # 4 hours


@dataclass
class AuthContext:
    user: User
    session: AsyncSession


def validate_init_data(init_data: str) -> dict:
    """Validate Telegram Mini App initData using HMAC-SHA256."""
    parsed = parse_qs(init_data)
    received_hash = parsed.get("hash", [None])[0]
    if not received_hash:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing hash in initData",
        )

    # Build the data-check-string: sorted key=value pairs excluding hash
    data_pairs = []
    for key, values in parsed.items():
        if key == "hash":
            continue
        data_pairs.append(f"{key}={unquote(values[0])}")
    data_pairs.sort()
    data_check_string = "\n".join(data_pairs)

    # secret_key = HMAC-SHA256("WebAppData", bot_token)
    secret_key = hmac.new(b"WebAppData", settings.BOT_TOKEN.encode(), hashlib.sha256).digest()

    # calculated_hash = HMAC-SHA256(secret_key, data_check_string)
    calculated_hash = hmac.new(secret_key, data_check_string.encode(), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(calculated_hash, received_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid initData signature",
        )

    # Validate auth_date to prevent replay attacks
    auth_date_str = parsed.get("auth_date", [None])[0]
    if not auth_date_str:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing auth_date in initData",
        )
    try:
        auth_date = int(auth_date_str)
    except ValueError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid auth_date",
        ) from err
    if time.time() - auth_date > INIT_DATA_MAX_AGE:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="InitData expired",
        )

    # Extract user info
    user_raw = parsed.get("user", [None])[0]
    if not user_raw:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No user data in initData",
        )

    try:
        return json.loads(unquote(user_raw))
    except json.JSONDecodeError as err:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid user data in initData",
        ) from err


async def get_current_user(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> AuthContext:
    """FastAPI dependency: validate initData and return AuthContext.

    Session lifecycle is managed by get_session dependency —
    auto-closes when request ends, no manual cleanup needed.
    """
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("tma "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header must start with 'tma '",
        )

    init_data = auth_header[4:]
    tg_user = validate_init_data(init_data)
    telegram_id = tg_user.get("id")
    if not telegram_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No telegram id in user data",
        )

    result = await session.execute(
        select(User)
        .where(User.telegram_id == telegram_id)
        .options(selectinload(User.athlete), selectinload(User.coach))
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not registered",
        )
    return AuthContext(user=user, session=session)
