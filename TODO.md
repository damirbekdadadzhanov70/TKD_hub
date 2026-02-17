# TKD Hub — TODO

> Полный план работ по проекту. Обновлено: 2026-02-18 (v7 — админ-профиль: поиск юзеров + уведомления на главную)
> Приоритеты: BLOCKER > CRITICAL > HIGH > MEDIUM > LOW
> Оценка готовности: **6/10** — хороший MVP, не готов к проду

---

## Прогресс

| Категория | Сделано | Осталось | Итого |
|-----------|---------|----------|-------|
| BLOCKER (деплой упадёт) | 0 | 6 | 6 |
| CRITICAL (сломает юзеров) | 8 | 7 | 15 |
| HIGH (безопасность/баги) | 10 | 12 | 22 |
| MEDIUM (качество) | 11 | 15 | 26 |
| LOW (полировка) | 8 | 10 | 18 |
| **Итого** | **37** | **50** | **87** |

---

## Решения, отличающиеся от FRONTEND_PLAN.md

- **BottomNav**: только иконки (без текстовых лейблов). Таб Profile — фото из Telegram (32px, ring при активном) вместо иконки
- **Фильтры на Tournaments**: статусы горизонтальные чипсы + кнопка-воронка → BottomSheet со списком городов
- **Ориентир на Россию**: города России вместо стран Центральной Азии. Валюта RUB
- **Rating FilterBar**: фильтр стран → фильтр городов России
- **Бот**: только точка входа (регистрация, инвайты, уведомления). Вся работа — в Mini App

---

## BLOCKER — Без этого деплой упадёт

> Эти проблемы сломают `alembic upgrade head` или сборку на Render/Vercel.

- [ ] **Миграция 004 несовместима с PostgreSQL** — `batch_alter_table` работает только в SQLite
  - `db/migrations/versions/004_add_cascade_deletes.py`
  - Переписать на `op.drop_constraint()` / `op.create_foreign_key()` напрямую

- [ ] **Миграция 006 дублирует индекс из 005** — `ix_audit_logs_user_id` создаётся дважды → ошибка на PG
  - `db/migrations/versions/006_add_user_cascades_and_indexes.py:67`
  - Убрать дублирующий `op.create_index` и из downgrade убрать `op.drop_index`

- [ ] **Boolean defaults в миграции 001 — SQLite-specific** — `sa.text("1")` вместо `sa.text("true")`
  - `db/migrations/versions/001_initial_schema.py:49-50, 67-68`
  - Заменить на `sa.text("true")` для PostgreSQL совместимости

- [ ] **Прогнать `alembic upgrade head` на пустой PostgreSQL** — убедиться что вся цепочка 001→006 проходит
  - Использовать Render PostgreSQL или локальный Docker

- [ ] **Toast не поддерживает типы** — `showToast(msg, 'error')` вызывается в 6+ местах, но type игнорируется
  - `webapp/src/components/Toast.tsx` — добавить `type?: 'success' | 'error'` параметр
  - Стилизовать: error → красная полоска, success → зелёная/золотая

- [ ] **Нет Error Boundary в React** — любой краш компонента убивает всё приложение
  - `webapp/src/main.tsx` — обернуть App в ErrorBoundary с fallback UI

---

## CRITICAL — Исправлено

- [x] ~~Scheduler: статус `"active"` вместо `"accepted"`~~ — исправлено
- [x] ~~`str(uuid)` в entries.py~~ — добавлен `_to_uuid()` хелпер
- [x] ~~Naive vs aware datetime в invite.py~~ — нормализация tzinfo
- [x] ~~Нет проверки дедлайна турнира при заявке~~ — 400 если deadline прошёл
- [x] ~~Дублирование результатов турнира~~ — `UniqueConstraint` + проверка → 409
- [x] ~~Training stats грузит все записи в память~~ — SQL агрегаты
- [x] ~~`response.json()` на DELETE 204~~ — проверка `status === 204`
- [x] ~~SECRET_KEY по умолчанию `"changeme"`~~ — обязательное поле

## CRITICAL — Осталось

- [ ] **Автокоммит в `get_session()` конфликтует с ручными коммитами** — двойной commit
  - `db/base.py` — убрать `await session.commit()` из dependency, роуты сами управляют транзакциями
  - Или: убрать ручные `session.commit()` из роутов (оставить только в dependency)
  - Выбрать ОДИН подход и применить везде

