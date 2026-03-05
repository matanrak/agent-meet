# Row-Level Security (RLS) — Deep Dive

RLS is the backbone of multi-tenant data isolation. Every query the backend runs is **filtered by the database itself** based on who is asking. Even if a bug in application code forgets a `WHERE user_id = ...` clause, the database will never return another user's data.

## How Supabase RLS Works (Background)

Supabase PostgreSQL has a built-in role hierarchy:

```
postgres          <- superuser, has BYPASSRLS (ignores all policies)
  └── supabase_admin
        └── authenticator   <- the role the backend connects as
              └── authenticated  <- SET ROLE'd to per-request (has RLS policies)
              └── anon           <- for unauthenticated access (not used here)
```

The key function is `auth.uid()`, which Supabase defines as:

```sql
-- Supabase's built-in function (simplified)
CREATE FUNCTION auth.uid() RETURNS uuid AS $$
  SELECT (current_setting('request.jwt.claims', true)::json->>'sub')::uuid;
$$ LANGUAGE sql STABLE;
```

This reads the `sub` claim from a PostgreSQL session variable (`request.jwt.claims`). RLS policies then use `auth.uid()` to filter rows.

## The Connection String — Why `authenticator`, Not `postgres`

```bash
# backend/.env.example
DATABASE_URL=postgresql+asyncpg://authenticator:postgres@host.docker.internal:54322/postgres
```

The backend connects as **`authenticator`**, NOT `postgres`. This is critical:
- `postgres` has `BYPASSRLS` — it ignores all RLS policies entirely
- `authenticator` respects RLS but can `SET ROLE` to `authenticated` (a role that has RLS policies applied)

If you accidentally connect as `postgres`, RLS does nothing and every user sees all data.

## Per-Request RLS Context Setup

Every request (REST or MCP) must set two things before any queries:

```python
# backend/app/db/rls.py
async def set_rls_context(session: AsyncSession, user_id: str) -> None:
    # 1. Switch role from authenticator -> authenticated
    #    This activates the RLS policies (which are "TO authenticated")
    claims = json.dumps({"sub": user_id, "role": "authenticated"})
    await session.execute(text("SET LOCAL role TO 'authenticated'"))

    # 2. Inject the user's identity into the session
    #    auth.uid() reads this to know WHO the current user is
    await session.execute(
        text("SELECT set_config('request.jwt.claims', :claims, true)"),
        {"claims": claims},
    )
```

**`SET LOCAL`** scopes the role change to the current transaction only. When the transaction ends, the role reverts automatically. The `true` in `set_config(..., true)` also makes the setting transaction-local.

## The Session Lifecycle

```
                    ┌─────────────────────────────────────────┐
    Request         │         PostgreSQL Connection            │
    arrives         │         (from connection pool)           │
        |           │                                          │
        v           │  Role: authenticator (default)           │
  get_session()     │  Claims: '' (empty)                      │
        |           │                                          │
        v           │  ┌─────────────────────────────────────┐ │
  session.begin()   │  │ Transaction starts                   │ │
        |           │  │                                      │ │
        v           │  │ SET LOCAL role TO 'authenticated'    │ │
  set_rls_context() │  │ set_config('request.jwt.claims',    │ │
        |           │  │   '{"sub":"user-uuid"}', true)       │ │
        v           │  │                                      │ │
  SQL queries       │  │ SELECT * FROM recommendations        │ │
  (RLS enforced)    │  │ -> DB auto-adds:                     │ │
        |           │  │   WHERE user_id = auth.uid()         │ │
        v           │  │                                      │ │
  session.commit()  │  │ Transaction ends                     │ │
        |           │  └─────────────────────────────────────┘ │
        v           │                                          │
  Connection        │  Role reverts to: authenticator          │
  returns to pool   │  Claims: reset by checkin listener       │
                    └─────────────────────────────────────────┘
```

## Connection Pool Safety — Preventing RLS Leakage

When a connection returns to the pool, the transaction is over, so `SET LOCAL` has already reverted. But as a defense-in-depth measure, an event listener explicitly resets everything:

```python
# backend/app/db/rls.py
@event.listens_for(engine.sync_engine, "checkin")
def reset_role(dbapi_connection, connection_record):
    """Reset role when connection returns to pool."""
    if dbapi_connection is None:
        return
    cursor = dbapi_connection.cursor()
    cursor.execute("RESET role")                     # Back to authenticator
    cursor.execute("SET request.jwt.claims TO ''")   # Clear identity
    cursor.close()
```

**Why both?** `SET LOCAL` is transaction-scoped and should auto-revert. But if a transaction is left in an unexpected state (e.g., implicit commit, connection error), the checkin listener is a safety net. Without it, a connection could retain User A's identity and serve it to User B's next request.

## RLS Policies Per Table

Every table has RLS enabled and policies scoped to `authenticated`:

