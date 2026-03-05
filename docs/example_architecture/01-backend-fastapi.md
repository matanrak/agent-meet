# Backend Architecture

## 1.1 App Composition — Two Apps in One Process

The single uvicorn process serves **two mounted FastAPI apps**:

```python
# main.py — the key design decision
app = FastAPI(lifespan=lifespan)           # Root app (no CORS — MCP handles its own)
api = FastAPI()                             # REST sub-app (with CORS)

app.mount("/api", api)                      # REST routes at /api/*
app.mount("/", mcp_app)                     # MCP/SSE at / (catch-all)
```

**Why this matters:**
- FastMCP's OAuth flow manages its own CORS headers. Adding global CORS would conflict.
- The REST sub-app gets isolated CORS config (wildcard pattern support for `*.vercel.app` preview URLs).
- Both apps share the same database engine, services, and models — zero code duplication.

**Design choice — WildcardCORSMiddleware:** Standard FastAPI CORS middleware doesn't support glob patterns. A custom `BaseHTTPMiddleware` subclass handles `*.vercel.app` patterns via regex matching. This allows Vercel preview deployments to work without whitelisting each URL.

## 1.2 Authentication — Three Entry Points, One Identity

| Entry Point | Auth Method | Used By |
|---|---|---|
| Unversioned `/api/` routes | JWT only (`HTTPBearer`) | Next.js frontend |
| Versioned `/api/v1/` routes | JWT **or** API key (`x-api-key` header) | External agents, scripts, frontend |
| MCP tools (`/mcp`) | OAuth → JWT (FastMCP `RemoteAuthProvider`) | AI agents (Claude Desktop, etc.) |

**JWT verification:** JWKS fetched from Supabase (`/auth/v1/.well-known/jwks.json`), verified with ES256 algorithm, `audience="authenticated"`.

**API key system:**
- Keys generated with 256-bit entropy: `<prefix>_<base64url>` format (e.g. `agm_`, `myapp_`)
- Stored as SHA-256 hash (never plaintext)
- `key_prefix` stored for display (`<prefix>_aBcDeFgH...`)
- 10 active keys per user quota
- `last_used_at` updated on each authentication
- Key management endpoints (create/list/revoke) are **JWT-only** — you can't use an API key to create more API keys

**Dual-auth flow (`get_auth_context`):**
1. Try JWT first
2. If JWT missing/invalid and API key present, try API key
3. Returns `AuthContext(user_id, access_method)` for activity logging

## 1.3 Database Architecture

**Connection:** Direct asyncpg via SQLAlchemy async engine. No Supabase client SDK on the backend — just raw PostgreSQL.

```python
engine = create_async_engine(
    settings.DATABASE_URL,
    pool_size=5, max_overflow=10,
    pool_pre_ping=True,    # Detect stale connections
    pool_recycle=300,       # Recycle after 5 minutes
)
```

**Models:** SQLModel (Pydantic + SQLAlchemy hybrid). JSONB columns for `tags` and `image_urls`.

**Migrations:** Dual migration strategy:
- **Supabase migrations** (`supabase/migrations/*.sql`): Schema creation, RLS policies, PostGIS functions — run via Supabase CLI
- **Alembic migrations** (`backend/migrations/versions/*.py`): Column additions, schema evolution — run at deploy time

## 1.4 Service Layer

Shared between MCP tools and REST routes. Key services:

- **`<domain>.py`** — CRUD with validation, sanitization (bleach), quota enforcement, domain-specific validation
- **`lists.py`** — List CRUD, batch save (atomic list + N items), quotas
- **`api_keys.py`** — Key generation, SHA-256 hashing, authentication, revocation
- **`rate_limit.py`** — In-memory sliding window (1000/hour, 3000/day per user)
- **`activity.py`** — Activity logging for audit trail

**Input sanitization:** All user text runs through `bleach.clean(value, tags=[], strip=True)` — strips HTML, prevents XSS at the storage layer.

## 1.6 Rate Limiting — Full Analysis

### Implementation

In-memory sliding window per user. A `defaultdict(list)` of `time.monotonic()` timestamps.