- [ ] **Регистрация хардкодит DOB и gender** — `date(2000,1,1)`, `gender="M"` в БД
  - `api/routes/me.py:156-164` — принимать реальные данные из формы регистрации
  - Обновить `RegisterRequest` схему: добавить `date_of_birth`, `gender`, `city` обязательными полями

- [x] **Роль определяется автоматически, не по выбору юзера** — если есть coach+athlete, всегда "coach"
  - `User.active_role` добавлено, `_resolve_role()` учитывает, `PUT /me/role` сохраняет

- [ ] **Race condition в invite token** — два юзера могут принять один инвайт одновременно
  - `bot/handlers/invite.py:107-122` — проверка и mark-as-used в разных моментах
  - Перенести в одну транзакцию с `SELECT ... FOR UPDATE`

- [ ] **Нет try/catch на photo upload в боте** — crash хендлера → юзер застревает в FSM
  - `bot/handlers/registration.py:212, 365` — обернуть `get_file()` в try/catch с fallback

- [ ] **CASCADE DELETE удалит турниры юзера** — удаление аккаунта удалит турниры, на которые записаны другие
  - `db/models/tournament.py:30` — `created_by` FK: заменить `CASCADE` на `SET NULL`
  - Турниры должны существовать независимо от создателя

- [ ] **Admin вход — хардкод `admin`/`123`** — любой может стать админом в demo mode
  - `webapp/src/pages/Profile.tsx:546` — убрать хардкод, проверять `me.role === 'admin'` с сервера

---

## HIGH — Исправлено

- [x] ~~AthleteUpdate без валидации~~ — `Field(min_length, max_length, gt, le)`
- [x] ~~CORS regex слишком широкий~~ — TODO: в production указать точный origin
- [x] ~~`IntegrityError` не ловится~~ — глобальный exception handler → 409
- [x] ~~HTML-инъекция через имя~~ — `html.escape()` в registration.py
- [x] ~~Кнопки approve/reject зависают~~ — `setProcessing(false)` в catch
- [x] ~~`useApi` hook: stale closures~~ — `useRef` для mockData и fetcher
- [x] ~~`useApi` hook: ошибки скрыты за mock~~ — убран fallback на mock при ошибке
- [x] ~~Фронтенд молча проглатывает ошибки мутаций~~ — toast в catch-блоках
- [x] ~~Фильтр турниров: `country: city`~~ — исправлено
- [x] ~~`age_category` параметр не используется~~ — заменён на `city`

## HIGH — Безопасность (осталось)

- [ ] **CORS regex** — `*.vercel.app` разрешает любой поддомен Vercel
  - `api/main.py:74` — в production указать точный origin `tkd-hub.vercel.app`

- [ ] **Нет проверки владения атлетом в боте** — тренер может просмотреть ЛЮБОГО атлета по UUID
  - `bot/handlers/my_athletes.py:70-92` — добавить проверку `CoachAthlete` связи

- [ ] **UUID из callback_data не валидируется** — некорректный UUID крашит хендлер
  - Все хендлеры с `parts[1]` — обернуть в `try: uuid.UUID(parts[1])` + `except ValueError`

- [ ] **`html.escape()` только на имени** — city, club, country не экранируются
  - `bot/handlers/registration.py:169, 194, 320` — добавить escape на все текстовые поля

- [ ] **CoachUpdate без валидации** — пустые строки, длинные значения пройдут
  - `api/schemas/coach.py:23-27` — добавить `Field(min_length, max_length)` как в AthleteUpdate

## HIGH — Баги (осталось)

- [ ] **Уведомления молча пропадают** — `except Exception: logger.warning(...)` без retry
  - `bot/handlers/entries.py:285` — логировать + сохранять в очередь для повторной отправки

- [ ] **Нет fetch timeout на фронте** — если сервер завис, ждём вечно
  - `webapp/src/api/client.ts:21` — добавить `AbortController` с timeout 10 секунд

- [ ] **Двойной клик delete** — кнопка не дизейблится во время async операции
  - `webapp/src/pages/TrainingLog.tsx:146` — добавить `deleting` state, disable кнопку

- [ ] **Rating дублирует серверную фильтрацию** — API фильтрует + клиент фильтрует
  - `webapp/src/pages/Rating.tsx:311-330` — убрать клиентскую фильтрацию, довериться API