**recommendations** — Direct ownership:
```sql
ALTER TABLE recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_isolation" ON recommendations
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))          -- read filter
  WITH CHECK (user_id = (SELECT auth.uid()));    -- write filter
```

**lists** — Direct ownership (same pattern):
```sql
CREATE POLICY "user_isolation" ON lists
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```

**list_items** — Indirect ownership via join to lists:
```sql
-- list_items has no user_id column — it inherits ownership from the parent list
CREATE POLICY "user_isolation" ON list_items
  FOR ALL TO authenticated
  USING (list_id IN (
    SELECT id FROM lists WHERE user_id = (SELECT auth.uid())
  ))
  WITH CHECK (list_id IN (
    SELECT id FROM lists WHERE user_id = (SELECT auth.uid())
  ));
```

This is a **subquery-based policy** — the database joins to `lists` to check ownership. More expensive than a direct column check, but necessary because `list_items` is a junction table.

**activity_log** — Read-only for users, write via RLS context:
```sql
-- Users can only READ their own activity
CREATE POLICY "Users see own activity" ON activity_log
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- App inserts as authenticated role with RLS context set
CREATE POLICY "Users insert own activity" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
```

**api_keys** — Direct ownership:
```sql
CREATE POLICY "user_isolation" ON api_keys
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
```

## Quota Functions — Bypass RLS by Design

Quota enforcement uses SQL functions that run as the **function definer**, not the caller:

```sql
CREATE FUNCTION user_recommendation_count(user_uuid UUID) RETURNS bigint AS $$
  SELECT COUNT(*) FROM recommendations WHERE user_id = user_uuid;
$$ LANGUAGE sql STABLE;
```

These functions take the `user_uuid` as an explicit parameter rather than using `auth.uid()`. This means they work correctly regardless of RLS context — even from the Alembic migration runner (which connects as `postgres`).

## Alembic Migrations — Role Switching

Migrations need DDL privileges (`CREATE TABLE`, `ALTER TABLE`). The `authenticator` role doesn't have these. So the migration runner swaps to `postgres`:

```python
# backend/migrations/env.py
def get_url() -> str:
    url = os.environ.get("DATABASE_URL", ...)
    # authenticator.projectref -> postgres.projectref
    return url.replace("authenticator.", "postgres.")
```

This means:
- **App runtime**: `authenticator` -> `SET ROLE authenticated` -> RLS enforced
- **Migrations**: `postgres` -> BYPASSRLS -> can CREATE/ALTER/DROP tables and policies

## Known RLS Issues and Gotchas

1. **Forgetting to set RLS context = silent data leak.** If `set_rls_context()` isn't called, queries run as `authenticator` (which has no RLS policies applied by default). Depending on the Supabase config, this could either return no rows or ALL rows. The codebase mitigates this by always calling `set_rls_context` at the start of every session via `get_session()`.

2. **MCP tools create their own sessions.** Unlike REST routes (which use `get_session(user_id)`), MCP tools manually create sessions and call `set_rls_context` inline:
   ```python
   async with async_session_factory() as session:
       async with session.begin():
           await set_rls_context(session, user_id)
           # ... operations
   ```
   This duplication means a new MCP tool could forget to set RLS context. No centralized enforcement.

3. **`list_items` subquery policy is expensive at scale.** For every `list_items` operation, PostgreSQL runs `SELECT id FROM lists WHERE user_id = auth.uid()`. With many lists per user, this subquery runs per-row. Could be optimized with a materialized view or by adding a denormalized `user_id` column to `list_items`.

4. **`activity_log` INSERT policy was missing initially.** The original Supabase migration only created a SELECT policy. The app inserts as `authenticated` role (not `postgres`), so inserts silently failed. Fixed later in the test conftest and migration 005. This is a class of bug where **RLS silently drops writes** instead of raising an error.

5. **`(SELECT auth.uid())` vs `auth.uid()` performance.** Supabase recommends `(SELECT auth.uid())` (with the subquery wrapper) instead of plain `auth.uid()` in policies. The subquery form is evaluated once per query, while the function form can be evaluated per-row. This project correctly uses the `SELECT` form everywhere.

6. **Schema drift risk with two migration systems.** Supabase migrations create RLS policies in SQL, and Alembic migrations also create RLS policies in Python. If both systems create a policy with the same name, migrations fail. The Supabase migrations use descriptive names (`"Users see own recommendations"`), while Alembic uses generic names (`"user_isolation"`). This works because they run on different deployments (Supabase CLI for initial setup, Alembic for ongoing evolution), but it's fragile.

7. **Realtime + RLS.** Supabase Realtime (used by the frontend for live updates) also respects RLS policies. The frontend subscribes to `postgres_changes` on the `recommendations` table, and Supabase only sends events for rows matching the user's RLS policy. This means User A won't see User B's inserts — but only if the Realtime subscription includes the correct auth token.
