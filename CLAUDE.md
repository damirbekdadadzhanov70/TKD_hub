# CLAUDE.md — TKD Hub Project Rules

## Project Overview

TKD Hub — Telegram Mini App + Bot for Taekwondo WT athletes and coaches.
**Stack:** Python (FastAPI + aiogram) backend, React + TypeScript + Tailwind CSS v4 frontend.
**Deploy:** Vercel. **DB:** PostgreSQL + SQLAlchemy.

## Repository Structure

```
TKD_hub/
├── api/          # FastAPI backend
├── bot/          # Telegram bot (aiogram 3)
├── db/           # SQLAlchemy models + Alembic migrations
├── webapp/       # React Mini App (this is where most frontend work happens)
│   └── src/
│       ├── api/          # client.ts, endpoints.ts, mock.ts
│       ├── components/   # BottomNav, BottomSheet, Card, Toast, PullToRefresh, etc.
│       ├── hooks/        # useApi, useTelegram
│       ├── pages/        # Tournaments, TrainingLog, Rating, Profile, TournamentDetail
│       ├── types/        # TypeScript interfaces (index.ts)
│       ├── index.css     # Tailwind @theme + global CSS
│       └── main.tsx      # App entry, ToastProvider wrapper
├── PROJECT.md        # Full project spec (DB schema, roles, user flows)
└── FRONTEND_PLAN.md  # Detailed frontend design spec
```

## Key Design Decisions

### Frontend Architecture
- **Demo mode**: When `VITE_API_URL` is not set, `apiRequest()` in `client.ts` returns `{} as T` — all data comes from `mock.ts` via localStorage
- **Mock data + localStorage**: `mock.ts` stores user profile in localStorage (`tkd_me`), training logs (`tkd_training_logs`), etc. Always merge stored data with defaults to handle schema evolution
- **useApi hook**: Wraps API calls with mock fallback. Has `silent` param for PullToRefresh (no LoadingSpinner). Returns `{ data, loading, error, isDemo, refetch, mutate }`
- **Roles**: `athlete | coach | admin` — stored in `me.role`, switchable in Settings

### Name Synchronization (Critical Pattern)
User has BOTH `me.athlete` and `me.coach` profiles. The `full_name` must stay in sync:
- **Profile.tsx onSaved**: When editing athlete name → also update `me.coach.full_name`, and vice versa
- **Display name**: `displayName` is **role-aware** — coach role shows `me.coach.full_name`, athlete role shows `me.athlete.full_name`
- **Rating.tsx**: Uses `useMemo` to patch user's rating entry with current `me.athlete` data
- **TournamentDetail.tsx**: Uses `useMemo` (`syncedTournament`) to patch entry names via `athlete_id`
- **Profile.tsx CoachSection**: Uses `useMemo` to sync coach's athlete list and entries with current `me.athlete`

**Rule: Any new display of user data MUST use the current `me` state, not stale mock snapshots.**

