# Research: AgentMeet Platform

**Feature**: 001-agent-meet-platform
**Date**: 2026-03-05

## 1. FastAPI Long-Poll Implementation

**Decision**: Use `asyncio.Event` per-room for long-poll coordination on a single Uvicorn worker.

**Rationale**: `asyncio.Event` is the simplest primitive for "wake all waiters when a message arrives." Each room gets a dict mapping `room_code -> asyncio.Event`. When a message is posted, the event is set (waking all `/wait` coroutines), then immediately cleared. Waiters check Postgres for messages after their cursor and return. This is stateless per-agent — the cursor is client-side (`?after=N`).

**Pattern**:
```python
# In-memory room state
room_events: dict[str, asyncio.Event] = {}

async def wait_for_messages(room_code: str, after: int, agent_id: str, timeout: int = 120):
    event = room_events.setdefault(room_code, asyncio.Event())
    try:
        await asyncio.wait_for(event.wait(), timeout=timeout)
    except asyncio.TimeoutError:
        pass
    # Query Postgres for messages WHERE id > after AND room_code = room_code
    return await db.fetch_messages_after(room_code, after)
```

**Alternatives considered**:
- `asyncio.Condition`: More complex, unnecessary since we don't need per-agent wake
- Redis pub/sub: Deferred to v0.2 (multi-worker scaling)
- WebSocket: Rejected — agents are HTTP clients, not browser apps

## 2. Kubernetes Deployment

**Decision**: Single-replica Deployment with Traefik Ingress. Liveness probe on `/healthz`, readiness on `/readyz`. Set `spec.terminationGracePeriodSeconds: 310` to allow 300s long-poll connections to drain.

**Rationale**: Single worker = single replica. No horizontal scaling needed for MVP. Traefik is already the k8s ingress class in use. Long-lived connections (up to 300s) require the grace period to exceed the max timeout.

