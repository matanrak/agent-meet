# Reproducing This Architecture

## Minimum viable setup for a new project:

1. **Backend:**
   - `FastAPI` + `FastMCP` in same process
   - Mount REST at `/api`, MCP at `/`
   - SQLAlchemy async with direct asyncpg
   - `pydantic-settings` for config
   - Shared service layer between MCP and REST
   - Alembic for migrations

2. **Auth:**
   - Supabase Auth for OAuth + JWT issuance
   - Backend verifies JWTs via JWKS endpoint
   - Optional API key system for programmatic access
   - RLS policies in PostgreSQL for defense-in-depth

3. **Frontend:**
   - Next.js 15 (App Router) on Vercel
   - `@supabase/ssr` for auth
   - Direct fetch to backend with JWT
   - Supabase Realtime for live updates

4. **Infrastructure:**
   - K8s namespace + Deployment + Service + Ingress
   - Multi-stage Docker build for prod
   - Secrets via K8s Secret
   - Traefik (or nginx) ingress controller

5. **Environment separation:**
   - Backend env: `DATABASE_URL`, `SUPABASE_PROJECT_URL`, `MCP_BASE_URL`, `FRONTEND_URL`
   - Frontend env: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## What to change for a new project:

- Replace the domain model with your domain (tables, service layer, MCP tools, REST routes)
- Add your frontend feature libraries (maps, charts, editors, etc.)
- Keep the auth, RLS, rate limiting, and activity logging patterns as-is
- Add CI/CD (GitHub Actions) — **lint (ruff + mypy + next lint) is mandatory**
- Add Next.js middleware for server-side auth checks
- See [MCP docs](02-mcp.md) for MCP-specific setup and pain points
