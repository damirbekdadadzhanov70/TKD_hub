"""
Business scenario tests for TKD Hub.

All business logic tests in one file, organized by sections.
Update this file as new features are added.

Sections:
  1. Helpers (mock factories)
  2. API: Registration
  3. API: Name Sync
  4. API: Admin Entries & Results
  5. API: Role Request
  6. Bot: /start & Language
  7. Bot: Registration FSM
  8. Bot: Tournament Entries
  9. Bot: Admin Coach Verification
  10. Bot: Invite Flow
  11. Bot: My Athletes
  12. Bot: Entries Edge Cases (deadline, withdraw, /my_entries)
  13. Bot: Registration Edge Cases (weight, country, club, photo)
"""

import uuid as uuid_mod
from datetime import date, datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from httpx import AsyncClient
from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from bot.config import settings
from db.models import Tournament, TournamentEntry
from db.models.athlete import Athlete
from db.models.coach import Coach, CoachAthlete
from db.models.invite_token import InviteToken
from db.models.role_request import RoleRequest
from db.models.user import User
from tests.conftest import ADMIN_TELEGRAM_ID, TestSession, create_tournament

# ═══════════════════════════════════════════════════════════════
#  1. HELPERS — Mock factories for bot tests
# ═══════════════════════════════════════════════════════════════


def _make_message(telegram_id: int = 123456789, text: str = "", language_code: str = "ru"):
    """Create a mock aiogram Message."""
    msg = AsyncMock()
    msg.from_user = MagicMock()
    msg.from_user.id = telegram_id
    msg.from_user.username = "testuser"
    msg.from_user.language_code = language_code
    msg.text = text
    msg.answer = AsyncMock()
    msg.bot = AsyncMock()
    msg.bot.send_message = AsyncMock()
    return msg


def _make_callback(telegram_id: int = 123456789, data: str = ""):
    """Create a mock aiogram CallbackQuery."""
    cb = AsyncMock()
    cb.from_user = MagicMock()
    cb.from_user.id = telegram_id
    cb.from_user.username = "testuser"
    cb.data = data
    cb.answer = AsyncMock()
    cb.message = AsyncMock()
    cb.message.edit_text = AsyncMock()
    cb.message.edit_reply_markup = AsyncMock()
    cb.bot = AsyncMock()
    cb.bot.send_message = AsyncMock()
    return cb


def _make_state(initial_data: dict | None = None):
    """Create a mock FSMContext with dict backend."""
    state = AsyncMock()
    _data = dict(initial_data or {})

    async def get_data():
        return dict(_data)

    async def update_data(**kwargs):
        _data.update(kwargs)

    async def set_state(s):
        _data["__state__"] = s

    async def clear():
        _data.clear()

    state.get_data = get_data
    state.update_data = update_data
    state.set_state = set_state
    state.clear = clear
    return state


def _make_command(args: str | None = None):
    """Create a mock CommandObject."""
    cmd = MagicMock()
    cmd.args = args
    return cmd


def _patched_parse_callback(data, prefix, expected_parts=2):
    """parse_callback that converts UUID strings to uuid.UUID for SQLite compat."""
    from bot.utils.callback import CallbackParseError

    if not data or not data.startswith(f"{prefix}:"):
        raise CallbackParseError(f"Expected prefix '{prefix}', got: {data!r}")
    parts = data.split(":", maxsplit=expected_parts - 1)
    if len(parts) != expected_parts:
        raise CallbackParseError(f"Expected {expected_parts} parts, got {len(parts)}: {data!r}")
    for i in range(1, len(parts)):
        try:
            parts[i] = uuid_mod.UUID(parts[i])
        except (ValueError, AttributeError):
            pass
    return parts


async def _create_admin_user_in_db(db_session: AsyncSession) -> User:
    """Create admin user directly in DB (for bot tests)."""
    user = User(telegram_id=ADMIN_TELEGRAM_ID, username="admin", language="en")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _create_coach_with_request(db_session: AsyncSession) -> tuple[User, RoleRequest]:
    """Create a coach user with a pending role request (for bot tests)."""
    user = User(telegram_id=666666666, username="pendingcoach", language="en")
    db_session.add(user)
    await db_session.flush()

    coach = Coach(
        user_id=user.id,
        full_name="Pending Coach",
        date_of_birth=date(1990, 1, 1),
        gender="M",
        country="RU",
        city="Moscow",
        club="Test Club",
        qualification="Master of Sport",
        is_verified=False,
    )
    db_session.add(coach)
    await db_session.flush()

    role_request = RoleRequest(
        user_id=user.id,
        requested_role="coach",
        status="pending",
    )
    db_session.add(role_request)
    await db_session.commit()
    await db_session.refresh(user)
    await db_session.refresh(role_request)
    return user, role_request


async def _create_verified_coach_with_athlete(db_session: AsyncSession) -> tuple[User, User]:
    """Create a verified coach and a linked athlete in DB.

    Returns (coach_user, athlete_user).
    The CoachAthlete link uses status="accepted" (as invite.py does).
    """
    # Coach user
    coach_user = User(telegram_id=888888888, username="invitecoach", language="en")
    db_session.add(coach_user)
    await db_session.flush()

    coach = Coach(
        user_id=coach_user.id,
        full_name="Invite Coach",
        date_of_birth=date(1985, 5, 15),
        gender="M",
        country="RU",
        city="Moscow",
        club="Invite Club",
        qualification="Master of Sport",
        is_verified=True,
    )
    db_session.add(coach)
    await db_session.flush()

    # Athlete user
    athlete_user = User(telegram_id=999999999, username="inviteathlete", language="en")
    db_session.add(athlete_user)
    await db_session.flush()

    athlete = Athlete(
        user_id=athlete_user.id,
        full_name="Invite Athlete",
        date_of_birth=date(2000, 3, 20),
        gender="M",
        weight_category="68kg",
        current_weight=67.5,
        sport_rank="КМС",
        country="Россия",
        city="Moscow",
    )
    db_session.add(athlete)
    await db_session.commit()
    await db_session.refresh(coach_user, attribute_names=["coach"])
    await db_session.refresh(athlete_user, attribute_names=["athlete"])
    return coach_user, athlete_user