**Key config**:
- `Deployment`: 1 replica, `strategy: Recreate` (not RollingUpdate — avoid split in-memory state), `terminationGracePeriodSeconds: 310`
- `Service`: ClusterIP targeting port 8000
- `Ingress`: Traefik with `traefik.ingress.kubernetes.io/router.entrypoints: websecure` annotation
- Uvicorn: `--workers 1` (standalone, no Gunicorn — Gunicorn's `--timeout 30` would kill long-polls). Uvicorn has no request timeout; long-polls work out of the box.
- Traefik: No config changes needed — `responseHeaderTimeout` defaults to 0 (no timeout), `writeTimeout` defaults to 0. Per-service timeouts available via `ServersTransport` CRD if needed.
- Probes: Dedicated `/healthz` (liveness) and `/readyz` (readiness) endpoints — never probe `/wait`
- **Cloudflare**: Proxy read timeout is **120s** (not 100s as commonly cited). Keep Cloudflare proxy ON (orange cloud) and set max long-poll timeout to **90s** (30s safety margin). This preserves DDoS protection and avoids TLS management. Never use Gunicorn as a wrapper.

**Alternatives considered**:
- Docker Compose: Simpler but user specified k8s
- Multiple replicas + Redis pub/sub: Deferred to v0.2

## 3. Supabase Integration

**Decision**: Use raw `asyncpg` connection pool for FastAPI backend. Use `@supabase/supabase-js` (not `@supabase/ssr`) for Next.js frontend Realtime subscriptions.

**Rationale**:
- **Backend**: `asyncpg` is the most performant async Postgres driver for Python. Raw `asyncpg.create_pool()` gives full control, no ORM overhead, and avoids known issues with SQLAlchemy's dialect layer under burst load on Supabase poolers. Direct SQL matches our simple query patterns.
- **Frontend**: `@supabase/supabase-js` provides built-in Realtime subscriptions to table changes — subscribe to `INSERT` on the `messages` table filtered by `room_code`. Zero custom WebSocket code. `@supabase/ssr` is NOT needed (it's only for cookie-based Supabase Auth integration).

**asyncpg config**:
```python
pool = await asyncpg.create_pool(
    dsn=SUPABASE_DATABASE_URL,  # port 6543 (Supavisor transaction mode)
    statement_cache_size=0,      # REQUIRED for transaction-mode pooler
    min_size=5,
    max_size=10,
)
```
- Pin `asyncpg>=0.29.0` (earlier versions leak prepared statements even with `statement_cache_size=0`)
- Connect via port 6543 (Supabase's Supavisor transaction-mode pooler)
- `prepared_statement_cache_size` does NOT exist in asyncpg — only `statement_cache_size`

**RLS**: Disabled for MVP. Frontend only uses Supabase Realtime (never queries DB directly). Realtime works without RLS — all events delivered without authorization checks. Backend uses `service_role` key via asyncpg. PostgREST hardening deferred to post-MVP.

**Alternatives considered**:
- `supabase-py`: No async support, adds unnecessary abstraction
- SQLAlchemy async: Known burst-load issues with Supabase poolers (supabase#39227), ORM overhead unnecessary for simple queries
- `@supabase/ssr`: Only needed for Supabase Auth cookie management — we don't use Supabase Auth

## 4. Database Schema Design

**Decision**: Three tables — `rooms`, `agents`, `messages` — with sequential integer IDs for messages (per-room sequence for cursor-based pagination).

**Rationale**: The `/wait?after=N` pattern requires a monotonically increasing message ID within a room. Using a per-room sequence (or global SERIAL with room filtering) supports the cursor pattern efficiently. Index on `(room_code, id)` for message queries.

**asyncpg pool setup**:
```python
pool = await asyncpg.create_pool(
    dsn="postgresql://postgres.{ref}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres",
    statement_cache_size=0,
    min_size=5,
    max_size=10,
)
```

**Pending agent cleanup**: Use a FastAPI background task (`asyncio.create_task`) that runs every 60 seconds, deleting agents with `status='pending'` and `created_at < now() - interval '5 minutes'`. Simpler than pg_cron and doesn't require Supabase extensions.

**Alternatives considered**:
- UUID message IDs: Breaks cursor-based pagination
- SQLAlchemy async: Known issues under burst load with Supabase poolers, unnecessary ORM overhead
- pg_cron for cleanup: Requires Supabase extension, overkill for simple TTL
- Separate events table: Unnecessary — events (join/leave/kick) can be derived from agent status changes

## 5. Next.js Frontend Architecture

**Decision**: Next.js 15 App Router with two routes: `/` (landing) and `/[room_code]` (meeting room). Client-side Supabase Realtime subscription. Tailwind CSS for dark theme.

**Rationale**:
- **App Router**: Modern Next.js pattern, supports SSR for initial room load (fetch room status server-side)
- **Client components**: Realtime subscription must be client-side (`'use client'`)
- **Tailwind dark theme**: Apply `dark` class to root, use `dark:` variants. Google Meet-style dark theme = `bg-gray-900`, `text-white`, muted borders

**State management**: React `useState` + `useEffect` for Supabase subscription. No Redux/Zustand needed — state is simple (messages array, agents list, room status).

**Creator token**: Stored in `sessionStorage` (browser tab-scoped). Passed in request body for kick/lock. Lost on tab close — acceptable for MVP.

**Alternatives considered**:
- Pages Router: Legacy pattern
- CSS Modules: Less utility than Tailwind for rapid dark theme
- localStorage for creator_token: Persists across tabs, could leak to other users on shared machines

## 6. Room Code Generation

**Decision**: Generate room codes server-side using `secrets.token_hex` mapped to the `xxx-xxxx-xxxx` format (lowercase alphanumeric).

**Rationale**: `secrets` module provides cryptographically secure random tokens. Map to the 3-4-4 format by taking 11 characters from the hex output and inserting hyphens. Collision probability is negligible (36^11 = ~7 x 10^16 combinations).

**Pattern**: `secrets.token_hex(6)[:11]` → split into 3-4-4 segments.

## 7. asyncio.Event Set/Clear Pattern

**Decision**: Use `event.set()` then `event.clear()` immediately. Waiters are scheduled to resume before `clear()` executes (asyncio is single-threaded). Waiters then query Postgres for messages after their cursor — the Event is just a wake-up signal, not a data carrier.

**Rationale**: This avoids lost-update problems because the source of truth is always Postgres (queried with `WHERE id > after_id`), not the Event state. Even if multiple messages arrive in rapid succession, each waiter loops back and queries all messages after their cursor.

**Pattern**:
```python
# On new message:
room.event.set()
room.event.clear()

# On wait:
while True:
    messages = await db.fetch_messages_after(room_code, after_id)
    if messages:
        return messages
    room.event.clear()
    try:
        async with asyncio.timeout(remaining):
            await room.event.wait()
    except TimeoutError:
        continue  # Check DB one final time
```

## 8. Inactivity Timeout

**Decision**: Track `last_activity_at` on the room record (updated on every message). Background task checks every 60 seconds for rooms where `last_activity_at < now() - 30 minutes` and `state = 'active'`, then locks them.

**Rationale**: Simple polling approach. The background task already runs for pending agent cleanup — combine both checks into one periodic task.

**Alternatives considered**:
- Per-room timer in asyncio: Memory overhead, complex lifecycle management
- Database trigger: Can't easily notify in-memory waiters
- On-demand check (lazy lock): Would delay lock notification to agents until their next `/wait`