- [x] ~~Onboarding не показывает ошибку~~ — добавлен toast в catch

- [ ] **EnterAthletesModal не валидирует age_category** — fallback `'Seniors'` может не существовать
  - `webapp/src/pages/TournamentDetail.tsx:688` — если `ageCategories` пустой, показать ошибку

- [ ] **Нет AbortController в useApi** — при быстрой навигации летят лишние запросы
  - `webapp/src/hooks/useApi.ts` — abort предыдущий fetch при новом вызове

## HIGH — Архитектура (исправлено)

- [x] ~~Нет глобального exception handler~~ — `IntegrityError` → 409, `Exception` → 500
- [x] ~~Eager loading athlete+coach~~ — `selectinload` корректен
- [x] ~~N*3 запросов при batch-заявке~~ — 3 batch-запроса с `.in_()`

---

## MEDIUM — Database

### Исправлено
- [x] ~~CASCADE DELETE на User-связанных FK~~ — миграция 006
- [x] ~~Индексы на coach_athletes, role_requests, audit_logs~~ — 6 индексов
- [x] ~~`Mapped[dict]` → `Mapped[list]`~~ — age/weight_categories

### Осталось
- [ ] **Нет CHECK constraints** на enum-поля — gender, belt, status, intensity, language
  - Новая миграция: `ALTER TABLE ADD CHECK (gender IN ('M','F'))` и т.д.

- [ ] **`DateTime(timezone=True)` только в InviteToken** — привести к единому стилю
  - Все DateTime поля → `DateTime(timezone=True)`

- [ ] **TournamentResult не привязан к TournamentEntry** — можно создать результат без заявки
  - Добавить `entry_id` FK или application-level проверку

- [ ] **Нет constraint на даты турнира** — `end_date >= start_date`, `deadline <= start_date`
  - CheckConstraint в модели Tournament

- [ ] **Нет constraint: `place > 0`, `rating_points >= 0`, `current_weight > 0`**
  - CheckConstraint в моделях TournamentResult, Athlete

- [ ] **Недостающие индексы** — `tournament_entries.tournament_id`, `tournaments.created_by`
  - PostgreSQL не создаёт индексы на FK автоматически

- [ ] **Lazy loading на relationships** — `tournament.creator`, `entry.athlete`, `entry.coach`
  - Добавить `back_populates` + использовать `selectinload` в запросах

- [ ] **AuditLog.target_id: Text → UUID** — потеря type safety
  - `db/models/audit_log.py:17`

## MEDIUM — Webapp

- [ ] **Нет тёмной темы** — `colorScheme` из Telegram SDK доступен, но не используется
- [ ] **Объединить TrainingForm и TrainingEditForm** — 95% дублирования
- [ ] **Type-safe form update** — `(field: string, value: unknown)` → generic
- [ ] **Нет shared state / кэша** — `getMe()` вызывается отдельно на каждой странице
  - Рассмотреть React Query, SWR, или Context
- [x] ~~История турниров в профиле — заглушка~~ — данные из `GET /me/stats`
- [x] ~~Статистика профиля (турниры, медали) — всегда "-"~~ — данные из `GET /me/stats`
- [ ] **Scroll position теряется** при навигации назад
- [ ] **Версия `v0.1.0` захардкожена** — брать из package.json

### Исправлено
- [x] ~~`<title>webapp</title>` → `<title>KukkiDo</title>`~~

## MEDIUM — Бот

- [x] ~~Хардкод "Добро пожаловать" в start.py~~ — теперь разные сообщения new/returning через i18n
- [ ] **Fallback язык "ru" хардкод** — использовать `message.from_user.language_code`
  - `bot/handlers/invite.py:76`
- [ ] **Scheduler loop: 4 часа между проверками** — при ошибке пропускает напоминания
  - `bot/utils/scheduler.py:98-105` — добавить exponential backoff или сократить интервал
- [ ] **Нет /cancel команды** — юзер не может выйти из FSM посередине (только /start)

## MEDIUM — Конфигурация и CI

### Исправлено
- [x] ~~`get_session` без commit/rollback~~ — добавлено
- [x] ~~`db/base.py` импортирует `bot.config`~~ — заменено на `os.getenv`
- [x] ~~`class Config` (deprecated)~~ → `model_config = SettingsConfigDict`
- [x] ~~0 тестов бота~~ — 114 тестов

