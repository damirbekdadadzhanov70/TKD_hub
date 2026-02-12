<p align="center">
  <img src="https://img.shields.io/badge/%F0%9F%A5%8B-KukkiDo-e53e3e?style=for-the-badge&labelColor=1a1a2e&logo=data:image/svg+xml;base64," alt="KukkiDo" />
</p>

<h1 align="center">KukkiDo</h1>

<p align="center">
  <b>Taekwondo Hub &mdash; Telegram Mini App</b>
</p>

<p align="center">
  <a href="#-about"><img src="https://img.shields.io/badge/python-3.11-blue?logo=python&logoColor=white" alt="Python" /></a>
  <a href="#-about"><img src="https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white" alt="FastAPI" /></a>
  <a href="#-about"><img src="https://img.shields.io/badge/aiogram-3.15-blue?logo=telegram&logoColor=white" alt="aiogram" /></a>
  <a href="#-about"><img src="https://img.shields.io/badge/React-19-61dafb?logo=react&logoColor=black" alt="React" /></a>
  <a href="#-about"><img src="https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss&logoColor=white" alt="Tailwind" /></a>
  <a href="#license"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

---

## About

**RU** — KukkiDo — платформа для управления тхэквондо-клубом через Telegram Mini App. Тренеры регистрируют спортсменов, записывают их на турниры, отслеживают тренировки и рейтинги — всё прямо в Telegram. Спортсмены ведут дневник тренировок и следят за предстоящими соревнованиями.

**EN** — KukkiDo is a Taekwondo club management platform built as a Telegram Mini App. Coaches register athletes, enter them into tournaments, and track training & ratings — all inside Telegram. Athletes keep a training log and stay up to date on upcoming competitions.

---

## Screenshots

> _Screenshots will be added here_

<!--
<p align="center">
  <img src="docs/screenshots/profile.png" width="200" />
  <img src="docs/screenshots/tournaments.png" width="200" />
  <img src="docs/screenshots/training.png" width="200" />
</p>
-->

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Bot** | Python 3.11, [aiogram 3.15](https://docs.aiogram.dev/), FSM states |
| **API** | [FastAPI](https://fastapi.tiangolo.com/), Pydantic v2, SlowAPI rate limiting |
| **Database** | PostgreSQL 16 (prod), SQLite + aiosqlite (dev), [SQLAlchemy 2.0](https://www.sqlalchemy.org/) async, Alembic migrations |
| **Frontend** | [React 19](https://react.dev/), TypeScript 5.9, [Tailwind CSS 4](https://tailwindcss.com/), Vite 7, [@twa-dev/sdk](https://github.com/nicepkg/twa-dev-sdk) |
| **Infra** | Docker Compose, GitHub Actions CI |

---

## Project Structure

```
KukkiDo/
├── api/                    # FastAPI backend
│   ├── routes/             #   endpoint handlers
│   ├── schemas/            #   Pydantic models
│   └── utils/              #   pagination helpers
├── bot/                    # aiogram Telegram bot
│   ├── handlers/           #   message & callback handlers
│   ├── keyboards/          #   inline keyboards
│   ├── states/             #   FSM states
│   └── utils/              #   audit, scheduler, callback parser
├── db/                     # Database layer
│   ├── models/             #   SQLAlchemy models
│   └── migrations/         #   Alembic migrations
├── locales/                # i18n (en, ru)
├── tests/                  # pytest test suite
├── webapp/                 # React Mini App (Vite + Tailwind)
│   └── src/
│       ├── pages/          #   Profile, Tournaments, Rating, TrainingLog
│       ├── api/            #   API client & endpoints
│       └── hooks/          #   useApi, custom hooks
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── pyproject.toml
```

---

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 20+
- Telegram Bot Token ([BotFather](https://t.me/BotFather))

### 1. Clone & configure

```bash
git clone https://github.com/damirbekdadadzhanov70/TKD_hub.git
cd TKD_hub
cp .env.example .env
# Edit .env — set BOT_TOKEN, ADMIN_IDS, SECRET_KEY
```

### 2. Install dependencies

```bash
make install
# or manually:
pip install -r requirements.txt
cd webapp && npm install
```

### 3. Run database migrations

```bash
make db-upgrade
# or: alembic upgrade head
```

### 4. Start services

```bash
# All at once:
make all        # API (port 8000) + webapp (port 5173)
make bot        # Telegram bot (separate terminal)

# Or individually:
make api        # FastAPI on :8000
make webapp     # React dev server on :5173
make bot        # Telegram bot
```

### Docker

```bash
docker compose up -d
# API → localhost:8000, PostgreSQL → localhost:5432
```

### Running tests

```bash
pip install -r requirements-dev.txt
python -m pytest tests/ -v
```

---

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make install` | Install all dependencies (Python + Node) |
| `make api` | Run FastAPI dev server |
| `make webapp` | Run React dev server |
| `make bot` | Run Telegram bot |
| `make all` | Run API + webapp in parallel |
| `make db-migrate msg="..."` | Create Alembic migration |
| `make db-upgrade` | Apply pending migrations |
| `make docker-up` | Start Docker services |
| `make docker-down` | Stop Docker services |

---

## License

[MIT](LICENSE)
