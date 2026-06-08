# HFT Trading Platform — Target Architecture

> **Purpose:** This document is the canonical blueprint of the system we are building toward. Every implementation choice in Phase 2 onward defers to this document. When something in the codebase disagrees with this document, the codebase is wrong.
>
> **How to read this:** Each section states *what* we build, *why* we build it that way (rationale), *what the tradeoffs are* (interview defense), and *what we are explicitly not building yet* (deferral). The deferral notes matter — half of architecture is what you choose not to do.
>
> **Companion documents:** [AUDIT.md](./AUDIT.md) — the current-state forensic analysis. [ROADMAP.md](./ROADMAP.md) — the phased implementation plan (Step 3 deliverable). [docs/adr/](./docs/adr/) — Architecture Decision Records as we make consequential choices.

> **Status update — Quant Lab shipped.** Beyond the core platform, a **Quantitative Research Lab** is now live (`app/quant/*` + `frontend/src/pages/*`): a Monte-Carlo option pricer (GBM + Black-Scholes + Greeks), a 3D implied-volatility surface (SVI parametrization + Newton-Raphson IV inversion) with an AR(1)/Ornstein-Uhlenbeck forecaster, a lookahead-safe strategy backtester, a from-scratch NumPy Random-Forest return predictor with Monte-Carlo resampling, and a Loughran-McDonald earnings-call sentiment analyzer with an event-study backtest. Engines are dependency-light, deterministic, and exposed under `/api/v1` (`options`, `vol`, `backtest`, `predict`, `sentiment`), surfaced through the in-app **Quant Lab** workspace.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [System Topology](#2-system-topology)
3. [Backend Architecture](#3-backend-architecture)
4. [Frontend Architecture](#4-frontend-architecture)
5. [Real-Time Architecture](#5-real-time-architecture)
6. [Data & Persistence](#6-data--persistence)
7. [Auth Architecture](#7-auth-architecture)
8. [Execution & Order Architecture](#8-execution--order-architecture)
9. [Quant & ML Architecture](#9-quant--ml-architecture)
10. [Observability](#10-observability)
11. [Infra & Deployment Topology](#11-infra--deployment-topology)
12. [Canonical Sequence: One Full Trade](#12-canonical-sequence-one-full-trade)
13. [Folder Structure: Final State](#13-folder-structure-final-state)
14. [ADR Discipline](#14-adr-discipline)
15. [Migration Strategy: Current → Target](#15-migration-strategy-current--target)
16. [Explicit Non-Goals](#16-explicit-non-goals)

---

## 1. Design Principles

These are the rules that override convenience. If a phase task contradicts a principle, the principle wins.

### 1.1 Layered, not Frankenstein
Each layer has one job and depends only on layers below it. **Routes never write SQL. Services never format HTTP responses. Repositories never know what a user is.** A clean dependency graph is the single biggest predictor of whether you can defend the design at a whiteboard.

### 1.2 Async-first for I/O, sync where it doesn't matter
The realtime path (WebSocket, market ingestion, broadcast) is fully `asyncio`. Synchronous yfinance / blocking SDK calls are isolated with `asyncio.to_thread`. The signal engine's ThreadPoolExecutor + `time.sleep` pattern (current audit finding 4.3) is deleted; we go async everywhere with explicit concurrency primitives.

### 1.3 Events first, broadcasts second
Engines emit *domain events* to an in-process event bus. The WebSocket layer is one of several subscribers. This means we can add Redis pub/sub later without touching engines, can add audit-log persistence without touching the broadcast, and — critically — can unit-test engines by asserting on emitted events instead of mocking the WebSocket.

### 1.4 Money is `Decimal`, time is `int` (epoch seconds)
Floats for currency is an interview disqualifier. All money values are `Decimal` end-to-end, quantized at the API boundary. Times are integer epoch seconds (or ISO-8601 strings at the boundary), never `datetime` without tzinfo.

### 1.5 The frontend has two state systems, not one
**Client state** (auth, UI preferences, live ticks, currently-selected symbol) lives in **Zustand**. **Server state** (portfolio, trade history, performance metrics — anything that has a "fetch + cache" pattern) lives in **TanStack Query**. Mixing these is the most common React anti-pattern; we draw the line explicitly.

### 1.6 Idempotency for any mutation that crosses a network
Trade execution, order placement, equity snapshots. Every mutation accepts a client-supplied `idempotency_key` (UUID). The server stores `(key, response)` pairs in Redis for 24h. Replay returns the stored response without re-executing. This is what real trading APIs do and what the current `X-Request-ID` header *should* be doing.

### 1.7 Configuration is one file, secrets are env-only
A single `app/core/config.py` Pydantic `Settings` model. All values read from environment variables with explicit defaults. No `os.getenv()` scattered across the codebase. No hardcoded constants like `SECRET_KEY = "supersecretkey"` (audit finding 3.1).

### 1.8 Migrations are the source of truth, `metadata.create_all` is deleted
The ORM model and the migration are the same shape *by construction*. Production startup runs `alembic upgrade head`. Dev can use a `make dev-db` target that does the same. `Base.metadata.create_all` lives only in tests.

### 1.9 The repo is shippable as `docker compose up`
A recruiter on macOS with Docker installed should be able to clone the repo, copy `.env.example` to `.env`, run `docker compose up`, and have a working dashboard at `http://localhost:5173` within five minutes. Anything that doesn't survive this test gets fixed.

### 1.10 Document the *why*, not the *what*
The codebase explains *what* it does. ADRs in `docs/adr/` explain *why* — "Why FIFO over WAC for PnL", "Why in-process event bus before Redis", "Why no Kafka yet". These are the documents you cite in interviews.

---

## 2. System Topology

The full system, at its target shape, is six logical processes (some of which can collapse into one container for dev):

```
                              ┌───────────────────────────┐
                              │   Browser (React + Vite)  │
                              │  Zustand + TanStack Query │
                              └──────┬──────────────┬─────┘
                                     │ HTTPS        │ WSS
                                     ▼              ▼
                              ┌───────────────────────────┐
                              │       Nginx Reverse       │
                              │      Proxy (TLS, gzip)    │
                              └──────┬──────────────┬─────┘
                                     │              │
                          ┌──────────▼──┐   ┌──────▼───────┐
                          │  FastAPI    │   │  FastAPI WS  │
                          │  REST API   │   │  Endpoint    │
                          │ (uvicorn N) │   │ (uvicorn N)  │
                          └──┬─────┬────┘   └──┬────────┬──┘
                             │     │           │        │
                ┌────────────┘     │           │        └────────┐
                │                  │           │                 │
                ▼                  ▼           ▼                 ▼
       ┌──────────────┐   ┌─────────────┐   ┌──────────────┐   ┌─────────────────┐
       │ PostgreSQL   │   │   Redis     │   │ Event Bus    │   │ Engine Workers  │
       │ (primary DB) │◄──┤ (cache,     │◄──┤ (in-process) │◄──┤ (asyncio tasks) │
       │ asyncpg      │   │  pub/sub,   │   │              │   │  - Market Feed  │
       │              │   │  idempotency│   │              │   │  - Candles      │
       │              │   │  store)     │   │              │   │  - Signals      │
       └──────────────┘   └─────────────┘   └──────────────┘   │  - Risk         │
                                                                │  - Execution    │
                                                                └─────────────────┘
                                                                         │
                                                                         ▼
                                                              ┌─────────────────────┐
                                                              │  Optional Sidecars  │
                                                              │  - Prometheus       │
                                                              │  - Grafana          │
                                                              │  - Sentry           │
                                                              └─────────────────────┘
```

### What's deliberately not on the diagram

- **No Kafka.** Phase 4 may introduce Redis pub/sub *across processes* (when we move engines to separate workers). Kafka is a Phase 5 ceiling, not a Phase 2 requirement.
- **No Celery / RQ.** We use asyncio tasks supervised by a Supervisor pattern. Celery's threading model would re-introduce audit finding 4.3.
- **No TimescaleDB / InfluxDB.** Postgres with proper `(symbol, timestamp DESC)` indexes is sufficient for our tick volume.
- **No GraphQL / tRPC.** REST + WebSocket is enough; adding a third protocol adds surface area without obvious wins for this domain.

### Container topology for `docker compose up`

| Service | Container | Image base | Why |
|---|---|---|---|
| `frontend` | `hft-frontend` | `node:20-alpine` (dev) / `nginx:alpine` (prod) | Vite dev server in dev; built static assets served by nginx in prod |
| `api` | `hft-api` | `python:3.12-slim` | FastAPI REST + WebSocket on the same uvicorn process (no need to split until horizontal scaling) |
| `workers` | `hft-workers` | `python:3.12-slim` (same image as api) | Background engines: market feed, candles, signals, risk monitor. Same code, different entrypoint |
| `postgres` | `postgres:16-alpine` | — | Primary DB |
| `redis` | `redis:7-alpine` | — | Cache, pub/sub, idempotency store, rate-limit counters |
| `nginx` | `nginx:alpine` | — | Reverse proxy, TLS termination (prod), WebSocket upgrade |

In dev we can collapse `api + workers` into one container to make `docker compose up` faster; in prod they're separate so workers can scale independently.

---

## 3. Backend Architecture

The backend is a layered application. Each layer has a single responsibility and depends *only* on layers below it.

```
┌────────────────────────────────────────────────────────────────┐
│  API LAYER          app/api/v1/                                │
│  Routes are thin HTTP-to-service mappers.                      │
│  No SQL. No business logic. No formatting beyond Pydantic.     │
└──────┬─────────────────────────────────────────────────────────┘
       │ calls
       ▼
┌────────────────────────────────────────────────────────────────┐
│  SERVICE LAYER      app/services/                              │
│  Orchestration. Transaction boundaries. Cross-cutting          │
│  concerns (auth context, idempotency check, audit log).        │
│  Returns domain objects or DTOs.                               │
└──────┬─────────────────────────────────────────────────────────┘
       │ calls
       ▼
┌────────────────────────────────────────────────────────────────┐
│  DOMAIN LAYER       app/domain/                                │
│  Pure business logic. Entities, value objects, aggregates.     │
│  No I/O. Fully unit-testable. No framework imports.            │
│  This is where FIFO PnL math, order state machines,            │
│  risk-check predicates, signal scoring live.                   │
└──────┬─────────────────────────────────────────────────────────┘
       │ used by
       ▼
┌────────────────────────────────────────────────────────────────┐
│  REPOSITORY LAYER   app/repositories/                          │
│  All SQLAlchemy queries live here. One repo per aggregate root │
│  (UserRepo, OrderRepo, PositionRepo, TradeRepo, ...).          │
│  Returns domain objects, not ORM rows (mapped at boundary).    │
└──────┬─────────────────────────────────────────────────────────┘
       │ uses
       ▼
┌────────────────────────────────────────────────────────────────┐
│  INFRASTRUCTURE     app/infra/                                 │
│  DB engine, Redis client, HTTP clients, WebSocket manager,     │
│  event bus, market data providers, ML model loader.            │
└────────────────────────────────────────────────────────────────┘
```

### 3.1 API Layer (`app/api/v1/`)

Routes are split per domain. Each file owns one resource family:

```
app/api/v1/
├── __init__.py          # combines all routers into one
├── auth.py              # /auth/{register,login,refresh,logout}
├── portfolio.py         # /portfolio, /portfolio/history, /portfolio/positions
├── trading.py           # /orders (POST/GET/DELETE), /trades, /fills
├── market.py            # /market, /market/{symbol}, /candles/{symbol}
├── signals.py           # /signals, /signals/{symbol}
├── analytics.py         # /performance, /analytics/sharpe, /analytics/drawdown
├── risk.py              # /risk/limits, /risk/exposure
├── ws.py                # /ws (the single WebSocket endpoint)
└── health.py            # /health, /health/db, /health/redis, /metrics
```

Rules for route handlers:
- Receive a Pydantic `*Request` model, return a Pydantic `*Response` model.
- Use FastAPI `Depends()` to inject `CurrentUser`, `DBSession`, `IdempotencyKey`.
- One service call per handler (no orchestration in the route).
- Errors raised as `HTTPException` only; structured error bodies via a global exception handler.

Example shape (illustrative, not implementation):
```python
@router.post("/orders", response_model=OrderResponse)
async def place_order(
    req: PlaceOrderRequest,
    user: CurrentUser,
    idem: IdempotencyKey,
    svc: OrderService = Depends(),
) -> OrderResponse:
    order = await svc.place_order(user_id=user.id, request=req, idempotency_key=idem)
    return OrderResponse.from_domain(order)
```

### 3.2 Service Layer (`app/services/`)

Services orchestrate. They open transactions, call repositories, invoke domain logic, emit events, return domain objects.

```
app/services/
├── auth_service.py
├── order_service.py        # place_order, cancel_order, modify_order
├── portfolio_service.py    # get_portfolio_summary, get_positions
├── analytics_service.py    # sharpe, sortino, drawdown, win_rate
├── market_service.py       # get_quote, get_candles, get_market_overview
├── signal_service.py       # get_signal, get_all_signals
├── risk_service.py         # check_pre_trade_risk
└── idempotency_service.py  # check_replay, store_response
```

Rules:
- Every public method receives explicit dependencies (no module-level singletons inside services).
- Every public method that mutates state is wrapped in a single transaction.
- Services emit events via the event bus *after* commit, never before.
- Services do not import FastAPI, do not import HTTP types, do not return Pydantic models.

### 3.3 Domain Layer (`app/domain/`)

Pure logic. No framework imports. Fully unit-testable in milliseconds.

```
app/domain/
├── entities/
│   ├── user.py             # User entity
│   ├── order.py            # Order entity + OrderStatus enum + state machine
│   ├── trade.py            # Trade entity (a Fill)
│   ├── position.py         # Position entity
│   └── candle.py           # Candle entity
├── value_objects/
│   ├── money.py            # Money(Decimal, Currency)
│   ├── quantity.py         # Quantity(Decimal)
│   ├── price.py            # Price(Decimal)
│   ├── symbol.py           # Symbol("AAPL")
│   └── timeframe.py        # Timeframe.ONE_MINUTE, FIVE_MINUTES, ...
├── pnl/
│   ├── fifo.py             # FIFO cost-basis matching engine
│   └── metrics.py          # sharpe, sortino, drawdown calculators
├── orders/
│   ├── state_machine.py    # PENDING → OPEN → PARTIAL → FILLED | CANCELLED | REJECTED
│   └── matching.py         # local matching for limit orders against market price
├── risk/
│   ├── rules.py            # MaxPositionRule, MaxDailyLossRule, ConcentrationRule
│   └── assessment.py       # RiskAssessment domain object
└── signals/
    ├── factors.py          # protocol for a Factor
    ├── scoring.py          # signal combination (replaces signal_engine._combine)
    └── result.py           # SignalResult value object
```

**Why this matters:** Most of your hardest interview questions (FIFO PnL math, order state transitions, risk rule evaluation) get *unit-testable in isolation*. You can pull `fifo.py` into a `pytest` and write 50 lines of property-based tests. That's what production code looks like.

### 3.4 Repository Layer (`app/repositories/`)

One repository per aggregate root. All SQLAlchemy lives here.

```
app/repositories/
├── base.py              # BaseRepository with generic CRUD
├── user_repo.py
├── order_repo.py
├── trade_repo.py
├── position_repo.py
├── equity_history_repo.py
└── candle_repo.py
```

Rules:
- Repositories take an `AsyncSession` in `__init__` (or as a method parameter — pick one, document, stick to it).
- Return domain entities, not ORM rows. The mapping happens at the repository boundary.
- No business logic. Repos only know how to read and write.
- No commits inside repos. Transaction boundary is the service.

### 3.5 Infrastructure (`app/infra/`)

Adapters to the outside world.

```
app/infra/
├── db.py                # Async SQLAlchemy engine + session factory
├── redis_client.py      # Async Redis client
├── event_bus/
│   ├── bus.py           # In-process AsyncIO event bus
│   ├── events.py        # Domain event types (PriceTicked, OrderFilled, ...)
│   └── subscribers/
│       ├── websocket_subscriber.py
│       ├── audit_subscriber.py
│       └── snapshot_subscriber.py
├── websocket/
│   ├── manager.py       # ConnectionManager with topic subscriptions
│   ├── protocol.py      # Message envelope, serialization
│   └── auth.py          # WS auth (short-lived WS token)
├── market_data/
│   ├── provider.py      # Provider protocol
│   ├── yfinance_provider.py
│   ├── synthetic_provider.py  # for demo mode
│   └── cache.py
├── ml/
│   ├── model_loader.py  # Lazy, thread-safe ONNX/TF loader
│   └── predictor.py     # Wrapper with feature pipeline
├── supervisor.py        # Async task supervisor (replaces safe_task)
└── logging.py           # Structured loguru config
```

### 3.6 Background Engines (`app/engines/`)

Engines are long-running async tasks supervised by `app/infra/supervisor.py`.

```
app/engines/
├── market_feed.py       # Pulls quotes, emits PriceTicked events
├── candle_engine.py     # Aggregates ticks into OHLC, emits CandleClosed
├── signal_engine.py     # Computes signals, emits SignalGenerated
├── risk_monitor.py      # Periodic risk checks, emits RiskBreached
└── snapshot_engine.py   # Periodic equity snapshots
```

Each engine has the shape:
```python
class MarketFeedEngine:
    def __init__(self, provider: MarketDataProvider, bus: EventBus, ...): ...
    async def run(self) -> None: ...   # main loop
    async def health(self) -> EngineHealth: ...  # for /health endpoint
```

Engines **never broadcast directly**. They emit events. The event bus routes events to subscribers. The WebSocket subscriber is one of many. This is the single most important architectural change vs. the current codebase.

### 3.7 Transaction & Idempotency Pattern

Every mutating service method follows the same pattern:

```python
async def place_order(
    self,
    user_id: int,
    request: PlaceOrderRequest,
    idempotency_key: UUID,
) -> Order:
    # 1. Idempotency check (Redis lookup, returns cached response if replay)
    if cached := await self._idem.get(idempotency_key):
        return cached

    # 2. Begin transaction
    async with self._uow.begin() as uow:
        # 3. Pre-trade risk check (pure domain logic)
        assessment = self._risk.assess(...)
        if not assessment.allowed:
            raise RiskRejection(assessment)

        # 4. Persist
        order = Order.new(...)
        await uow.orders.add(order)
        # ... position update, etc.

    # 5. Post-commit: emit event + store idempotency response
    await self._bus.emit(OrderPlaced(order=order))
    await self._idem.store(idempotency_key, order, ttl=86400)
    return order
```

`uow` is the Unit-of-Work pattern — a context manager that opens a transaction, exposes typed repositories, commits on `__aexit__`, rolls back on exception.

---

## 4. Frontend Architecture

```
frontend/src/
├── main.jsx                    # React entry, providers (QueryClientProvider, Router)
├── App.jsx                     # Routing only, no business logic
├── routes/                     # Route guards, protected route HoC
│   └── protected.jsx
├── features/                   # Feature modules — the new top-level org
│   ├── auth/
│   │   ├── api/
│   │   │   └── auth.api.js     # axios calls + TanStack Query hooks for auth
│   │   ├── components/
│   │   │   ├── LoginForm.jsx
│   │   │   └── RegisterForm.jsx
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx
│   │   │   └── RegisterPage.jsx
│   │   ├── store/
│   │   │   └── auth.store.js   # Zustand slice for auth state
│   │   └── hooks/
│   │       └── useAuth.js
│   ├── portfolio/
│   │   ├── api/portfolio.api.js
│   │   ├── components/
│   │   │   ├── EquityCurve.jsx
│   │   │   ├── PositionsTable.jsx
│   │   │   ├── AllocationPie.jsx
│   │   │   └── PnLSummary.jsx
│   │   └── pages/
│   │       └── PortfolioPage.jsx
│   ├── trading/
│   │   ├── api/orders.api.js
│   │   ├── components/
│   │   │   ├── OrderForm.jsx
│   │   │   ├── OrderBook.jsx
│   │   │   ├── OpenOrdersTable.jsx
│   │   │   ├── TradeHistoryTable.jsx
│   │   │   └── TradeConfirmation.jsx
│   │   └── pages/
│   │       └── TradingTerminal.jsx
│   ├── market/
│   │   ├── api/market.api.js
│   │   ├── components/
│   │   │   ├── CandlestickChart.jsx     # rebuilt with incremental updates
│   │   │   ├── PriceTicker.jsx
│   │   │   ├── SymbolSearch.jsx
│   │   │   ├── Watchlist.jsx
│   │   │   └── MarketScanner.jsx
│   │   └── pages/
│   │       └── MarketPage.jsx
│   ├── signals/
│   │   ├── api/signals.api.js
│   │   ├── components/
│   │   │   ├── SignalCard.jsx
│   │   │   ├── FactorBreakdown.jsx
│   │   │   └── ConfidenceMeter.jsx
│   │   └── pages/
│   │       └── SignalsPage.jsx
│   ├── analytics/
│   │   ├── api/analytics.api.js
│   │   ├── components/
│   │   │   ├── SharpeCard.jsx
│   │   │   ├── DrawdownChart.jsx
│   │   │   └── WinRateGauge.jsx
│   │   └── pages/
│   │       └── AnalyticsPage.jsx
│   └── dashboard/
│       └── pages/DashboardPage.jsx       # composes widgets from other features
├── shared/                     # Cross-feature, reusable
│   ├── components/
│   │   ├── ui/                 # Button, Input, Card, Modal, Tooltip, Toast
│   │   ├── layout/             # AppShell, Sidebar, Topbar, PageContainer
│   │   ├── feedback/           # Skeleton, ErrorBoundary, EmptyState, Spinner
│   │   └── data/               # DataTable, KpiCard, MetricGrid
│   ├── hooks/
│   │   ├── useDebounce.js
│   │   ├── useIntersectionObserver.js
│   │   └── useLiveTick.js      # subscribes to WS topic, returns latest tick
│   ├── lib/
│   │   ├── apiClient.js        # axios instance with interceptors
│   │   ├── queryClient.js      # TanStack Query client config
│   │   ├── wsClient.js         # WebSocket client (replaces websocket.js)
│   │   ├── format.js           # currency, percent, number formatters
│   │   └── jwt.js              # decode/isExpired helpers
│   └── store/
│       ├── ui.store.js         # global UI prefs (theme, sidebar collapsed, etc.)
│       └── market.store.js     # live tick state (Zustand)
├── styles/
│   ├── globals.css
│   └── tokens.css              # design tokens (colors, spacing, typography)
├── config/
│   ├── env.js                  # import.meta.env wrapper with validation
│   └── routes.js               # route path constants
└── types/                      # JSDoc typedefs (Phase 5: migrate to TS)
```

### 4.1 State management boundary

```
┌─────────────────────────────────────────────────────────────────┐
│                      CLIENT STATE (Zustand)                     │
│  - Auth: user, tokens, isAuthenticated                          │
│  - UI:   theme, sidebar collapsed, modal stack                  │
│  - Market live ticks: bySymbol → {price, change, ts}            │
│  - Selected symbol / timeframe                                  │
│                                                                 │
│  Selectors: shallow comparison via Zustand's createWithEqualityFn│
│  Persistence: auth + UI prefs to localStorage                   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  │ used together
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SERVER STATE (TanStack Query)                  │
│  - Portfolio summary           queryKey: ['portfolio']          │
│  - Positions                   queryKey: ['positions']          │
│  - Trade history               queryKey: ['trades', filters]    │
│  - Open orders                 queryKey: ['orders', 'open']     │
│  - Performance metrics         queryKey: ['performance']        │
│  - Candle history (initial)    queryKey: ['candles', sym, tf]   │
│  - Signals                     queryKey: ['signals', symbol]    │
│                                                                 │
│  Cache: staleTime per query (portfolio: 5s, history: 60s, ...)  │
│  Invalidation: on WS events (TradeFilled → invalidate trades)   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.2 The WS → Query invalidation bridge

This is the single most important pattern on the frontend:

```javascript
// shared/lib/wsClient.js (illustrative)
wsClient.subscribe('user.42.trade', (event) => {
  // server says: a trade just filled
  queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  queryClient.invalidateQueries({ queryKey: ['trades'] });
  queryClient.invalidateQueries({ queryKey: ['positions'] });
  toast.success(`Trade filled: ${event.symbol} ${event.action} ${event.quantity}`);
});

wsClient.subscribe('tick.AAPL', (event) => {
  // server says: new price
  useMarketStore.getState().updateTick(event.symbol, event.price, event.ts);
  // No query invalidation — live ticks are pure client state
});
```

The boundary is: **events that change server-side persistent state invalidate Query caches; events that are pure live data update Zustand directly.** A trade fill changes the DB → invalidate. A price tick is ephemeral → Zustand.

### 4.3 Component philosophy

- **`shared/components/ui/`** — design-system primitives. Headless logic + Tailwind classes. No business knowledge.
- **`shared/components/data/`** — reusable data presentation (DataTable, KpiCard). Generic.
- **`features/*/components/`** — feature-specific composites. Know about domain (e.g., `OrderForm` knows about order types). Compose `ui/` primitives.
- **`features/*/pages/`** — route-level components. Compose feature components and may compose components from *other* features (Dashboard does this). Use TanStack Query hooks here, pass data down.

### 4.4 Error boundaries

Three levels:
1. **App-level boundary** — wraps the entire router. Catches catastrophic React errors. Renders a fallback page.
2. **Feature-level boundaries** — wrap each top-level page. A chart crash on the dashboard doesn't take down the navbar.
3. **Async query boundary** — TanStack Query's `useQuery({...}).error` is rendered inline by each component (skeleton on `isLoading`, error message on `isError`).

---

## 5. Real-Time Architecture

### 5.1 The single WebSocket endpoint

One WS endpoint: `wss://api.example.com/ws`. All real-time goes through here.

- **No multiple WS endpoints per feature** (the current README's `/ws/market` and `/ws/portfolio` is rejected — it forces the browser to open multiple connections, increases reconnect surface).
- **One connection, many topics.** Topics are server-side strings; clients subscribe and unsubscribe over the connection.

### 5.2 Message envelope (v1)

Every message in either direction has this shape:

```json
{
  "v": 1,
  "id": "msg_01H...",
  "type": "tick",
  "topic": "tick.AAPL",
  "ts": 1716840000,
  "data": { ... }
}
```

- `v`: protocol version. Always 1 in Phase 2. Bumped only for breaking changes.
- `id`: ULID. Server-generated for server→client. Used for sequence/replay.
- `type`: discriminator for `data` shape. Documented in [docs/WS_PROTOCOL.md](./docs/WS_PROTOCOL.md).
- `topic`: required for events; absent for control messages.
- `ts`: epoch seconds. Server time on emit.
- `data`: type-specific payload.

### 5.3 Control message types (client → server)

| `type` | Purpose | `data` shape |
|---|---|---|
| `auth` | (Optional) re-auth with new token mid-session | `{token: "..."}` |
| `subscribe` | Subscribe to a topic | `{topics: ["tick.AAPL", "candle.AAPL.1m"]}` |
| `unsubscribe` | Unsubscribe | `{topics: [...]}` |
| `ping` | Keepalive | `{}` |
| `replay` | Request replay from a sequence (Phase 4) | `{topic: "...", since_id: "msg_..."}` |

### 5.4 Event message types (server → client)

| `type` | Topic pattern | When | `data` shape |
|---|---|---|---|
| `tick` | `tick.{symbol}` | New price | `{symbol, price, change, ts}` |
| `candle.active` | `candle.{symbol}.{tf}` | Active (open) candle mutated | `{symbol, tf, time, open, high, low, close}` |
| `candle.closed` | `candle.{symbol}.{tf}` | A candle just closed | `{symbol, tf, time, open, high, low, close, volume}` |
| `signal` | `signal.{symbol}` | Signal recomputed | `{symbol, signal, confidence, factors, ts}` |
| `trade.filled` | `user.{user_id}.trade` | A trade filled for this user | `{trade_id, symbol, action, qty, price, ts}` |
| `position.changed` | `user.{user_id}.position` | Position update | `{symbol, qty, avg_price, market_value, unrealized_pnl}` |
| `balance.changed` | `user.{user_id}.balance` | Cash balance changed | `{balance, ts}` |
| `risk.breach` | `user.{user_id}.risk` | Risk limit breached | `{rule, severity, message, ts}` |
| `system.notice` | `system` | System broadcast (maintenance, etc.) | `{level, message}` |
| `pong` | — | Heartbeat response | `{server_ts}` |

### 5.5 Authentication

- Browser cannot send custom headers on `new WebSocket(...)`. Workaround: a **short-lived WS-specific token** issued by `POST /auth/ws-token` (1 minute TTL), passed as a query string.
- Why not the access token? Because access tokens have 24h TTL and end up in reverse-proxy access logs. A 1-minute WS token is acceptable to log.
- On connection, the server validates the WS token, extracts `user_id`, attaches it to the connection state. The user can then subscribe to `user.{user_id}.*` topics; attempts to subscribe to *another* user's topic are rejected.

### 5.6 Heartbeat & reconnect

- **Server-driven heartbeat:** server sends `{"type": "ping", "ts": ...}` every 30s. Client must respond with `{"type": "pong"}` within 10s. Three missed pongs → server closes the connection with code 4002 (`HEARTBEAT_TIMEOUT`).
- **Client-driven heartbeat:** client also sends `ping` every 20s as a network-keepalive (some proxies kill idle connections); server responds with `pong`. This is the opposite direction of the server-driven heartbeat.
- **Reconnect:** client uses exponential backoff (1s, 2s, 4s, ..., capped at 30s). On reconnect, client re-fetches a WS token and re-subscribes to its previous topic list (Zustand-persisted).

### 5.7 The event bus

```
┌──────────────────────┐
│ Engine               │  (e.g., MarketFeedEngine fetches AAPL, computes a tick)
│  emit(PriceTicked)   │
└──────────┬───────────┘
           │
           ▼
┌─────────────────────────────────────────────────────────────┐
│  EventBus (in-process asyncio)                              │
│                                                             │
│  bus.emit(event) → for each subscriber matching event type: │
│      subscriber.handle(event)                               │
│                                                             │
│  Implementation: simple asyncio.Queue per subscriber, or    │
│  fan-out via asyncio.gather(*[s.handle(event) for s in subs])│
└──────────┬─────────────────────┬────────────────────────────┘
           │                     │
           ▼                     ▼
┌──────────────────┐   ┌──────────────────────┐
│ WebSocketSub     │   │ AuditLogSub          │
│  derive topic    │   │  persist to DB       │
│  manager.publish │   │  (PriceTicked goes   │
│   (topic, data)  │   │   to time-series tbl)│
└──────────────────┘   └──────────────────────┘
```

### 5.8 The broadcast pipeline (replaces the current 3-task duplication)

```
yfinance/synthetic                                                 
  ↓                                                                
MarketFeedEngine ──emit──> PriceTicked(symbol, price, ts)         
                              │                                    
                              ├─> CandleEngine (consumes ticks)    
                              │      ├─> emits CandleActive(...)   
                              │      └─> emits CandleClosed(...)   
                              │                                    
                              ├─> SignalEngine (consumes ticks)    
                              │      └─> emits SignalGenerated(...)
                              │                                    
                              └─> WebSocketSubscriber              
                                     ├─> tick.{sym} → topic subs   
                                     ├─> candle.{sym}.{tf} → subs  
                                     └─> signal.{sym} → subs       
```

Each engine consumes events from the bus (it's not a producer-consumer queue; it's pub-sub). This means:
- Adding a new feature (e.g., volume profile chart) = subscribing a new engine to ticks, no other code changes.
- Removing a feature = unsubscribing.
- Testing an engine = inject a mock bus and assert on emitted events.

### 5.9 Backpressure & connection isolation

- `ConnectionManager.broadcast_to_topic` does **not** await every send sequentially. It uses `asyncio.gather(*sends, return_exceptions=True)` *with a per-connection timeout*.
- If a connection's send buffer is full (slow client), the timeout fires → connection marked as `degraded`. After 3 degradations → server disconnects with code 4003 (`SLOW_CONSUMER`).
- This protects all other clients from one slow consumer holding up the broadcast loop.

---

## 6. Data & Persistence

### 6.1 Schema (target)

```sql
-- Users
CREATE TABLE users (
    id              BIGSERIAL PRIMARY KEY,
    username        VARCHAR(64) NOT NULL UNIQUE,
    email           VARCHAR(255),
    hashed_password VARCHAR(255) NOT NULL,
    balance         NUMERIC(20, 2) NOT NULL DEFAULT 100000.00,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Orders (the new entity — every trade originates as an order)
CREATE TABLE orders (
    id                BIGSERIAL PRIMARY KEY,
    client_order_id   UUID NOT NULL UNIQUE,           -- idempotency key
    user_id           BIGINT NOT NULL REFERENCES users(id),
    symbol            VARCHAR(16) NOT NULL,
    side              VARCHAR(8) NOT NULL,            -- BUY | SELL
    order_type        VARCHAR(16) NOT NULL,           -- MARKET | LIMIT | STOP | STOP_LIMIT
    quantity          NUMERIC(20, 8) NOT NULL,
    limit_price       NUMERIC(20, 8),
    stop_price        NUMERIC(20, 8),
    time_in_force     VARCHAR(8) NOT NULL DEFAULT 'GTC',  -- GTC | IOC | FOK | DAY
    status            VARCHAR(16) NOT NULL,           -- PENDING | OPEN | PARTIAL | FILLED | CANCELLED | REJECTED | EXPIRED
    filled_quantity   NUMERIC(20, 8) NOT NULL DEFAULT 0,
    avg_fill_price    NUMERIC(20, 8),
    rejection_reason  TEXT,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
CREATE INDEX idx_orders_symbol_status ON orders(symbol, status);

-- Trades (fills against orders)
CREATE TABLE trades (
    id              BIGSERIAL PRIMARY KEY,
    order_id        BIGINT NOT NULL REFERENCES orders(id),
    user_id         BIGINT NOT NULL REFERENCES users(id),
    symbol          VARCHAR(16) NOT NULL,
    side            VARCHAR(8) NOT NULL,
    quantity        NUMERIC(20, 8) NOT NULL,
    price           NUMERIC(20, 8) NOT NULL,
    fees            NUMERIC(20, 8) NOT NULL DEFAULT 0,
    realized_pnl    NUMERIC(20, 8),
    executed_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_trades_user_time ON trades(user_id, executed_at DESC);

-- Positions (current holdings)
CREATE TABLE positions (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    symbol          VARCHAR(16) NOT NULL,
    quantity        NUMERIC(20, 8) NOT NULL,
    avg_price       NUMERIC(20, 8) NOT NULL,
    cost_basis      NUMERIC(20, 8) NOT NULL,         -- materialized: quantity * avg_price
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, symbol)
);

-- Equity snapshots (for performance charts)
CREATE TABLE equity_history (
    id              BIGSERIAL PRIMARY KEY,
    user_id         BIGINT NOT NULL REFERENCES users(id),
    equity_value    NUMERIC(20, 2) NOT NULL,
    cash_balance    NUMERIC(20, 2) NOT NULL,
    positions_value NUMERIC(20, 2) NOT NULL,
    snapshot_at     TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_equity_user_time ON equity_history(user_id, snapshot_at DESC);

-- Risk profiles (per-user limits)
CREATE TABLE risk_profiles (
    id                    BIGSERIAL PRIMARY KEY,
    user_id               BIGINT NOT NULL UNIQUE REFERENCES users(id),
    max_position_size     NUMERIC(20, 2),
    max_daily_loss        NUMERIC(20, 2),
    max_leverage          NUMERIC(8, 4) DEFAULT 1.0,
    concentration_limit   NUMERIC(8, 4) DEFAULT 0.30,  -- max 30% in one symbol
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Idempotency keys (Redis is primary; this is the backup)
CREATE TABLE idempotency_records (
    key                UUID PRIMARY KEY,
    user_id            BIGINT NOT NULL REFERENCES users(id),
    request_hash       VARCHAR(64) NOT NULL,
    response_body      JSONB NOT NULL,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_idempotency_expires ON idempotency_records(expires_at);
```

### 6.2 Migration policy

- Every schema change ships as an Alembic migration. Autogenerated migrations are reviewed by hand before commit (autogen often gets foreign-key cascade rules wrong).
- Migrations are **forward-only** in deploy practice. Down-migrations exist for local rollback but are never run in prod.
- Migrations include data backfills *only when safe*. Backfill of large tables happens in a separate background job, not in the migration.

### 6.3 Async SQLAlchemy 2.0

- All session work is async (`AsyncSession`, `select()`, `await session.execute(stmt)`).
- The Unit-of-Work is a context manager:
  ```python
  async with uow.begin() as session:
      session.orders  # OrderRepo
      session.users   # UserRepo
      ...
  # commit on exit, rollback on exception
  ```
- Connection pool: `pool_size=10`, `max_overflow=20` per worker. Sized to `workers × 30` against Postgres `max_connections=200`.

### 6.4 Time-series strategy (current and future)

- **Current state (Phase 2-3):** OHLC candles and price ticks live in-memory only. Candle history endpoint reads from yfinance (with cache).
- **Phase 4:** Persist closed candles to `candles` table for historical queries.
- **Phase 5 ceiling:** if tick volume justifies it, introduce TimescaleDB as a separate hypertable. Decision deferred — not required for portfolio defense.

---

## 7. Auth Architecture

### 7.1 Token strategy

- **Access token (JWT, 15 min TTL):** carries `sub`, `iat`, `exp`, `jti`, `roles`. Signed with HS256 using `settings.jwt_secret_key`. Returned on login/register, included in `Authorization: Bearer ...` header.
- **Refresh token (opaque, 7 day TTL):** UUID stored in Redis with value `user_id`. Returned as an `httpOnly`, `secure`, `sameSite=strict` cookie on login. Used at `POST /auth/refresh` to mint a new access token.
- **WS token (short JWT, 60 sec TTL):** minted by `POST /auth/ws-token` (requires access token). Single-use semantics enforced by storing the `jti` in Redis with the TTL.

### 7.2 Login flow

```
Client → POST /auth/login {username, password}
Server:
  - Verify password (bcrypt, isolated to bcrypt 4.x via direct dep, not passlib)
  - Generate access_token + refresh_token
  - Store refresh_token in Redis: SET refresh:{token} {user_id} EX 604800
  - Set httpOnly cookie with refresh token
  - Return {access_token, user: {...}}

Client stores access_token in memory (Zustand, not localStorage)
```

**Why access token in memory, not localStorage?** XSS protection. An access token in localStorage is exfiltratable by any injected script. In memory, it's only readable by the JS that holds the reference. Refresh token in httpOnly cookie is unreachable from JS. This is the modern web auth pattern (OWASP recommendation).

### 7.3 Token refresh flow

```
Client (silent, on access token expiry approaching or 401):
  → POST /auth/refresh (cookie sent automatically)
Server:
  - Read refresh_token from cookie
  - Look up Redis: GET refresh:{token}
  - If valid:
    - Generate new access_token
    - Rotate refresh_token (delete old, set new) — defense against replay
    - Return new access_token, set new cookie
```

### 7.4 Logout flow

```
Client → POST /auth/logout
Server:
  - Delete refresh:{token} from Redis
  - Clear cookie
  - Optionally: add access_token jti to a blocklist (jti:blocked:{jti}) with TTL = remaining access token TTL
```

### 7.5 Frontend integration

- `Zustand authStore` holds: `accessToken`, `user`, `isAuthenticated`.
- `apiClient` interceptor reads `accessToken` from the store (not localStorage).
- 401 response triggers automatic refresh attempt. If refresh fails → call `authStore.logout()`, redirect to `/login`.
- `ProtectedRoute` reads `isAuthenticated` from the store (reactive — re-renders on change).

---

## 8. Execution & Order Architecture

### 8.1 Order lifecycle (state machine)

```
                  ┌─────────────┐
                  │   PENDING   │  (just created, pre-trade risk check passed,
                  └─────┬───────┘    waiting for matcher / market open)
                        │
              ┌─────────┴─────────┐
              │                   │
              ▼                   ▼
        ┌──────────┐         ┌──────────┐
        │   OPEN   │         │ REJECTED │  (risk rule failed, insufficient funds)
        └─────┬────┘         └──────────┘
              │
       ┌──────┴──────┐
       │             │
       ▼             ▼
  ┌─────────┐   ┌─────────┐
  │ PARTIAL │   │ FILLED  │
  └────┬────┘   └─────────┘
       │
       ├──────────────┐
       │              │
       ▼              ▼
  ┌─────────┐   ┌───────────┐
  │ FILLED  │   │ CANCELLED │
  └─────────┘   └───────────┘
                      ▲
                      │
                ┌─────────┐
                │ EXPIRED │  (DAY orders past close)
                └─────────┘
```

### 8.2 Order types (Phase 3.4 scope)

| Type | Description | Fill logic |
|---|---|---|
| MARKET | Fill immediately at current price | Compare current `market_state` price; consume cash/inventory; emit `TradeFilled` |
| LIMIT (BUY) | Fill only if price ≤ limit | Wait for tick where `price ≤ limit`; fill at that price; or expire on DAY |
| LIMIT (SELL) | Fill only if price ≥ limit | Mirror of buy |
| STOP (BUY) | Triggered when price ≥ stop, then becomes MARKET | On trigger tick → fill at current price |
| STOP (SELL) | Triggered when price ≤ stop, then becomes MARKET | Mirror |
| STOP_LIMIT | STOP that becomes a LIMIT (not a MARKET) on trigger | Phase 4 |

### 8.3 The matching engine

A single async task (`OrderMatcher`) subscribes to `PriceTicked` events. On each tick, it queries open orders for that symbol and evaluates fill conditions.

```python
# Pseudocode
async def on_price_ticked(event: PriceTicked):
    open_orders = await order_repo.get_open(symbol=event.symbol)
    for order in open_orders:
        if order.should_fill(event.price):
            await execution_service.fill_order(
                order=order,
                fill_price=order.fill_price_at(event.price),
                fill_quantity=order.remaining_quantity,
            )
```

Fills update the order, create a Trade row, update the Position, update the user balance — all in one transaction. Then emit `TradeFilled`, `PositionChanged`, `BalanceChanged`.

### 8.4 Idempotency

Every order placement requires a `client_order_id` (UUID, supplied by the frontend). The server:
1. Hashes the request body.
2. Checks Redis for `idem:{key}` → if present, validates the request hash matches (rejects with 409 if different request body for same key), returns the cached response.
3. Otherwise, proceeds with execution, then stores `(key, response_hash, response_body)` in Redis for 24h.

This means the frontend can safely retry on network error without risking double-execution.

### 8.5 Pre-trade risk evaluation

Before any state mutation, the order goes through `RiskService.assess()`:

```python
@dataclass(frozen=True)
class RiskAssessment:
    allowed: bool
    violations: list[RiskViolation]
    
@dataclass(frozen=True)
class RiskViolation:
    rule: str           # "max_position_size" | "max_daily_loss" | ...
    severity: Severity  # WARNING | BLOCKING
    message: str
    current_value: Decimal
    limit_value: Decimal
```

`BLOCKING` violations reject the order. `WARNING` violations attach to the response but don't block. The frontend renders both — and this is what makes the risk dashboard genuinely useful, not just decorative.

---

## 9. Quant & ML Architecture

### 9.1 The phased ML approach

The current LSTM is a black box with a broken training pipeline (audit 5.10). We replace it with a deliberate, defensible structure.

**Phase 3** (foundation): Pure factor-based signals. No ML. Explainable, testable, fast.
- `app/domain/signals/factors.py` defines a `Factor` protocol.
- Concrete factors: `MomentumFactor`, `MeanReversionFactor`, `TrendFactor`, `VolatilityFactor`.
- Each factor returns a normalized score in `[-1, 1]`.
- Signal scoring is a calibrated logistic regression on factor outputs (Phase 4) — or a hand-tuned weighted sum (Phase 3 placeholder).
- Tests assert: known input candles → known factor output.

**Phase 4** (ML re-introduction): A small, *legible* model.
- Either: a calibrated gradient boost (LightGBM) trained on factor outputs to predict realized 1-bar return sign.
- Or: a tiny LSTM (rebuilt from scratch with documented preprocessing).
- Training pipeline lives in `ml/training/`, fully reproducible: `python -m ml.training.train --symbol AAPL --start 2020-01-01 --end 2024-01-01`.
- Model artifacts in ONNX format (portable, fast, no TF runtime dependency).
- Inference: `app/infra/ml/predictor.py` loads ONNX, exposes `predict(features) → score`.

**Phase 5** (advanced): Regime detection (HMM or change-point) gating factor weights.

### 9.2 Feature pipeline

The single biggest source of train/serve skew is divergent feature code. We solve this with a shared feature module:

```
app/domain/features/
├── extractors.py       # pure functions: df → DataFrame of features
├── pipeline.py         # composes extractors, handles missing data, normalization
└── schema.py           # explicit feature schema (name, dtype, range, default)
```

Training and serving both call the same `pipeline.transform(candles_df) → features_df`. Train/serve skew is impossible by construction.

### 9.3 Signal computation flow (Phase 3 target)

```
PriceTicked event
       │
       ▼
SignalEngine subscribes to ticks for active symbols
       │
       ├─> rate-limit: max one signal recompute per symbol per N seconds (debounced)
       │
       ▼
fetch recent candles (in-memory cache, fallback to provider)
       │
       ▼
features = FeaturePipeline.transform(candles)
       │
       ▼
factor_scores = {f.name: f.compute(features) for f in factors}
       │
       ▼
signal_score = scoring.combine(factor_scores, risk_metrics)
       │
       ▼
signal = SignalResult(symbol, direction, confidence, factors, ts)
       │
       ▼
emit(SignalGenerated(signal))
```

### 9.4 Backtesting

`app/domain/backtest/` (Phase 4) — a backtest harness that:
- Replays historical candles.
- Runs the same `FeaturePipeline + SignalEngine + ExecutionService` against synthetic ticks.
- Records equity curve, sharpe, drawdown.
- Outputs a JSON report.

The interview talking point: "I designed the live execution path and the backtest to share the same code. Walk-forward backtesting is one CLI command."

---

## 10. Observability

### 10.1 Logging (loguru, structured JSON)

- **Format:** JSON to stdout (12-factor). Fields: `ts`, `level`, `logger`, `msg`, `request_id`, `user_id` (when applicable), `event_type`, custom kvs.
- **No emojis in logs.** Audit finding 12.7.
- **Request ID:** generated at the FastAPI middleware level, propagated via `contextvars` so any logger in the call chain includes it.
- **No PII in logs.** Usernames are fine; passwords / tokens / refresh tokens never logged.

### 10.2 Metrics (Prometheus)

`/metrics` endpoint exposes:
- HTTP: `http_requests_total{method, path, status}`, `http_request_duration_seconds{method, path}` (histogram).
- WebSocket: `ws_connections_active`, `ws_messages_sent_total{type, topic}`, `ws_messages_received_total{type}`.
- Business: `orders_placed_total{symbol, side, type, status}`, `trades_filled_total{symbol, side}`, `signal_generated_total{symbol, direction}`.
- Engine: `engine_loop_duration_seconds{engine}`, `engine_errors_total{engine}`.

### 10.3 Tracing (deferred to Phase 5)

OpenTelemetry instrumentation can be added later. Phase 2/3 focus on logs + metrics; tracing is a P5 polish item that's expensive to add poorly.

### 10.4 Health endpoints

- `GET /health` — process up.
- `GET /health/db` — async DB ping.
- `GET /health/redis` — Redis ping.
- `GET /health/engines` — each engine's last heartbeat timestamp.
- `GET /ready` — composite (all of the above must be green) — used by load balancer readiness probe.

---

## 11. Infra & Deployment Topology

### 11.1 docker-compose.yml (dev shape)

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment: [POSTGRES_DB, POSTGRES_USER, POSTGRES_PASSWORD]
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]
    healthcheck: pg_isready

  redis:
    image: redis:7-alpine
    volumes: [redis_data:/data]
    ports: ["6379:6379"]
    healthcheck: redis-cli ping

  api:
    build: { context: ., dockerfile: Dockerfile, target: api }
    depends_on: { postgres: {condition: service_healthy}, redis: {condition: service_healthy} }
    env_file: [.env]
    ports: ["8000:8000"]
    command: uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
    volumes: [./app:/app/app, ./alembic:/app/alembic]  # hot-reload in dev

  workers:
    build: { context: ., dockerfile: Dockerfile, target: workers }
    depends_on: { postgres: ..., redis: ..., api: ... }
    env_file: [.env]
    command: python -m app.workers.entrypoint

  frontend:
    build: { context: ./frontend, dockerfile: Dockerfile, target: dev }
    ports: ["5173:5173"]
    volumes: [./frontend/src:/app/src]
    environment: [VITE_API_URL=http://localhost:8000, VITE_WS_URL=ws://localhost:8000/ws]

  nginx:    # only in prod profile
    profiles: [prod]
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    depends_on: [api, frontend]
    volumes: [./nginx/nginx.conf:/etc/nginx/nginx.conf:ro]

volumes:
  postgres_data:
  redis_data:
```

### 11.2 Multi-stage Dockerfile (backend)

```
FROM python:3.12-slim as base
  # poetry/uv install, system deps

FROM base as api
  CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]

FROM base as workers
  CMD ["python", "-m", "app.workers.entrypoint"]
```

### 11.3 `.dockerignore` (mandatory)

```
node_modules/
__pycache__/
*.pyc
.git/
.env
.env.*
!.env.example
logs/
*.db
*.sqlite
*.sqlite3
*.h5
.pytest_cache/
.mypy_cache/
htmlcov/
.coverage
.vscode/
.idea/
frontend/node_modules/
frontend/dist/
```

### 11.4 Environment files

- `.env.example` — committed. Defaults that are obviously placeholders (`change-me-in-production`).
- `.env` — gitignored. Local dev values.
- `.env.test` — committed. Used by pytest.
- In production, env vars are injected by the orchestrator (docker secrets / k8s secrets / Fly.io secrets / etc.) — no file involved.

### 11.5 Deployment targets

For the portfolio repo, we target three deployment options of escalating polish:

1. **Local docker compose** — `docker compose up` works on any machine with Docker. Required.
2. **Fly.io or Railway** — single-command deploy, free tier, public URL. Phase 3 polish.
3. **AWS / GCP** — Phase 5 (only if it adds interview value; for most frontend roles, "deployed on Fly.io" is enough).

---

## 12. Canonical Sequence: One Full Trade

This is *the* sequence to memorize. It is the answer to "walk me through a trade in your system."

```
┌──────────┐   ┌─────────┐   ┌──────────┐   ┌──────────┐   ┌────────┐   ┌────────┐   ┌──────────┐
│ Browser  │   │  Nginx  │   │ FastAPI  │   │  Order   │   │ Risk   │   │ Order  │   │ EventBus │
│  (React) │   │         │   │  Routes  │   │ Service  │   │ Domain │   │ Repo   │   │          │
└────┬─────┘   └────┬────┘   └────┬─────┘   └────┬─────┘   └───┬────┘   └───┬────┘   └────┬─────┘
     │              │             │              │             │            │             │
     │ 1. POST /api/v1/orders {symbol, side, qty, type, client_order_id}    │             │
     │ Authorization: Bearer ...                                            │             │
     │ ──────────────►                                                      │             │
     │              │             │              │             │            │             │
     │              │ 2. forward  │              │             │            │             │
     │              │ ──────────► │              │             │            │             │
     │              │             │              │             │            │             │
     │              │             │ 3. Depends(): authenticate user         │             │
     │              │             │    Depends(): validate Pydantic request │             │
     │              │             │    Depends(): extract idempotency key   │             │
     │              │             │              │             │            │             │
     │              │             │ 4. svc.place_order(user_id, req, idem)  │             │
     │              │             │ ──────────►  │             │            │             │
     │              │             │              │             │            │             │
     │              │             │              │ 5. idem.get(key)         │             │
     │              │             │              │    → miss                │             │
     │              │             │              │             │            │             │
     │              │             │              │ 6. async with uow.begin():              │
     │              │             │              │   - load user, positions │             │
     │              │             │              │ ──────────► │            │             │
     │              │             │              │             │            │             │
     │              │             │              │ 7. risk.assess(user, positions, req)    │
     │              │             │              │ ──────────► │            │             │
     │              │             │              │             │            │             │
     │              │             │              │ 8. assessment.allowed = True            │
     │              │             │              │ ◄────────── │            │             │
     │              │             │              │             │            │             │
     │              │             │              │ 9. order = Order.new(...)               │
     │              │             │              │    apply state machine: PENDING → OPEN  │
     │              │             │              │    if MARKET: fill immediately at price │
     │              │             │              │ ──────────► │            │             │
     │              │             │              │             │            │             │
     │              │             │              │ 10. orders.add(order)    │             │
     │              │             │              │     trades.add(trade)    │             │
     │              │             │              │     positions.upsert(...)│             │
     │              │             │              │     users.update(balance)│             │
     │              │             │              │ ─────────────────────────► │           │
     │              │             │              │             │            │             │
     │              │             │              │ 11. uow commits transaction              │
     │              │             │              │             │            │             │
     │              │             │              │ 12. bus.emit(OrderPlaced(order))         │
     │              │             │              │     bus.emit(TradeFilled(trade))         │
     │              │             │              │     bus.emit(PositionChanged(pos))       │
     │              │             │              │     bus.emit(BalanceChanged(balance))    │
     │              │             │              │ ─────────────────────────────────────────►│
     │              │             │              │             │            │             │
     │              │             │              │ 13. idem.store(key, order_response)      │
     │              │             │              │             │            │             │
     │              │             │              │ 14. return order                          │
     │              │             │ ◄──────────  │             │            │             │
     │              │             │              │             │            │             │
     │              │ 15. OrderResponse 201      │             │            │             │
     │              │ ◄────────── │              │             │            │             │
     │ ◄──────────► │             │              │             │            │             │
     │              │             │              │             │            │             │
     │  TanStack Query: optimistic update on success            │            │             │
     │              │             │              │             │            │             │
     │ ┄ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┄│
     │              │             │              │             │            │             │
     │  Meanwhile, asynchronously via the EventBus → WebSocketSubscriber:    │             │
     │              │             │              │             │            │             │
     │ 16. WS push: {type: "trade.filled", topic: "user.42.trade", data: {...}}            │
     │ ◄ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
     │              │             │              │             │            │             │
     │ 17. wsClient handler: queryClient.invalidateQueries(['portfolio'])    │             │
     │     wsClient handler: toast.success("Trade filled: AAPL BUY 10")      │             │
     │              │             │              │             │            │             │
```

**Interview cheat sheet for this sequence:**

- *"How do you handle idempotency?"* → Step 5 + 13. Client supplies `client_order_id` (UUID). Server checks Redis. Same body → cached response. Different body, same key → 409.
- *"How does your frontend stay in sync?"* → Two channels: (a) the POST response itself, optimistically applied; (b) the `trade.filled` WebSocket event, which invalidates TanStack Query caches.
- *"What's atomic in a trade?"* → Step 6-11. Everything inside the UoW. Order persistence, position update, balance update — one transaction. Event emission is *after* commit (step 12). If events fail, the trade is still consistent.
- *"What happens on a race condition (two simultaneous BUYs)?"* → `SELECT ... FOR UPDATE` on the user row at step 6. Second request waits. (Postgres only. SQLite is dev-only.)

---

## 13. Folder Structure: Final State

Full target. Phase 2 doesn't have to land everything; this is what we converge toward.

```
hft-platform/
├── README.md
├── AUDIT.md
├── ARCHITECTURE.md
├── ROADMAP.md
├── LICENSE
├── .gitignore
├── .dockerignore
├── .env.example
├── .env.test
├── pyproject.toml              # replaces requirements.txt
├── uv.lock                     # hashed lockfile
├── alembic.ini
├── docker-compose.yml
├── docker-compose.prod.yml
├── Makefile
├── pytest.ini
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint, type-check, test (backend + frontend)
│       └── cd.yml              # deploy on main
│
├── app/
│   ├── main.py                 # FastAPI app factory
│   ├── api/
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── auth.py
│   │       ├── portfolio.py
│   │       ├── trading.py
│   │       ├── market.py
│   │       ├── signals.py
│   │       ├── analytics.py
│   │       ├── risk.py
│   │       ├── ws.py
│   │       ├── health.py
│   │       └── deps.py         # FastAPI dependencies (CurrentUser, UoW, etc.)
│   │
│   ├── core/
│   │   ├── config.py           # Pydantic Settings
│   │   ├── logging.py          # loguru config
│   │   ├── exceptions.py       # domain + http exception types
│   │   └── security.py         # password hashing
│   │
│   ├── domain/
│   │   ├── entities/
│   │   ├── value_objects/
│   │   ├── pnl/
│   │   ├── orders/
│   │   ├── risk/
│   │   ├── signals/
│   │   ├── features/
│   │   └── backtest/
│   │
│   ├── services/
│   │   ├── auth_service.py
│   │   ├── order_service.py
│   │   ├── portfolio_service.py
│   │   ├── analytics_service.py
│   │   ├── market_service.py
│   │   ├── signal_service.py
│   │   ├── risk_service.py
│   │   └── idempotency_service.py
│   │
│   ├── repositories/
│   │   ├── base.py
│   │   ├── user_repo.py
│   │   ├── order_repo.py
│   │   ├── trade_repo.py
│   │   ├── position_repo.py
│   │   ├── equity_history_repo.py
│   │   ├── candle_repo.py
│   │   └── unit_of_work.py
│   │
│   ├── infra/
│   │   ├── db.py
│   │   ├── redis_client.py
│   │   ├── event_bus/
│   │   │   ├── bus.py
│   │   │   ├── events.py
│   │   │   └── subscribers/
│   │   │       ├── websocket_subscriber.py
│   │   │       ├── audit_subscriber.py
│   │   │       └── snapshot_subscriber.py
│   │   ├── websocket/
│   │   │   ├── manager.py
│   │   │   ├── protocol.py
│   │   │   └── auth.py
│   │   ├── market_data/
│   │   │   ├── provider.py
│   │   │   ├── yfinance_provider.py
│   │   │   ├── synthetic_provider.py
│   │   │   └── cache.py
│   │   ├── ml/
│   │   │   ├── model_loader.py
│   │   │   └── predictor.py
│   │   ├── supervisor.py
│   │   └── metrics.py
│   │
│   ├── engines/
│   │   ├── market_feed.py
│   │   ├── candle_engine.py
│   │   ├── signal_engine.py
│   │   ├── order_matcher.py
│   │   ├── risk_monitor.py
│   │   └── snapshot_engine.py
│   │
│   ├── workers/
│   │   └── entrypoint.py       # supervisor + all engines
│   │
│   ├── schemas/                # Pydantic request/response models
│   │   ├── auth.py
│   │   ├── orders.py
│   │   ├── portfolio.py
│   │   ├── market.py
│   │   ├── signals.py
│   │   └── analytics.py
│   │
│   └── models/                 # SQLAlchemy ORM models
│       ├── base.py
│       ├── user.py
│       ├── order.py
│       ├── trade.py
│       ├── position.py
│       ├── equity_history.py
│       ├── risk_profile.py
│       └── idempotency_record.py
│
├── alembic/
│   ├── env.py
│   ├── script.py.mako
│   └── versions/
│       └── 0001_initial_schema.py
│
├── ml/                         # ML training is a separate sub-project
│   ├── README.md
│   ├── pyproject.toml
│   ├── training/
│   │   ├── prepare_data.py
│   │   ├── features.py         # re-exports from app.domain.features
│   │   ├── train.py
│   │   └── evaluate.py
│   └── notebooks/              # exploratory only, gitignored *.ipynb_checkpoints
│
├── tests/
│   ├── conftest.py
│   ├── unit/
│   │   ├── domain/
│   │   │   ├── test_pnl_fifo.py
│   │   │   ├── test_order_state_machine.py
│   │   │   ├── test_risk_rules.py
│   │   │   └── test_signal_scoring.py
│   │   └── services/
│   │       ├── test_order_service.py
│   │       └── test_idempotency.py
│   ├── integration/
│   │   ├── test_auth_flow.py
│   │   ├── test_trade_lifecycle.py
│   │   └── test_ws_protocol.py
│   └── load/
│       └── ws_smoke.k6.js
│
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   ├── .env.example
│   ├── Dockerfile
│   ├── index.html
│   ├── public/
│   ├── src/
│   │   └── (as in section 4)
│   └── tests/
│       ├── unit/               # component tests with Vitest + Testing Library
│       └── e2e/                # Playwright (Phase 4)
│
├── nginx/
│   └── nginx.conf
│
└── docs/
    ├── ARCHITECTURE.md         # symlink or copy of this file
    ├── WS_PROTOCOL.md
    ├── API.md
    ├── DEPLOY.md
    ├── DESIGN_DECISIONS.md
    └── adr/
        ├── 0001-async-sqlalchemy.md
        ├── 0002-fifo-over-wac.md
        ├── 0003-zustand-tanstack-boundary.md
        ├── 0004-in-process-event-bus.md
        ├── 0005-onnx-over-tf-runtime.md
        └── ...
```

---

## 14. ADR Discipline

Every consequential decision gets a one-page ADR (Architecture Decision Record). Format:

```markdown
# ADR-NNNN: <Title>

**Status:** Accepted | Proposed | Superseded
**Date:** YYYY-MM-DD
**Deciders:** Akki

## Context
What's the situation that requires a decision? What constraints apply?

## Decision
What did we decide?

## Consequences
- ✅ What we gain
- ⚠️ What we accept as cost
- ❌ What we close off

## Alternatives Considered
- Option A: ... rejected because ...
- Option B: ... rejected because ...
```

**Minimum Phase 2 ADRs to write:**
1. `0001-async-sqlalchemy.md` — why async SQLAlchemy 2.0 over sync.
2. `0002-fifo-over-wac.md` — why FIFO cost basis (auditability) over weighted-average.
3. `0003-zustand-tanstack-boundary.md` — why split client vs server state.
4. `0004-in-process-event-bus.md` — why not Kafka in Phase 2.
5. `0005-onnx-over-tf-runtime.md` — when ML is reintroduced.

These ADRs are interview gold. "I chose FIFO because in real markets cost-basis methodology has tax implications and an auditor needs to see lot-level matching" is a much better answer than "yeah I just used FIFO."

---

## 15. Migration Strategy: Current → Target

We do not rewrite the codebase. We migrate it, file by file, in a defined order.

### 15.1 The order of operations

The dependency graph forces a specific order:

```
Phase 2.0: Hygiene Sweep (kills dead code, fixes deps, fixes CI/Docker)
   │
   ▼
Phase 2.1: Auth + Config (fixes JWT secret, restores config integrity)
   │
   ▼
Phase 2.2: Database Truth (reconcile models/migrations, drop create_all)
   │
   ▼
Phase 2.3: Service + Repository Layers (no behavior change, pure structural refactor)
   │
   ▼
Phase 2.4: PnL + Execution Correctness (Decimal money, idempotency, FIFO)
   │
   ▼
Phase 2.5: Real-Time Pipeline v1 (event bus, single broadcast path, incremental candles)
   │
   ▼
Phase 2.6: Frontend Foundations (Zustand + TanStack Query, reactive auth, feature dirs)
   │
   ▼
Phase 2.7: Test Foundations (real pytest + Vitest, CI green)
   │
   ▼
Phase 3+: Order types, advanced WS protocol, quant differentiation, deploy polish
```

Each phase is **independently mergeable**. The codebase should be in a runnable state at the end of every phase.

### 15.2 The "strangler fig" pattern for routes.py

We do not delete `app/api/routes.py` and replace it. We:

1. Create `app/api/v1/__init__.py` with an empty router.
2. Move *one* domain (auth first) into `app/api/v1/auth.py`.
3. Mount both old and new routers in `main.py` at the same prefix; new router takes precedence.
4. Verify auth endpoints still work end-to-end.
5. Delete auth routes from `app/api/routes.py`.
6. Repeat for portfolio, trading, market, signals, ws.
7. When routes.py is empty, delete it.

This guarantees a runnable system at every step. No "big bang" merge.

### 15.3 The compatibility shims

Phase 2 will, in places, introduce **temporary shims**:
- `app/portfolio/pnl_engine.py` will re-export from `app/services/portfolio_service.py` for one phase, so importers don't all break at once.
- `app/api/routes.py` will gradually empty out — old endpoints stay live until their replacements are tested.
- `marketStore.js` will be deleted only after `useMarket` is rewritten against the Zustand store.

Each shim has an explicit "delete by" phase commit. No shim lives longer than one phase.

### 15.4 What does NOT change in Phase 2

To control scope:
- **No new visual design system.** Polish in Phase 3.
- **No new pages.** All current pages (Dashboard, Portfolio, Trade, Market, Performance) remain. Internals change, surface area doesn't.
- **No quant feature expansion.** Factors stay as-is until Phase 3+.
- **No new external dependencies** beyond what's listed in section 16.4.

---

## 16. Explicit Non-Goals

Things that are *not* in scope. Naming them is half the design.

### 16.1 Not a real exchange
This is a simulator. We do not connect to a live broker, do not route real orders, do not handle real money. The interview pitch is *"a faithful simulator of the data and execution architecture you'd find at a trading firm."*

### 16.2 Not a regulated system
No KYC, no AML, no SEC reporting, no tax-form generation. Mentioning these as "future work" is good interview hygiene; building them is out of scope.

### 16.3 Not multi-tenant SaaS
One user per session. We have a `users` table, but the system isn't designed for cross-tenant isolation, role hierarchies, or org-level admin. Adding those later would be straightforward but isn't a goal.

### 16.4 Dependency budget (locked for Phase 2-3)

**Backend (Python):**
- Runtime: `fastapi`, `uvicorn[standard]`, `pydantic`, `pydantic-settings`, `sqlalchemy[asyncio]`, `alembic`, `asyncpg`, `redis[hiredis]`, `bcrypt`, `pyjwt[crypto]`, `httpx`, `yfinance`, `loguru`, `prometheus-client`, `python-ulid`.
- Dev: `pytest`, `pytest-asyncio`, `pytest-cov`, `ruff`, `mypy`, `factory-boy`.
- *Removed:* `passlib`, `redis-py-cluster`, `celery`, `apscheduler`, `tensorflow`, `keras`, `python-jose`. (See audit 3.7.)
- ML (Phase 4+, separate `ml/` subproject): `onnxruntime`, `scikit-learn`, `lightgbm`, `pandas`, `numpy`.

**Frontend (npm):**
- Runtime: `react`, `react-dom`, `react-router-dom`, `zustand`, `@tanstack/react-query`, `axios`, `lightweight-charts`, `recharts`, `framer-motion`, `clsx`, `tailwind-merge`, `lucide-react`, `react-hot-toast`, `date-fns`.
- Dev: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `eslint`, `@eslint/js`, `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `vitest`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`.
- *Added vs current:* `zustand`, `@tanstack/react-query`, `clsx`, `tailwind-merge`, `lucide-react`, `react-hot-toast`, `date-fns`, `vitest` + testing libraries.

This is the dependency surface for the next 6 weeks. Any addition requires a one-line justification in the relevant ADR.

---

*End of Architecture Document. The next deliverable is `ROADMAP.md` — the phased implementation plan that executes against this architecture.*
