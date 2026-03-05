# Security & DevOps Action Items (Scored 5.4/10)

Full-stack review by 5 parallel security/DevOps agents. **None of these are addressed yet.**

## Area Scores

| Area | Score | Verdict |
|---|---|---|
| API / Auth | 7/10 | Solid JWT + API key design, rate limiting gaps |
| Database / RLS | 7/10 | Good RLS architecture, dual migration fragility |
| Frontend | 6.5/10 | Clean React patterns, missing headers + middleware |
| K8s / Infra | 4/10 | Basics present, no hardening |
| DevOps / CI-CD | 3/10 | Essentially nonexistent |

## Top 10 Action Items

| # | Finding | Effort | Status |
|---|---------|--------|--------|
| 1 | **Add CI/CD pipeline** — GitHub Actions: lint (ruff + mypy + next lint), test (pytest + jest), Docker build + scan, deploy. **Lint is mandatory in CI config.** | 1-2 days | NOT DONE |
| 2 | **Harden container** — Add `USER appuser` in Dockerfile.prod, add `securityContext` (runAsNonRoot, readOnlyRootFilesystem, allowPrivilegeEscalation: false, drop ALL capabilities) | 1 hour | NOT DONE |
| 3 | **TLS on Ingress** — Add cert-manager ClusterIssuer + `tls:` block, or document Cloudflare termination. K8s manifest currently deleted from repo — restore it | 1 hour | NOT DONE |
| 4 | **Fix open redirect** in `/auth/callback/route.ts` — Validate `next` param starts with `/` and not `//` | 5 min | NOT DONE |
| 5 | **Add `middleware.ts`** — Next.js middleware for Supabase session refresh + route protection. Currently no middleware exists at all | 2 hours | NOT DONE |
| 6 | **Add security headers** — CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy in `next.config.ts` `headers()` | 1 hour | NOT DONE |
| 7 | **Commit `uv.lock`** — Uncomment in `.gitignore`, run `uv lock`, commit. Reproducible Python builds | 10 min | NOT DONE |
| 8 | **Extend rate limiting** — Cover all endpoints (reads, updates, deletes). Redis not needed at current scale — just add the in-memory limiter to uncovered routes | Half day | NOT DONE |
| 9 | **Fix PostGIS functions** — Replace stale `note` column with `description`. Change `p_user_id` param to `auth.uid()` to prevent cross-tenant calls | 1 hour | NOT DONE |
| 10 | **Add NetworkPolicy** — Restrict pod ingress to Traefik only, egress to Supabase DB + DNS only | 30 min | NOT DONE |

## Additional Findings by Severity

**Critical (beyond top 10):**
- No backend `.dockerignore` — `COPY . .` in dev Dockerfile copies `.env`, `.git` into image
- `activity_log` missing INSERT RLS policy in Supabase migration — audit trail silently broken on Supabase-only deploys

**High:**
- `:latest` image tag — no immutable versioning, rollbacks unreliable
- No Python dependency lockfile (`uv.lock` deliberately excluded)
- Hardcoded DB creds in `alembic.ini` (`postgres:postgres`)
- Quota functions (`user_recommendation_count` etc.) accept arbitrary UUIDs, no `GRANT`/`REVOKE`
- No `FORCE ROW LEVEL SECURITY` on any table
- `tokens` table only in Supabase migrations, not Alembic — schema drift

**Medium:**
- In-memory rate limiter resets on restart, per-process only
- CORS wildcard `*.vercel.app` too broad for credentialed requests
- No SSL/TLS enforcement on DB connection (`sslmode=require` missing)
- MCP tools lack centralized RLS enforcement — each manually calls `set_rls_context`
- Pool checkin reset lacks exception handling — stale RLS context on failure
- Dual migration system creates overlapping RLS policies
- Realtime subscription not user-scoped (relies entirely on server-side RLS)
- No observability stack (logging, metrics, tracing, alerting)
- JWT error messages leak internal PyJWT exception details
- `getSession()` used for auth decisions in OAuth consent (should use `getUser()`)

**Low:**
- No API key expiration mechanism
- ILIKE search doesn't escape `%` and `_` wildcards
- PostGIS functions reference stale column `note` (renamed to `description`)
- `google_place_id` and `badge` fields not sanitized (inconsistent with other fields)
- `automountServiceAccountToken` not disabled in pod spec
