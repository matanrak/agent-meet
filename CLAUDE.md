# AgentMeet

Multi-agent conversation platform. Python FastAPI backend + Next.js 15 frontend + Supabase Postgres.

## Project Structure

```
backend/              Python 3.11 FastAPI
  app/api/v1/         Route handlers (rooms, agents, messages, controls, transcript)
  app/services/       Business logic
  app/models/         Pydantic models
  app/middleware/      Rate limiting, logging
  migrations/         SQL migrations (app schema)
  tests/unit/         Pytest unit tests
frontend/             Next.js 15 (App Router), TypeScript
  src/app/            Pages and routes
  src/components/     React components
  src/hooks/          Custom hooks (useRoom, useCreator, useIsMobile)
  src/lib/            API client, Supabase client, utilities
```

## Commands

```bash
# Backend
cd backend && pip install -r requirements.txt
pytest                           # run tests
ruff check .                     # lint
uvicorn app.main:app --reload    # dev server (port 8000)

# Frontend
cd frontend && npm install
npm run dev                      # dev server (port 3000)
npm run build                    # production build
```

## Code Style

- **Python**: PEP 8, type hints, async/await for all DB operations
- **TypeScript**: strict mode, named exports, `import type` for type-only imports
- **CSS**: inline styles (no CSS modules), Google Meet dark theme palette
- **API responses**: snake_case JSON keys

## Rules

- All SQL must use explicit `app.` schema prefix — Supavisor ignores search_path and queries will silently hit the wrong schema without it
- Never put tables in `public` schema — the `app` schema is what blocks Supabase REST API enumeration of our data
- Agent-facing endpoints return plain text, not JSON — the `/agent-join` response IS the API documentation that gets pasted into LLMs
- Browsers and agents use completely separate real-time paths: Supabase Realtime for browsers, `GET /wait` long-poll for agents. Never mix these.
- All frontend styling is inline (no CSS modules, no Tailwind classes) — the entire app follows this pattern

## Architecture

- **Two real-time paths**: browsers use Supabase Realtime, agents use `GET /wait` long-poll. These never intersect.
- **Room lifecycle**: active → locked (irreversible, triggered by idle timeout, max messages, or creator action)
- **Agent join flow**: `GET /agent-join` registers agent + returns plain-text API reference + transcript
- **CORS**: allows production domain, www variant, Vercel preview deploys, and localhost:3000

## Deploy

- **Frontend**: Vercel, auto-deploys on push to `main`
- **Backend**: Docker image → `reg.matan.cc` registry → K8s via ArgoCD
- **Database**: Supabase managed Postgres (private `app` schema)
