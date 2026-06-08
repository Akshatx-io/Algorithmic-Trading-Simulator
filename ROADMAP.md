# HFT Trading Platform — Phased Implementation Roadmap

> **Purpose:** This document is the executable plan. Every commit in the next ~30-45 working days should be traceable to a task in this roadmap. When something here is wrong, we update this file *before* changing the code.
>
> **Timeline frame:** 1–2 months aggressive (per user input). Calibrated to ~30-45 working days assuming consistent daily work. Phases are sized in days, not hours, to absorb the inevitable interruptions and learning curve.
>
> **Companion documents:** [AUDIT.md](./AUDIT.md), [ARCHITECTURE.md](./ARCHITECTURE.md).
>
> **Reading guide:** Each phase has a fixed shape — *Objective, Why this phase exists, Dependencies, Tasks, Deliverables, Acceptance Criteria, Interview Talking Points, Duration*. The "Interview Talking Points" section is the most important — those are the answers you will rehearse for behavioral-technical interviews after each phase ships.

> **Status update — quant phase shipped (and over-delivered).** The Phase-4 "Quant differentiation" goal (originally *pick 2-3 of regime / optimizer / VaR / ML / backtest*) is **complete**: eight quant surfaces are live — Market-Regime detection, Monte-Carlo Portfolio Optimizer, Monte-Carlo Option Pricer, Neural Volatility Surface, Vol-Surface Forecaster, Strategy Backtester, Stock-Return Predictor (NumPy Random Forest + Monte-Carlo resampling), and an Earnings-Call Sentiment Analyzer (financial NLP + event study). Each ships a numerically-honest engine, a typed REST endpoint, and a bespoke interactive visualization, unified under the in-app **Quant Lab**. See the README "Quantitative Research Lab" section.

---

## Table of Contents