# ═══════════════════════════════════════════════════════════════
#  2. API: Registration (POST /api/me/register)
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_register_athlete_success(bare_client: AsyncClient):
    response = await bare_client.post(
        "/api/me/register",
        json={
            "role": "athlete",
            "data": {
                "full_name": "New Athlete",
                "date_of_birth": "2000-01-15",
                "gender": "M",
                "weight_category": "68kg",
                "current_weight": 67.5,
                "sport_rank": "КМС",
                "city": "Moscow",
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["athlete"]["full_name"] == "New Athlete"
    assert data["role"] in ("athlete", "admin")


@pytest.mark.asyncio
async def test_register_coach_success(bare_client: AsyncClient):
    response = await bare_client.post(
        "/api/me/register",
        json={
            "role": "coach",
            "data": {
                "full_name": "New Coach",
                "date_of_birth": "1985-05-15",
                "gender": "M",
                "sport_rank": "МС",
                "club": "Test Club",
                "city": "Kazan",
            },
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["coach"]["full_name"] == "New Coach"


@pytest.mark.asyncio
async def test_register_athlete_duplicate_rejected(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/me/register",
        json={
            "role": "athlete",
            "data": {
                "full_name": "Dup Athlete",
                "date_of_birth": "2000-01-15",
                "gender": "M",
                "weight_category": "74kg",
                "current_weight": 73.0,
                "sport_rank": "КМС",
                "city": "Bishkek",
            },
        },
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_coach_duplicate_rejected(coach_client: AsyncClient):
    response = await coach_client.post(
        "/api/me/register",
        json={
            "role": "coach",
            "data": {
                "full_name": "Dup Coach",
                "date_of_birth": "1985-05-15",
                "gender": "M",
                "sport_rank": "МС",
                "club": "Club",
                "city": "Bishkek",
            },
        },
    )
    assert response.status_code == 400
    assert "already exists" in response.json()["detail"]


@pytest.mark.asyncio
async def test_register_athlete_validation_missing_fields(bare_client: AsyncClient):
    with pytest.raises(ValidationError):
        await bare_client.post(
            "/api/me/register",
            json={"role": "athlete", "data": {}},
        )


@pytest.mark.asyncio
async def test_register_athlete_name_too_short(bare_client: AsyncClient):
    with pytest.raises(ValidationError):
        await bare_client.post(
            "/api/me/register",
            json={
                "role": "athlete",
                "data": {
                    "full_name": "A",
                    "date_of_birth": "2000-01-15",
                    "gender": "M",
                    "weight_category": "68kg",
                    "current_weight": 67.5,
                    "sport_rank": "КМС",
                    "city": "Moscow",
                },
            },
        )


# ═══════════════════════════════════════════════════════════════
#  3. API: Name Sync (PUT /api/me, PUT /api/me/coach)
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_update_athlete_name_syncs_to_coach(dual_client: AsyncClient):
    response = await dual_client.put(
        "/api/me",
        json={"full_name": "Synced Name"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["athlete"]["full_name"] == "Synced Name"
    assert data["coach"]["full_name"] == "Synced Name"


@pytest.mark.asyncio
async def test_update_coach_name_syncs_to_athlete(dual_client: AsyncClient):
    response = await dual_client.put(
        "/api/me/coach",
        json={"full_name": "Coach Synced"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["coach"]["full_name"] == "Coach Synced"
    assert data["athlete"]["full_name"] == "Coach Synced"


@pytest.mark.asyncio
async def test_update_athlete_name_no_coach_profile(auth_client: AsyncClient):
    response = await auth_client.put(
        "/api/me",
        json={"full_name": "Solo Athlete"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["athlete"]["full_name"] == "Solo Athlete"
    assert data["coach"] is None


@pytest.mark.asyncio
async def test_update_coach_no_athlete_profile(coach_client: AsyncClient):
    response = await coach_client.put(
        "/api/me/coach",
        json={"full_name": "Solo Coach"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["coach"]["full_name"] == "Solo Coach"
    assert data["athlete"] is None


# ═══════════════════════════════════════════════════════════════
#  4. API: Admin Entries & Results
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_admin_approve_entries(
    admin_client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    coach_user: User,
    coach_with_athlete: tuple[User, User],
):
    coach_u, athlete_u = coach_with_athlete
    tournament = await create_tournament(db_session, admin_user)

    coach_result = await db_session.execute(select(User).where(User.id == coach_u.id).options(selectinload(User.coach)))
    coach = coach_result.scalar_one().coach

    athlete_result = await db_session.execute(
        select(User).where(User.id == athlete_u.id).options(selectinload(User.athlete))
    )
    athlete = athlete_result.scalar_one().athlete

    entry = TournamentEntry(
        tournament_id=tournament.id,
        athlete_id=athlete.id,
        coach_id=coach.id,
        weight_category="68kg",
        age_category="Seniors",
        status="pending",
    )
    db_session.add(entry)
    await db_session.commit()

    response = await admin_client.post(f"/api/tournaments/{tournament.id}/coaches/{coach.id}/approve")
    assert response.status_code == 204

    await db_session.refresh(entry)
    assert entry.status == "approved"


@pytest.mark.asyncio
async def test_admin_reject_entries(
    admin_client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    coach_with_athlete: tuple[User, User],
):
    coach_u, athlete_u = coach_with_athlete
    tournament = await create_tournament(db_session, admin_user)

    coach_result = await db_session.execute(select(User).where(User.id == coach_u.id).options(selectinload(User.coach)))
    coach = coach_result.scalar_one().coach

    athlete_result = await db_session.execute(
        select(User).where(User.id == athlete_u.id).options(selectinload(User.athlete))
    )
    athlete = athlete_result.scalar_one().athlete

    entry = TournamentEntry(
        tournament_id=tournament.id,
        athlete_id=athlete.id,
        coach_id=coach.id,
        weight_category="68kg",
        age_category="Seniors",
        status="pending",
    )
    db_session.add(entry)
    await db_session.commit()

    response = await admin_client.post(f"/api/tournaments/{tournament.id}/coaches/{coach.id}/reject")
    assert response.status_code == 204

    await db_session.refresh(entry)
    assert entry.status == "rejected"


@pytest.mark.asyncio
async def test_approve_entries_non_admin_403(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    tournament = await create_tournament(db_session, test_user)
    fake_coach_id = uuid_mod.uuid4()

    response = await auth_client.post(f"/api/tournaments/{tournament.id}/coaches/{fake_coach_id}/approve")
    assert response.status_code == 403


@pytest.mark.asyncio
async def test_approve_entries_no_entries_404(
    admin_client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
):
    tournament = await create_tournament(db_session, admin_user)
    fake_coach_id = uuid_mod.uuid4()

    response = await admin_client.post(f"/api/tournaments/{tournament.id}/coaches/{fake_coach_id}/approve")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_results_empty(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    tournament = await create_tournament(db_session, test_user)

    response = await auth_client.get(f"/api/tournaments/{tournament.id}/results")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_result_admin(
    admin_client: AsyncClient,
    db_session: AsyncSession,
    admin_user: User,
    test_user: User,
):
    tournament = await create_tournament(db_session, admin_user)

    athlete_result = await db_session.execute(
        select(User).where(User.id == test_user.id).options(selectinload(User.athlete))
    )
    athlete = athlete_result.scalar_one().athlete
    original_rating = athlete.rating_points

    response = await admin_client.post(
        f"/api/tournaments/{tournament.id}/results",
        json={
            "athlete_id": str(athlete.id),
            "weight_category": "68kg",
            "age_category": "Seniors",
            "place": 1,
            "rating_points_earned": 100,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["place"] == 1
    assert data["rating_points_earned"] == 100

    await db_session.refresh(athlete)
    assert athlete.rating_points == original_rating + 100


@pytest.mark.asyncio
async def test_create_result_non_admin_403(
    auth_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
):
    tournament = await create_tournament(db_session, test_user)

    athlete_result = await db_session.execute(
        select(User).where(User.id == test_user.id).options(selectinload(User.athlete))
    )
    athlete = athlete_result.scalar_one().athlete

    response = await auth_client.post(
        f"/api/tournaments/{tournament.id}/results",
        json={
            "athlete_id": str(athlete.id),
            "weight_category": "68kg",
            "age_category": "Seniors",
            "place": 1,
            "rating_points_earned": 50,
        },
    )
    assert response.status_code == 403


# ═══════════════════════════════════════════════════════════════
#  5. API: Role Request (POST /api/me/role-request)
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_create_role_request_success(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/me/role-request",
        json={"requested_role": "coach", "data": {}},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["requested_role"] == "coach"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_role_request_already_has_role(coach_client: AsyncClient):
    response = await coach_client.post(
        "/api/me/role-request",
        json={"requested_role": "coach", "data": {}},
    )
    assert response.status_code == 400
    assert "already have" in response.json()["detail"]


@pytest.mark.asyncio
async def test_role_request_duplicate_pending(auth_client: AsyncClient):
    response1 = await auth_client.post(
        "/api/me/role-request",
        json={"requested_role": "coach", "data": {}},
    )
    assert response1.status_code == 200

    response2 = await auth_client.post(
        "/api/me/role-request",
        json={"requested_role": "coach", "data": {}},
    )
    assert response2.status_code == 400
    assert "pending" in response2.json()["detail"]


@pytest.mark.asyncio
async def test_role_request_athlete_already_exists(auth_client: AsyncClient):
    response = await auth_client.post(
        "/api/me/role-request",
        json={"requested_role": "athlete", "data": {}},
    )
    assert response.status_code == 400
    assert "already have" in response.json()["detail"]


# ═══════════════════════════════════════════════════════════════
#  6. Bot: /start & Language
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_start_new_user(db_session):
    """Unknown user → create User in DB + send WebApp button."""
    from bot.handlers.start import cmd_start

    msg = _make_message(telegram_id=999999999)
    state = _make_state()
    command = _make_command()

    with patch("bot.handlers.start.async_session", TestSession):
        await cmd_start(msg, state, command)

    msg.answer.assert_called_once()
    call_text = msg.answer.call_args[0][0]
    assert "KukkiDo" in call_text

    # User should be created in DB
    async with TestSession() as session:
        result = await session.execute(select(User).where(User.telegram_id == 999999999))
        user = result.scalar_one_or_none()
    assert user is not None


@pytest.mark.asyncio
async def test_start_existing_user(db_session, test_user):
    """Existing user with profile → returning welcome message."""
    from bot.handlers.start import cmd_start

    msg = _make_message(telegram_id=test_user.telegram_id)
    state = _make_state()
    command = _make_command()

    with patch("bot.handlers.start.async_session", TestSession):
        await cmd_start(msg, state, command)

    msg.answer.assert_called_once()
    call_text = msg.answer.call_args[0][0]
    assert "Welcome back" in call_text or "С возвращением" in call_text


@pytest.mark.asyncio
async def test_start_invite_deep_link(db_session):
    """args='invite_abc' → delegate to invite handler."""
    from bot.handlers.start import cmd_start

    msg = _make_message(telegram_id=999999999)
    state = _make_state()
    command = _make_command(args="invite_abc123")

    with (
        patch("bot.handlers.start.async_session", TestSession),
        patch("bot.handlers.invite.handle_invite_deep_link", new_callable=AsyncMock) as mock_invite,
    ):
        await cmd_start(msg, state, command)

    mock_invite.assert_called_once_with(msg, state, "invite_abc123")


# ═══════════════════════════════════════════════════════════════
#  7. Bot: Registration FSM
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_athlete_full_name_step(db_session):
    """Entering name → state updated, next step prompted."""
    from bot.handlers.registration import athlete_full_name

    state = _make_state({"language": "en"})
    msg = _make_message(text="John Doe")

    await athlete_full_name(msg, state)

    data = await state.get_data()
    assert data["full_name"] == "John Doe"
    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_athlete_dob_valid(db_session):
    """Valid date '15.06.2000' → date saved in state."""
    from bot.handlers.registration import athlete_dob

    state = _make_state({"language": "en"})
    msg = _make_message(text="15.06.2000")

    await athlete_dob(msg, state)

    data = await state.get_data()
    assert data["date_of_birth"] == "2000-06-15"


@pytest.mark.asyncio
async def test_athlete_dob_invalid(db_session):
    """Invalid date → error message, state NOT updated."""
    from bot.handlers.registration import athlete_dob

    state = _make_state({"language": "en"})
    msg = _make_message(text="not-a-date")

    await athlete_dob(msg, state)

    data = await state.get_data()
    assert "date_of_birth" not in data
    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_athlete_weight_invalid(db_session):
    """Negative weight → error message."""
    from bot.handlers.registration import athlete_current_weight

    state = _make_state({"language": "en"})
    msg = _make_message(text="-5")

    await athlete_current_weight(msg, state)

    data = await state.get_data()
    assert "current_weight" not in data
    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_save_athlete_creates_db_record(db_session):
    """All fields provided → Athlete record created in DB."""
    from bot.handlers.registration import _save_athlete

    user = User(telegram_id=333333333, username="newathlete", language="en")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    state = _make_state(
        {
            "language": "en",
            "user_id": str(user.id),
            "full_name": "Created Athlete",
            "date_of_birth": "2000-01-15",
            "gender": "M",
            "weight_category": "68kg",
            "current_weight": 68.0,
            "sport_rank": "КМС",
            "city": "Moscow",
            "club": "Test Club",
            "photo_url": None,
        }
    )
    msg = _make_message()

    with patch("bot.handlers.registration.async_session", TestSession):
        await _save_athlete(msg, state)

    async with TestSession() as session:
        result = await session.execute(select(Athlete).where(Athlete.user_id == user.id))
        athlete = result.scalar_one_or_none()

    assert athlete is not None
    assert athlete.full_name == "Created Athlete"
    assert athlete.city == "Moscow"
    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_save_coach_creates_db_record_and_role_request(db_session):
    """All fields → Coach + RoleRequest created in DB."""
    from bot.handlers.registration import _save_coach

    user = User(telegram_id=444444444, username="newcoach", language="en")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    state = _make_state(
        {
            "language": "en",
            "user_id": str(user.id),
            "full_name": "Created Coach",
            "date_of_birth": "1985-03-20",
            "gender": "F",
            "city": "Kazan",
            "club": "Coach Club",
            "sport_rank": "МС",
            "photo_url": None,
        }
    )
    msg = _make_message()

    with patch("bot.handlers.registration.async_session", TestSession):
        await _save_coach(msg, state)

    async with TestSession() as session:
        result = await session.execute(select(Coach).where(Coach.user_id == user.id))
        coach = result.scalar_one_or_none()

    assert coach is not None
    assert coach.full_name == "Created Coach"
    assert coach.is_verified is False

    async with TestSession() as session:
        result = await session.execute(select(RoleRequest).where(RoleRequest.user_id == user.id))
        rr = result.scalar_one_or_none()

    assert rr is not None
    assert rr.requested_role == "coach"
    assert rr.status == "pending"


# ═══════════════════════════════════════════════════════════════
#  8. Bot: Tournament Entries
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_tournament_enter_not_verified(db_session: AsyncSession):
    """Unverified coach → rejection message."""
    from bot.handlers.entries import on_tournament_enter

    user = User(telegram_id=222222222, username="unverified", language="en")
    db_session.add(user)
    await db_session.flush()

    coach = Coach(
        user_id=user.id,
        full_name="Unverified Coach",
        date_of_birth=date(1990, 1, 1),
        gender="M",
        country="RU",
        city="Moscow",
        club="Club",
        qualification="MS",
        is_verified=False,
    )
    db_session.add(coach)
    await db_session.commit()

    cb = _make_callback(telegram_id=222222222, data="tournament_enter:some-uuid")
    state = _make_state()

    with patch("bot.handlers.entries.async_session", TestSession):
        await on_tournament_enter(cb, state)

    cb.message.edit_text.assert_called_once()


@pytest.mark.asyncio
async def test_tournament_enter_shows_athletes(
    db_session: AsyncSession,
    coach_with_athlete: tuple[User, User],
):
    """Verified coach with athletes → show athlete checkbox keyboard."""
    from bot.handlers.entries import on_tournament_enter

    coach_u, athlete_u = coach_with_athlete
    tournament = await create_tournament(db_session, coach_u)

    cb = _make_callback(
        telegram_id=coach_u.telegram_id,
        data=f"tournament_enter:{tournament.id}",
    )
    state = _make_state()

    with (
        patch("bot.handlers.entries.async_session", TestSession),
        patch("bot.handlers.entries.parse_callback", _patched_parse_callback),
    ):
        await on_tournament_enter(cb, state)

    cb.message.edit_text.assert_called()
    data = await state.get_data()
    assert str(tournament.id) in str(data.get("entry_tid"))


@pytest.mark.asyncio
async def test_toggle_athlete_selection(db_session: AsyncSession, coach_with_athlete: tuple[User, User]):
    """Toggle → athlete added/removed from selected list."""
    from bot.handlers.entries import on_toggle_athlete

    coach_u, athlete_u = coach_with_athlete

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == athlete_u.id).options(selectinload(User.athlete)))
        athlete = result.scalar_one().athlete

    async with TestSession() as session:
        result = await session.execute(select(User).where(User.id == coach_u.id).options(selectinload(User.coach)))
        coach = result.scalar_one().coach

    state = _make_state(
        {
            "language": "en",
            "entry_coach_id": coach.id,
            "selected_athletes": [],
        }
    )

    cb = _make_callback(
        telegram_id=coach_u.telegram_id,
        data=f"toggle_athlete:{athlete.id}",
    )

    with (
        patch("bot.handlers.entries.async_session", TestSession),
        patch("bot.handlers.entries.parse_callback", _patched_parse_callback),
    ):
        await on_toggle_athlete(cb, state)

    data = await state.get_data()
    selected = [str(a) for a in data["selected_athletes"]]
    assert str(athlete.id) in selected


@pytest.mark.asyncio
async def test_confirm_entries_creates_records(
    db_session: AsyncSession,
    coach_with_athlete: tuple[User, User],
):
    """Confirm → TournamentEntry records created in DB."""
    from bot.handlers.entries import on_confirm_entries

    coach_u, athlete_u = coach_with_athlete
    tournament = await create_tournament(db_session, coach_u)

    async with TestSession() as session:
        coach_result = await session.execute(
            select(User).where(User.id == coach_u.id).options(selectinload(User.coach))
        )
        coach = coach_result.scalar_one().coach

        athlete_result = await session.execute(
            select(User).where(User.id == athlete_u.id).options(selectinload(User.athlete))
        )
        athlete = athlete_result.scalar_one().athlete

    state = _make_state(
        {
            "language": "en",
            "entry_tid": tournament.id,
            "entry_coach_id": coach.id,
            "entry_age_category": "Seniors",
            "selected_athletes": [athlete.id],
        }
    )

    cb = _make_callback(telegram_id=coach_u.telegram_id, data="confirm_entries")

    with patch("bot.handlers.entries.async_session", TestSession):
        await on_confirm_entries(cb, state)

    async with TestSession() as session:
        result = await session.execute(
            select(TournamentEntry).where(
                TournamentEntry.tournament_id == tournament.id,
                TournamentEntry.athlete_id == athlete.id,
            )
        )
        entry = result.scalar_one_or_none()

    assert entry is not None
    assert entry.status == "pending"
    assert entry.age_category == "Seniors"


@pytest.mark.asyncio
async def test_entry_cancel_clears_state(db_session: AsyncSession):
    """Cancel → state cleared."""
    from bot.handlers.entries import on_entry_cancel

    state = _make_state({"language": "en", "entry_tid": "some-id"})
    cb = _make_callback(data="entry_cancel")

    await on_entry_cancel(cb, state)

    data = await state.get_data()
    assert data == {}
    cb.message.edit_text.assert_called_once()


# ═══════════════════════════════════════════════════════════════
#  9. Bot: Admin Coach Verification
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_admin_command_non_admin_ignored(db_session: AsyncSession, monkeypatch):
    """Non-admin user → message.answer NOT called."""
    from bot.handlers.admin_coaches import cmd_admin

    monkeypatch.setattr(settings, "ADMIN_IDS", str(ADMIN_TELEGRAM_ID))

    msg = _make_message(telegram_id=999999999)

    await cmd_admin(msg)

    msg.answer.assert_not_called()


@pytest.mark.asyncio
async def test_admin_command_shows_menu(db_session: AsyncSession, monkeypatch):
    """Admin user → admin menu shown."""
    from bot.handlers.admin_coaches import cmd_admin

    monkeypatch.setattr(settings, "ADMIN_IDS", str(ADMIN_TELEGRAM_ID))
    await _create_admin_user_in_db(db_session)

    msg = _make_message(telegram_id=ADMIN_TELEGRAM_ID)

    with patch("bot.handlers.admin_coaches.async_session", TestSession):
        await cmd_admin(msg)

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_pending_coaches_empty(db_session: AsyncSession, monkeypatch):
    """No pending requests → 'no pending' message."""
    from bot.handlers.admin_coaches import cmd_pending_coaches

    monkeypatch.setattr(settings, "ADMIN_IDS", str(ADMIN_TELEGRAM_ID))
    await _create_admin_user_in_db(db_session)

    msg = _make_message(telegram_id=ADMIN_TELEGRAM_ID)

    with patch("bot.handlers.admin_coaches.async_session", TestSession):
        await cmd_pending_coaches(msg)

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_approve_coach_sets_verified(db_session: AsyncSession, monkeypatch):
    """Approve → is_verified=True, status='approved'."""
    from bot.handlers.admin_coaches import on_approve_coach

    monkeypatch.setattr(settings, "ADMIN_IDS", str(ADMIN_TELEGRAM_ID))
    await _create_admin_user_in_db(db_session)
    coach_user, role_request = await _create_coach_with_request(db_session)

    cb = _make_callback(
        telegram_id=ADMIN_TELEGRAM_ID,
        data=f"approve_coach:{role_request.id}",
    )

    with (
        patch("bot.handlers.admin_coaches.async_session", TestSession),
        patch("bot.handlers.admin_coaches.parse_callback", _patched_parse_callback),
        patch("bot.handlers.admin_coaches.write_audit_log", new_callable=AsyncMock),
    ):
        await on_approve_coach(cb)

    async with TestSession() as session:
        result = await session.execute(select(RoleRequest).where(RoleRequest.id == role_request.id))
        rr = result.scalar_one()
        assert rr.status == "approved"

        coach_result = await session.execute(select(Coach).where(Coach.user_id == coach_user.id))
        coach = coach_result.scalar_one()
        assert coach.is_verified is True


@pytest.mark.asyncio
async def test_decline_coach_with_reason(db_session: AsyncSession, monkeypatch):
    """Decline with reason → status='declined', admin_comment set."""
    from bot.handlers.admin_coaches import on_decline_coach, on_decline_reason

    monkeypatch.setattr(settings, "ADMIN_IDS", str(ADMIN_TELEGRAM_ID))
    await _create_admin_user_in_db(db_session)
    coach_user, role_request = await _create_coach_with_request(db_session)

    # Step 1: decline button → enters FSM
    cb = _make_callback(
        telegram_id=ADMIN_TELEGRAM_ID,
        data=f"decline_coach:{role_request.id}",
    )
    state = _make_state()

    with (
        patch("bot.handlers.admin_coaches.async_session", TestSession),
        patch("bot.handlers.admin_coaches.parse_callback", _patched_parse_callback),
    ):
        await on_decline_coach(cb, state)

    cb.message.edit_text.assert_called_once()

    # Step 2: enter reason
    msg = _make_message(telegram_id=ADMIN_TELEGRAM_ID, text="Insufficient qualification")

    with (
        patch("bot.handlers.admin_coaches.async_session", TestSession),
        patch("bot.handlers.admin_coaches.parse_callback", _patched_parse_callback),
        patch("bot.handlers.admin_coaches.write_audit_log", new_callable=AsyncMock),
    ):
        await on_decline_reason(msg, state)

    async with TestSession() as session:
        result = await session.execute(select(RoleRequest).where(RoleRequest.id == role_request.id))
        rr = result.scalar_one()
        assert rr.status == "declined"
        assert rr.admin_comment == "Insufficient qualification"


# ═══════════════════════════════════════════════════════════════
#  10. BOT: Invite Flow
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_cmd_invite_not_a_coach(db_session: AsyncSession):
    """Non-coach user runs /invite → gets 'not a coach' message."""
    # Create user without coach profile
    user = User(telegram_id=700000001, username="nocoach", language="en")
    db_session.add(user)
    await db_session.commit()

    msg = _make_message(telegram_id=700000001)

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import cmd_invite

        await cmd_invite(msg)

    msg.answer.assert_called_once()
    call_text = msg.answer.call_args[0][0]
    assert call_text  # got some response (not_a_coach message)


@pytest.mark.asyncio
async def test_cmd_invite_unverified_coach(db_session: AsyncSession):
    """Unverified coach runs /invite → gets 'not verified' message."""
    user = User(telegram_id=700000002, username="unverified", language="en")
    db_session.add(user)
    await db_session.flush()

    coach = Coach(
        user_id=user.id,
        full_name="Unverified Coach",
        date_of_birth=date(1990, 1, 1),
        gender="M",
        country="RU",
        city="Moscow",
        club="Club",
        qualification="MS",
        is_verified=False,
    )
    db_session.add(coach)
    await db_session.commit()

    msg = _make_message(telegram_id=700000002)

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import cmd_invite

        await cmd_invite(msg)

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_cmd_invite_verified_creates_token(db_session: AsyncSession):
    """Verified coach runs /invite → InviteToken created, link returned."""
    coach_user, _ = await _create_verified_coach_with_athlete(db_session)

    msg = _make_message(telegram_id=coach_user.telegram_id)

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import cmd_invite

        await cmd_invite(msg)

    msg.answer.assert_called_once()
    call_text = msg.answer.call_args[0][0]
    assert "t.me/" in call_text or "invite_" in call_text

    # Verify token in DB
    async with TestSession() as session:
        result = await session.execute(select(InviteToken))
        tokens = result.scalars().all()
        assert len(tokens) == 1
        assert tokens[0].coach_id == coach_user.coach.id
        assert not tokens[0].used


@pytest.mark.asyncio
async def test_invite_deep_link_expired_token(db_session: AsyncSession):
    """Deep link with expired token → 'invite expired' message."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    # Create expired token (use naive datetime — SQLite drops timezone info)
    token = InviteToken(
        token="expired12345",
        coach_id=coach_user.coach.id,
        expires_at=datetime.utcnow() - timedelta(hours=1),
        used=False,
    )
    db_session.add(token)
    await db_session.commit()

    msg = _make_message(telegram_id=athlete_user.telegram_id)
    state = _make_state()

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import handle_invite_deep_link

        await handle_invite_deep_link(msg, state, "invite_expired12345")

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_invite_deep_link_used_token(db_session: AsyncSession):
    """Deep link with already-used token → 'invite expired' message."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    token = InviteToken(
        token="used12345678",
        coach_id=coach_user.coach.id,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        used=True,
    )
    db_session.add(token)
    await db_session.commit()

    msg = _make_message(telegram_id=athlete_user.telegram_id)
    state = _make_state()

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import handle_invite_deep_link

        await handle_invite_deep_link(msg, state, "invite_used12345678")

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_invite_deep_link_valid_token_shows_decision(db_session: AsyncSession):
    """Valid invite token → shows coach info + accept/decline buttons."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    token = InviteToken(
        token="valid1234567",
        coach_id=coach_user.coach.id,
        expires_at=datetime.utcnow() + timedelta(hours=24),
        used=False,
    )
    db_session.add(token)
    await db_session.commit()

    msg = _make_message(telegram_id=athlete_user.telegram_id)
    state = _make_state()

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import handle_invite_deep_link

        await handle_invite_deep_link(msg, state, "invite_valid1234567")

    msg.answer.assert_called_once()
    call_kwargs = msg.answer.call_args
    # Should have reply_markup (invite decision keyboard)
    assert call_kwargs.kwargs.get("reply_markup") is not None

    # Token should now be marked as used
    async with TestSession() as session:
        result = await session.execute(select(InviteToken).where(InviteToken.token == "valid1234567"))
        t = result.scalar_one()
        assert t.used is True


@pytest.mark.asyncio
async def test_invite_accept_creates_link(db_session: AsyncSession):
    """Athlete accepts invite → CoachAthlete link created."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    cb = _make_callback(
        telegram_id=athlete_user.telegram_id,
        data=f"invite_accept:{coach_user.coach.id}",
    )

    with (
        patch("bot.handlers.invite.async_session", TestSession),
        patch("bot.handlers.invite.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.invite import on_invite_accept

        await on_invite_accept(cb)

    cb.message.edit_text.assert_called_once()

    # Verify CoachAthlete link exists
    async with TestSession() as session:
        result = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach_user.coach.id,
                CoachAthlete.athlete_id == athlete_user.athlete.id,
            )
        )
        link = result.scalar_one()
        assert link.status == "accepted"


@pytest.mark.asyncio
async def test_invite_accept_already_linked(db_session: AsyncSession):
    """Athlete accepts invite but already linked → 'already linked' message."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    # Pre-create link
    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)
    await db_session.commit()

    cb = _make_callback(
        telegram_id=athlete_user.telegram_id,
        data=f"invite_accept:{coach_user.coach.id}",
    )

    with (
        patch("bot.handlers.invite.async_session", TestSession),
        patch("bot.handlers.invite.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.invite import on_invite_accept

        await on_invite_accept(cb)

    cb.message.edit_text.assert_called_once()
    # Should NOT create a second link
    async with TestSession() as session:
        result = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach_user.coach.id,
                CoachAthlete.athlete_id == athlete_user.athlete.id,
            )
        )
        links = result.scalars().all()
        assert len(links) == 1


@pytest.mark.asyncio
async def test_invite_decline(db_session: AsyncSession):
    """Athlete declines invite → message updated, no link created."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    cb = _make_callback(
        telegram_id=athlete_user.telegram_id,
        data=f"invite_decline:{coach_user.coach.id}",
    )

    with patch("bot.handlers.invite.async_session", TestSession):
        from bot.handlers.invite import on_invite_decline

        await on_invite_decline(cb)

    cb.message.edit_text.assert_called_once()

    # No link should exist
    async with TestSession() as session:
        result = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach_user.coach.id,
                CoachAthlete.athlete_id == athlete_user.athlete.id,
            )
        )
        links = result.scalars().all()
        assert len(links) == 0


# ═══════════════════════════════════════════════════════════════
#  11. BOT: My Athletes
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_my_athletes_not_a_coach(db_session: AsyncSession):
    """Non-coach user runs /my_athletes → 'not a verified coach'."""
    user = User(telegram_id=710000001, username="notcoach", language="en")
    db_session.add(user)
    await db_session.commit()

    msg = _make_message(telegram_id=710000001)

    with patch("bot.handlers.my_athletes.async_session", TestSession):
        from bot.handlers.my_athletes import cmd_my_athletes

        await cmd_my_athletes(msg)

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_my_athletes_empty(db_session: AsyncSession):
    """Verified coach with no athletes → 'no athletes'."""
    coach_user, _ = await _create_verified_coach_with_athlete(db_session)
    # Don't link athlete — coach has zero linked athletes

    msg = _make_message(telegram_id=coach_user.telegram_id)

    with patch("bot.handlers.my_athletes.async_session", TestSession):
        from bot.handlers.my_athletes import cmd_my_athletes

        await cmd_my_athletes(msg)

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_my_athletes_with_linked_athletes(db_session: AsyncSession):
    """Verified coach with linked athlete → shows athlete list."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)
    await db_session.commit()

    msg = _make_message(telegram_id=coach_user.telegram_id)

    with patch("bot.handlers.my_athletes.async_session", TestSession):
        from bot.handlers.my_athletes import cmd_my_athletes

        await cmd_my_athletes(msg)

    msg.answer.assert_called_once()
    call_kwargs = msg.answer.call_args
    assert call_kwargs.kwargs.get("reply_markup") is not None


@pytest.mark.asyncio
async def test_view_athlete_detail(db_session: AsyncSession):
    """Coach views athlete card → shows athlete info."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)
    await db_session.commit()

    cb = _make_callback(
        telegram_id=coach_user.telegram_id,
        data=f"view_athlete:{athlete_user.athlete.id}",
    )

    with (
        patch("bot.handlers.my_athletes.async_session", TestSession),
        patch("bot.handlers.my_athletes.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.my_athletes import on_view_athlete

        await on_view_athlete(cb)

    cb.message.edit_text.assert_called_once()
    call_text = cb.message.edit_text.call_args[0][0]
    assert "Invite Athlete" in call_text


@pytest.mark.asyncio
async def test_unlink_athlete(db_session: AsyncSession):
    """Coach unlinks athlete → CoachAthlete deleted."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)
    await db_session.commit()

    cb = _make_callback(
        telegram_id=coach_user.telegram_id,
        data=f"unlink_athlete:{athlete_user.athlete.id}",
    )

    with (
        patch("bot.handlers.my_athletes.async_session", TestSession),
        patch("bot.handlers.my_athletes.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.my_athletes import on_unlink_athlete

        await on_unlink_athlete(cb)

    # Verify link is deleted
    async with TestSession() as session:
        result = await session.execute(
            select(CoachAthlete).where(
                CoachAthlete.coach_id == coach_user.coach.id,
                CoachAthlete.athlete_id == athlete_user.athlete.id,
            )
        )
        links = result.scalars().all()
        assert len(links) == 0


# ═══════════════════════════════════════════════════════════════
#  12. BOT: Entries Edge Cases
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_tournament_enter_deadline_passed(db_session: AsyncSession):
    """Coach tries to enter athletes after registration deadline → rejected."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    # Link athlete to coach (entries.py uses status="accepted")
    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)

    # Tournament with deadline in the past
    tournament = Tournament(
        name="Past Deadline",
        start_date=date.today() + timedelta(days=5),
        end_date=date.today() + timedelta(days=7),
        city="Moscow",
        country="RU",
        venue="Arena",
        registration_deadline=date.today() - timedelta(days=1),
        created_by=coach_user.id,
    )
    db_session.add(tournament)
    await db_session.commit()
    await db_session.refresh(tournament)

    cb = _make_callback(
        telegram_id=coach_user.telegram_id,
        data=f"tournament_enter:{tournament.id}",
    )
    state = _make_state()

    with (
        patch("bot.handlers.entries.async_session", TestSession),
        patch("bot.handlers.entries.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.entries import on_tournament_enter

        await on_tournament_enter(cb, state)

    cb.message.edit_text.assert_called_once()
    # Should show deadline_passed message, not athlete list


@pytest.mark.asyncio
async def test_tournament_enter_not_found(db_session: AsyncSession):
    """Coach tries to enter athletes for non-existent tournament → not found."""
    coach_user, _ = await _create_verified_coach_with_athlete(db_session)

    fake_id = uuid_mod.uuid4()
    cb = _make_callback(
        telegram_id=coach_user.telegram_id,
        data=f"tournament_enter:{fake_id}",
    )
    state = _make_state()

    with (
        patch("bot.handlers.entries.async_session", TestSession),
        patch("bot.handlers.entries.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.entries import on_tournament_enter

        await on_tournament_enter(cb, state)

    cb.message.edit_text.assert_called_once()


@pytest.mark.asyncio
async def test_cmd_my_entries_no_entries(db_session: AsyncSession):
    """Coach runs /my_entries with no entries → 'no entries'."""
    coach_user, _ = await _create_verified_coach_with_athlete(db_session)

    msg = _make_message(telegram_id=coach_user.telegram_id)

    with patch("bot.handlers.entries.async_session", TestSession):
        from bot.handlers.entries import cmd_my_entries

        await cmd_my_entries(msg)

    msg.answer.assert_called_once()


@pytest.mark.asyncio
async def test_cmd_my_entries_with_entries(db_session: AsyncSession):
    """Coach runs /my_entries with existing entries → shows tournament list."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)

    tournament = Tournament(
        name="My Entries Test",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=32),
        city="Moscow",
        country="RU",
        venue="Arena",
        registration_deadline=date.today() + timedelta(days=20),
        created_by=coach_user.id,
    )
    db_session.add(tournament)
    await db_session.flush()

    entry = TournamentEntry(
        tournament_id=tournament.id,
        athlete_id=athlete_user.athlete.id,
        coach_id=coach_user.coach.id,
        weight_category="68kg",
        age_category="Seniors",
    )
    db_session.add(entry)
    await db_session.commit()

    msg = _make_message(telegram_id=coach_user.telegram_id)

    with patch("bot.handlers.entries.async_session", TestSession):
        from bot.handlers.entries import cmd_my_entries

        await cmd_my_entries(msg)

    msg.answer.assert_called_once()
    call_kwargs = msg.answer.call_args
    assert call_kwargs.kwargs.get("reply_markup") is not None


@pytest.mark.asyncio
async def test_withdraw_entry_success(db_session: AsyncSession):
    """Coach withdraws entry before deadline → entry deleted."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)

    tournament = Tournament(
        name="Withdraw Test",
        start_date=date.today() + timedelta(days=30),
        end_date=date.today() + timedelta(days=32),
        city="Moscow",
        country="RU",
        venue="Arena",
        registration_deadline=date.today() + timedelta(days=20),
        created_by=coach_user.id,
    )
    db_session.add(tournament)
    await db_session.flush()

    entry = TournamentEntry(
        tournament_id=tournament.id,
        athlete_id=athlete_user.athlete.id,
        coach_id=coach_user.coach.id,
        weight_category="68kg",
        age_category="Seniors",
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)

    cb = _make_callback(
        telegram_id=coach_user.telegram_id,
        data=f"withdraw:{entry.id}",
    )

    with (
        patch("bot.handlers.entries.async_session", TestSession),
        patch("bot.handlers.entries.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.entries import on_withdraw_entry

        await on_withdraw_entry(cb)

    # Entry should be deleted
    async with TestSession() as session:
        result = await session.execute(select(TournamentEntry).where(TournamentEntry.id == entry.id))
        assert result.scalar_one_or_none() is None


@pytest.mark.asyncio
async def test_withdraw_entry_deadline_passed(db_session: AsyncSession):
    """Coach tries to withdraw after deadline → rejected."""
    coach_user, athlete_user = await _create_verified_coach_with_athlete(db_session)

    link = CoachAthlete(
        coach_id=coach_user.coach.id,
        athlete_id=athlete_user.athlete.id,
        status="accepted",
    )
    db_session.add(link)

    tournament = Tournament(
        name="No Withdraw",
        start_date=date.today() + timedelta(days=5),
        end_date=date.today() + timedelta(days=7),
        city="Moscow",
        country="RU",
        venue="Arena",
        registration_deadline=date.today() - timedelta(days=1),
        created_by=coach_user.id,
    )
    db_session.add(tournament)
    await db_session.flush()

    entry = TournamentEntry(
        tournament_id=tournament.id,
        athlete_id=athlete_user.athlete.id,
        coach_id=coach_user.coach.id,
        weight_category="68kg",
        age_category="Seniors",
    )
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)

    cb = _make_callback(
        telegram_id=coach_user.telegram_id,
        data=f"withdraw:{entry.id}",
    )

    with (
        patch("bot.handlers.entries.async_session", TestSession),
        patch("bot.handlers.entries.parse_callback", _patched_parse_callback),
    ):
        from bot.handlers.entries import on_withdraw_entry

        await on_withdraw_entry(cb)

    # Entry should NOT be deleted (deadline passed → reject before delete)
    async with TestSession() as session:
        result = await session.execute(select(TournamentEntry).where(TournamentEntry.id == entry.id))
        assert result.scalar_one_or_none() is not None


# ═══════════════════════════════════════════════════════════════
#  13. BOT: Registration Edge Cases
# ═══════════════════════════════════════════════════════════════


@pytest.mark.asyncio
async def test_athlete_weight_invalid_negative():
    """Negative weight → error message."""
    msg = _make_message(text="-5")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_current_weight

    await athlete_current_weight(msg, state)

    msg.answer.assert_called_once()
    data = await state.get_data()
    assert "current_weight" not in data


@pytest.mark.asyncio
async def test_athlete_weight_invalid_over_300():
    """Weight > 300 → error message."""
    msg = _make_message(text="350")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_current_weight

    await athlete_current_weight(msg, state)

    msg.answer.assert_called_once()
    data = await state.get_data()
    assert "current_weight" not in data


@pytest.mark.asyncio
async def test_athlete_weight_valid():
    """Valid weight → saved to state."""
    msg = _make_message(text="68.5")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_current_weight

    await athlete_current_weight(msg, state)

    data = await state.get_data()
    assert data["current_weight"] == 68.5


@pytest.mark.asyncio
async def test_athlete_weight_comma_format():
    """Comma-formatted weight (e.g. '68,5') → parsed correctly."""
    msg = _make_message(text="68,5")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_current_weight

    await athlete_current_weight(msg, state)

    data = await state.get_data()
    assert data["current_weight"] == 68.5


@pytest.mark.asyncio
async def test_athlete_dob_invalid_format():
    """Invalid date format → error message."""
    msg = _make_message(text="not-a-date")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_dob

    await athlete_dob(msg, state)

    msg.answer.assert_called_once()
    data = await state.get_data()
    assert "date_of_birth" not in data


@pytest.mark.asyncio
async def test_athlete_city_other_custom():
    """Selecting 'other' city → enters custom city step."""
    cb = _make_callback(data="city:other")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_city_callback

    await athlete_city_callback(cb, state)

    cb.message.edit_text.assert_called_once()
    state_data = await state.get_data()
    # city should NOT be set yet (will be set in city_custom handler)
    assert "city" not in state_data


@pytest.mark.asyncio
async def test_athlete_city_custom_text():
    """Custom city text input → saved to state."""
    msg = _make_message(text="Владивосток")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_city_custom

    await athlete_city_custom(msg, state)

    data = await state.get_data()
    assert data["city"] == "Владивосток"


@pytest.mark.asyncio
async def test_athlete_club_skip():
    """Skipping club → club set to None."""
    cb = _make_callback(data="club:skip")
    state = _make_state({"language": "en"})

    from bot.handlers.registration import athlete_club_skip

    await athlete_club_skip(cb, state)

    data = await state.get_data()
    assert data["club"] is None


@pytest.mark.asyncio
async def test_athlete_photo_skip(db_session: AsyncSession):
    """Skipping photo → photo_url set to None, _save_athlete called."""
    # Need a real user in DB for the foreign key
    user = User(telegram_id=720000099, username="photoskip", language="en")
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    cb = _make_callback(data="photo:skip")
    state = _make_state(
        {
            "language": "en",
            "user_id": str(user.id),
            "full_name": "Test Photo Skip",
            "date_of_birth": "2000-01-01",
            "gender": "M",
            "weight_category": "68kg",
            "current_weight": 67.5,
            "sport_rank": "КМС",
            "city": "Moscow",
        }
    )

    with patch("bot.handlers.registration.async_session", TestSession):
        from bot.handlers.registration import athlete_photo_skip

        await athlete_photo_skip(cb, state)

    # State should be cleared after successful save
    data = await state.get_data()
    assert data == {}
