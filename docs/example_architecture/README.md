# Agent Map — Architecture Reference

> A reusable architecture for building **AI-agent-powered web apps** with a FastAPI + MCP backend on Kubernetes, a Next.js frontend on Vercel, and Supabase as the auth + database layer.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTS                                     │
│                                                                      │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────────┐    │
│  │  Next.js App  │   │  AI Agents   │   │  REST API Clients     │    │
│  │  (Vercel)     │   │  (MCP/SSE)   │   │  (API key or JWT)     │    │
│  └──────┬───────┘   └──────┬───────┘   └───────────┬───────────┘    │
│         │ JWT               │ OAuth/JWT              │ API Key/JWT   │
└─────────┼───────────────────┼────────────────────────┼──────────────┘
          │                   │                        │
          ▼                   ▼                        ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     BACKEND (K8s / single pod)                       │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                     FastAPI (main app)                        │   │
│  │                                                               │   │
│  │  mount("/api")  ──►  REST sub-app (CORS middleware)          │   │
│  │    ├── /api/health, /api/recommendations, /api/lists, ...    │   │
│  │    └── /api/v1/ (dual-auth: JWT + API key)                   │   │
│  │         ├── /api/v1/recommendations (CRUD)                   │   │
│  │         ├── /api/v1/lists (CRUD)                             │   │
│  │         ├── /api/v1/api-keys (JWT-only)                      │   │
│  │         └── /api/v1/activity                                 │   │
│  │                                                               │   │
│  │  mount("/")  ──►  FastMCP SSE app (MCP protocol)             │   │
│  │    ├── OAuth flow (delegates to Supabase)                    │   │
│  │    └── MCP tools: save/list/get/update/delete recommendations│   │
│  │        + save_recommendation_list, list_lists, get_list,     │   │
│  │          add_to_list, remove_from_list                       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                              │                                       │
│                              │ asyncpg (direct, no ORM pooling)      │
└──────────────────────────────┼──────────────────────────────────────┘
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (managed)                                │
│                                                                      │
│  PostgreSQL + PostGIS          Supabase Auth (GoTrue)                │
│  ├── recommendations           ├── OAuth providers (GitHub, etc.)    │
│  ├── lists                     ├── JWT issuance (ES256, JWKS)        │
│  ├── list_items                └── User management                   │
│  ├── activity_log                                                    │
│  ├── api_keys                  Supabase Realtime                     │
│  └── RLS policies              └── postgres_changes → frontend WS    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Documentation

| Doc | Contents |
|-----|----------|
| [01 — Backend (FastAPI)](./01-backend-fastapi.md) | App composition, auth (JWT/API key), database, service layer, rate limiting |
| [02 — MCP Server](./02-mcp.md) | FastMCP setup, mounting, OAuth flow with Supabase, known pain points |
| [03 — RLS Deep Dive](./03-rls-deep-dive.md) | Row-Level Security: how it works, per-request context, pool safety, policies per table, gotchas |
| [04 — Frontend](./04-frontend.md) | Next.js stack, auth flow, API communication, responsive design |
| [05 — Infrastructure](./05-infrastructure.md) | Kubernetes, Docker, domain architecture, DNS, environment variables |
| [06 — Database Schema](./06-database-schema.md) | Tables, indexes, domain-specific functions |
| [07 — Design Decisions](./07-design-decisions.md) | Why asyncpg over Supabase SDK, dual API surface, in-memory rate limiting, Realtime |
| [08 — Weakpoints](./08-weakpoints.md) | Known risks ranked Critical / Moderate / Minor |
| [09 — Security Audit](./09-security-audit.md) | What's done well, HIGH/MEDIUM/LOW security concerns |
| [10 — Action Items](./10-action-items.md) | Scored 5.4/10 — Top 10 fixes with effort estimates, full findings by severity |
| [11 — Reproducing](./11-reproducing.md) | How to copy this architecture to a new project |
