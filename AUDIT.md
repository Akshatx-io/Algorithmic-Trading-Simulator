# HFT Trading Platform — Phase 1 Audit

> **Status:** Brutal honesty mode. This document is the baseline truth of the codebase as of the audit date. Every finding cites file paths and line numbers from the working tree. Severity is assigned from the perspective of *(a) production correctness*, *(b) interview defensibility*, and *(c) recruiter-facing polish*.
>
> **Scope:** Backend (FastAPI + SQLAlchemy + ML + WebSocket), Frontend (React + Vite + Tailwind), Infra (Docker, Alembic, GitHub Actions), Testing, Git hygiene, Documentation.
>
> **Outcome:** The codebase has the *skeleton* of a serious system, but it is currently held together by duplicated logic, hardcoded secrets, schema drift, dead code, and a real-time pipeline that re-broadcasts the entire dataset every second. It is **not** production-defensible in its current state, and several findings would not survive a senior engineer's first 30 minutes of code review.
>
> The good news: the surface area is right, the domain modeling is roughly correct, and most of the rot is *localized*. A disciplined phased refactor (Phase 2 onward) can turn this into an interview-defensible platform without a full rewrite.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Severity Legend](#2-severity-legend)
3. [P0 — Critical Security & Correctness](#3-p0--critical-security--correctness)
4. [P1 — Architecture & Structural Defects](#4-p1--architecture--structural-defects)
5. [Backend Domain Audit](#5-backend-domain-audit)
6. [Frontend Domain Audit](#6-frontend-domain-audit)
7. [Real-Time / WebSocket Audit](#7-real-time--websocket-audit)
8. [Quant / ML Audit](#8-quant--ml-audit)
9. [Database & Migrations Audit](#9-database--migrations-audit)
10. [Infra, Docker & CI/CD Audit](#10-infra-docker--cicd-audit)
11. [Git Hygiene & Repo Cleanliness](#11-git-hygiene--repo-cleanliness)
12. [Naming, Code Style & Dead Code](#12-naming-code-style--dead-code)
13. [Testing Audit](#13-testing-audit)
14. [Documentation Audit](#14-documentation-audit)
15. [Top 25 Punchlist (Ordered by Risk)](#15-top-25-punchlist-ordered-by-risk)
16. [Architecture Verdict](#16-architecture-verdict)
17. [Bridge to Phase 2](#17-bridge-to-phase-2)

---

## 1. Executive Summary

The repository contains a partially-implemented full-stack simulator with a FastAPI backend, a Vite/React frontend, async background engines for market data and signals, a WebSocket layer, and an LSTM model file. The intent is clearly there. The execution is not.

**Headline findings:**

- **JWT secret is hardcoded** in `app/auth/jwt_handler.py` (`SECRET_KEY = "supersecretkey"`) and the `settings.jwt_secret_key` value is *never read* by the auth path. The "production guard" in `app/core/config.py` is bypassed entirely.
- **The ORM model and the Alembic migration disagree on the `positions` table.** Model column is `average_price` (`app/models/position.py:11`), migration column is `avg_price` (`alembic/versions/001_initial.py:70`). Any query through SQLAlchemy after a fresh migration will throw.
- **`app/api/routes.py` contains 1419 lines, of which ~960 are commented-out previous generations.** Three distinct versions of the same router are stacked on top of each other, and the "live" router at the bottom continues to import from modules that contain similar dead duplication.
- **`app/portfolio/pnl_engine.py` ships two complete implementations** — a class-based `PnLEngine` (lines 21–315) and a functional implementation (lines 437–587). Only the functional one is wired up; the class references columns (`pos.avg_price`) that don't exist on the model, so it would crash if ever called.
- **The real-time pipeline broadcasts the entire candle history every second.** `app/market/candle_engine.py` emits ~3,300 candle objects/second to every connected client (11 symbols × 3 timeframes × 100 candles), and `app/websocket/market_stream.py` duplicates that work in a separate task. The frontend then polls `/candles/{symbol}` via REST every 3 seconds on top of that.
- **`CandlestickChart.jsx` calls `series.setData(candles)` on every refresh** — full data replacement, not incremental update. **This is the flicker you described.**
- **Signal engine default sleep interval is 3600 seconds (1 hour).** `app/quant/signal_engine.py:359` reads `signal_update_interval` (not in settings), falls back to `model_update_interval` (default `3600`). So the "background loop" runs once per hour in default config.
- **Frontend has no Zustand and no TanStack Query** despite the brief listing both. State is a hand-rolled pub-sub class (`marketStore.js`) that is created but never imported by any component.
- **`AuthContext.jsx` is an empty file** (1 line).
- **`docker-compose.yml` has no frontend service**, and the backend Dockerfile does `COPY . .` without a `.dockerignore`, meaning `frontend/node_modules/` ships inside the production image.
- **`requirements.txt` pins `redis-py-cluster==2.1.3` and `passlib[bcrypt]==1.7.4`** — the former is deprecated and will fail to install on modern Python; the latter is the well-known bcrypt 4.x incompatibility footgun.
- **`hft.db` (SQLite binary), `logs/`, and `lstm_model.h5` are present in the working tree**, despite `.gitignore` rules. If they were ever committed, they need `git rm --cached`.

**Interview-defensibility verdict:** Currently fails. A senior interviewer asking *"walk me through what happens when a tick arrives"* would, within five minutes, surface (a) duplicated state in the broadcast, (b) the candle flicker, (c) the hardcoded JWT secret, and (d) the schema mismatch. None of these are debatable design choices; they are bugs.

**Recoverability verdict:** High. The folder layout is roughly right (`api/`, `market/`, `portfolio/`, `risk/`, `quant/`, `ml/`, `websocket/`). With targeted refactors — not a rewrite — this can be cleaned to a defensible state inside the 1–2 month window.

---

## 2. Severity Legend

| Severity | Meaning |
|----------|---------|
| **P0 — Critical** | Security hole, data corruption risk, immediate production failure, or guaranteed interview disqualifier. Fix before anything else. |
| **P1 — High** | Architectural defect, broken contract between layers, performance cliff, or feature that does not work as advertised. Fix in Phase 2. |
| **P2 — Medium** | Code smell, dead code, naming drift, missing abstraction. Will not break, but signals immaturity to reviewers. |
| **P3 — Low** | Cosmetic, polish, optional. Worth doing for portfolio shine, deferrable. |

---

## 3. P0 — Critical Security & Correctness

### 3.1 [P0] Hardcoded JWT secret bypasses configuration system
**File:** `app/auth/jwt_handler.py:4`
```python
SECRET_KEY = "supersecretkey"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60
```
**Root cause:** The auth handler defines its own module-level constants and never reads `app.core.config.settings`. Meanwhile `config.py:48` defines `jwt_secret_key` and `config.py:145-150` includes a validator that raises if the secret still contains "change-this" in production. That validator is **dead** because nothing else consumes `settings.jwt_secret_key`.

**Impact:** (a) Any attacker who reads the open-source repo can forge tokens. (b) The whole configuration story is a lie — the value in `.env` is irrelevant to authentication. (c) Token expiry is also inconsistent: 60 minutes here vs. 24 hours in settings vs. JWT TTL claimed in WebSocket auth path.

**Required fix (Phase 2.1):** Auth module must consume `settings.jwt_secret_key`, `settings.jwt_algorithm`, `settings.jwt_expiration_hours`. Refresh-token flow (`settings.jwt_refresh_hours`) needs to actually exist — it is referenced in config but has no implementation.

---

### 3.2 [P0] ORM model and Alembic migration disagree on `positions` schema
**Files:**
- `app/models/position.py:11` → `average_price = Column(Float)`
- `alembic/versions/001_initial.py:70` → `sa.Column('avg_price', sa.Float(), nullable=False)`
- `alembic/versions/001_initial.py:71` → `sa.Column('current_price', sa.Float(), nullable=True)` *(not in model)*
- `alembic/versions/001_initial.py:72` → `sa.Column('signal', sa.String(), nullable=True)` *(not in model)*
- `alembic/versions/001_initial.py:73-74` → `created_at`, `updated_at` *(not in model)*

**Root cause:** The migration was written against an *earlier* (or *aspirational*) version of the Position model. The current model has fewer columns and uses a different name for the primary economic field.

**Impact:** Running `alembic upgrade head` on PostgreSQL and then issuing any `db.query(Position)` will fail with `UndefinedColumn: column positions.average_price does not exist`. The system currently "works" only because it falls back to `Base.metadata.create_all` (in `app/core/database.py:21`) which builds the schema from the model, ignoring the migration. **That means Alembic is for show — migrations have never actually been applied.**

**Required fix (Phase 2.2):** Reconcile model and migration. Decide canonical names (`avg_price` is conventional in quant systems). Regenerate baseline migration. Drop `metadata.create_all` from production startup; rely entirely on `alembic upgrade head`.

---

### 3.3 [P0] `app/api/routes.py` contains 3 stacked generations of the router
**File:** `app/api/routes.py` (1419 lines total)
- **Lines 1–488**: Commented-out generation #1 (uses `query(User)` directly, contains its own Pydantic response models inline).
- **Lines 493–948**: Commented-out generation #2 (uses dataclass-style mixed in with routes, includes a half-finished limit-order block at lines 493–613).
- **Lines 960–1419**: Live router (the one actually imported by `main.py`).

**Impact:**
- File is unreadable. Code review is impossible.
- Git diffs are noise.
- Risk of "Frankenstein resurrection" — a future developer (you, in 3 weeks) un-comments part of the wrong generation.
- Several of the commented endpoints reference modules and functions that have since been renamed (`get_safe_price`, `calculate_unrealized_pnl` two-arg form, etc.).

**Required fix (Phase 2.2):** Delete everything from line 1 to line 959. Then *split* the live router into separate routers per domain — `api/v1/auth.py`, `api/v1/portfolio.py`, `api/v1/trading.py`, `api/v1/market.py`, `api/v1/signals.py`, `api/v1/websocket.py` — and aggregate in `api/v1/__init__.py`. This is the FastAPI-idiomatic structure.

---

### 3.4 [P0] Two complete `PnLEngine` implementations in one file, only one wired up
**File:** `app/portfolio/pnl_engine.py`
- **Lines 21–315**: `class PnLEngine` (object-oriented, comprehensive, references `pos.avg_price`, `pos.updated_at`, `pos.signal`, `pos.current_price` — *fields that do not exist on the current `Position` model*).
- **Lines 437–587**: Functional implementation using FIFO realized PnL accounting (references `pos.average_price` — correct against the current model).

**Impact:**
- The class would crash on first call (`AttributeError: 'Position' object has no attribute 'avg_price'`).
- The class is exported and importable but never imported.
- The two implementations produce *different numbers* for realized PnL: the class uses weighted-average cost basis with a min/clamp on quantity, the functional version uses FIFO lot matching. These are not equivalent in a tax/audit sense, and the file gives no signal which is "correct."
- Risk: a future developer imports `PnLEngine` thinking it's the canonical engine.

**Required fix (Phase 2.4):** Delete the class. Keep FIFO. Promote it to `app/portfolio/services/pnl_service.py`. Add a comment explaining cost-basis choice (FIFO vs LIFO vs WAC) — this is an *interview talking point*: cost-basis methodology matters in real finance.

---

### 3.5 [P0] Signal engine background loop sleeps 1 hour by default
**File:** `app/quant/signal_engine.py:359-361`
```python
interval = getattr(settings, "signal_update_interval",
                getattr(settings, "model_update_interval", 10))
```
**Root cause:** `settings.signal_update_interval` does **not exist** in `app/core/config.py`. The fallback `settings.model_update_interval` **does** exist and defaults to `3600` (line 128 of config.py). So the background signal loop sleeps 3600 seconds between iterations.

**Impact:** The "real-time" signal engine effectively never updates. Signals you see on the dashboard are computed once at startup and then refreshed once per hour.

**Required fix (Phase 2.5):** Add `signal_update_interval: int = 10` to settings. Default of 10s is reasonable for sim; consider making per-symbol with a priority queue in Phase 4.

---

### 3.6 [P0] Tests are not real tests and one is provably broken
**Files:** `tests/test_api.py`, `tests/conftest.py`
- `test_health_check` (line 8) asserts the response contains `environment`. The actual `/health` response in `main.py:199-208` contains `status`, `database`, `version` — **no `environment` field**. This test will fail the first time it is run.
- `tests/conftest.py:55-59` defines an `event_loop` fixture using `asyncio.get_event_loop_policy().new_event_loop()`. This is deprecated in pytest-asyncio 0.21+ (which is what `requirements.txt` pins) — emits a `DeprecationWarning` that becomes an error under strict mode.
- The CI workflow runs `pytest --cov=app --cov-report=xml` against these three tests. **Code coverage is reported as a number derived from three lines of HTTP smoke testing.** This is worse than no tests — it produces false confidence.

**Required fix (Phase 2.7):** Build a real test pyramid (unit → integration → e2e). Minimum Phase 2 coverage: auth happy/sad path, PnL FIFO correctness with hand-computed fixture, execution engine atomicity (concurrent BUY race), risk engine boundary conditions.

---

### 3.7 [P0] `requirements.txt` cannot be installed on a fresh Python 3.13 environment
**File:** `requirements.txt`
- Line 31: `redis-py-cluster==2.1.3` — **abandoned** package. Its install requires `redis<4.0`, conflicts with line 30 `redis==5.0.1`. Modern Redis cluster support lives in `redis.cluster` inside the `redis` package itself.
- Line 13: `passlib[bcrypt]==1.7.4` — passlib has been unmaintained since 2020 and the bundled bcrypt 4.x compatibility has a well-known `AttributeError: module 'bcrypt' has no attribute '__about__'` warning that breaks under strict environments.
- Line 20: `tensorflow==2.14.0` + line 18: `numpy==1.24.3` — this combination requires `protobuf<5`, which conflicts with several other deps. TF 2.14 is also Python 3.11 only; CI uses 3.11 but local dev on 3.12/3.13 will fail.
- Lines 62: `celery==5.3.4` — **dead dependency**. Grep shows zero usages.
- Line 61: `apscheduler==3.10.4` — **dead dependency**. Zero usages.
- Lines 8–9: Both `psycopg2-binary` and `asyncpg` listed; codebase only uses `psycopg2` (via SQLAlchemy sync engine), `asyncpg` is imported nowhere.
- Line 26: `yfinance==0.2.18` — over 18 months old; yfinance API has had several breaking changes since.

**Impact:** `pip install -r requirements.txt` likely fails on a fresh machine, and even when it succeeds it pulls 2 GB of TensorFlow + Keras for an engine that calls `predict()` once.

**Required fix (Phase 2.0):** Switch to `pyproject.toml` with hashed lockfile (`uv` or `pip-tools`). Split runtime vs dev. Replace TF with ONNX Runtime if ML stays; drop celery/apscheduler/redis-py-cluster/asyncpg.

---

### 3.8 [P0] `main.py` `safe_task` wrapper has restart-storm logic
**File:** `main.py:44-59`
```python
async def safe_task(name: str, coro):
    while True:
        try:
            logger.info(f"🚀 Starting {name}")
            result = coro()
            if inspect.isawaitable(result):
                await result
            else:
                await asyncio.sleep(1)
        except asyncio.CancelledError:
            ...
            break
        except Exception as e:
            ...
            await asyncio.sleep(2)
```
**Root cause:** The `else` branch (for sync `coro()` that doesn't return an awaitable) sleeps 1 second and then loops, which means **the synchronous engine is "started" once and then the wrapper just spins re-printing "Starting X" every 2 seconds for the application lifetime**. If `start_signal_engine` ever returned synchronously (it doesn't today, but it could), you would get a log-spam denial-of-service.

The current four background engines (`start_market_data_engine`, `start_candle_engine`, `start_signal_engine`, `start_market_stream`) are all async, so the bug is latent — but it is the kind of bug a senior engineer asks about.

**Required fix (Phase 3.1):** Replace `safe_task` with a proper `Supervisor` pattern: tasks are registered with a name, a `start` callable, restart policy (exponential backoff capped), and shutdown timeout. Use `asyncio.TaskGroup` (Python 3.11+) for structured concurrency.

---

### 3.9 [P0] CORS is hardcoded, the configured value is commented out
**File:** `main.py:139-144`
```python
app.add_middleware(
    CORSMiddleware,
    # allow_origins=settings.cors_origins,
    allow_origins=["http://localhost:5173"],  # frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```
**Impact:** A staging or production deploy with a different frontend origin will be silently blocked by CORS. The `cors_origins` setting (config.py:59-62) exists but is dead code.

**Required fix (Phase 2.2):** Uncomment, parse from env as a `List[str]`, document required format.

---

### 3.10 [P0] `TrustedHostMiddleware` uses placeholder hostnames
**File:** `main.py:147-150`
```python
if settings.environment == "production":
    app.add_middleware(
        TrustedHostMiddleware,
        allowed_hosts=["yourdomain.com", "*.yourdomain.com"],
    )
```
**Impact:** Any production deploy is broken out-of-the-box. The "production guard" doesn't protect anything because the allowed hosts are literal placeholders.

---

### 3.11 [P0] Frontend `AuthContext.jsx` is an empty file
**File:** `frontend/src/context/AuthContext.jsx` (1 line, empty)
The file exists, contributes to the import graph, and a future developer will assume there is an auth context here. There isn't. Auth state lives in `localStorage` and is checked imperatively via `isAuthenticated()` from `authService.js` (which we couldn't even confirm exists with a real implementation — it's referenced in `App.jsx:48`).

**Impact:** Auth state is **not reactive**. After login, components that already mounted with `isAuthenticated() === false` will not re-render when the token arrives. The only thing that "fixes" this is a hard navigation (which the login page probably does, but that's a brittle pattern).

**Required fix (Phase 2.6):** Build a real auth store (Zustand slice) with login/logout/refresh actions, plus a `useAuth()` hook that triggers re-render on state change.

---

### 3.12 [P0] Frontend has no Zustand, no React Query — brief says it must
**File:** `frontend/package.json:12-20`
```json
"dependencies": {
  "axios": "^1.13.5",
  "framer-motion": "^12.35.2",
  "lightweight-charts": "^5.1.0",
  "react": "^19.2.0",
  "react-dom": "^19.2.0",
  "react-router-dom": "^7.13.1",
  "recharts": "^3.8.0"
}
```
**No `zustand`. No `@tanstack/react-query`. No date library. No testing library. No TypeScript.**

**Impact:** Every data-fetching hook (`usePortfolio`, `useMarket`, `usePerformance`) is hand-rolled. There is no cache invalidation strategy, no stale-while-revalidate, no request deduplication, no retry policy. The `marketStore.js` is a custom pub-sub class — its existence is fine, but `useMarket.js:14-101` doesn't even use it (`marketStore` is exported but never imported by any component).

**Required fix (Phase 2.6):** Install Zustand for client state, TanStack Query for server state, Vitest + Testing Library for tests. Phase 4 should introduce TypeScript.

---

## 4. P1 — Architecture & Structural Defects

### 4.1 [P1] No clear service / repository layering in the backend
**Files:** `app/api/routes.py`, `app/portfolio/pnl_engine.py`, `app/execution/execution_engine.py`

The current backend has only two layers: **API handlers** (in `routes.py`) and **engines** (`pnl_engine.py`, `execution_engine.py`, `signal_engine.py`, `market_data_engine.py`, etc.).

There is no:
- **Repository layer**. SQLAlchemy queries are written inline in engines and route handlers (`execution_engine.py:147-155`, `pnl_engine.py:493`).
- **Service layer** with transaction boundaries. `routes.py:1170` calls `execute_trade(db, user.id, request)` which internally commits — but then `routes.py:1179` calls `record_equity_snapshot(db, user.id)` and **commits again**. Two commits per request, no rollback semantics if the snapshot fails.
- **Domain / dto separation**. Pydantic schemas live in `app/schemas/`, ORM models in `app/models/`, but nothing in between — handlers return ORM-shaped dicts directly.

**Why this matters for interviews:** "Walk me through how you separate concerns" is asked in every backend interview. The current answer would be: "concerns are not separated."

**Phase 3 target:** introduce `app/services/` (orchestration with transaction context manager), `app/repositories/` (all SQLAlchemy lives here), keep `app/engines/` for stateful background workers, keep route handlers as thin HTTP-to-service adapters.

---

### 4.2 [P1] Two background tasks broadcast the same data
**Files:** `app/market/market_data_engine.py:328-352`, `app/websocket/market_stream.py:105-115`, `app/market/candle_engine.py:294-325`

- `start_market_data_engine` fetches prices and broadcasts `{"type": "market_batch", "payload": [...]}`.
- `start_market_stream` runs a separate loop that reads the same `market_state`, attaches the last 100 candles, and broadcasts `{"type": "market_update", "data": [...]}`.
- `start_candle_engine` separately broadcasts `{"type": "candle_update", "candles": [...100]}` for each `(symbol, timeframe)` combination every second.

The frontend (`useMarket.js:57-66`) subscribes to both `market_batch` and `market_update` and merges them into the same buffer. The candle messages are not handled by `useMarket` at all — they're dropped, but still cost bandwidth.

**Bandwidth math:** 11 symbols × (3 timeframes × 100 candles × ~80 bytes) = ~264 KB **per second per connected client** of redundant candle data, on top of the price ticks. With 10 clients you're at 2.6 MB/s of pure waste.

**Phase 3 target:** Collapse into a single broadcast pipeline with topic-based subscriptions. Frontend subscribes to specific symbols; backend pushes incremental deltas (`{"type": "tick", "symbol": "AAPL", "price": 182.41, "ts": ...}`), and candles are pushed only when a candle *closes*, with an additional `candle_update` event for the *active* candle's OHLC mutation.

---

### 4.3 [P1] Two threading models fighting in the same process
**Files:** `app/quant/signal_engine.py`, `app/market/market_state.py`, `main.py`

- `signal_engine.py:68-76` creates a `ThreadPoolExecutor` and runs the signal loop in a **dedicated OS thread** (`threading.Thread(target=self._loop, daemon=True).start()` at line 386).
- The signal loop calls `time.sleep(interval)` — blocking sleep inside a daemon thread.
- Meanwhile `main.py:92` wraps `start_signal_engine` in `asyncio.create_task` and `safe_task` — so an async wrapper is babysitting a thread that spins on its own.
- `market_state.py:101` uses `threading.Lock()` — correct for multi-threaded access, but called from the asyncio event loop in `market_data_engine.py` it will block the loop for the duration of the lock hold (microseconds, but still — and `pnl_engine.calculate_unrealized_pnl` calls `get_safe_price` which can fall back to `fetch_stock_data` which can block for **seconds**, see 5.3 below).

**Why this matters:** Interviewers will ask "is your backend asyncio or threaded?" and the honest answer is "both, by accident." That's bad.

**Phase 3 target:** Pick one. Recommend **asyncio everywhere**, run synchronous yfinance calls in `asyncio.to_thread`, replace `time.sleep` with `await asyncio.sleep`, replace `threading.Lock` with `asyncio.Lock` where the lock is held across awaits.

---

### 4.4 [P1] `market_state` is a singleton in-memory cache shared by every layer
**File:** `app/market/market_state.py`

Every layer touches the singleton:
- `market_data_engine.update_price` writes.
- `candle_engine.update_candle` writes.
- `signal_engine.update_signal` writes.
- `execution_engine.get_price` reads.
- `routes.market_symbol` reads *and* writes (line 1255 of routes.py, where REST handler updates state from a yfinance fetch).
- `pnl_engine` reads via `get_safe_price`.

This is acceptable for a single-process dev server, but it has zero replication story. If you scale to 2+ uvicorn workers (`settings.workers > 1`), each worker has its own `market_state` and signals diverge. The same is true for any horizontal scaling. **This is why Redis pub/sub or Kafka is on the brief.**

**Phase 4 target:** Make `MarketState` an interface with an in-memory implementation (current behavior) and a Redis-backed implementation. Selected by config. This is the kind of seam interviewers love — "I chose the strategy pattern here so we can swap in Redis without touching the engines."

---

### 4.5 [P1] WebSocket has no per-user / per-channel addressing
**File:** `app/websocket/manager.py:67-99`

The `ConnectionManager` is a flat `Set[WebSocket]`. Every message goes to every connected client. There is:
- No `send_to_user(user_id, msg)`.
- No `subscribe(client, topic)`.
- No `unsubscribe(client, topic)`.
- No bandwidth metric per client.
- No max-message-size guard.

The `subscribe` message type *is* handled in `routes.py:1390`, but it only logs the channel and sends `{"type": "subscribed", "channel": ...}` back — it does **nothing** to filter subsequent broadcasts.

**Impact:**
- Every user sees every signal.
- A user trading AAPL receives broadcasts for NFLX too.
- No way to push portfolio updates to a single user (you would broadcast every user's PnL to everyone — privacy disaster in a real system).

**Phase 3 target:** Topic-based pub/sub inside `ConnectionManager`. Map `WebSocket → Set[str]` (subscribed topics) and `topic → Set[WebSocket]`. Per-user channels via `user:{id}` topics.

---

### 4.6 [P1] No event bus — broadcasts are triggered ad-hoc from engines
**Cross-cutting**

Right now:
- `market_data_engine` calls `manager.broadcast(...)` directly.
- `candle_engine` calls `manager.broadcast(...)` directly.
- `market_stream` calls `manager.broadcast(...)` directly.
- `execution_engine` does **not** push trade fills to WebSocket — so the frontend never gets a trade confirmation push and has to refetch.

This is the symptom of a missing **event bus**. Engines should emit domain events (`PriceUpdated`, `CandleClosed`, `TradeFilled`, `SignalGenerated`, `PositionChanged`) and a single dispatcher routes them to subscribers (the WebSocket manager being one of many — analytics, persistence, alerting, etc., would all subscribe).

**Phase 4 target:** Introduce an in-process event bus first (a simple `asyncio.Queue`-backed dispatcher). Phase 5+ swap for Redis pub/sub or Kafka.

---

### 4.7 [P1] Execution engine has no order types, no idempotency, no audit trail
**File:** `app/execution/execution_engine.py:138-246`

- Only "instant market" execution. No limit, no stop, no stop-limit, no IOC/FOK. The frontend brief asks for all of these.
- No `client_order_id` / idempotency key. The API client sends a `X-Request-ID` header (`apiClient.js:63`) but the backend doesn't read it.
- `with_for_update()` (line 147) is a no-op on SQLite. On PostgreSQL it would lock the user row — but two concurrent BUYs from the same user would still race because the `Position` row isn't locked.
- Float math for money throughout. Should be `Decimal` end-to-end with explicit quantization.
- `db.commit()` at line 235 commits the trade *and* the position update — good, that's atomic — but `record_equity_snapshot` in `routes.py:1179` is a separate transaction, so if the snapshot fails the trade is still recorded.

**Phase 3 target:** Order state machine (`PENDING → OPEN → FILLED | PARTIAL | CANCELLED | REJECTED`), order book for limit orders, OCO support, single transaction boundary in the service layer.

---

### 4.8 [P1] No risk engine integration that actually blocks trades
**File:** `app/risk/risk_engine.py` (referenced from `routes.py:1157`)

The risk engine is called with `check_risk_limits(db, user.id, request.symbol, request.action, request.quantity, price)` and the route raises 400 if it returns false — but I have not yet read the implementation. From the call site, the function is a **pure boolean gate**, with no breakdown of which limit was breached. A real risk module returns structured violations (`MaxPositionExceeded`, `MaxDailyLossExceeded`, `ConcentrationLimit`, `LeverageLimit`, `CircuitBreakerActive`) so the frontend can render specific UX.

**Phase 3 target:** Risk module returns a `RiskAssessment` dataclass with violations list, severity, and remediation hints.

---

## 5. Backend Domain Audit

### 5.1 [P1] `app/core/database.py` defines `create_tables` before `Base`
**File:** `app/core/database.py:15-22`, then `Base = declarative_base()` at line 42.
The function works at call time (because it's lazy), but reading top-to-bottom is confusing. Also, calling `Base.metadata.create_all` in production *defeats* Alembic — see 3.2.

### 5.2 [P1] `init_database` and `create_tables` are both called at startup
**File:** `main.py:76-77`
```python
await asyncio.to_thread(init_database)
await asyncio.to_thread(create_tables)
```
This is fine for dev, but `create_tables` should never run in production — migrations are the source of truth.

### 5.3 [P1] `get_safe_price` falls back to synchronous yfinance fetch on every position
**File:** `app/portfolio/pnl_engine.py:467-485`
```python
def get_safe_price(symbol: str):
    try:
        price = market_state.get_price(symbol)
        if price is None:
            data = fetch_stock_data(symbol)
            price = float(data["close"].iloc[-1])
        ...
```
When `market_state` doesn't have a price (cold start, missed tick), this blocks on a `yf.download(...)` for several seconds — **inside a synchronous SQLAlchemy session, holding a DB connection**. With 5 positions and a cold cache, a single `/portfolio` request blocks for 25+ seconds.

**Phase 2 target:** Never fall back to network in the request path. Return last-known price with a `stale: true` flag, let the frontend show it greyed out.

### 5.4 [P2] `fetch_stock_data` cache key ignores interval
**File:** `app/market/fetch_stock_data.py:67-89`
```python
CACHE = {}
CACHE_TTL = 5
...
if symbol in CACHE:
    data, ts = CACHE[symbol]
```
Cache key is just `symbol`. A `1m` call and a `15m` call for AAPL share the same cache slot — whichever populated first wins. This silently returns wrong-timeframe data.

**Fix:** `CACHE[(symbol, interval)] = (data, ts)`.

### 5.5 [P1] yfinance rate limit will be hit at the current poll rate
**File:** `app/market/market_data_engine.py:238` `FETCH_INTERVAL = 2`
11 symbols × every 2 seconds = 330 requests/minute to Yahoo. The cache helps (TTL 5s) so it's effectively 11 × 12 = 132/min after the cache stabilizes — still aggressive. yfinance's unofficial limit is around 60/minute before throttling.

**Phase 2 target:** Stagger fetches across symbols, increase `FETCH_INTERVAL`, or add a synthetic tick generator for demo mode (no external dependency = better demo).

### 5.6 [P1] `BATCH_BROADCAST_INTERVAL` is declared but never used
**File:** `app/market/market_data_engine.py:239`
Dead constant.

### 5.7 [P2] `signal_engine.cache_ttl = 30` but the loop force-regenerates every iteration
**File:** `app/quant/signal_engine.py:66, 357-377`
The cache check at line 301-304 is short-circuited because the background loop calls `generate(s)` without `force=True`, but the loop runs more often than the cache TTL — so the cache check is meaningful in steady state, *except* the loop sleeps 3600 seconds by default (see 3.5). Net effect: cache is irrelevant.

### 5.8 [P2] `signal_engine.get_all_signals` regenerates every signal synchronously in the request thread
**File:** `app/quant/signal_engine.py:337-338`
`get_all_signals` → `get(symbol)` → `generate(symbol)` → factors + ML + risk computation for every symbol. For 10 symbols this can take 5+ seconds depending on yfinance latency. The `GET /signals` endpoint will be very slow.

### 5.9 [P2] `predictor.py` clamps ML output to [-1, 1] but the LSTM was trained on raw returns
**File:** `app/ml/predictor.py:103`
```python
return max(min(value, 1.0), -1.0)
```
Returns are bounded much tighter (typically -0.05 to 0.05 for 1m data). Clamping to ±1 is a no-op for any well-behaved output and hides bad outputs that would otherwise signal model breakage.

### 5.10 [P0/P1] Training script imports modules that do not exist
**File:** `app/ml/training/train_lstm.py:2-3`
```python
from app.quant.preprocess_data import create_features, create_sequences
from app.quant.build_lstm_model import build_lstm_model
```
Neither `preprocess_data.py` nor `build_lstm_model.py` exist in `app/quant/`. The only artifact suggesting they ever existed is `app/quant/__pycache__/build_lstm_model.cpython-313.pyc` — a *compiled* file with no source. This means the source was deleted but the bytecode was committed.

Also: `model.save("app/quant/lstm_model.h5")` saves to a different path than `settings.model_path = "app/ml/models/lstm_model.h5"`.

**Impact:** The training pipeline is non-executable. There is no reproducible way to regenerate the `.h5` file. The model in the repo is effectively a binary opaque blob.

**Phase 5 target:** Either (a) delete the ML entirely and use simple factor signals (defensible: "I deferred ML to focus on real-time architecture"), or (b) rebuild the training pipeline from scratch with explicit feature engineering, train/val/test split, and a model card.

### 5.11 [P2] Settings validator raises if model file is missing
**File:** `app/core/config.py:152-157`
```python
@field_validator("model_path")
def validate_model(cls, v):
    if not Path(v).exists():
        raise ValueError(f"Model not found: {v}")
    return v
```
This makes the entire FastAPI app fail to import if `lstm_model.h5` is missing — even when `settings.model_load_on_startup = False`. Contradictory. The predictor (`predictor.py:52-58`) already handles missing-file gracefully; the validator is overly aggressive.

### 5.12 [P2] `__pycache__/` directories at repo root and in `app/quant/`
Both should be in `.gitignore` (they are — line 2). But they exist in the working tree, suggesting someone ran Python from the repo root with cached bytecode being committed at some point. Stale `.pyc` files are a known source of "phantom imports."

---

## 6. Frontend Domain Audit

### 6.1 [P0] CandlestickChart full data replacement causes flicker
**File:** `frontend/src/components/charts/CandlestickChart.jsx:167-175`
```javascript
useEffect(() => {
  if (!seriesRef.current) return;
  if (!candles.length) {
    seriesRef.current.setData([]);
    return;
  }
  seriesRef.current.setData(candles);
  chartRef.current?.timeScale().fitContent();
}, [candles]);
```
`setData()` is the lightweight-charts method for replacing the entire series. It is correct for initial load only. For tick updates, you should call `series.update({ time, open, high, low, close })` — that mutates only the last bar and is repaint-free.

Combined with `fitContent()` being called on every refresh, the user's pan/zoom is **reset every 3 seconds** (see 6.2).

### 6.2 [P0] CandlestickChart polls REST every 3 seconds
**File:** `frontend/src/components/charts/CandlestickChart.jsx:81-101`
```javascript
const id = setInterval(fetchCandles, 3000);
```
This defeats the entire WebSocket architecture. The chart should:
- Fetch historical candles **once** on mount (`/candles/{symbol}`).
- Subscribe to the WebSocket `tick` / `candle_close` events for that symbol.
- Call `series.update(...)` for in-progress candle, `series.update(closedCandle)` when a candle closes.

### 6.3 [P1] `useMarket` re-renders all consumers on every throttle tick
**File:** `frontend/src/hooks/useMarket.js:71-86`
The hook calls `setData(values)` every 100ms. Any component using `useMarket` re-renders 10x/second. With Dashboard rendering 11 ticker cards + sub-charts, that's a lot of reconciliation. React can usually handle this, but on lower-end machines this *will* drop frames.

**Fix:** Move market state into Zustand with shallow selectors so components subscribe only to the slice they need (e.g., `useMarketStore(s => s.bySymbol['AAPL'])`).

### 6.4 [P1] `useMarket` sorts on every tick
**File:** `frontend/src/hooks/useMarket.js:79-81`
```javascript
const values = Object.values(bufferRef.current)
  .slice(0, MAX_SYMBOLS)
  .sort((a, b) => String(a.symbol).localeCompare(String(b.symbol)));
```
O(n log n) sort × 10 times per second × every consumer of the hook. For 11 symbols it's negligible; the smell is the unnecessary work being done on every tick when sort order doesn't change.

### 6.5 [P1] App.jsx has two `Route path="/"` declarations
**File:** `frontend/src/App.jsx:133-148` and `155-162`
The second declaration is unreachable (first wins by registration order). Dead code.

### 6.6 [P1] `apiClient.js` has 60 lines of commented-out interceptor
**File:** `frontend/src/services/apiClient.js:75-135`
Same Frankenstein problem as the backend `routes.py`. Delete.

### 6.7 [P2] `apiClient` sends `X-Request-ID` header that the backend ignores
**File:** `frontend/src/services/apiClient.js:62-64`
Comment says "Prevent duplicate POST (important for trading)" — but the backend doesn't read this header, so it doesn't prevent anything. Either implement server-side idempotency (3.7) or remove the misleading code.

### 6.8 [P2] WebSocket auth token sent in query string
**File:** `frontend/src/services/websocket.js:59`
```javascript
this.socket = new WebSocket(`${this.baseURL}?token=${token}`);
```
Query-string tokens are logged by every reverse proxy and uvicorn's access log by default. This is the standard browser limitation (WebSocket doesn't support custom headers in browser), so the workaround is fine **if** you have access-log filtering. Document this; better yet, switch to a short-lived WS-specific token issued by `/auth/ws-token` so the actual JWT never appears in logs.

### 6.9 [P2] Dashboard uses ₹ (rupee) symbol on US stocks
**File:** `frontend/src/components/charts/CandlestickChart.jsx:186`, `frontend/src/pages/Dashboard.jsx:261`
```javascript
{m.symbol}: ₹{safeNumber(m.price).toFixed(2)}
```
Cosmetic, but jarring. AAPL is priced in USD. Use a currency formatter (Intl.NumberFormat) parameterized by symbol metadata.

### 6.10 [P2] No error boundaries below the root
**File:** `frontend/src/App.jsx:82-115`
The single root-level `ErrorBoundary` is not even rendered (it's defined but `App()` doesn't wrap `Suspense` in it). A chart crash takes down the whole dashboard. Wrap each major feature (Charts, Portfolio, Trade panel) in its own boundary.

### 6.11 [P2] `marketStore.js` is defined but unused
**File:** `frontend/src/store/marketStore.js`
83 lines of custom pub/sub. Nothing imports it. The intent appears to have been "later I'll wire useMarket through this", which never happened.

**Fix:** Either delete or replace with Zustand and use it.

### 6.12 [P3] No `.env.example` in frontend
**File:** `frontend/` (missing)
`websocket.js:24` reads `VITE_WS_URL`, `apiClient.js:7` reads `VITE_API_URL`. New devs won't know to set these.

### 6.13 [P3] No TypeScript
With React 19 + react-router 7 the world has moved to TypeScript by default for serious apps. JS is fine for a learning project; *for an interview portfolio*, TS is a stronger signal. Defer to Phase 5.

### 6.14 [P3] No tests, no Vitest, no Testing Library
The CI workflow runs `npm test`, but `package.json:6-11` defines no `test` script. CI is broken.

---

## 7. Real-Time / WebSocket Audit

Summary of the real-time pipeline as it stands:

```
[yfinance HTTP] → market_data_engine (async, every 2s)
                    ↓
                market_state (in-memory, threading.Lock)
                    ↓                ↓                   ↓
            candle_engine     market_stream      signal_engine
            (every 1s)        (every 1s)         (every 3600s default!)
                    ↓                ↓                   ↓
        manager.broadcast (flat fan-out, no topics, no per-user)
                                 ↓
                            All WebSocket clients
```

**Cumulative problems:**
- **No incremental updates** — full snapshots every second (issue 4.2).
- **No topic filtering** — every client gets everything (issue 4.5).
- **No backpressure** — `asyncio.gather(*send_calls)` will block the broadcast loop if any client is slow (`manager.py:96-99`).
- **No client identity** — broadcasts are anonymous; no `user_id` association in `ConnectionManager`.
- **No connection-level rate limiting** — a single malicious client sending 1000 ping/sec would be processed serially (`routes.py:1366-1407`).
- **No max message size** — `await websocket.receive_text()` happily accepts megabytes.
- **Reconnect is on the client only** — the server has no awareness that a reconnected socket is "the same client" as before, so session state cannot be resumed.
- **No subscription persistence** — the client's `{type: "subscribe", channel: "market"}` is acknowledged but stored nowhere. After reconnect the client has to re-subscribe (which it does, in `websocket.js:72-76` — but the server-side has no state, so this works by accident).
- **Heartbeat is one-directional** — client sends ping, server sends pong (`routes.py:1380-1384`). Server never sends an unsolicited ping. If the client process freezes but the TCP socket stays open, the server has no way to detect it.

**Phase 3.3 target:** Document a real WS protocol. Versioned message envelope `{v: 1, type: "...", id: "...", ts: ..., data: ...}`. Topic-based subscriptions. Server-initiated heartbeats with timeout-driven disconnects. Per-client sequence numbers so the client can request a replay on reconnect.

---

## 8. Quant / ML Audit

### 8.1 [P1] Factor implementations live in `app/quant/factors/` — not reviewed in this audit (out of scope), but signal engine treats them as numeric scalars in [-1, 1]. Need to verify each factor function is normalized — if `trend_factor` returns a raw slope coefficient, the linear combination at `signal_engine.py:176-180` is mathematically meaningless.

### 8.2 [P1] Signal scoring is a hardcoded linear combination
**File:** `app/quant/signal_engine.py:174-210`
```python
factor_score = (0.25*f["trend"] + 0.20*f["mean_reversion"] + 0.30*f["momentum"])
final_score = 0.6*factor_score + 0.4*ml
```
- Weights sum to 0.75 (not 1.0) — typo, or "volatility is intentionally excluded" is undocumented.
- Static weights — no calibration, no regime switching, no learning.
- ML prediction is given 40% weight even when ML returns 0.0 (the safe-fallback). So when the model is missing, every signal is biased toward 0.6 × factor_score.

**Phase 4 target:** Replace linear combination with a calibrated meta-model (logistic regression on factor outputs to predict realized 1-bar returns, or a small gradient boost). Document the calibration procedure.

### 8.3 [P0] No actual training pipeline (see 5.10).

### 8.4 [P1] No feature store, no feature versioning, no train/serve skew detection
For a "production ML" claim, you need:
- A deterministic feature pipeline that produces identical features at training and inference time (currently the predictor receives a DataFrame and presumably calls `model.predict` on raw OHLC — but I didn't see the feature engineering step; if it's "raw OHLC into LSTM", that's a different concern).
- A model registry with hashes and metadata.
- Train/serve skew tests in CI.

This is a real differentiator for ML/quant roles — even a stubbed version of this is impressive.

### 8.5 [P2] LSTM model file is committed in git
**File:** `app/ml/models/lstm_model.h5` (binary blob)
The Keras .h5 format is not git-friendly. Use Git LFS or, better, host the model in S3 / Hugging Face / a GitHub Release and download on startup with a checksum check.

### 8.6 [P1] `backtesting.py` exists but not reviewed
**File:** `app/ml/backtesting.py` — needs audit in Phase 2.

### 8.7 [P1] `decision_logic.py` exists but not wired
**File:** `app/quant/decision_logic.py` — appears to be a third signal-generation path beyond `signal_engine.py`. If unused, delete; if intended, document.

---

## 9. Database & Migrations Audit

### 9.1 [P0] Model/migration schema drift (see 3.2).
### 9.2 [P0] `metadata.create_all` is called at startup, defeating Alembic (see 3.2).
### 9.3 [P1] Single `001_initial.py` migration with no follow-up
The migration was clearly hand-written, not autogenerated. After the model changed (e.g., `created_at` added to User), no migration was generated. The team's workflow is "edit model, restart, `create_all` rebuilds schema." That works in dev, blows up in production.

### 9.4 [P1] No connection pool sizing rationale
**File:** `app/core/config.py:36-37`
```python
database_pool_size: int = 20
database_max_overflow: int = 30
```
50 connections for a 1-worker uvicorn. PostgreSQL default `max_connections` is 100; with multiple workers + Alembic + admin tools, you'll hit the cap. Justify the numbers or compute them: `(workers × pool_size) + headroom`.

### 9.5 [P1] No transaction context manager in services
SQLAlchemy sessions are obtained via `Depends(get_db)` — fine for HTTP handlers. But engines (`execution_engine`, `pnl_engine`) receive `db: Session` directly and commit eagerly. There's no `with db.begin():` boundary, no savepoints, no rollback on partial failure.

### 9.6 [P2] Async DB engine is half-wired
**File:** `app/core/database.py:48-67`
Async engine is created conditionally if URL starts with `postgresql`, then `get_async_db` is defined but never used anywhere in the codebase. Either commit to async SQLAlchemy 2.0 (recommended) or remove the half-implementation.

### 9.7 [P3] SQLite committed in working tree
**File:** `hft.db` (57 KB)
.gitignore says `*.db` is ignored, but the file is present — if it's tracked, `git rm --cached hft.db`. Either way, never ship a DB file.

---

## 10. Infra, Docker & CI/CD Audit

### 10.1 [P0] No `.dockerignore` file
**Files:** (missing)
`Dockerfile:52` does `COPY . .`. With no `.dockerignore`, this copies:
- `frontend/node_modules/` (hundreds of MB)
- `logs/` (committed log files)
- `__pycache__/`
- `.git/`
- `.env`
- `hft.db`

The resulting image will be 1+ GB and may contain secrets.

### 10.2 [P0] `docker-compose.yml` mounts `.env` directly into the container
**File:** `docker-compose.yml:18`
```yaml
volumes:
  - ./logs:/app/logs
  - ./.env:/app/.env
```
This means the container runs against whatever `.env` is in the host repo root. Acceptable for dev; in production you should use Docker secrets or env injection, never a file mount.

### 10.3 [P0] No frontend service in `docker-compose.yml`
**File:** `docker-compose.yml`
Only `hft-app`, `postgres`, `redis`, `pgadmin`, `redis-commander`. The frontend has to be built and served separately, with no nginx reverse proxy in front of the API. For a recruiter demo, `docker compose up` should bring up the whole thing.

### 10.4 [P1] Production CMD is `python main.py` (single-worker uvicorn)
**File:** `Dockerfile:69` + `main.py:213-222`
For production, use `gunicorn -k uvicorn.workers.UvicornWorker -w N main:app` with `N = 2 × CPU + 1`. The current pattern caps you at one worker per container, defeating horizontal scaling within a single host.

### 10.5 [P1] CI workflow installs `tensorflow==2.14.0` on every build
**File:** `.github/workflows/ci-cd.yml:42-43`
TensorFlow + Keras is ~500 MB and takes 3-5 minutes to install. CI cache is not configured for pip (only npm). Every CI run is ~7 minutes wasted on dependency install.

### 10.6 [P1] CI runs `npm test` but no `test` script exists
**File:** `.github/workflows/ci-cd.yml:92` + `frontend/package.json:6-11`
This step has been failing on every run (or, more likely, the workflow has never been triggered). Either fix the script or remove the step.

### 10.7 [P1] `deploy-staging` is a placeholder echo
**File:** `.github/workflows/ci-cd.yml:131-133`
```yaml
steps:
  - name: Deploy to staging
    run: |
      echo "Deploying to staging environment..."
      # Add your deployment commands here
```
Currently this is theater. Either implement (Fly.io / Render / Railway / a real Kubernetes target) or remove from the pipeline.

### 10.8 [P2] `Makefile`'s `check-deploy` grep pattern doesn't match `.env.example`
**File:** `Makefile:102` vs `.env.example:22`
- Makefile greps for `"JWT_SECRET_KEY=your-secret-key-change-in-production"`
- `.env.example` actually contains `"JWT_SECRET_KEY=your-super-secret-jwt-key-change-in-production"`

The check **always passes** because the literal string doesn't match. False security.

### 10.9 [P2] `validate_setup.py` is dead code
**File:** `validate_setup.py`
Lists file existence. Adds nothing pytest doesn't already cover (and doesn't). Delete.

### 10.10 [P3] `alembic.ini` not reviewed in depth — confirm `script_location` is `alembic` and `sqlalchemy.url` is set from env, not hardcoded.

---

## 11. Git Hygiene & Repo Cleanliness

| Item | Status | Action |
|---|---|---|
| `hft.db` (SQLite binary) | Present in tree | `git rm --cached hft.db && commit` |
| `logs/` (committed logs) | Present in tree | `git rm --cached -r logs/ && commit` |
| `app/ml/models/lstm_model.h5` (binary model) | Present | Move to Git LFS or external storage; not in `.gitignore` (only `models/*.h5` is, but actual path is `app/ml/models/*.h5`) |
| `__pycache__/` dirs | Present at root, in app/quant/ | `find . -type d -name __pycache__ -exec rm -rf {} +` (gitignored, just stale) |
| `app/quant/__pycache__/build_lstm_model.cpython-313.pyc` | Orphan .pyc with no .py source | Delete |
| `.env` | Present in tree | Confirm it's gitignored (`.gitignore:99` says `.env` ✓); rotate JWT secret if ever committed |
| No `.dockerignore` | Missing | Create |
| No `frontend/.env.example` | Missing | Create with `VITE_API_URL`, `VITE_WS_URL` |
| No `CODEOWNERS` | Missing | Optional polish |
| No `LICENSE` | Missing (README references MIT) | Add `LICENSE` file |
| No `CONTRIBUTING.md` | Missing | Optional |

---

## 12. Naming, Code Style & Dead Code

### 12.1 [P1] Folder name `app/quant/` vs `app/ml/` — overlapping responsibilities
- `app/quant/signal_engine.py` calls `app.ml.predictor.predict_return` — so the "quant" engine depends on "ml" output.
- `app/quant/factors/` holds factor functions — pure feature engineering, arguably belongs under `app/ml/features/` or `app/signals/factors/`.
- `app/quant/decision_logic.py` exists alongside `signal_engine.py` — two signal paths.
- `app/quant/__pycache__/build_lstm_model.cpython-313.pyc` is bytecode for a "build LSTM model" function that morally belongs in `app/ml/`.

The mental model of "what goes where" is unclear. **Phase 3 target:** Pick one layout (recommended: `app/signals/` for strategy logic, `app/ml/` for inference and training, `app/features/` for feature engineering) and migrate.

### 12.2 [P1] File-level docstrings use 🔥 EMOJI THEATER
Across the codebase: `"🔥 ELITE PRODUCTION CONFIGURATION"`, `"🚀 ULTIMATE ELITE SIGNAL ENGINE — FINAL EXTENDED VERSION"`, `"✔ ZERO CRASH GUARANTEE"`, `"🔥 BULLETPROOF EXTRACTION"`. These read like motivational posters and undermine the actual engineering. **A senior reviewer cringes at the word "elite" in docstrings.** Replace with substantive module docstrings: purpose, invariants, threading model, lifecycle.

### 12.3 [P2] `_safe`, `_compute`, `_combine`, `_fallback` — abbreviated private methods on `SignalEngine`
**File:** `app/quant/signal_engine.py`
Method names should describe intent: `_safe` → `_coerce_to_float`, `_compute` → `_compute_signal_for_symbol`, etc. Single-letter args (`f, ml, r` for factors/ml/risk in `_combine`) require comments to be readable.

### 12.4 [P2] Inconsistent return shapes from API endpoints
- `GET /portfolio` returns `{status, positions, summary}` (pnl_engine `get_total_pnl`).
- `GET /performance` returns `{status, metrics, equity_curve}` (routes.py:1110).
- `GET /trades` returns `{trades: [...]}` (routes.py:1201).
- `GET /market` returns `{prices: {...}, signals: {...}}` (routes.py:1220).
- `POST /trades` returns the raw `result` dict from `execute_trade` (routes.py:1186).

No consistent envelope. Recommend: `{data: T, meta: {...}, error: null}` everywhere, with a typed Pydantic response model for each route.

### 12.5 [P2] Mixed sync/async on the same router
**File:** `app/api/routes.py`
- `register` (line 1021) is `def` (sync) — runs in threadpool.
- `login` (line 1049) is `def` (sync).
- `health` (line 1009) is `async def`.
- `portfolio` (line 1071) is `def`.
- `websocket_endpoint` (line 1329) is `async def` (it must be).

Some of this is fine (SQLAlchemy sync is easier in `def`). But the choice should be explicit and documented, not ad-hoc.

### 12.6 [P2] Dead comments left as "trail of thought"
Examples:
- `pnl_engine.py:316-435` — 120 lines of commented-out previous attempts.
- `app/api/routes.py:1-959` — see 3.3.
- `frontend/src/services/apiClient.js:75-135` — see 6.6.
- `frontend/src/pages/Dashboard.jsx:1-144` — entire previous version of the file commented out.
- `app/websocket/manager.py:1-57` — see related.
- `app/market/market_data_engine.py:1-209` — three commented versions stacked.
- `app/market/candle_engine.py:1-231` — same pattern.
- `frontend/src/App.jsx:1-33` — first version of routing commented out.

This is the **single biggest readability problem in the codebase**. A reviewer will lose trust within 30 seconds. **Phase 2.0 deliverable: a single "kill the commented code" pass across the entire repo.**

### 12.7 [P3] `🔥`, `🚀`, `🛑`, `📡`, `🕯️` log emojis
`logger.info("🚀 Starting HFT Trading System...")`. Cute in dev, looks unprofessional in `journalctl` and breaks some terminal renderings. Keep prefix tags (`[STARTUP]`) instead.

---

## 13. Testing Audit

### 13.1 [P0] Three trivial smoke tests masquerading as a test suite (see 3.6).

### 13.2 [P0] No tests for any business logic
- PnL calculation: untested. FIFO matching is non-trivial — needs hand-computed fixtures.
- Execution engine: untested. Concurrent BUY/SELL races, insufficient balance, sell-without-position, etc.
- Risk engine: untested.
- Signal engine: untested. Mocking the ML predictor and verifying signal output for known factor inputs is straightforward.
- Auth: untested. Token expiry, malformed token, missing sub claim.

### 13.3 [P1] No integration tests
`/api/v1/trades` (full BUY → DB state → portfolio recomputation → equity snapshot) is the critical flow. Untested.

### 13.4 [P1] No frontend tests
No Vitest, no Testing Library, no Playwright. CI claims to run `npm test` and silently fails.

### 13.5 [P1] No load test
For a "high-frequency" trading platform, the lack of even a basic Locust/k6 script is jarring. A simple "1000 concurrent WebSocket clients receiving ticks" test would expose 4.2, 4.5, and the absence of backpressure handling.

### 13.6 [P2] `pytest.ini` not reviewed in depth — needs to set `asyncio_mode = auto` for pytest-asyncio.

---

## 14. Documentation Audit

### 14.1 [P1] README claims features that don't exist
**File:** `README.md`
- Lists `POST /api/v1/auth/refresh` (line 170) — no such endpoint.
- Lists `GET /health/db` (line 223) — no such endpoint.
- Lists `ws://localhost:8000/ws/market` (line 186) — actual endpoint is `/api/v1/ws`.
- Says "Prometheus metrics at `/metrics` when enabled" (line 228) — no `/metrics` endpoint exists; `prometheus-client` is in requirements but never wired.
- Claims `app.log`, `error.log`, `trading.log` separation (line 234-236) — the `logs/` directory contains those files (which proves the logger is configured for it), but the loguru rotation config in `settings.log_file` only references `logs/app.log`.

### 14.2 [P2] No architecture document
README has an ASCII-art box-diagram of "Frontend ↔ Backend ↔ DB". That is not architecture documentation. A serious portfolio repo has `docs/ARCHITECTURE.md` with sequence diagrams, an ADR log (`docs/adr/`), and a "How to extend" guide.

### 14.3 [P2] No API contract doc
FastAPI auto-generates `/docs` — fine for browsing, but a `docs/API.md` with request/response examples for the top 10 endpoints is what recruiters scan first.

### 14.4 [P2] No "Why this architecture" doc
For interview defensibility, a `docs/DESIGN_DECISIONS.md` (one ADR per major choice: "Why Zustand over Redux", "Why FIFO PnL", "Why in-memory event bus before Redis pub/sub", "Why no Kafka in Phase 1") is the single highest-leverage document you can write.

---

## 15. Top 25 Punchlist (Ordered by Risk)

This is the ordered list of "if you only fix one more thing today" items. Phase 2 should address roughly the top 12; Phase 3 the rest.

| # | Severity | Area | Issue | Fix Phase |
|---|---|---|---|---|
| 1 | P0 | Security | Hardcoded JWT secret bypasses settings (`jwt_handler.py:4`) | 2.1 |
| 2 | P0 | Data | Model/migration schema drift (`positions.average_price` vs `avg_price`) | 2.2 |
| 3 | P0 | Code | 960 lines of commented-out dead code in `routes.py` | 2.0 |
| 4 | P0 | Code | Two `PnLEngine` implementations, one references nonexistent fields | 2.4 |
| 5 | P0 | Real-time | Signal engine sleeps 3600s by default (missing config key) | 2.5 |
| 6 | P0 | Frontend | `CandlestickChart` does full `setData()` every 3s → flicker | 2.6 |
| 7 | P0 | Frontend | `CandlestickChart` polls REST instead of using WebSocket | 2.6 / 3.3 |
| 8 | P0 | Frontend | `AuthContext.jsx` is empty file, auth is not reactive | 2.6 |
| 9 | P0 | Frontend | No Zustand, no React Query despite brief requirement | 2.6 |
| 10 | P0 | Infra | No `.dockerignore` → 1GB+ images, leaks `.env` and `hft.db` | 2.0 |
| 11 | P0 | Infra | `docker-compose` has no frontend service | 2.0 |
| 12 | P0 | Deps | `redis-py-cluster`, `passlib`, TF version conflicts | 2.0 |
| 13 | P1 | Backend | Two background tasks broadcast same data (candle + stream) | 3.3 |
| 14 | P1 | Backend | No per-user / per-topic WebSocket addressing | 3.3 |
| 15 | P1 | Backend | Two threading models (asyncio + OS thread) fighting | 3.1 |
| 16 | P1 | Backend | No service / repository layer; routes call ORM directly | 3.2 |
| 17 | P1 | Backend | Execution engine: float money, no idempotency, no order types | 3.4 |
| 18 | P1 | Backend | `get_safe_price` blocks on yfinance in request path | 2.4 |
| 19 | P1 | Tests | One existing test is broken; no business-logic coverage | 2.7 |
| 20 | P1 | CI | `npm test` runs against non-existent script | 2.0 |
| 21 | P1 | Real-time | Signal scoring is hardcoded linear combo with weights summing to 0.75 | 4.1 |
| 22 | P1 | ML | Training script imports nonexistent modules | 5.x |
| 23 | P1 | Backend | CORS hardcoded, `cors_origins` setting dead | 2.0 |
| 24 | P1 | Frontend | App.jsx has duplicate `Route path="/"` (dead route) | 2.0 |
| 25 | P2 | Code | Across-repo: kill commented code in 8+ files | 2.0 |

---

## 16. Architecture Verdict

### What's salvageable
- **Folder skeleton is right.** `app/{api, auth, core, execution, market, ml, models, portfolio, quant, risk, schemas, websocket}` is recognizable as a serious backend layout. Don't move files; clean them.
- **FastAPI + SQLAlchemy + Vite + Tailwind** is the right stack for the goal. No need to reach for Next.js or Django.
- **The intent of `market_state` as a single source of truth** is correct; it just needs to become an interface that can be backed by Redis later.
- **The `lifespan` pattern in `main.py`** is the modern idiom. The bug is in `safe_task`, not in the pattern.
- **The factor-based signal engine** with ML as one input is a sound architecture. The bugs are in the scoring math and the missing training pipeline, not the design.

### What needs to go
- All 1900+ lines of commented-out code.
- The class-based `PnLEngine` duplicate.
- `redis-py-cluster`, `passlib`, `celery`, `apscheduler`, `asyncpg` from requirements.
- `validate_setup.py`.
- The orphan `.pyc` in `app/quant/__pycache__/`.
- The committed `lstm_model.h5`, `hft.db`, and `logs/`.

### What needs to be built
- A real auth module (refresh tokens, structured errors, `AuthContext`/Zustand store on the frontend).
- A real service layer (transaction context, repository pattern).
- A real WebSocket protocol (topics, per-user channels, server heartbeats, message envelope).
- A real test suite (PnL fixtures, execution races, risk boundaries, frontend Vitest, k6 WebSocket load test).
- A real CI pipeline (cached pip, real npm test, real deploy).
- Architecture documentation (ADR log, sequence diagrams).

### What's deferred
- Kafka. The brief mentions it as "optional advanced." It is. Phase 4 in-process event bus first; Redis pub/sub second; Kafka only if you need it for an interview talking point.
- TimescaleDB. Same reasoning — Postgres with proper indexing on `(symbol, timestamp)` is sufficient until you're storing >100M ticks.
- Prometheus / Grafana. Add Prometheus *exposition* (it's cheap) early; Grafana dashboards are Phase 5 polish.
- TypeScript. Defer to Phase 5. Migrating JS → TS mid-project is its own can of worms.

---

## 17. Bridge to Phase 2

Phase 2 starts with the **Target Architecture document** — folder layout, service boundaries, event flows, websocket protocol, worker design, infra topology — followed by the **Phased Implementation Roadmap** with concrete tasks, dependencies, deliverables, and the "what to say in the interview" notes for each phase.

The roadmap will be structured around the following phases (preview, not committed):

- **Phase 2.0 — Hygiene Sweep (week 1):** kill dead code, fix `.dockerignore`, fix `requirements.txt`, fix CORS, unify routes file, fix CI, remove orphan binaries from git.
- **Phase 2.1 — Auth Hardening:** real JWT integration with settings, refresh tokens, reactive auth store on frontend.
- **Phase 2.2 — Database Truth:** reconcile model/migration, kill `metadata.create_all` in prod path, migrate to async SQLAlchemy 2.0.
- **Phase 2.3 — Service & Repository Layers:** introduce `services/` and `repositories/`, refactor execution + portfolio.
- **Phase 2.4 — PnL & Execution Correctness:** single FIFO PnL service, Decimal money, idempotent trade execution.
- **Phase 2.5 — Real-Time Pipeline v1:** collapse three broadcasters into one, fix signal interval, fix candle flicker on frontend.
- **Phase 2.6 — Frontend Foundations:** install Zustand + TanStack Query, replace `useMarket` and `usePortfolio`, real `AuthContext`, error boundaries per feature.
- **Phase 2.7 — Test Foundations:** real pytest suite, Vitest setup, fix CI.

Phase 3 (architecture & polish) and Phase 4 (quant differentiation) will be defined after Phase 2 approval.

---

*End of Audit Report. Generated against the working tree on the date the audit was run. Re-run after each phase to verify regressions have not been introduced.*