### Осталось
- [ ] **0 тестов фронтенда** — vitest + @testing-library/react
- [ ] **Нет `--cov-fail-under`** — минимальный порог покрытия
- [ ] **Нет валидации i18n ключей** — скрипт для проверки синхронизации en и ru
- [ ] **Тесты только на SQLite** — нужны тесты на PostgreSQL (testcontainers)
- [ ] **Нет CI/CD pipeline** — GitHub Actions: тесты + typecheck на каждый PR
- [ ] **Нет Dockerfile** — нельзя контейнеризировать бэкенд
- [ ] **Два vercel.json** — в корне и в webapp/, непонятно какой используется

---

## LOW

### Исправлено
- [x] ~~Создать `.env.example`~~ — создан
- [x] ~~Обновить `.gitignore`~~ — добавлены .coverage, venv/, .pytest_cache/ и т.д.
- [x] ~~Удалить мусорные файлы `=0.8` и `=6.0`~~ — удалены
- [x] ~~`MeResponse.role: str` → `Literal["athlete", "coach", "none"]`~~ — исправлено
- [x] ~~Мёртвый код `TournamentEntryCreate`~~ — удалён
- [x] ~~Нет `CoachUpdate` схемы~~ — уже существует
- [x] ~~`hapticFeedback` не используется~~ — теперь в BottomNav
- [x] ~~`INIT_DATA_MAX_AGE` 24ч → 4ч~~ — сокращено

### Осталось
- [ ] Hardcoded статусы (`"accepted"`, `"pending"`) → enum/константы
- [ ] `photo_url` без URL-валидации (`api/schemas/athlete.py`)
- [ ] Raw ISO даты на фронте → `Intl.DateTimeFormat`
- [ ] Пагинация из API отбрасывается на фронте — нет "Load more"
- [ ] Тестовые данные: "Bishkek" → российский город (`tests/conftest.py:74`)
- [ ] `EmptyState.icon` prop определён но не рендерится — dead code
- [ ] Disabled opacity непоследовательный (40/60/80 в разных компонентах)
- [ ] Анимация подиума ломается если < 3 атлетов в рейтинге
- [ ] Нет aria-label на FAB кнопке в TrainingLog
- [ ] localStorage квота не обрабатывается — молча теряет данные

---

## Деплой и подключение к реальной БД

> Инфраструктура: Render (API + PostgreSQL), Vercel (фронт), ngrok (бот dev)

- [ ] **Исправить миграции для PostgreSQL** (см. BLOCKER выше)
- [ ] **Обновить `DATABASE_URL`** — `.env` локально + Render env vars
- [ ] **Накатить миграции** — `alembic upgrade head` на Render PostgreSQL
- [ ] **Задеплоить API на Render** — Web Service
  - Start: `uvicorn api.main:app --host 0.0.0.0 --port $PORT`
  - Env: `DATABASE_URL`, `SECRET_KEY`, `BOT_TOKEN`, `ENVIRONMENT=production`
- [ ] **Подключить webapp к API** — `VITE_API_URL` → Render URL
- [ ] **Обновить `WEBAPP_URL` в боте** — `tkd-hub.vercel.app`
- [ ] **Проверить end-to-end** — бот → регистрация → Mini App → реальные данные

---

## Role Management & Account Deletion

- [x] **Settings role switcher — admin-only** — реализовано с `PUT /me/role` и персистенцией
- [x] **Запрос смены роли** — форма как в онбординге → запрос админу, `POST /me/role-request` сохраняет данные
- [x] **Админ: UI одобрения/отклонения** запросов смены роли — `GET/POST /admin/role-requests` + UI в Settings
- [x] ~~**DELETE /me — полное удаление аккаунта**~~ — реализовано: cascade delete + уведомление админу + frontend redirect на онбординг

---

## Недостающие эндпоинты (Feature Gaps)

- [x] ~~`DELETE /api/me` — удаление аккаунта~~ — реализовано
- [x] ~~`POST /api/tournaments` — создание турнира~~ — добавлен (admin-only)
- [x] ~~`DELETE /api/tournaments/{id}` — удаление турнира~~ — добавлен (admin-only)
- [ ] `PUT /api/training-log/{id}/comment` — комментарий тренера к тренировке
- [ ] `GET /api/coach/pending-athletes` — список ожидающих приглашений
- [ ] Webhook поддержка в боте (сейчас только polling)
