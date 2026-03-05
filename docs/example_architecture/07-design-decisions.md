# Key Design Decisions

## Direct asyncpg Instead of Supabase Client SDK

The backend connects directly to PostgreSQL via asyncpg/SQLAlchemy instead of using the Supabase Python client. This gives:
- Full SQLAlchemy ORM/query builder capabilities
- Async connection pooling with health checks
- Alembic migrations for schema evolution
- RLS context set via raw SQL (no SDK abstraction layer)

Trade-off: Must manually manage RLS context and connection pool role resets.

## Dual API Surface (MCP + REST)

Both MCP tools and REST endpoints call the same service layer. This means:
- AI agents use MCP (with OAuth)
- Web frontend uses REST (with JWT)
- External scripts/agents use REST (with API key)
- Business logic is never duplicated

## In-Memory Rate Limiting

Simple, zero-dependency rate limiter using a dict of timestamp lists. Works because:
- Single worker process (`--workers 1`)
- Single replica (`replicas: 1`)

**Breaks if:** You scale to multiple workers or replicas. Would need Redis or a DB-backed rate limiter.

## Supabase Realtime for Live Updates

Frontend subscribes to `postgres_changes` on your domain table. When an MCP agent writes data, the frontend updates instantly without polling. The user talks to an AI agent, and the result appears in the UI in real-time.

## Client-Side Clustering

Example: clustering is done on the frontend with `supercluster`, not on the backend. All records are fetched once (`limit: 1000`) and processed in-browser. This keeps the backend simple but limits scale to ~1000 records per user. Swap this pattern for your feature's data loading strategy.
