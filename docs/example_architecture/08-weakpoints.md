# Weakpoints and Risks

## Critical

1. **In-memory rate limiter is not durable.** Process restart resets all limits. Multiple replicas would have independent limits. Solution: Redis or PostgreSQL-backed rate limiter.

2. **No CI/CD pipeline.** No `.github/workflows/` — deployments appear to be manual (`docker build` + `kubectl apply`). This means no automated tests, no lint checks, no build verification before deploy.

3. **No Next.js middleware for auth.** Auth is entirely client-side. Users can access protected pages briefly before being redirected. A `middleware.ts` that checks the Supabase session cookie would fix this.

4. **Single replica, single worker.** The backend runs 1 pod with 1 uvicorn worker. Zero redundancy — a pod restart means downtime. The in-memory rate limiter and the single-worker constraint are coupled.

## Moderate

5. **Frontend fetches ALL recommendations at once** (`limit: 1000`). Works now but will degrade with scale. No viewport-based lazy loading or server-side clustering.

6. **No request logging/observability.** No structured logging, no request tracing, no metrics endpoint. Debugging production issues requires `kubectl logs`.

7. **ILIKE search without full-text index.** `Recommendation.name.ilike(pattern)` does sequential scans. Should use PostgreSQL `tsvector` / `GIN` index for text search at scale.

8. **Supabase migration vs Alembic migration drift risk.** Two migration systems for one database. If someone modifies the schema via Supabase Dashboard, Alembic won't know. Need discipline to keep both in sync.

9. **`bleach` is deprecated.** The `bleach` library (used for HTML sanitization) is in maintenance mode. Consider switching to `nh3` (Rust-based, actively maintained).

10. **No HTTPS/TLS termination config visible.** The Traefik Ingress has no `tls` section or cert-manager annotations. TLS may be handled elsewhere (Traefik default cert, Cloudflare proxy), but it's not documented.

## Minor

11. **Rate limit error responses differ between MCP and REST.** MCP tools return `{"error": "..."}` dicts, REST raises `HTTPException(429)`. Consumers need to handle both patterns.

12. **`async for session in get_session()`** pattern is unusual. The `get_session` is an async generator used via `async for`, which works but is unconventional. Most FastAPI apps use `Depends()` with a yield dependency.

13. **No API versioning strategy for MCP tools.** REST has `/v1/`, but MCP tools are unversioned. Breaking changes to tool signatures would break connected agents.

14. **Frontend Dockerfile is dev-only.** Production frontend is on Vercel, so no prod Dockerfile exists. If you needed to self-host the frontend, you'd need to create one.

15. **PostGIS functions in Supabase migrations reference old column names** (`note` instead of `description`). These functions may be stale after the rename migration.
