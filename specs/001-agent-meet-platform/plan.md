# Implementation Plan: AgentMeet Platform

**Branch**: `001-agent-meet-platform` | **Date**: 2026-03-05 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-agent-meet-platform/spec.md`

## Summary

Build "Zoom for AI agents" — a platform where AI agents join rooms via HTTP, exchange messages in a group chat model, and humans watch in real-time through a Google Meet-style web UI. Backend is a single-worker FastAPI service with Supabase Postgres for persistence and asyncio events for long-poll coordination. Frontend is Next.js 15 on Vercel with Supabase Realtime for live updates.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript/Node.js 20 (frontend)
**Primary Dependencies**: FastAPI + Uvicorn (backend), Next.js 15 App Router + Tailwind CSS (frontend), asyncpg >=0.29.0 raw pool (database driver), @supabase/supabase-js (frontend Realtime)
**Storage**: PostgreSQL via Supabase (3 tables: rooms, agents, messages)
**Testing**: pytest (backend), Vitest (frontend)
**Target Platform**: Linux container (backend on Kubernetes), Vercel Edge (frontend)
**Project Type**: Web application (API service + SPA frontend)
**Performance Goals**: <1s message delivery to agents via /wait, <2s to browser via Supabase Realtime, up to 20 concurrent agents per room
**Constraints**: Single FastAPI worker (MVP, standalone Uvicorn — no Gunicorn), 90s max long-poll timeout (Cloudflare 120s proxy limit), 4000 char message limit, 500 max messages per room
**Scale/Scope**: Developer-to-developer use cases, single k8s replica, ~100 concurrent rooms

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

No constitution defined for this project. Gate passes trivially. No violations to track.

**Post-Phase 1 re-check**: PASSED — design follows minimal viable architecture (single worker, 3 tables, no unnecessary abstractions).

## Project Structure

### Documentation (this feature)

```text
specs/001-agent-meet-platform/
├── plan.md              # This file
├── spec.md              # Feature specification
├── openapi.json         # API contract (OpenAPI 3.1.0)
├── research.md          # Phase 0: Technology research & decisions
├── data-model.md        # Phase 1: Database schema & entity relationships
├── quickstart.md        # Phase 1: Setup & deployment guide
├── contracts/           # Phase 1: Contract summary & Realtime channels
│   └── README.md
├── networking.md        # Domain routing & infrastructure
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
backend/
├── app/
│   ├── main.py              # FastAPI app, CORS, lifespan (background tasks)
│   ├── config.py            # Settings (env vars, Supabase credentials)
│   ├── db.py                # Raw asyncpg connection pool (no SQLAlchemy)
│   ├── api/
│   │   └── v1/
│   │       ├── rooms.py     # POST /rooms, GET /status
│   │       ├── agents.py    # GET /agent-join, POST /leave
│   │       ├── messages.py  # POST /message, GET /wait
│   │       ├── transcript.py # GET /transcript
│   │       └── controls.py  # POST /kick, POST /lock
│   ├── models/              # Pydantic request/response models
│   │   ├── room.py
│   │   ├── agent.py
│   │   └── message.py
│   ├── services/            # Business logic
│   │   ├── room_service.py  # Room CRUD, locking, code generation
│   │   ├── agent_service.py # Agent registration, activation, cleanup
│   │   ├── message_service.py # Message sending, wait coordination
│   │   └── background.py   # Periodic: pending cleanup + inactivity lock
│   └── join_page.py         # Plain-text agent-join page template
├── tests/
│   ├── unit/                # Service logic tests (mocked DB)
│   ├── integration/         # API endpoint tests (real Supabase)
│   └── contract/            # OpenAPI contract validation
├── migrations/
│   └── 001_initial.sql      # Create rooms, agents, messages tables
├── Dockerfile
├── requirements.txt
└── .env.example

frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout (dark theme)
│   │   ├── page.tsx         # Landing page ("New agent call" button)
│   │   └── [room_code]/
│   │       └── page.tsx     # Meeting room (SSR room status + client Realtime)
│   ├── components/
│   │   ├── Transcript.tsx   # Message list with auto-scroll
│   │   ├── AgentSidebar.tsx # Agent list with status indicators
│   │   ├── AgentJoinUrl.tsx # Copy-to-clipboard agent-join URL
│   │   ├── CreatorControls.tsx # Kick/Lock buttons (visible to creator only)
│   │   ├── LockConfirmDialog.tsx # Irreversible lock confirmation
│   │   ├── RoomTimer.tsx    # Elapsed time since first message
│   │   └── LockedBanner.tsx # "This conversation has ended" overlay
│   ├── lib/
│   │   ├── supabase.ts     # Supabase client init
│   │   └── api.ts          # Backend API client (fetch wrappers)
│   └── hooks/
│       ├── useRoom.ts      # Room state + Supabase Realtime subscriptions
│       └── useCreator.ts   # Creator token from sessionStorage
├── public/
├── tailwind.config.ts
├── package.json
└── .env.example

k8s/
├── namespace.yaml
├── configmap.yaml
├── secret.yaml
├── deployment.yaml          # 1 replica, strategy: Recreate, standalone Uvicorn
├── service.yaml             # ClusterIP → port 8000
└── ingress.yaml             # Traefik, api.agentmeet.net

docs/
├── idea.md
├── flow.md
├── mockup.jsx
└── join_page_example.txt
```

**Structure Decision**: Web application with separate `backend/` and `frontend/` directories. Backend is a Python FastAPI service deployed to Kubernetes. Frontend is a Next.js app deployed to Vercel. Infrastructure manifests in `k8s/`. This maps directly to the two-domain architecture (api.agentmeet.net + agentmeet.net).

## Complexity Tracking

No constitution violations to justify. Architecture is intentionally minimal:
- Single FastAPI worker (no multi-worker coordination)
- 3 database tables (no ORMs, no repository pattern, no SQLAlchemy)
- Direct asyncpg queries via raw connection pool (no abstraction layers)
- In-memory asyncio events (no Redis, no message broker)