### Design System
- **Colors**: Gold accent (#D4AF37) + warm grays. See `index.css` `@theme` block
- **Fonts**: DM Serif Display (headings, `font-heading`), DM Sans (body, `font-body`), DM Mono (numbers, `font-mono`)
- **No emojis** in UI — only typography and thin line icons (Lucide-style SVGs)
- **Tailwind v4** with `@theme` directive (NOT `theme.extend` in config)
- **BottomSheet** for all modals — with focus trap, Escape key, `role="dialog"`, `aria-modal="true"`
- **Toast** via context (`useToast`) — slide-down from top, gold left border, auto-hide 3s

### Telegram WebApp Integration
- `useTelegram()` hook: `isTelegram`, `hapticFeedback()`, `hapticNotification()`, `showBackButton()`, `user`
- **Desktop vs Telegram differences** (by design):
  - Desktop: shows "Open in Telegram" banner, custom ← Back button, no haptics
  - Telegram: BackButton API, haptic feedback, safe-area insets
- **PullToRefresh**: Supports both touch AND mouse events for desktop parity

### Role Management
- **Settings role switcher** is admin-only. Regular users see only their current role (chosen at onboarding)
- **Role change**: regular users submit a request to admin with a form (same fields as onboarding for the target role). Admin approves/denies
- **Account deletion**: must fully clear all data in DB and bot state. On re-`/start` the user goes through onboarding again with zero leftover data
- **Admin role**: assigned manually, never available through onboarding or self-service

### Cities
Use real Russian cities only: Москва, Санкт-Петербург, Казань, Екатеринбург, Нижний Новгород, Рязань, Махачкала, Новосибирск, Краснодар, Владивосток.
**Never** use regions as cities (e.g., "Дагестан" is not a city → use "Махачкала").

## Coding Conventions

### React Components
- Functional components only, no class components
- State managed with `useState` / `useMemo` / `useCallback`
- No external state library — prop drilling + context (Toast only)
- SVG icons inline as components (no icon library)

### Styling
- Tailwind utility classes only, no inline CSS except for dynamic values (`style={{ }}`)
- Use CSS variables from `@theme` via Tailwind classes: `text-accent`, `bg-bg-secondary`, `text-text-heading`, etc.
- Interactive elements: always include `cursor-pointer`, `active:opacity-80` (mobile), `hover:` state (desktop)
- Disabled state: `disabled:opacity-40` or `disabled:opacity-60`

### Error Handling Pattern
```tsx
try {
  await apiCall(data);
  hapticNotification('success');  // ← inside try
  onSuccess();                    // ← inside try
} catch {
  hapticNotification('error');    // ← inside catch
  setSaving(false);               // ← inside catch
}
```
**Never** put success logic after the try/catch block.

### TypeScript
- Strict mode, no `any` unless absolutely necessary
- Types in `webapp/src/types/index.ts`
- Optional fields use `?` (e.g., `athlete_id?: string`)

## Build & Test

```bash
# Frontend
cd webapp
npx vite build          # Production build
npx tsc --noEmit        # Type check only
npx vite dev            # Dev server

# Backend tests (85 tests: API + bot handlers)
python3 -m pytest tests/ -v                    # All tests
python3 -m pytest tests/ --cov=api --cov=bot   # With coverage
python3 -m pytest tests/test_business_scenarios.py -v  # Business scenarios only
```

### Testing Notes
- Tests use in-memory SQLite (`sqlite+aiosqlite:///:memory:`) — no external DB needed
- Bot handler tests mock `async_session` and aiogram objects (Message, CallbackQuery, FSMContext)
- SQLite Uuid type requires `uuid.UUID` objects (not strings) — bot tests use `_patched_parse_callback` helper
- `conftest.py` provides fixtures: `test_user`, `coach_user`, `admin_user`, `bare_user`, `dual_profile_user` + corresponding clients
- `create_tournament()` helper in conftest for tournament test data
- **All business scenarios live in `tests/test_business_scenarios.py`** — single file, update it when adding new features

## Documentation Maintenance

After completing any task (bug fix, feature, refactor), **always check and update** relevant `.md` files:
- **TODO.md** — mark completed items `[x]`, update progress counters and date
- **CLAUDE.md** (this file) — update if conventions, structure, or patterns changed
- **MEMORY.md** — update test counts, new patterns, or bug fixes learned
- **PROJECT.md** / **FRONTEND_PLAN.md** — update if DB schema, roles, or UI spec changed

Never leave documentation out of sync with the actual codebase state.

## Common Pitfalls

1. **localStorage stale data**: When adding new fields to `MeResponse`, merge with defaults in `mock.ts` (`storedMe.field || defaultMe.field`)
2. **Demo mode API calls**: `apiRequest` returns `{} as T` when no `VITE_API_URL` — the success path in try/catch still runs
3. **Name sync**: Editing name in one role must update the other role too
4. **`displayName` must be role-aware**: Don't use `me.athlete?.full_name || me.coach?.full_name` — check the current role first
5. **Hover states**: Always add `hover:` classes for desktop users alongside `active:` for mobile
6. **Accessibility**: BottomSheet needs `role="dialog"`, `aria-modal`, focus trap, Escape key; icon buttons need `aria-label`