```python
# backend/app/services/rate_limit.py
HOURLY_LIMIT = 1000
DAILY_LIMIT = 3000

_rate_calls: dict[str, list[float]] = defaultdict(list)

def check_rate_limit(user_id: str, count: int = 1) -> None:
    now = time.monotonic()
    calls = _rate_calls[user_id]
    _rate_calls[user_id] = calls = [t for t in calls if now - t < DAY]  # Prune >24h

    hourly = sum(1 for t in calls if now - t < HOUR)
    if hourly + count > HOURLY_LIMIT: raise RateLimitExceededError(...)
    if len(calls) + count > DAILY_LIMIT: raise RateLimitExceededError(...)
    for _ in range(count):
        calls.append(now)
```

**Two wrappers** for different contexts:
- `_check_rate_limit(user_id)` — MCP tools, converts to `ValueError`
- `handle_rate_limit_http(user_id)` — REST v1, raises `HTTPException(429)` with `Retry-After` header

### What's Rate-Limited (and What's NOT)

| Endpoint | Rate Limited? | Notes |
|---|---|---|
| **MCP tools** (all 10) | Yes | Every tool call checks `_check_rate_limit(user_id)` |
| `POST /api/v1/recommendations` | Yes | `handle_rate_limit_http(auth.user_id)` |
| `POST /api/v1/lists` (batch create) | Yes | `handle_rate_limit_http(auth.user_id, n)` — counts N items |
| `GET /api/v1/recommendations` | **NO** | Reads are not rate-limited |
| `GET /api/v1/lists`, `GET /api/v1/lists/{id}` | **NO** | |
| `PUT /api/v1/recommendations/{id}` | **NO** | Updates are not rate-limited |
| `DELETE /api/v1/recommendations/{id}` | **NO** | Deletes are not rate-limited |
| `GET /api/v1/activity` | **NO** | |
| All unversioned `/api/` routes | **NO** | Legacy routes have zero rate limiting |
| `POST /api/v1/api-keys` | **NO** | Key creation not rate-limited (has quota: 10 keys) |
| Auth endpoints (JWT verify, API key lookup) | **NO** | No failed-auth throttle |
| Health endpoints | **NO** | Expected |

### Gaps

1. **No rate limiting on authentication failures.** An attacker can send unlimited `x-api-key` header attempts. The 256-bit key entropy makes brute-force impractical, but there's no alerting or blocking of suspicious patterns. A failed auth attempt logs `logger.warning` but nothing throttles the caller.

2. **Read endpoints are unlimited.** `GET /api/v1/recommendations` with no rate limit means an attacker (or runaway script) can hammer the database with search queries. The ILIKE pattern search (`%query%`) is especially expensive.

3. **Unversioned routes are completely unprotected.** The frontend uses `/api/recommendations` (unversioned), which has NO rate limiting. A compromised JWT could issue unlimited reads.

4. **Updates and deletes are not rate-limited.** A malicious script could delete all 1000 recommendations instantly.

5. **No per-IP rate limiting.** All limits are per-user-id (post-authentication). Pre-auth abuse (scanning for valid API keys, brute-forcing) has no throttle.

### Architectural Constraints

- **In-memory only** — state lost on process restart, not shared across workers/replicas
- **Single worker, single replica** — this is WHY in-memory works, but it's a coupling
- **`time.monotonic()`** — immune to clock skew, but means rate limit state is process-local
- **Linear scan for pruning** — `[t for t in calls if now - t < DAY]` is O(n) per check. At 3000 calls/day max, this is fine. At higher limits, use a deque.
- **No persistence** — if you need rate limits to survive restarts, move to Redis or PostgreSQL

### For New Projects — Recommendations

For a copy of this architecture, decide based on scale:

| Scale | Approach |
|---|---|
| MVP / <100 users | In-memory is fine. Add rate limits to ALL endpoints (reads too). |
| Production / multi-replica | Redis with sliding window (e.g., `redis-py` + Lua script) |
| Enterprise | API gateway rate limiting (Kong, Traefik middleware, Cloudflare) |

Always add:
- **Pre-auth rate limiting** per IP (failed auth attempts)
- **Read rate limiting** (lower priority but prevents scraping)
- **Global request size limits** (`--limit-request-body` in uvicorn)
