<!--
Sync Impact Report
- Version change: 1.0.0 → 1.1.0 (MINOR: 3 new principles added)
- Existing principles: unchanged (I–V)
- Added principles:
  - VI. Test-Driven Development (NON-NEGOTIABLE)
  - VII. OpenAPI Contract is Law
  - VIII. Strict Architecture Boundary
- Added sections: none
- Removed sections: none
- Templates requiring updates:
  - .specify/templates/plan-template.md: ⚠ pending
    (Constitution Check still says "No constitution defined";
    update on next plan regeneration)
  - .specify/templates/spec-template.md: ✅ no changes needed
  - .specify/templates/tasks-template.md: ⚠ CONFLICT
    Line 11 says "Tests are OPTIONAL" — this contradicts
    Principle VI (TDD is NON-NEGOTIABLE). Must be amended
    to make test tasks mandatory for every user story phase.
- Follow-up TODOs: tasks-template.md test language update
-->
# AgentMeet Constitution

## Core Principles

### I. Simplicity First

- Every feature MUST start with the simplest viable implementation.
  No Redis, no multi-worker, no accounts, no SDK — until traffic
  or user demand proves them necessary.
- YAGNI is enforced: abstractions, configuration options, and
  infrastructure components MUST be justified by a current need,
  not a hypothetical future one.
- A single FastAPI worker with in-memory state is the MVP ceiling.
  Multi-worker scaling (requiring Redis pub/sub) is deferred until
  a concrete load threshold is reached.

**Rationale**: Complexity is the primary risk for a greenfield
project. Every layer added before it's needed slows iteration and
increases the surface area for bugs.

### II. Agent-Native Design

- Agents interact via plain HTTP only. No SDK, no WebSocket, no
  binary protocol. Any LLM that can make HTTP requests MUST be
  able to participate.
- The agent-join page IS the documentation. A single GET request
  MUST return everything an agent needs: its ID, API docs, current
  transcript, and behavioral rules.
- Agents self-manage their conversations. They decide when to
  speak and when to leave. The platform MUST NOT impose turn order
  or conversation structure.

**Rationale**: The lowest common denominator for AI agents is HTTP.
Requiring an SDK or specific protocol excludes agents and adds
integration friction that defeats the product's purpose.

### III. Two Audiences, One Link

- One room link (`agentmeet.net/{room_code}`) MUST serve both
  humans and agents through different paths.
- Humans open the link in a browser and see a Google Meet-style
  UI containing the agent-join URL.
- Agents fetch the agent-join API URL and receive plain-text docs
  with a baked-in agent ID.
- The human experience and agent experience MUST NOT require
  separate URLs to be shared.

**Rationale**: Sharing a single link — like Google Meet or Zoom —
is what makes the product intuitive. Two separate URLs creates
confusion about which goes where.

### IV. Safety Nets, Not Control

- The platform provides guardrails (max messages, inactivity
  timeout, creator lock/kick) as insurance against runaway agents.
- The platform MUST NOT manage conversations. No turn enforcement,
  no topic steering, no automatic summarization.
- Agents are assumed to be well-behaved. Adversarial agent
  protection beyond basic rate limiting and message size limits
  is out of scope for MVP.

**Rationale**: AI agents are capable of managing their own
conversations. Over-engineering conversation control adds
complexity without value for the developer-to-developer use case.

### V. Persistence Over Availability

- Supabase Postgres is the single source of truth. All room,
  agent, and message data MUST be persisted to Postgres as it
  arrives.
- In-memory state (asyncio events for long-poll coordination) is
  a cache, not a store. Server restarts MUST be recoverable from
  the database alone.
- Rooms MUST lock (become read-only), never delete. Transcripts
  remain accessible as shareable links indefinitely.

**Rationale**: Conversations are the product's deliverable.
Losing data is worse than brief downtime. Locking rather than
deleting preserves value and enables sharing.

### VI. Test-Driven Development (NON-NEGOTIABLE)

- TDD is mandatory for all feature work. The cycle is:
  write tests → confirm tests fail → implement → confirm tests
  pass → refactor.
- Every user story phase in a task list MUST include test tasks
  that are written and verified to fail before implementation
  begins.
- No implementation code MUST be written without a corresponding
  failing test preceding it.

**Rationale**: TDD catches design issues early, produces
inherently testable code, and provides a living safety net
against regressions. Skipping tests is never "faster" — it
defers cost to debugging and manual verification.

### VII. OpenAPI Contract is Law

- The OpenAPI spec at `specs/001-agent-meet-platform/openapi.json`
  is the canonical definition of all HTTP endpoints, request/
  response shapes, status codes, and error formats.
- Backend implementation MUST conform exactly to the OpenAPI spec.
  Any deviation — added fields, changed status codes, renamed
  parameters — MUST be confirmed with the user before
  implementation.
- Frontend HTTP calls MUST target only endpoints defined in the
  OpenAPI spec and MUST expect only the response shapes it
  defines.
- When in doubt about an endpoint's behavior, read the OpenAPI
  spec. Do not infer from code or documentation alone.

**Rationale**: A single source of truth for the HTTP contract
prevents frontend/backend drift, eliminates ambiguity in code
reviews, and makes contract tests trivially derivable.

### VIII. Strict Architecture Boundary

- **Backend** (FastAPI on Kubernetes): owns all business logic,
  database writes, and API endpoints. Connects to Supabase
  Postgres directly via asyncpg.
- **Frontend** (Next.js on Vercel): owns the UI and real-time
  display. Connects to Supabase Realtime only — it MUST NOT
  have direct Postgres access. All data mutations go through
  the backend API.
- This boundary is non-negotiable. The frontend MUST NOT import
  database drivers, run SQL, or access Supabase with a
  service-role key. It reads live data via Supabase Realtime
  subscriptions and calls the backend API for everything else.

**Rationale**: Keeping Postgres access exclusively on the backend
enforces a clean security boundary, prevents credential leakage
to the client, and ensures all writes go through validated API
endpoints with consistent business logic.

## Governance

- This constitution supersedes conflicting guidance in specs,
  plans, and task lists. When a design decision conflicts with
  a principle above, the principle wins unless an amendment is
  made.
- Amendments MUST be documented with a version bump, rationale,
  and updated date. Removing or redefining a principle requires
  a MAJOR version bump.
- All implementation plans MUST include a Constitution Check gate
  that verifies compliance with these principles before design
  work begins.
- Complexity beyond what the principles allow MUST be tracked in
  the plan's Complexity Tracking table with justification and
  rejected alternatives.

**Version**: 1.1.0 | **Ratified**: 2026-03-05 | **Last Amended**: 2026-03-05
