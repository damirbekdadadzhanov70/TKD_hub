# TKD Hub — TODO

> Полный план работ по проекту. Обновлено: 2026-02-18 (v9 — HIGH исправлены)
> Приоритеты: BLOCKER > CRITICAL > HIGH > MEDIUM > LOW
> Оценка готовности: **6/10** — хороший MVP, не готов к проду

---

## Прогресс

| Категория | Сделано | Осталось | Итого |
|-----------|---------|----------|-------|
| BLOCKER (деплой упадёт) | 0 | 6 | 6 |
| CRITICAL (сломает юзеров) | 15 | 0 | 15 |
| HIGH (безопасность/баги) | 21 | 1 | 22 |
| MEDIUM (качество) | 13 | 17 | 30 |
| LOW (полировка) | 8 | 12 | 20 |
| **Итого** | **57** | **36** | **93** |

---

## Решения, отличающиеся от FRONTEND_PLAN.md

- **BottomNav**: только иконки (без текстовых лейблов). Таб Profile — фото из Telegram (32px, ring при активном) вместо иконки
- **Фильтры на Tournaments**: статусы горизонтальные чипсы + кнопка-воронка → BottomSheet со списком городов
- **Ориентир на Россию**: города России вместо стран Центральной Азии. Валюта RUB
- **Rating FilterBar**: фильтр стран → фильтр городов России
- **Бот**: только точка входа (инвайты, уведомления, admin-команды). Регистрация и вся работа — в Mini App

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
- [x] ~~Роль определяется автоматически, не по выбору юзера~~ — `User.active_role` + `_resolve_role()` + `PUT /me/role`
- [x] ~~Name sync неполный в CoachSection~~ — `!== undefined` вместо truthiness
- [x] ~~Автокоммит в `get_session()` двойной commit~~ — убран автокоммит, роуты сами коммитят
- [x] ~~Регистрация хардкодит DOB и gender~~ — было false positive, фронтенд уже передаёт все поля
- [x] ~~Race condition в invite token~~ — объединено в одну сессию (check + mark-as-used атомарно)
- [x] ~~CASCADE DELETE удалит турниры~~ — `created_by` FK: `CASCADE` → `SET NULL`
- [x] ~~Admin хардкод `admin`/`123`~~ — не найден в коде, мёртвые i18n ключи
- [x] ~~Нет try/catch на photo upload в боте~~ — добавлен fallback на `photo_url=None`

## CRITICAL — Осталось

> Все критические проблемы исправлены!

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

## HIGH — Безопасность (исправлено)

- [x] ~~CORS regex — `*.vercel.app` разрешает любой поддомен~~ — production: точный origin + dev: regex ограничен `tkd-hub*`
- [x] ~~Нет проверки владения атлетом в боте~~ — добавлена проверка CoachAthlete связи в `on_view_athlete`
- [x] ~~UUID из callback_data не валидируется~~ — добавлен `parse_callback_uuid()` хелпер, используется во всех хендлерах
- [x] ~~`html.escape()` только на имени~~ — добавлен escape на city_custom и club в обеих регистрациях
- [x] ~~CoachUpdate без валидации~~ — добавлены `Field(min_length, max_length)` constraints
- [x] ~~`setattr()` с невалидированным field~~ — добавлен whitelist `EDITABLE_TEXT_FIELDS`

## HIGH — Баги (исправлено)

- [x] ~~Нет fetch timeout на фронте~~ — добавлен `AbortController` с 10с timeout в `client.ts`
- [x] ~~Двойной клик delete~~ — добавлен `deleting` state + `disabled` на кнопке в TrainingLog
- [x] ~~Rating дублирует серверную фильтрацию~~ — клиентская фильтрация только в demo mode
- [x] ~~EnterAthletesModal не валидирует age_category~~ — убран fallback `'Seniors'`, блокирует submit если пусто
- [x] ~~Нет AbortController в useApi~~ — abort предыдущего fetch + cleanup при unmount

## HIGH — Баги (осталось)

- [ ] **Уведомления молча пропадают** — `except Exception: logger.warning(...)` без retry
  - `bot/handlers/entries.py:285` — логировать + сохранять в очередь для повторной отправки

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

- [ ] **`Coach.is_active` нигде не проверяется** — неактивный тренер может всё
  - Либо убрать поле, либо добавить фильтрацию в endpoints

## MEDIUM — Webapp

- [x] ~~Города захардкожены в 4 файлах~~ — вынесены в `src/constants/cities.ts`
- [ ] **Нет тёмной темы** — `colorScheme` из Telegram SDK доступен, но не используется
- [ ] **Объединить TrainingForm и TrainingEditForm** — 95% дублирования
- [ ] **Type-safe form update** — `(field: string, value: unknown)` → generic
- [ ] **Нет shared state / кэша** — `getMe()` вызывается отдельно на каждой странице
  - Рассмотреть React Query, SWR, или Context
- [x] ~~История турниров в профиле — заглушка~~ — данные из `GET /me/stats`
- [x] ~~Статистика профиля (турниры, медали) — всегда "-"~~ — данные из `GET /me/stats`
- [ ] **Scroll position теряется** при навигации назад
- [ ] **Версия `v0.1.0` захардкожена** — брать из package.json
- [ ] **Missing aria-labels** на кнопках навигации месяцев (TrainingLog) и city picker close

### Backend (средние)
- [x] ~~`datetime.utcnow()` deprecated~~ — заменено на `datetime.now(timezone.utc)` везде
- [ ] **Inconsistent HTTP status codes** — числа вместо `status.HTTP_*` констант в нескольких роутах

## MEDIUM — Бот

- [x] ~~Хардкод "Добро пожаловать" в start.py~~ — теперь разные сообщения new/returning через i18n
- [ ] **Fallback язык "ru" хардкод** — использовать `message.from_user.language_code`
  - `bot/handlers/invite.py:76`
- [ ] **Scheduler loop: 4 часа между проверками** — при ошибке пропускает напоминания
  - `bot/utils/scheduler.py:98-105` — добавить exponential backoff или сократить интервал
- [ ] **`_notified_today` в памяти** — теряется при перезапуске бота
  - `bot/utils/scheduler.py:21` — хранить в БД
- [ ] **Нет /cancel команды** — юзер не может выйти из FSM посередине (только /start)
- [ ] **Нет rate limiting на callback queries** — можно спамить кнопки
- [ ] **Нет валидации длины** имени и полей турнира в FSM
- [x] ~~Нет try/catch на photo upload~~ — добавлен fallback на `photo_url=None`

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
- [ ] `nextLogId` в mock.ts растёт бесконечно — использовать `Date.now()` паттерн
- [ ] DELETE endpoints возвращают 200 вместо 204 (REST convention)

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
- [x] **DELETE /admin/users/{id}/profile/{role}** — удаление отдельного профиля без удаления юзера

---

## Недостающие эндпоинты (Feature Gaps)

- [x] ~~`DELETE /api/me` — удаление аккаунта~~ — реализовано
- [x] ~~`POST /api/tournaments` — создание турнира~~ — добавлен (admin-only)
- [x] ~~`DELETE /api/tournaments/{id}` — удаление турнира~~ — добавлен (admin-only)
- [ ] `PUT /api/training-log/{id}/comment` — комментарий тренера к тренировке
- [ ] `GET /api/coach/pending-athletes` — список ожидающих приглашений
- [ ] Webhook поддержка в боте (сейчас только polling)