- [Roadmap Overview](#roadmap-overview)
- [Sequencing Rationale](#sequencing-rationale)
- [Phase 2.0 — Hygiene Sweep](#phase-20--hygiene-sweep)
- [Phase 2.1 — Auth Hardening & Config Integrity](#phase-21--auth-hardening--config-integrity)
- [Phase 2.2 — Database Truth](#phase-22--database-truth)
- [Phase 2.3 — Service & Repository Layers](#phase-23--service--repository-layers)
- [Phase 2.4 — PnL & Execution Correctness](#phase-24--pnl--execution-correctness)
- [Phase 2.5 — Real-Time Pipeline v1](#phase-25--real-time-pipeline-v1)
- [Phase 2.6 — Frontend Foundations](#phase-26--frontend-foundations)
- [Phase 2.7 — Test Foundations & Green CI](#phase-27--test-foundations--green-ci)
- [Phase 3 — Architecture Polish & SaaS-Grade UI](#phase-3--architecture-polish--saas-grade-ui)
- [Phase 4 — Quant Differentiation](#phase-4--quant-differentiation)
- [Phase 5 — Stretch / Optional Polish](#phase-5--stretch--optional-polish)
- [Cross-Cutting Practices](#cross-cutting-practices)
- [Definition of Done (per phase)](#definition-of-done-per-phase)

---

## Roadmap Overview

| Phase | Name | Duration | Cumulative | Job-Critical? |
|---|---|---|---|---|
| 2.0 | Hygiene Sweep | 2 days | 2 days | ★ (recruiter first-impression) |
| 2.1 | Auth Hardening & Config | 2 days | 4 days | ★ |
| 2.2 | Database Truth | 2 days | 6 days | — |
| 2.3 | Service & Repository Layers | 3 days | 9 days | ★ (interview-defensible) |
| 2.4 | PnL & Execution Correctness | 3 days | 12 days | ★ (interview-defensible) |
| 2.5 | Real-Time Pipeline v1 | 3 days | 15 days | ★ (visual demo) |
| 2.6 | Frontend Foundations | 4 days | 19 days | ★★★ (job-critical) |
| 2.7 | Test Foundations & Green CI | 2 days | 21 days | ★ |
| 3.0 | Premium UI System | 4 days | 25 days | ★★★ (job-critical) |
| 3.1 | Trading Terminal v1 (orders + book) | 3 days | 28 days | ★★ |
| 3.2 | WS Protocol v2 + Order Matcher | 3 days | 31 days | ★ |
| 3.3 | Observability + Deploy | 2 days | 33 days | ★ |
| 4.0 | Quant Differentiation | 5 days | 38 days | ★★ (depending on target roles) |
| 5.x | Stretch goals | 5+ days | 43+ days | — |

**Total committed for Phase 2-4:** ~38 working days. Fits the upper edge of the 1-2 month window with buffer for the inevitable detours.

**The job-critical critical path** (★★ and ★★★): 2.0 → 2.1 → 2.5 → 2.6 → 3.0 → 3.1. If timeline compresses, this is the line that must not slip. Everything else can be deferred or reduced in scope.

---

## Sequencing Rationale

We sequence on *dependency* and *risk*, not on importance.

**Why Phase 2.0 first:** A repo with 960 lines of commented-out code in one file fails first-impression. Recruiters scanning GitHub spend ~30 seconds. The hygiene sweep is the cheapest, highest-leverage thing we can do — it makes the rest of the work *visible*.

**Why Phase 2.1 before 2.2:** Auth is in the request path. If we refactor the DB layer first, every request still flows through the hardcoded JWT secret. We close the security hole first, then move structural pieces.

**Why Phase 2.2 before 2.3:** Service/repository refactors involve moving SQLAlchemy queries. If the schema isn't truthful, we move broken code.

**Why Phase 2.5 before 2.6:** The frontend's biggest visible bug is the candle flicker, which is half a backend problem (broadcast topology) and half a frontend problem (full setData). We fix the backend half first so the frontend rebuild has stable inputs.

**Why Phase 2.6 takes 4 days:** It's the largest single phase because the frontend is the job-critical artifact. New Zustand stores, TanStack Query integration, real auth context, error boundaries, the rebuilt chart with incremental updates, feature-folder reorganization. All of this must land coherently.

**Why Phase 3.0 (Premium UI) is after 2.7:** Polish without correctness is decoration on rot. We get to a stable, tested baseline first, then make it beautiful.

---

## Phase 2.0 — Hygiene Sweep

### Objective
Bring the repository to a state where it can be reviewed without embarrassment. **Pure cleanup, zero behavior change.** A reviewer opening any file should see code that was clearly authored on purpose.

### Why this phase exists
Audit findings 3.3 (`routes.py` 960 commented lines), 3.7 (broken `requirements.txt`), 10.1 (no `.dockerignore`), 11 (committed binaries), 12.6 (dead comments in 8+ files), 14.1 (README lies). These are all *signal* problems, not behavior bugs — but they dominate first impressions and they're trivially fixable.

### Dependencies
None. Starts immediately.

### Tasks (ordered)

1. **Kill committed binaries from git tracking.**
   - `git rm --cached hft.db logs/ app/ml/models/lstm_model.h5 app/quant/__pycache__/build_lstm_model.cpython-313.pyc`
   - Verify `.gitignore` covers all of them (it covers most; add explicit `*.h5`, `app/ml/models/*.h5`, `*.sqlite3`).
   - Verify `.env` is not tracked (it's gitignored, but confirm with `git ls-files | grep -E "(\.env|hft\.db|\.h5)$"`).

2. **Create `.dockerignore`.**
   - Mirror the list from `ARCHITECTURE.md` section 11.3.
   - Verify by running `docker build` and checking image size before/after (target: drop >500 MB).

3. **Replace `requirements.txt` with `pyproject.toml`.**
   - Define groups: `[project.dependencies]` (runtime), `[tool.uv.dev-dependencies]` or `[project.optional-dependencies.dev]`.
   - Apply the dependency budget from `ARCHITECTURE.md` section 16.4. Remove: `passlib`, `redis-py-cluster`, `celery`, `apscheduler`, `tensorflow`, `keras`, `python-jose`, `asyncpg` only-if-not-using-async (we will use it, keep), `alpha-vantage`, `sentry-sdk` (defer to Phase 3.3).
   - Add: `bcrypt`, `pyjwt[crypto]`, `python-ulid`, `httpx`.
   - Use `uv` or `pip-tools` to generate a hashed lockfile.
   - Test: `uv sync` (or `pip install -e .[dev]`) on a fresh venv succeeds in <60s.

4. **Update Dockerfile + docker-compose for the new dep system.**
   - Multi-stage: `base` → `api` → `workers`.
   - Add `frontend` service to `docker-compose.yml` (dev mode: Vite dev server with volume mount).
   - Confirm `docker compose up` brings up postgres + redis + api + workers + frontend cleanly.

5. **Surgical delete of commented-out code blocks.**
   - `app/api/routes.py` — delete lines 1-959 (audit 3.3). Keep only the live router. Note: this is a single pre-Phase-2.3 cleanup; full split into per-domain routers happens in 2.3.
   - `app/portfolio/pnl_engine.py` — delete lines 1-435 (audit 4.4 partial; full removal of the class duplicate is in 2.4).
   - `app/market/market_data_engine.py` — delete lines 1-219 (audit 12.6).
   - `app/market/candle_engine.py` — delete lines 1-239 (audit 12.6).
   - `app/websocket/manager.py` — delete lines 1-58 (audit 12.6).
   - `frontend/src/App.jsx` — delete lines 1-39.
   - `frontend/src/pages/Dashboard.jsx` — delete lines 1-159.
   - `frontend/src/services/apiClient.js` — delete lines 75-135.
   - Replace all `# 🔥 ELITE` / `🚀 ULTIMATE` / etc. docstrings with substantive ones (audit 12.2). One module docstring per file: purpose, invariants, callers.

6. **Fix `main.py` immediate bugs.**
   - Uncomment `allow_origins=settings.cors_origins` and delete the hardcoded line (audit 3.9).
   - Replace `"yourdomain.com"` placeholder with reading from `settings.allowed_hosts` (new setting, default `["localhost", "127.0.0.1"]`, override via env) (audit 3.10).
   - `safe_task` cleanup will be done in 2.3 supervisor refactor — for now, add a TODO comment.

7. **Delete dead files.**
   - `validate_setup.py` (audit 10.9).
   - `app/quant/__pycache__/` (orphan `.pyc`).
   - Any `__pycache__/` at repo root.
   - Run `find . -type d -name __pycache__ -not -path "*/node_modules/*" -exec rm -rf {} +` once.

8. **Fix README to match reality.**
   - Correct WebSocket endpoint (`/api/v1/ws`, not `/ws/market`).
   - Remove non-existent endpoints (`/auth/refresh` until 2.1, `/health/db` until 2.7, `/metrics` until 3.3).
   - Replace ASCII box-diagram with a link to `ARCHITECTURE.md` section 2.
   - Add a "Status" section at the top: "Phase 2.0 in progress. See ROADMAP.md."

9. **Fix CI workflow.**
   - Remove `npm test` (no test script exists yet).
   - Cache pip via `actions/setup-python@v5` with `cache: pip`.
   - Cache npm via `actions/setup-node@v4` with `cache: npm`.
   - Remove `pip install flake8 black isort mypy` line; these belong in dev-deps (added in step 3).
   - Replace with: `ruff check app`, `ruff format --check app`, `mypy app`.

### Deliverables
- Clean git tree: no committed DBs, logs, binaries, `__pycache__`, orphan `.pyc`.
- `pyproject.toml` + lockfile, removing 6 broken/dead packages.
- Working `.dockerignore`.
- `docker compose up` brings up the full stack.
- All 8+ files freed of commented-code rot.
- README matches reality.
- Green CI on the lint job.

### Acceptance Criteria
- `git status` is clean after fresh clone + `make setup`.
- `du -sh frontend/node_modules` reports normally (not duplicated inside Docker image).
- `find . -name "*.py" | xargs grep -c '^# ' | sort -t: -k2 -rn | head` shows no file with >50 commented lines.
- `pip install -e .[dev]` succeeds on Python 3.12 in <60s.
- `docker compose up` brings up all services and `curl localhost:8000/health` returns 200 within 30s.
- CI run on the cleanup PR is green.

### Interview Talking Points
- *"I started the refactor with a hygiene sweep. The thesis was simple: a reviewer scans the file structure first and the file contents second. If they see 1500 lines of commented-out code, they don't trust the rest. So before I touched architecture, I shipped a PR that just deleted dead weight — 3500 lines removed, behavior unchanged."*
- *"I replaced `requirements.txt` with `pyproject.toml` because the original had four dead dependencies and one (redis-py-cluster) that conflicted with another. A hashed lockfile is table stakes for reproducible builds."*
- *"`.dockerignore` was missing. Without it, `COPY . .` was shipping `node_modules`, `__pycache__`, and the local `.env` into the production image. Image size dropped from 1.2 GB to 350 MB."*

### Duration
**2 working days.** This is mostly mechanical work. The longest single step is the `pyproject.toml` migration with `uv sync` verification.

---

## Phase 2.1 — Auth Hardening & Config Integrity

### Objective
Make the configuration system the single source of truth for runtime values. Eliminate the hardcoded JWT secret. Introduce refresh tokens. Make the frontend auth reactive.

### Why this phase exists
Audit findings 3.1 (hardcoded JWT secret), 3.11 (empty AuthContext), 3.12 (no Zustand). The current auth is both insecure *and* unusable — a recruiter who registers an account and refreshes the page is logged out. Fixing this early unblocks every subsequent demo.

### Dependencies
- Phase 2.0 (clean tree, pyproject in place, `pyjwt` available).

### Tasks (ordered)

1. **Rewrite `app/core/config.py`.**
   - Audit every setting; add missing ones (`signal_update_interval`, `allowed_hosts`).
   - Remove the over-aggressive `validate_model` raising on missing file.
   - Make `jwt_secret_key` validation actually run for production (current validator is dead because nothing reads the setting).
   - Add a `__post_init__` log line at startup: `logger.info(f"Config loaded: env={settings.environment}, db={mask(settings.database_url)}, redis={mask(settings.redis_url)}")`.

2. **Rewrite `app/auth/jwt_handler.py`.**
   - Delete the module-level constants. Read everything from `settings`.
   - Use `pyjwt` (not `python-jose`). Smaller, better-maintained.
   - Functions: `create_access_token(claims) -> str`, `create_refresh_token(user_id) -> str`, `decode_token(token) -> Claims`, `verify_access_token(token) -> Claims | None`.
   - Add `jti` (token ID) to every access token.
   - Set `aud` (audience) to `settings.app_name` so cross-app token reuse is impossible.

3. **Rewrite `app/auth/password.py`.**
   - Use `bcrypt` directly (drop `passlib`). The bcrypt 4.x API: `bcrypt.hashpw(password.encode(), bcrypt.gensalt())` and `bcrypt.checkpw(password.encode(), hashed)`.
   - Add a constant-time-safe `verify_password` wrapper.

4. **Add Redis client + refresh-token store.**
   - `app/infra/redis_client.py`: async Redis client (singleton, lazy init).
   - `app/services/auth_service.py`:
     - `register(...) -> (User, access_token, refresh_token)`
     - `login(...) -> (User, access_token, refresh_token)`
     - `refresh(refresh_token) -> (access_token, new_refresh_token)` with rotation
     - `logout(refresh_token) -> None` (deletes from Redis)
   - Refresh token storage pattern: `SET refresh:{token_id} {user_id} EX {refresh_ttl_seconds}`.

5. **Add `app/api/v1/auth.py`** (the first router extracted from `routes.py`).
   - `POST /auth/register` — returns `{user, access_token}` + sets refresh cookie.
   - `POST /auth/login` — same.
   - `POST /auth/refresh` — reads cookie, returns new access_token + rotates cookie.
   - `POST /auth/logout` — deletes refresh, clears cookie.
   - `POST /auth/ws-token` — returns short-lived (60s) WS token. Requires access token.
   - Mount in `main.py` *alongside* the old router. Old `/auth/login` and `/auth/register` continue to work until 2.3 deletes them.

6. **Frontend: real `authStore` with Zustand.**
   - Install `zustand` and `@tanstack/react-query`.
   - `frontend/src/features/auth/store/auth.store.js`:
     ```javascript
     export const useAuthStore = create((set, get) => ({
       accessToken: null,    // in-memory only
       user: null,
       isAuthenticated: false,
       setAuth: ({ accessToken, user }) => set({ accessToken, user, isAuthenticated: true }),
       clearAuth: () => set({ accessToken: null, user: null, isAuthenticated: false }),
     }));
     ```
   - **Do not** persist `accessToken` to localStorage. User identity (`user.id`, `user.username`) can persist for UX (showing "Welcome back, X"), but the token itself stays in memory and is re-fetched via refresh on page load.

7. **Frontend: `apiClient` interceptor reads from store, handles refresh.**
   - Request interceptor: pulls `accessToken` from `useAuthStore.getState()`.
   - Response interceptor: on 401, calls `/auth/refresh` (cookie-based, no body), updates store, retries the original request once. On second 401 → `clearAuth()` + redirect.

8. **Frontend: `useAuth` hook + `ProtectedRoute`.**
   - `useAuth()` returns `{user, isAuthenticated, login, logout, register}`.
   - `<ProtectedRoute>` uses `useAuthStore(s => s.isAuthenticated)` (reactive) instead of `isAuthenticated()` function call.
   - On app mount, attempt silent refresh: `POST /auth/refresh`. If 200, populate store. If 401, leave unauthenticated. This is how "stay logged in" works without localStorage.

9. **Delete `frontend/src/context/AuthContext.jsx`** (the empty file from audit 3.11).

### Deliverables
- `pyjwt`-based JWT with refresh rotation.
- `bcrypt`-based password hashing.
- Redis-backed refresh token store.
- New `app/api/v1/auth.py` router co-mounted with the legacy router.
- Frontend `useAuthStore`, reactive `ProtectedRoute`, automatic silent refresh on page load.
- Empty `AuthContext.jsx` deleted.

### Acceptance Criteria
- Login → close browser → reopen → still authenticated (silent refresh works).
- Hit 401 on any endpoint → auto-refresh → request retried → succeeds (if refresh valid).
- Tamper with the JWT signature → 401.
- `settings.jwt_secret_key` is the *only* place the secret lives. `grep -r "supersecretkey" app/` returns nothing.
- WS token from `/auth/ws-token` expires after 60 seconds (verify by waiting + retry).

### Interview Talking Points
- *"The auth refactor was the highest-risk item in the audit — the JWT secret was hardcoded as a string literal, bypassing the entire config system. I migrated to pyjwt with a refresh-rotate flow: access tokens are 15 min and held in memory (not localStorage, to defeat XSS), refresh tokens are 7 days in an httpOnly cookie and rotated on every use."*
- *"For WebSockets I issue a separate 60-second WS token, because the browser can't send custom headers on `new WebSocket()` — the workaround of putting an auth token in the URL is acceptable only if the token is short-lived, since reverse proxies log query strings."*
- *"On the frontend the trickiest piece was reactivity: the old code checked `isAuthenticated()` as a function call, so after login no component re-rendered. I moved auth state to a Zustand slice and components subscribe via selectors, so login state changes cascade through the tree."*

### Duration
**2 working days.**

---

## Phase 2.2 — Database Truth

### Objective
Make the ORM models and the Alembic migrations the same shape. Delete `Base.metadata.create_all` from the production startup path. Migrate to async SQLAlchemy 2.0.

### Why this phase exists
Audit findings 3.2 (schema drift), 5.1-5.2 (create_all in production), 9 (whole section). Right now, "migrations" are an illusion — production runs `metadata.create_all` and ignores Alembic entirely. We can't ship trustworthy data work until this is fixed.

### Dependencies
- Phase 2.0 (clean tree).
- Phase 2.1 nice-to-have (auth_service uses async DB — easier if Phase 2.2 lands before 2.1's services).

### Tasks (ordered)

1. **Audit current ORM model fields against the working database.**
   - Spin up a fresh Postgres via `docker compose up postgres`.
   - Run a one-off script that creates tables via `metadata.create_all`, then `\d users`, `\d positions`, `\d trades` to dump actual columns.
   - Snapshot this as the "current truth" in a temporary `schema_snapshot.sql`.

2. **Define the target schema** (already in `ARCHITECTURE.md` section 6.1).
   - `users`, `orders` (new!), `trades`, `positions`, `equity_history`, `risk_profiles`, `idempotency_records`.
   - All money columns `NUMERIC(20, 8)` or `NUMERIC(20, 2)` per spec.

3. **Rewrite ORM models to match target schema.**
   - `app/models/base.py`: `Base = declarative_base()` (separate from `database.py` to avoid the circular ordering bug).
   - `app/models/user.py`: add `email`, `updated_at`.
   - `app/models/position.py`: rename `average_price` → `avg_price`. Add `cost_basis` (materialized).
   - `app/models/trade.py`: add `order_id` FK, `fees`, rename `timestamp` → `executed_at`.
   - `app/models/order.py`: **new** — full order entity with state.
   - `app/models/idempotency_record.py`: **new**.

4. **Delete existing migrations, regenerate baseline.**
   - `rm alembic/versions/001_initial.py`.
   - `alembic revision --autogenerate -m "baseline"`.
   - Manually review the generated migration. Autogen often gets FK cascade and index direction wrong.
   - Verify with `alembic upgrade head` on a fresh Postgres → schema matches the target.

5. **Migrate `app/core/database.py` to async SQLAlchemy 2.0.**
   - Single async engine using `asyncpg`.
   - `AsyncSession` via `async_sessionmaker`.
   - `get_db()` dependency yields `AsyncSession`.
   - Delete `create_tables()` from production startup. Move to `tests/conftest.py` only.
   - Keep `init_database()` as a connectivity check (`SELECT 1`).

6. **Migrate `auth_service` from Phase 2.1 to async DB calls.**
   - `await db.execute(select(User).where(User.username == username))`.
   - Update both old `routes.py` paths and new `api/v1/auth.py` to use async sessions.

7. **Update `main.py` startup.**
   - Lifespan does:
     - `await init_database()` (connectivity check)
     - `await ensure_migrations_current()` — a helper that compares `alembic_version` table head to the latest migration file; logs WARN if out of sync (does not auto-upgrade in production).
   - No `create_tables` call.

8. **Update `tests/conftest.py`.**
   - Async test client (`httpx.AsyncClient` + `LifespanManager`).
   - Each test session: spin up fresh schema via `metadata.create_all` on an in-memory SQLite (`sqlite+aiosqlite:///:memory:`), drop on teardown.
   - Fix the broken `test_health_check` (audit 3.6).

### Deliverables
- Async SQLAlchemy 2.0 throughout.
- ORM models and Alembic migration agree on every column.
- Production startup no longer calls `metadata.create_all`.
- New tables: `orders`, `idempotency_records`.
- Tests run against in-memory SQLite, no `.db` files left in the working dir.

### Acceptance Criteria
- `alembic upgrade head` against a fresh Postgres produces a schema that matches `metadata.tables`.
- `alembic current` matches the migration in the repo head.
- All Phase 2.1 auth endpoints continue to work (login, register, refresh, logout).
- `find . -name "*.db" -not -path "*/node_modules/*"` returns empty after a test run.
- `pytest tests/unit/repositories/` passes (basic CRUD on each repo, to be written here as a smoke test).

### Interview Talking Points
- *"The original ORM model and Alembic migration disagreed on the `positions` table — model said `average_price`, migration said `avg_price`. Production was 'working' only because `metadata.create_all` was running at startup, silently ignoring Alembic. I reconciled the two and removed `create_all` from the production path, which is the discipline you need before any production DB."*
- *"I introduced an `orders` table separate from `trades` because in real markets an order can be partially filled across multiple trades, can sit open as a limit, can be cancelled — and a `trades` table flattens all of that into a single dimensionless event. Now orders have an explicit state machine and trades reference their parent order."*
- *"All money columns are `NUMERIC(20, 8)` with `Decimal` end-to-end in the Python layer. Float math for money is the kind of bug that turns into a regulatory finding in real finance."*

### Duration
**2 working days.**

---

## Phase 2.3 — Service & Repository Layers

### Objective
Introduce the four-layer architecture (API → Service → Domain → Repository). No new behavior; pure structural refactor. The Frankenstein `routes.py` empties out and disappears.

### Why this phase exists
Audit finding 4.1 (no separation of concerns). This is the largest *interview-defensibility* phase. The answer to "how do you structure a FastAPI backend" has to be more than "I dump everything in routes."

### Dependencies
- Phase 2.0 (clean tree).
- Phase 2.1 (auth_service exists as the prototype service).
- Phase 2.2 (async DB, repositories can be written against async sessions).

### Tasks (ordered)

1. **Create the directory skeleton.**
   - `mkdir app/{repositories,services,domain,infra}`.
   - Empty `__init__.py` in each.
   - Update `app/__init__.py` exports.

2. **Build `app/repositories/base.py` with the `BaseRepository` generic.**
   - Constructor: `def __init__(self, session: AsyncSession)`.
   - Generic CRUD: `get(id)`, `add(entity)`, `update(entity)`, `delete(entity)`, `list(filters)`.
   - Subclasses override with typed signatures.

3. **Build `app/repositories/unit_of_work.py`.**
   - `class UnitOfWork`:
     - Async context manager that opens a session.
     - Exposes typed repositories as attributes: `uow.users`, `uow.orders`, `uow.trades`, `uow.positions`, `uow.equity_history`.
     - `__aexit__` commits on success, rolls back on exception.
   - `get_uow()` FastAPI dependency that yields a `UnitOfWork`.

4. **Build per-aggregate repositories.**
   - `app/repositories/user_repo.py`: `get_by_id`, `get_by_username`, `add`, `update_balance`.
   - `app/repositories/order_repo.py`: `get_by_id`, `get_by_client_order_id`, `get_open_for_user`, `get_open_for_symbol`, `add`, `update_status`.
   - `app/repositories/trade_repo.py`: `add`, `list_for_user(filters)`.
   - `app/repositories/position_repo.py`: `get_for_user_symbol`, `upsert`, `delete`, `list_for_user`.
   - `app/repositories/equity_history_repo.py`: `add_snapshot`, `list_for_user(days)`.
   - Each returns ORM model rows (Phase 2.3 simplification — domain entities come in Phase 2.4 where it matters).

5. **Move services from `app/portfolio/*_engine.py` and `app/execution/execution_engine.py` into `app/services/`.**
   - `app/services/order_service.py` (currently `execute_trade` function — rewritten as a class with UoW dependency).
   - `app/services/portfolio_service.py` (currently `pnl_engine.get_total_pnl` — rewritten).
   - `app/services/analytics_service.py` (currently `performance_engine.calculate_performance_metrics`).
   - `app/services/market_service.py` (currently scattered across `routes.py`).
   - `app/services/signal_service.py` (delegates to `signal_engine` for now).
   - Each service:
     - Constructor takes dependencies (`uow`, `idem`, `event_bus`, `risk`).
     - Public methods are explicit verbs (`place_order`, not `do_trade`).
     - No FastAPI imports.

6. **Split `app/api/routes.py` into `app/api/v1/*.py`.**
   - `auth.py` (already exists from 2.1).
   - `portfolio.py`: GET `/portfolio`, GET `/portfolio/history`, GET `/portfolio/positions`.
   - `trading.py`: POST `/orders`, GET `/orders`, DELETE `/orders/{id}`, GET `/trades`.
   - `market.py`: GET `/market`, GET `/market/{symbol}`, GET `/candles/{symbol}`.
   - `signals.py`: GET `/signals`, GET `/signals/{symbol}`.
   - `analytics.py`: GET `/performance`, GET `/analytics/sharpe`, GET `/analytics/drawdown`.
   - `ws.py`: WS `/ws`.
   - `health.py`: GET `/health`, GET `/health/db`, GET `/health/redis`.
   - `app/api/v1/__init__.py` aggregates with `router.include_router(...)`.
   - `main.py` mounts `app.api.v1.router` at `/api/v1`.

7. **Build `app/api/v1/deps.py` — shared FastAPI dependencies.**
   - `CurrentUser = Annotated[User, Depends(get_current_user)]`.
   - `DBSession = Annotated[AsyncSession, Depends(get_db)]`.
   - `UoW = Annotated[UnitOfWork, Depends(get_uow)]`.
   - `IdempotencyKey = Annotated[UUID | None, Header(alias="X-Idempotency-Key")]`.
   - Service factories: `OrderSvc = Annotated[OrderService, Depends(get_order_service)]`, etc.

8. **Delete `app/api/routes.py` entirely.** It is now empty.

9. **Delete the legacy module aliases.**
   - `app/portfolio/pnl_engine.py` → keep only as a shim that re-exports from `app/services/portfolio_service.py` with a deprecation warning. Phase 2.4 removes the shim.
   - `app/execution/execution_engine.py` → shim that re-exports from `app/services/order_service.py`.

### Deliverables
- Four-layer backend: API / Service / Domain (skeleton) / Repository.
- `app/api/routes.py` deleted.
- `app/api/v1/{auth,portfolio,trading,market,signals,analytics,ws,health}.py` all populated.
- UoW pattern enforced for every mutating service.
- Service factories injected via FastAPI dependencies.

### Acceptance Criteria
- `grep -r "from sqlalchemy" app/api/` returns nothing. (No SQL in the API layer.)
- `grep -r "from fastapi" app/services/` returns nothing. (No HTTP in the service layer.)
- All existing endpoints continue to respond identically (smoke-test with the Phase 2.7 tests once they exist, or curl-walk now).
- `app/api/routes.py` does not exist.
- `app/services/order_service.py` has a `place_order` method that takes a UoW and returns an Order entity.

### Interview Talking Points
- *"I refactored from a two-layer (route + engine) backend to a four-layer one: API → Service → Domain → Repository. Routes are thin: 5-10 lines each, just HTTP plumbing. Services own the orchestration and transactions. Repositories own all SQL. Domain is pure logic."*
- *"The transaction boundary is the service method, not the route. I use a Unit-of-Work context manager that opens a session, exposes typed repositories, and commits on exit. Two-phase concerns like 'persist trade and emit event' use the same boundary: persist inside UoW, emit on the bus *after* commit so we never publish an event for state that rolled back."*
- *"Every mutating service method accepts an `idempotency_key`. The service hits Redis first — if it's a replay, return the cached response. Otherwise execute and store the response keyed on the idempotency key for 24h. That's how real trading APIs handle network retries."*

### Duration
**3 working days.** This is structural surgery — careful, file-by-file, with smoke tests after each move.

---

## Phase 2.4 — PnL & Execution Correctness

### Objective
Single correct PnL implementation (FIFO, `Decimal`-based). Single correct execution path with idempotency and proper risk integration. Delete every duplicate engine and stale code path.

### Why this phase exists
Audit findings 3.4 (two PnL engines fighting), 4.7 (no order types, no idempotency, no real risk integration), 5.3 (blocking yfinance in request path), 5.9-5.11 (ML quality), 7 in the audit (yfinance rate limit). This is the "make the trading logic correct" phase.

### Dependencies
- Phase 2.2 (Decimal-typed schema in place).
- Phase 2.3 (service layer in place).

### Tasks (ordered)

1. **Build `app/domain/pnl/fifo.py`.**
   - Pure function: `compute_fifo_realized(trades: list[Trade]) -> Decimal`.
   - Pure function: `compute_unrealized(positions: list[Position], price_lookup: Callable[[str], Decimal]) -> Decimal`.
   - Hand-computed unit tests with 5+ scenarios: empty, single BUY, BUY-SELL closed, BUY-BUY-PARTIAL-SELL, BUY-SELL-BUY-SELL alternating.

2. **Delete the duplicate `PnLEngine` class.**
   - Remove lines 21-315 from `app/portfolio/pnl_engine.py`.
   - Remove the shim too — `app/services/portfolio_service.py` is now the only PnL implementation.

3. **Build `app/domain/orders/state_machine.py`.**
   - Enum: `OrderStatus(PENDING, OPEN, PARTIAL, FILLED, CANCELLED, REJECTED, EXPIRED)`.
   - State transition validator: `can_transition(from_status, to_status) -> bool`.
   - Property: `is_terminal(status) -> bool`.
   - Property: `is_active(status) -> bool` (OPEN, PARTIAL).

4. **Build `app/domain/risk/rules.py`.**
   - Protocol: `RiskRule.evaluate(context: RiskContext) -> RiskViolation | None`.
   - Concrete rules: `MaxPositionSize`, `MaxDailyLoss`, `Concentration` (max 30% in one symbol), `InsufficientBalance`, `ShortSelling` (Phase 2.4: reject all short attempts).
   - `RiskAssessment(allowed: bool, violations: list[RiskViolation])`.

5. **Rewrite `app/services/order_service.py` with full execution path.**
   - Method signature: `async def place_order(self, user_id: int, request: PlaceOrderRequest, idempotency_key: UUID) -> Order`.
   - Step-by-step (matches `ARCHITECTURE.md` section 12 sequence):
     1. `await self._idem.get(idempotency_key)` — return cached if exists.
     2. `async with self._uow.begin() as uow`.
     3. Load user (`SELECT ... FOR UPDATE`).
     4. Build risk context, call `self._risk.assess(...)`.
     5. If BLOCKING violation → raise `RiskRejection` (HTTP 400).
     6. Create `Order` entity, validate state machine (PENDING → OPEN).
     7. For MARKET orders: fill immediately at `market_state.get_price(symbol)`. Update Order to FILLED, create Trade, upsert Position, update user.balance.
     8. For LIMIT/STOP orders: persist as OPEN, return immediately (matching happens in 3.2 via OrderMatcher).
     9. Exit UoW (commits).
     10. `await self._bus.emit(OrderPlaced(...))` and other relevant events.
     11. `await self._idem.store(idempotency_key, order_response)`.
     12. Return order.

6. **Build `app/services/idempotency_service.py`.**
   - `async def get(self, key: UUID) -> Optional[StoredResponse]`.
   - `async def store(self, key: UUID, request_hash: str, response: dict, ttl: int = 86400)`.
   - Backed by Redis (`SETEX idem:{key} 86400 {json}`).
   - Also writes to `idempotency_records` table as a backup (asynchronously, non-blocking).

7. **Replace `Decimal`-unsafe code throughout.**
   - All money columns return Python `Decimal` from SQLAlchemy.
   - Pydantic models use `Decimal` types for money fields with explicit JSON serializers (`Decimal` → string in JSON, deserializes back to `Decimal`).
   - Service signatures: `Decimal`, never `float`.

8. **Stop blocking on yfinance in the request path.**
   - `app/services/portfolio_service.py` price lookup: read from `market_state` only. If missing, mark position as `{stale: true, price: null}`. Frontend renders these as `--` greyed out.
   - The yfinance call is only made by `MarketFeedEngine` in the background.

9. **Fix `market_state` cache key for `fetch_stock_data`.**
   - `app/infra/market_data/cache.py`: cache key is `(symbol, interval)`, not just `symbol` (audit 5.4).

10. **Add `OrderMatcher` skeleton.**
    - `app/engines/order_matcher.py`: subscribes to `PriceTicked` events, queries open LIMIT/STOP orders, fills when conditions met. Phase 2.4 implements the skeleton + LIMIT MARKET-only; STOP and STOP_LIMIT in Phase 3.2.

### Deliverables
- Single FIFO PnL implementation with property tests.
- Order state machine.
- Risk rules as composable predicates.
- Idempotent order placement.
- `Decimal` money end-to-end.
- yfinance no longer in the request path.

### Acceptance Criteria
- `pytest tests/unit/domain/test_pnl_fifo.py` passes 8+ test cases.
- `pytest tests/unit/domain/test_order_state_machine.py` passes (all valid transitions accepted, all invalid rejected).
- POST `/orders` with the same `X-Idempotency-Key` twice returns the same response, executes the trade only once.
- `grep -r "float" app/services/ app/domain/` returns only `float()` casts in defined boundaries (e.g., serialization for FE display); no `float` arithmetic on money.
- `/portfolio` endpoint responds in <100ms even with cold market_state cache (because it doesn't call yfinance).

### Interview Talking Points
- *"PnL had two complete implementations fighting each other — one used weighted-average cost basis, one used FIFO. I deleted the WAC version and chose FIFO because in real finance, cost-basis methodology has tax implications and an auditor needs to see lot-level matching. The FIFO function is pure — 30 lines — and has property-based tests against hand-computed expected values."*
- *"Idempotency on order placement is keyed on a client-supplied UUID. First request executes and the response is stored in Redis 24h. Repeated requests with the same key return the same response without re-executing. This is what every real trading API does, and the audit caught that the original code sent an `X-Request-ID` header that the backend silently ignored."*
- *"Money is `Decimal` end-to-end. Pydantic serializes Decimal to string in JSON to preserve precision across the wire. The frontend uses `Intl.NumberFormat` and `Decimal.js` (if needed) to display. Float arithmetic for currency is one of those bugs that doesn't show up in dev and ruins your week in production."*

### Duration
**3 working days.**

---

## Phase 2.5 — Real-Time Pipeline v1

### Objective
Collapse the three duplicate broadcasters into one event-driven flow. Fix the signal engine sleep interval. Introduce the in-process event bus. Fix the candle flicker at the source.

### Why this phase exists
Audit findings 3.5 (1-hour signal sleep), 4.2 (three tasks broadcast same data), 4.3 (mixed threading models), 4.5 (no per-user / per-topic addressing), 4.6 (no event bus), 7 in audit (whole section). This is *the* phase that makes the real-time architecture defensible.

### Dependencies
- Phase 2.3 (service layer for emitting events).
- Phase 2.4 (correct execution path that can emit `OrderFilled` events).

### Tasks (ordered)

1. **Build `app/infra/event_bus/bus.py`.**
   - `class EventBus`:
     - `subscribe(event_type: Type[Event], handler: Callable[[Event], Awaitable])`.
     - `unsubscribe(event_type, handler)`.
     - `async emit(event: Event)`.
   - Implementation: `dict[Type[Event], list[Handler]]`. On `emit`, fan-out via `asyncio.gather(*[h(event) for h in handlers], return_exceptions=True)`. Log handler errors, don't propagate.

2. **Define domain events in `app/infra/event_bus/events.py`.**
   - `@dataclass(frozen=True) class PriceTicked(symbol: str, price: Decimal, ts: int)`.
   - `CandleActive(symbol, timeframe, candle)`, `CandleClosed(symbol, timeframe, candle)`.
   - `SignalGenerated(symbol, signal, confidence, factors, ts)`.
   - `OrderPlaced`, `OrderFilled`, `OrderCancelled`, `OrderRejected`.
   - `PositionChanged(user_id, symbol, qty, avg_price, market_value, unrealized_pnl)`.
   - `BalanceChanged(user_id, balance)`.
   - `RiskBreached(user_id, rule, severity, message)`.

3. **Rewrite `app/engines/market_feed.py`.**
   - Replaces `app/market/market_data_engine.py`.
   - Loop: every `FETCH_INTERVAL` seconds, fetch quote for each symbol *in parallel via `asyncio.gather`*. For each new price, emit `PriceTicked`.
   - Provider abstraction: `MarketDataProvider` protocol; `YFinanceProvider` and `SyntheticProvider` (for demo mode without external dependency).

4. **Rewrite `app/engines/candle_engine.py`.**
   - Replaces `app/market/candle_engine.py`.
   - Subscribes to `PriceTicked`. For each tick, updates the active candle for each timeframe. On candle boundary, emits `CandleClosed` for the closing candle and starts a new active candle.
   - For active candle mutations (high/low/close update), emits `CandleActive` (throttled to once per second per symbol-tf pair, otherwise we'd emit on every tick).

5. **Rewrite `app/engines/signal_engine.py`.**
   - Subscribes to `PriceTicked` (or `CandleClosed` depending on signal kind).
   - Debounced: at most one signal recompute per symbol per `settings.signal_update_interval` (default 10s).
   - On recompute, emits `SignalGenerated`.
   - Fix audit 3.5: `settings.signal_update_interval` now exists in config with default `10`.

6. **Build `app/infra/event_bus/subscribers/websocket_subscriber.py`.**
   - Subscribes to: every event type from #2.
   - For each event, derive a topic string per `ARCHITECTURE.md` section 5.4.
   - Calls `manager.publish_to_topic(topic, message)`.

7. **Rewrite `app/infra/websocket/manager.py`.**
   - Replaces `app/websocket/manager.py`.
   - State: `_connections: dict[WebSocket, ConnectionState]`, `_topic_subs: dict[str, set[WebSocket]]`, `_user_conns: dict[int, set[WebSocket]]`.
   - `connect(ws, user_id)`, `disconnect(ws)`.
   - `subscribe(ws, topics)`, `unsubscribe(ws, topics)`.
   - `publish_to_topic(topic, message)` — broadcasts to all subscribers of that topic.
   - `publish_to_user(user_id, message)` — convenience for user-scoped events.
   - `broadcast_with_backpressure`: per-connection send with timeout; mark as degraded on timeout, disconnect after 3 degradations.

8. **Build `app/infra/websocket/protocol.py`.**
   - `Envelope` Pydantic model: `v: int = 1, id: str, type: str, topic: Optional[str], ts: int, data: dict`.
   - Constants for event types and control message types.
   - `make_event(type, topic, data) -> dict` helper.

9. **Rewrite `/ws` endpoint** (in `app/api/v1/ws.py`).
   - Validate WS token (from `?token=` query string), extract `user_id`.
   - Register connection with manager.
   - Handle subscribe/unsubscribe/ping messages.
   - Validate that subscribe topics for `user.{id}.*` match the connected user.
   - Server-initiated heartbeat every 30s; disconnect on 3 missed pongs.

10. **Build `app/infra/supervisor.py`.**
    - Replaces `safe_task` in `main.py` (audit 3.8).
    - `class EngineSupervisor`:
      - `register(name, runner: Callable[[], Awaitable])`.
      - `async start_all()` — uses `asyncio.TaskGroup`.
      - Per-engine: exponential backoff on crash (1s, 2s, 4s, ..., 30s max).
      - Per-engine: health endpoint reads last successful loop timestamp.

11. **Update `main.py` lifespan** to use the supervisor.
    - `supervisor.register("market_feed", MarketFeedEngine(...).run)`.
    - Same for candle, signal, order_matcher.
    - `await supervisor.start_all()`.

12. **Delete old engine modules.**
    - `app/market/market_data_engine.py`, `app/market/candle_engine.py`, `app/websocket/market_stream.py`, `app/websocket/manager.py` (old version) — gone.
    - `app/quant/signal_engine.py` → moved to `app/engines/signal_engine.py` and shim deleted.

### Deliverables
- In-process event bus.
- Single broadcast pipeline driven by domain events.
- Topic-based WebSocket subscriptions.
- Per-user WebSocket addressing.
- Engine supervisor with proper restart policy.
- Signal engine no longer sleeps 1 hour.

### Acceptance Criteria
- Open two browser tabs as the same user. Place a trade in tab 1. Tab 2 receives the `trade.filled` WS event within 200ms.
- Open a browser tab as user A and another as user B. User A's trades do NOT push to user B's WS connection (verified by inspecting messages received).
- Subscribe to `tick.AAPL` only. Verify no `tick.MSFT` messages are received.
- Kill the candle_engine task. Within 5 seconds, the supervisor restarts it. `/health/engines` shows the restart.
- Total WS bandwidth per client at idle (no positions, no subscriptions beyond `tick.AAPL`): <10 KB/min.

### Interview Talking Points
- *"The original real-time pipeline had three separate background tasks broadcasting overlapping snapshots — about 264 KB per second per connected client of redundant data. I replaced it with an in-process event bus where engines emit domain events and subscribers route them. The WebSocket subscriber is one of several — an audit logger is another, an equity-snapshot writer is a third. Adding a new feature is just subscribing a new handler."*
- *"Topics are server-side strings: `tick.AAPL`, `candle.AAPL.1m`, `user.42.trade`. Clients send subscribe messages with the topics they care about. The manager maintains `dict[topic, set[WebSocket]]` so broadcast is O(subscribers) not O(connections). Per-user topics are scoped by user ID and rejected if a client tries to subscribe to someone else's stream."*
- *"For backpressure: per-connection sends have a 200ms timeout. If a client can't keep up, it's marked degraded; after three timeouts it's disconnected with code 4003. This means one slow consumer can't hold up the broadcast loop for everyone else — a classic mistake in WebSocket fanout."*

### Duration
**3 working days.**

---

## Phase 2.6 — Frontend Foundations

### Objective
Rebuild the frontend on Zustand + TanStack Query with the feature-folder architecture. Fix the candle flicker. Wire the new WS protocol. This is the job-critical phase — by the end, the dashboard should *feel* like a real product.

### Why this phase exists
Audit findings 3.11-3.12 (no Zustand, no React Query, empty AuthContext), 6.1-6.14 (whole frontend audit). For a frontend job application, this phase is the single most important deliverable in the entire roadmap.

### Dependencies
- Phase 2.1 (Zustand authStore prototype, refresh-token flow).
- Phase 2.5 (new WS protocol).

### Tasks (ordered)

1. **Install new dependencies** (per `ARCHITECTURE.md` 16.4):
   - `zustand`, `@tanstack/react-query`, `@tanstack/react-query-devtools`.
   - `clsx`, `tailwind-merge`, `lucide-react`, `react-hot-toast`, `date-fns`.

2. **Create the feature-folder structure** (per `ARCHITECTURE.md` 4):
   - `mkdir -p frontend/src/features/{auth,portfolio,trading,market,signals,analytics,dashboard}/{api,components,pages,store,hooks}`.
   - `mkdir -p frontend/src/shared/{components/{ui,layout,feedback,data},hooks,lib,store}`.

3. **Build `shared/lib/queryClient.js`.**
   - Configured TanStack Query client: `staleTime: 30s` default, `gcTime: 5min`, `retry: 1`.
   - Per-query overrides defined in feature `api/` files.

4. **Build `shared/lib/wsClient.js`** (replaces `services/websocket.js`).
   - Class with the new protocol: envelope-aware, topic-based.
   - On connect: fetch WS token via `/auth/ws-token`, connect with `?token=...`.
   - Client API:
     - `subscribe(topic, handler) -> unsubscribe()`.
     - `unsubscribeAll(topic)`.
     - `disconnect()`.
   - Internal:
     - Server-driven heartbeat handling (pong on ping).
     - Client-driven heartbeat every 20s.
     - Exponential reconnect.
     - On reconnect, re-fetch token, re-subscribe to all previously-subscribed topics (state persisted in Zustand).

5. **Build `shared/lib/apiClient.js`** (refactor of existing).
   - Reads access token from `useAuthStore.getState().accessToken`.
   - On 401, calls `/auth/refresh`. If successful, retries original request once. If failed, `useAuthStore.getState().clearAuth()` + redirect.
   - All other interceptor logic from Phase 2.1.

6. **Build Zustand stores.**
   - `features/auth/store/auth.store.js` — already exists from 2.1.
   - `shared/store/market.store.js` — `bySymbol: Record<string, TickState>`. Action: `updateTick(symbol, price, ts)`. Selector helpers: `useLastPrice(symbol)`, `usePriceChange(symbol)`.
   - `shared/store/ui.store.js` — `theme`, `sidebarCollapsed`, `selectedSymbol`, `selectedTimeframe`. Persisted to localStorage.

7. **Build `shared/hooks/useLiveTick.js`.**
   - Hook that subscribes to `tick.{symbol}` WS topic on mount, unsubscribes on unmount.
   - Updates `market.store` on each tick.
   - Returns `{price, change, ts, isStale}`.

8. **Build the WS → Query invalidation bridge.**
   - In `App.jsx` (or a dedicated `WSBridge` component), subscribe to user-scoped topics on auth:
     - `user.{id}.trade` → `queryClient.invalidateQueries(['portfolio', 'positions', 'trades'])` + toast.
     - `user.{id}.position` → `queryClient.invalidateQueries(['positions', 'portfolio'])`.
     - `user.{id}.balance` → `queryClient.invalidateQueries(['portfolio'])`.
   - Unsubscribe on logout.

9. **Rebuild `features/market/components/CandlestickChart.jsx`.** (audit 6.1-6.2)
   - Mount:
     - Fetch initial 200 candles via TanStack Query: `useQuery(['candles', symbol, timeframe])`. Stale time 60s.
     - Initialize lightweight-charts series with `setData(candles)`.
   - Live updates:
     - Subscribe to `candle.{symbol}.{timeframe}` WS topic.
     - On `candle.active`: `series.update(activeCandle)` — incremental, no flicker.
     - On `candle.closed`: `series.update(closedCandle)` — finalizes the bar.
     - Never call `fitContent()` on update (only on mount + on timeframe change).
   - User pan/zoom is preserved across all updates.

10. **Rebuild `features/portfolio/api/portfolio.api.js`.**
    - `usePortfolioSummary()` → `useQuery(['portfolio'], () => apiClient.get('/portfolio'))`.
    - `usePositions()` → `useQuery(['positions'], ...)`.
    - `useEquityHistory(days)` → `useQuery(['equity', days], ...)`.

11. **Rebuild `features/trading/api/orders.api.js`.**
    - `usePlaceOrder()` → `useMutation({ mutationFn: (req) => apiClient.post('/orders', req, { headers: { 'X-Idempotency-Key': uuid() } }) })`.
    - `useOpenOrders()` → `useQuery(['orders', 'open'], ...)`.
    - `useTrades(filters)` → `useQuery(['trades', filters], ...)`.

12. **Rewrite all pages on the new architecture.**
    - `DashboardPage.jsx`: composes `PnLSummary`, `EquityCurve`, `Watchlist`, recent trades, signal cards.
    - `PortfolioPage.jsx`: full positions table with live unrealized PnL.
    - `TradingTerminal.jsx`: `OrderForm` + `OpenOrdersTable` + selected `CandlestickChart`.
    - `MarketPage.jsx`: `SymbolSearch` + grid of mini charts + scanner.
    - `AnalyticsPage.jsx`: Sharpe, drawdown chart, win-rate gauge.

13. **Wrap with error boundaries.**
    - `shared/components/feedback/ErrorBoundary.jsx`: class component.
    - Wrap each page in its own boundary inside `App.jsx`.

14. **Fix `App.jsx`.** (audit 6.5)
    - Delete the commented-out top block.
    - Delete the duplicate `Route path="/"`.
    - Single routing tree.

15. **Delete dead modules.**
    - `frontend/src/context/AuthContext.jsx`, `frontend/src/store/marketStore.js`, `frontend/src/services/websocket.js`, old `apiClient.js`.
    - Old hooks: `useMarket.js`, `usePortfolio.js`, `usePerformance.js` — replaced by feature-folder versions.
    - Old `services/*.js` — replaced by feature `api/*.api.js`.

### Deliverables
- Feature-folder organized React app.
- Zustand for client state, TanStack Query for server state, clear boundary.
- WS-Query invalidation bridge.
- Candlestick chart with incremental updates (no flicker, preserved user pan/zoom).
- Reactive auth state.
- Error boundaries per page.
- All old dead modules deleted.

### Acceptance Criteria
- Open the chart for AAPL, zoom in to last 30 minutes. Wait 5 minutes. Pan/zoom **is preserved**, prices update in place.
- Place a trade. Within 500ms: toast appears, positions table updates, dashboard PnL refreshes — all driven by the WS event, no manual refresh.
- Close the tab, reopen. Still logged in (silent refresh works). Watchlist symbols persisted (UI store).
- Force a chart component to throw. The rest of the dashboard remains functional (error boundary contains the blast).
- `find frontend/src -name "*.context*" -o -name "marketStore.js" -o -name "websocket.js"` returns empty.

### Interview Talking Points
- *"On state management I went with Zustand for client state and TanStack Query for server state, with a clear line: client state is things like 'which symbol is selected' or 'the latest live tick'; server state is things like 'my portfolio' or 'my trade history' that have a fetch-cache pattern. Mixing those two is one of the most common React anti-patterns, so I drew the boundary explicitly."*
- *"The chart was the highest-impact UX fix. The original called `series.setData(allCandles)` every three seconds, which is a full data replacement plus a fitContent reset — that's the flicker. I rebuilt it to fetch the history once via TanStack Query, then subscribe to a WebSocket topic for that symbol-timeframe pair. Active candle mutations call `series.update`, which is repaint-free, and the user's pan/zoom is preserved across the entire session."*
- *"The bridge between server-pushed events and the query cache is one component: a `WSBridge` that subscribes to user-scoped topics and calls `queryClient.invalidateQueries` on mutating events. When a trade fills on the server, the WS push triggers re-fetch of portfolio + positions + trades, all coordinated. The user sees a toast and the UI updates without a manual refresh — that's the 'feels live' feeling for the dashboard."*

### Duration
**4 working days.** Single biggest phase. Frontend job-critical.

---

## Phase 2.7 — Test Foundations & Green CI

### Objective
Build a real test pyramid. Replace the three smoke tests with proper coverage of business logic. Get green CI on both backend and frontend.

### Why this phase exists
Audit findings 3.6 (broken test), 13 (whole section). A portfolio repo with a passing CI badge that actually means something is a strong recruiter signal.

### Dependencies
- Phase 2.4 (domain logic exists to test).
- Phase 2.6 (frontend components exist to test).

### Tasks (ordered)

1. **Configure pytest properly.**
   - `pytest.ini` or `pyproject.toml` `[tool.pytest.ini_options]`:
     - `asyncio_mode = "auto"`.
     - `addopts = "-ra -q --strict-markers"`.
     - `markers = ["unit", "integration", "slow"]`.
   - `tests/conftest.py`:
     - `event_loop` removed (deprecated).
     - In-memory SQLite + `sqlite+aiosqlite` for fast tests.
     - Async `httpx.AsyncClient` fixture.
     - Factory-Boy fixtures for User, Order, Trade, Position.

2. **Write unit tests for domain logic.**
   - `tests/unit/domain/test_pnl_fifo.py`: 8 scenarios (empty, single BUY, BUY-SELL closed, partial fill, alternating, large positions for precision).
   - `tests/unit/domain/test_order_state_machine.py`: all valid transitions accepted, all invalid rejected.
   - `tests/unit/domain/test_risk_rules.py`: each rule independently — boundary cases.
   - `tests/unit/domain/test_signal_scoring.py`: factor combination → expected signal direction.

3. **Write service-layer integration tests.**
   - `tests/integration/test_order_lifecycle.py`:
     - Register → login → place market order → verify position created, balance debited, trade recorded.
     - Replay same order (same idempotency key) → verify no second execution.
     - Place order with insufficient balance → 400 rejection.
     - Place order exceeding max position size → 400 with risk violation detail.
   - `tests/integration/test_auth_flow.py`:
     - Register → login → access protected endpoint → success.
     - Wait for access expiry → call refresh → continue.
     - Logout → refresh fails.
     - Tampered token → 401.
   - `tests/integration/test_ws_protocol.py`:
     - Connect with WS token → subscribe to `tick.AAPL` → emit price event → verify message received with correct envelope.
     - Try to subscribe to `user.99.trade` as user 42 → rejected.
     - Send invalid envelope → no crash, error message returned.

4. **Frontend test setup.**
   - Install `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
   - `vitest.config.js`: jsdom env, setup file with `@testing-library/jest-dom` extensions.
   - Add `"test": "vitest"` and `"test:run": "vitest run"` scripts to `package.json`.

5. **Write component tests.**
   - `frontend/src/features/trading/components/OrderForm.test.jsx`:
     - Renders fields.
     - Validation: rejects negative quantity, requires symbol.
     - On submit, calls `usePlaceOrder` mutation with correct payload.
   - `frontend/src/features/auth/components/LoginForm.test.jsx`:
     - On valid login, calls auth store and navigates.
     - On invalid credentials, shows error message.
   - `frontend/src/shared/components/feedback/ErrorBoundary.test.jsx`:
     - Catches thrown errors and renders fallback.

6. **Fix and re-enable CI.**
   - `.github/workflows/ci.yml`:
     - Backend job: lint (ruff), type-check (mypy), test (pytest --cov), upload coverage.
     - Frontend job: lint (eslint), build (vite build), test (vitest run).
     - Both jobs run on push and PR.
     - Use the cached package managers (configured in 2.0).
   - First green CI run on `main`.

7. **Add load test for WS pipeline.**
   - `tests/load/ws_smoke.k6.js`: connects 100 simulated clients, each subscribes to 3 topics, runs for 5 minutes, asserts no disconnects and p95 message latency <100ms.
   - Not in CI (too slow), runnable via `make load`.

### Deliverables
- ~30 unit tests, ~15 integration tests, ~5 frontend component tests.
- Green CI pipeline on `main`.
- Coverage report uploaded to Codecov (or surfaced via `pytest-cov` artifact).
- Load test script committed.

### Acceptance Criteria
- `pytest` runs all tests in <10 seconds.
- `npm test` runs all frontend tests in <15 seconds.
- CI badge in README is green.
- Coverage >70% on `app/domain/` and `app/services/`.
- A deliberate regression (e.g., flip FIFO to LIFO) causes the test suite to fail.

### Interview Talking Points
- *"The original test suite was three smoke tests — and one of them asserted a field the endpoint didn't return, so it failed the first time anyone ran it. I rebuilt to a proper pyramid: domain logic gets unit tests with hand-computed fixtures (FIFO PnL math, order state machine, risk rules), service flows get integration tests against an in-memory SQLite, and frontend components get React Testing Library tests for behavior, not implementation."*
- *"The load test isn't in CI but it's in the repo: a k6 script that simulates 100 WebSocket clients to verify the broadcast pipeline handles realistic concurrency. That's the kind of test you write once and run before each scaling milestone."*

### Duration
**2 working days.**

---

## Phase 3 — Architecture Polish & SaaS-Grade UI

Phase 2 finishes with a correct, tested, structured platform. Phase 3 makes it look and feel like a product a fintech startup would ship.

### Phase 3.0 — Premium UI System (★★★ job-critical)

**Objective:** Bring the visual quality from "developer baseline" to "modern SaaS fintech." Premium dark theme, neon accents, glassmorphism where tasteful, micro-interactions.

**Tasks:**

1. **Design tokens in `frontend/src/styles/tokens.css`.**
   - Color scale: `--bg-base`, `--bg-elevated`, `--bg-panel`, `--bg-overlay` (with glass blur).
   - Accent: `--accent-cyan` (#22d3ee), `--accent-violet` (#a855f7), `--accent-emerald` (#34d399), `--accent-rose` (#f43f5e).
   - Surface: `--surface-1`, `--surface-2`, `--surface-3` (elevation steps).
   - Border: `--border-subtle`, `--border-emphasis`, `--border-accent`.
   - Typography: variable font (Inter Variable or similar), monospace for numbers (JetBrains Mono).
   - Radius scale: `--radius-sm/md/lg/xl/2xl`.
   - Shadow scale with glow variants for accent elements.

2. **Build `shared/components/ui/` design system.**
   - `Button` (variants: primary, secondary, ghost, danger; sizes: sm, md, lg).
   - `Card` (with optional glassmorphism `variant="glass"`).
   - `Input`, `Select`, `Switch`, `Slider`.
   - `Modal`, `Drawer`, `Tooltip`, `Popover`.
   - `Tabs`, `Accordion`.
   - `Badge` (with severity colors), `Chip`, `Tag`.
   - `Skeleton`, `Spinner`, `ProgressBar`.
   - `Toast` (wrapping react-hot-toast).

3. **Build `shared/components/data/`.**
   - `DataTable` (sortable, filterable, virtualized for >100 rows).
   - `KpiCard` (label, value, delta, trend sparkline).
   - `MetricGrid` (responsive grid of KpiCards).
   - `Sparkline` (lightweight inline chart).

4. **Build `shared/components/layout/`.**
   - `AppShell` (sidebar + topbar + content).
   - `Sidebar` (collapsible, with route highlighting, animated indicator).
   - `Topbar` (search, notifications, account dropdown, theme switch placeholder).
   - `PageContainer` (max-width, padding, page title slot).

5. **Animation pass with Framer Motion.**
   - Page transitions: fade + subtle slide.
   - List item enter: stagger fade-up.
   - Number changes: animated counter on PnL.
   - Sidebar collapse: spring animation.
   - Don't overdo it — Bloomberg terminal aesthetic, not animated greeting card.

6. **Apply to every page.**
   - Dashboard, Portfolio, Trading Terminal, Market, Analytics, Signals.
   - Each page redesigned with the new components.

**Deliverables:** Complete design system, all pages restyled, animations integrated.

**Acceptance:** Side-by-side comparison with `linear.app`, `vercel.com/dashboard`, a crypto-exchange dashboard — visually competitive.

**Interview talking points:** *"The visual quality bar I set was 'looks like a fintech SaaS, not a dev tool.' I built a tokenized design system — color scale with accent palette, typography with a monospace for numbers, three elevation surfaces with glassmorphism on the higher layers. Every component is a thin Tailwind wrapper around the tokens, so a future theme switch is a CSS variable change."*

**Duration:** 4 working days.

---

### Phase 3.1 — Trading Terminal v1 (Orders + Order Book) (★★)

**Objective:** Full trading UX with all order types, open orders table, simulated order book, recent trades tape.

**Tasks:**

1. **`OrderForm` with full order types.**
   - Tabs: Market / Limit / Stop / Stop-Limit.
   - Side toggle (Buy / Sell) with color.
   - Quantity, price (when applicable), TIF dropdown.
   - Live preview: estimated cost, fees, post-trade balance.
   - Submit with idempotency key.

2. **`OpenOrdersTable`** showing live status, cancel button per row.

3. **`OrderBook` panel** showing bid/ask ladder (simulated — derived from market state with synthetic spread).

4. **`RecentTradesTape`** showing your last 20 trades, scrolling.

5. **`StockDetailsPanel`** with: live price, 24h change, volume, factor breakdown, signal card.

6. **Page layout:** four-pane (chart, order form, book, tape).

**Duration:** 3 working days.

---

### Phase 3.2 — WS Protocol v2 + Order Matcher (★)

**Objective:** Implement remaining order types (STOP, STOP_LIMIT), add per-client message sequence numbers for replay on reconnect, server-driven heartbeat tightening.

**Tasks:**

1. `OrderMatcher` engine: STOP and STOP_LIMIT execution paths.
2. Per-topic sequence numbers in WS envelope.
3. `replay` control message: client requests `{topic, since_id}` → server resends missed events from a bounded ring buffer (last 200 per topic).
4. WS auth re-handshake on token refresh.
5. Connection health metrics: `ws_clients_active`, `ws_clients_degraded`, `ws_message_latency_seconds`.

**Duration:** 3 working days.

---

### Phase 3.3 — Observability + Deploy (★)

**Objective:** Prometheus metrics, structured logs, Sentry integration, one-command deploy to Fly.io or Railway.

**Tasks:**

1. **`prometheus-client` integration.**
   - `/metrics` endpoint exposing HTTP, WS, business, engine metrics per `ARCHITECTURE.md` 10.2.
   - Grafana dashboard JSON committed to `docs/grafana/`.

2. **Structured logging.**
   - JSON formatter for production (when `settings.environment != "development"`).
   - Request ID middleware adds `request_id` to context.

3. **Sentry SDK** (optional, gated on `SENTRY_DSN` env var).
   - FastAPI integration, async-aware.

4. **Deploy to Fly.io.**
   - `fly.toml` for backend.
   - Volume mount for Postgres (or use Fly Postgres).
   - Frontend deployed to Vercel (Vite static build) or as a separate Fly app.

5. **Demo URL in README.**
   - Public URL with a demo account credentials in README, so a recruiter can click and try.

**Duration:** 2 working days.

---

## Phase 4 — Quant Differentiation

This phase is what separates "polished full-stack project" from "this person is interesting." Selective — pick 2-3 of these depending on target roles.

### Phase 4.0 — Quant Features (★★ depending on roles)

**Pick 2-3 of:**

1. **Regime Detection (HMM)** — `app/domain/regimes/` with a Gaussian HMM over rolling returns; emit `RegimeChanged` events; visualization on the analytics page showing regime overlay on equity curve. *Interview line: "HMM with hidden states for trending vs. mean-reverting vs. high-volatility."*

2. **Convex Portfolio Optimizer** — `app/domain/optimizer/` using cvxpy: mean-variance optimization with constraints (max position, max sector, leverage). UI: a "rebalance" button on Portfolio that shows the recommended allocation. *Interview line: "Quadratic program with linear constraints, solved via CVXPY's OSQP backend."*

3. **VaR + Stress Testing** — historical VaR over rolling window; Monte Carlo VaR with assumed return distribution; stress scenarios (-20% market, sector crash). UI: risk dashboard.

4. **ML Re-introduction (ONNX path)** — rebuild the training pipeline (`ml/training/`), train a LightGBM model on factor outputs to predict 1-bar return direction, export to ONNX, serve via `onnxruntime`. Replace the broken LSTM completely.

5. **Backtest Harness** — replay historical candles through the live execution path; record equity curve; output a JSON report with sharpe, drawdown, win rate.

6. **Trade Analytics Dashboard** — per-symbol PnL attribution, hold-time distribution, win/loss expectancy chart, slippage analysis.

**Duration:** 5 working days for 2-3 features.

---

## Phase 5 — Stretch / Optional Polish

Time-permitting features that strengthen the project but aren't critical.

| Item | Value | Cost |
|---|---|---|
| TypeScript migration (frontend) | Strong signal | High (1-2 weeks) |
| Playwright E2E tests | Real product testing | 2-3 days |
| Multi-currency support | Genuinely interesting | 2-3 days |
| Mobile-responsive trading UI | Demonstrates rigor | 2 days |
| Public API documentation site (mkdocs) | Recruiter-facing | 1 day |
| Open-graph preview images for sharing | LinkedIn-friendly | half day |
| Loom video walkthrough in README | High recruiter conversion | 1 day |

---

## Cross-Cutting Practices

These apply throughout every phase.

### Commit hygiene
- One concern per PR (where "concern" = one phase task or one closely-related task group).
- Conventional Commits: `feat(scope):`, `fix(scope):`, `refactor(scope):`, `chore:`, `docs:`.
- PR description includes: what changed, why, audit/roadmap reference, screenshots for UI work.

### ADR discipline
- Before any consequential decision (one that's hard to undo), write an ADR draft.
- Discuss with yourself out loud — "alternative A, alternative B, why I'm picking A."
- Commit the ADR before the implementation.

### Performance budgets
- API p95 < 100ms for non-aggregating endpoints, < 300ms for portfolio/analytics.
- WS broadcast latency p95 < 50ms server-side.
- Frontend Lighthouse Performance > 85.
- Bundle size budget: <300 KB gzipped for the initial chunk.

### Security baseline
- No secret in code, ever.
- All inputs validated by Pydantic at the API boundary.
- All money math in Decimal.
- All user-scoped queries explicitly filter by user_id.
- Per-IP rate limit on auth endpoints (5 attempts / minute) — Phase 3.3.

### Documentation cadence
- Every phase ends with a doc update commit: roadmap status, ADRs written, README links updated.
- README is always accurate.

---

## Definition of Done (per phase)

A phase is **Done** when:

1. **All tasks completed** with code merged to `main`.
2. **All acceptance criteria pass** — manually verified or by automated test.
3. **CI is green** on the final commit of the phase.
4. **The system runs end-to-end** via `docker compose up`.
5. **Documentation reflects reality**: README, ADRs, this roadmap (status updated).
6. **Interview talking points are rehearsed** — you can verbalize the 3 talking points for the phase without referencing notes.

When 1-6 are all true, *and only then*, move to the next phase.

---

*End of Roadmap. The next step is execution: Phase 2.0 — Hygiene Sweep, starting now.*
