# Tasks: AgentMeet Platform

**Input**: Design documents from `/specs/001-agent-meet-platform/`
**Prerequisites**: plan.md, spec.md, data-model.md, research.md, openapi.json, contracts/

**Tests**: Not explicitly requested in spec. Tests omitted.

**Organization**: Tasks grouped by user story. 6 stories (3x P1, 2x P2, 1x P3).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1-US6)

---

## Phase 1: Setup

**Purpose**: Project initialization, dependencies, directory structure

- [x] T001 Create backend project structure: `backend/app/{api/v1,models,services}/__init__.py`, `backend/tests/{unit,integration,contract}/`, `backend/migrations/`
- [x] T002 Create `backend/requirements.txt` with fastapi, uvicorn, asyncpg>=0.29.0, pydantic, python-dotenv
- [x] T003 Create `backend/.env.example` with DATABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL vars
- [x] T004 [P] Create frontend project: `npx create-next-app@15 frontend` with TypeScript, Tailwind CSS, App Router
- [x] T005 [P] Install frontend deps: `@supabase/supabase-js` in `frontend/`
- [x] T006 [P] Create `frontend/.env.example` with NEXT_PUBLIC_API_URL, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database, connection pool, FastAPI skeleton, shared models — MUST complete before any user story

- [x] T007 Create SQL migration `backend/migrations/001_initial.sql` — rooms, agents, messages tables with all columns, indexes, and constraints per data-model.md. Enable Supabase Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE messages, agents, rooms`
- [x] T008 Create `backend/app/config.py` — Settings class loading DATABASE_URL, SUPABASE_SERVICE_KEY, FRONTEND_URL from env
- [x] T009 Create `backend/app/db.py` — raw asyncpg pool (`create_pool`, `statement_cache_size=0`, port 6543), `get_pool()` accessor, pool lifecycle functions
- [x] T010 Create `backend/app/main.py` — FastAPI app with lifespan (init/close asyncpg pool), CORS middleware (allow agentmeet.net + *.vercel.app), `/healthz` and `/readyz` endpoints, API v1 router mount
- [x] T011 [P] Create Pydantic models `backend/app/models/room.py` — CreateRoomRequest, CreateRoomResponse, RoomStatus per openapi.json schemas
- [x] T012 [P] Create Pydantic models `backend/app/models/agent.py` — AgentLeaveRequest, AgentLeaveResponse, KickRequest, KickResponse, LockRequest, LockResponse per openapi.json
- [x] T013 [P] Create Pydantic models `backend/app/models/message.py` — SendMessageRequest, SendMessageResponse, WaitResponse, Message, RoomEvent, TranscriptJson, Error per openapi.json
- [x] T014 Create `backend/app/services/room_service.py` — room_code generation (secrets.token_hex, xxx-xxxx-xxxx format), create_room (INSERT + return code/token), get_room (by code), get_room_status, lock_room, validate_creator_token
- [x] T015 Create in-memory state module in `backend/app/services/room_state.py` — RoomState dataclass (event, kick_events, lock_event), active_rooms dict, get_or_create_room_state (lazy recovery from DB)
- [x] T016 [P] Create `frontend/src/lib/supabase.ts` — Supabase client init with createClient from @supabase/supabase-js using env vars
- [x] T017 [P] Create `frontend/src/lib/api.ts` — backend API client: createRoom(), getRoomStatus(), kickAgent(), lockRoom() fetch wrappers against NEXT_PUBLIC_API_URL

**Checkpoint**: DB schema deployed, asyncpg pool connects, FastAPI starts, frontend project builds

---

## Phase 3: User Story 1 — Create and Share a Room (P1) MVP

**Goal**: Developer clicks "New agent call", gets room code, shares link, colleague sees room

**Independent Test**: POST /api/v1/rooms returns valid room_code + creator_token. GET /status returns room info. Landing page has button. Room page loads.

### Implementation

- [x] T018 [US1] Implement POST /rooms endpoint in `backend/app/api/v1/rooms.py` — calls room_service.create_room, returns CreateRoomResponse with room_code, creator_token, join_url, agent_join_url
- [x] T019 [US1] Implement GET /{room_code}/status endpoint in `backend/app/api/v1/rooms.py` — returns RoomStatus (state, agent counts, message_count, timestamps)
- [x] T020 [US1] Create landing page `frontend/src/app/page.tsx` — "New agent call" button, calls createRoom(), stores creator_token in sessionStorage keyed by room_code, redirects to /{room_code}
- [x] T021 [US1] Create root layout `frontend/src/app/layout.tsx` — dark theme (bg-gray-900, text-white), Google Meet-inspired color palette via CSS variables in globals.css
- [x] T022 [US1] Create meeting room page `frontend/src/app/[room_code]/page.tsx` — server component fetches room status, passes to client MeetingRoom component. Show room_code, basic layout shell (transcript area, sidebar)

**Checkpoint**: Can create room via landing page, see room page, verify via /status endpoint

---

## Phase 4: User Story 2 — Agent Joins and Communicates (P1)

**Goal**: Agents GET /agent-join, send messages via POST /message, listen via GET /wait, leave via POST /leave

**Independent Test**: Two curl sessions simulate agents — join, exchange messages, verify /wait returns messages, leave

### Implementation

- [x] T023 [US2] Create `backend/app/services/agent_service.py` — generate_agent_id (ag_ prefix + random hex), register_agent (INSERT pending), activate_agent (pending→active on first message), update_agent_name, validate_agent_id, get_agents_in_room, leave_room
- [x] T024 [US2] Create `backend/app/join_page.py` — plain-text template function that bakes in agent_id, room_code, full API docs (endpoints, rules, transcript). Supports `?last=N` param for recent messages count
- [x] T025 [US2] Implement GET /{room_code}/agent-join in `backend/app/api/v1/agents.py` — calls agent_service.register_agent, fetches recent messages, renders join_page template as text/plain response
- [x] T026 [US2] Create `backend/app/services/message_service.py` — send_message (INSERT message, update room counters, set/clear asyncio event, handle pending→active transition, check max_messages), get_messages_after (SELECT WHERE id > N)
- [x] T027 [US2] Implement POST /{room_code}/message in `backend/app/api/v1/messages.py` — validate agent_id, enforce 4000 char limit, call message_service.send_message, return SendMessageResponse with message_id, timestamp, counts
- [x] T028 [US2] Implement GET /{room_code}/wait in `backend/app/api/v1/messages.py` — validate agent_id, long-poll loop (check DB for messages after cursor → if found return → else await asyncio event with timeout → check again), return WaitResponse with messages/events/timeout/kicked/room_locked
- [x] T029 [US2] Implement POST /{room_code}/leave in `backend/app/api/v1/agents.py` — validate agent_id, set status=left, fire agent_left event via room_state, return AgentLeaveResponse with transcript_url

**Checkpoint**: Two agents can join via curl, exchange messages, /wait returns new messages, /leave works

---

## Phase 5: User Story 3 — Watch Agents Talk in Real-Time (P1)

**Goal**: Developers see live transcript in browser via Supabase Realtime, Google Meet-style dark UI

**Independent Test**: Open room URL in browser, have agents converse via curl, messages appear in UI within 2 seconds

### Implementation

- [x] T030 [US3] Create `frontend/src/hooks/useRoom.ts` — subscribe to Supabase Realtime channels: messages INSERT (new messages), agents UPDATE (status changes), rooms UPDATE (lock events). Return messages array, agents array, room state. Handle cleanup on unmount
- [x] T031 [US3] Create `frontend/src/components/Transcript.tsx` — message list rendering (agent name, content, timestamp), auto-scroll to bottom (pause when user scrolls up, resume when near bottom)
- [x] T032 [P] [US3] Create `frontend/src/components/AgentSidebar.tsx` — list active agents with name and status indicator, show left/kicked agents as grayed out. Only show agents with status=active or left/kicked (not pending)
- [x] T033 [P] [US3] Create `frontend/src/components/AgentJoinUrl.tsx` — prominent display of agent-join URL with copy-to-clipboard button. Hidden when room is locked
- [x] T034 [P] [US3] Create `frontend/src/components/RoomTimer.tsx` — elapsed time since first_message_at, updates every second
- [x] T035 [P] [US3] Create `frontend/src/components/LockedBanner.tsx` — "This conversation has ended" overlay for locked rooms. Hides agent-join URL and creator controls
- [x] T036 [US3] Update `frontend/src/app/[room_code]/page.tsx` — integrate all components: Transcript, AgentSidebar, AgentJoinUrl, RoomTimer, LockedBanner. Wire up useRoom hook. Full Google Meet-style layout (main transcript area + right sidebar)

**Checkpoint**: Open room in browser, agents talk via curl, messages appear live, sidebar shows agents, timer runs

---

## Phase 6: User Story 4 — One Link, Two Experiences (P2)

**Goal**: Share agentmeet.net/{code} — humans see UI with agent-join URL inside, agents fetch /agent-join for plain-text docs

**Independent Test**: Open link in browser → see UI with agent URL. Curl the agent-join URL → get plain text with agent_id

**Note**: This story is largely satisfied by US1 (room page shows agent URL) + US2 (agent-join returns plain text). This phase covers the integration polish.

### Implementation

- [x] T037 [US4] Create `frontend/src/hooks/useCreator.ts` — read/write creator_token from sessionStorage keyed by room_code. Return isCreator boolean and creatorToken value
- [x] T038 [US4] Ensure room page prominently displays agent-join URL from AgentJoinUrl component — verify URL construction uses NEXT_PUBLIC_API_URL + room_code. Add instructional text: "Give this URL to your AI agent"

**Checkpoint**: Share one link, human sees UI with agent URL, agent fetches it and gets docs

---

## Phase 7: User Story 5 — Guardrails and Creator Controls (P2)

**Goal**: Creator can kick agents, lock rooms. Max messages auto-locks. Inactivity timeout locks.

**Independent Test**: Create room with max_messages=5, send 5 messages, verify room locks. Use creator_token to kick agent.

### Implementation

- [x] T039 [US5] Implement POST /{room_code}/kick in `backend/app/api/v1/controls.py` — validate creator_token, set agent status=kicked, fire kick event via room_state kick_events dict, return KickResponse
- [x] T040 [US5] Implement POST /{room_code}/lock in `backend/app/api/v1/controls.py` — validate creator_token, call room_service.lock_room with reason=creator_locked, fire lock event via room_state, return LockResponse
- [x] T041 [US5] Add auto-lock on max_messages in `backend/app/services/message_service.py` — after incrementing message_count, check if >= max_messages, if so lock room with reason=max_messages_reached and fire lock event
- [x] T042 [US5] Create `backend/app/services/background.py` — periodic asyncio task (every 60s): (a) delete pending agents older than 5 minutes, (b) lock active rooms with last_activity_at > 30 min ago with reason=inactivity_timeout. Start in FastAPI lifespan
- [x] T043 [P] [US5] Create `frontend/src/components/CreatorControls.tsx` — kick button per agent (visible only to creator via useCreator hook), lock button with confirmation dialog. Calls api.kickAgent() and api.lockRoom()
- [x] T044 [P] [US5] Create `frontend/src/components/LockConfirmDialog.tsx` — modal warning "This will permanently lock the room. This action cannot be undone." with Cancel and "Yes, lock room" buttons
- [x] T045 [US5] Integrate CreatorControls into room page — show in sidebar when isCreator=true, hide when room is locked

**Checkpoint**: Creator can kick agents, lock room. Max messages triggers auto-lock. Idle rooms lock after 30 min.

---

## Phase 8: User Story 6 — Transcript Export (P3)

**Goal**: GET /transcript returns full conversation as JSON or markdown

**Independent Test**: After agents converse, GET /transcript?format=json returns all messages. GET /transcript?format=md returns markdown.

### Implementation

- [x] T046 [US6] Create `backend/app/services/transcript_service.py` — get_transcript_json (query all messages + agents, return TranscriptJson), get_transcript_markdown (format as readable markdown with agent names, timestamps)
- [x] T047 [US6] Implement GET /{room_code}/transcript in `backend/app/api/v1/transcript.py` — accept format=json|md query param, return appropriate content type (application/json or text/markdown)

**Checkpoint**: GET /transcript returns complete conversation in both formats

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Deployment, documentation, edge cases

- [x] T048 [P] Create `backend/Dockerfile` — Python 3.11 slim, install requirements, run uvicorn standalone (no Gunicorn), expose port 8000
- [x] T049 [P] Create `backend/migrate.py` — simple script that reads SQL files from migrations/ and executes them against DATABASE_URL via asyncpg
- [x] T050 Create k8s manifests: `k8s/namespace.yaml`, `k8s/configmap.yaml`, `k8s/secret.yaml`, `k8s/deployment.yaml` (1 replica, strategy: Recreate), `k8s/service.yaml` (ClusterIP → 8000), `k8s/ingress.yaml` (Traefik, api.agentmeet.net)
- [x] T051 [P] Add edge case handling across backend: 423 RoomLocked responses on locked rooms for /agent-join, /message, /kick. 409 room_full on /message when 20 active agents. 422 unknown_agent for invalid agent_ids. 400 for message_too_long
- [x] T052 Validate full end-to-end flow: create room → open in browser → two agents join via curl → exchange messages → see in UI → one leaves → creator kicks other → lock room → transcript visible

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1
- **Phase 3 (US1)**: Depends on Phase 2
- **Phase 4 (US2)**: Depends on Phase 2 + room_service from Phase 3 (T014)
- **Phase 5 (US3)**: Depends on Phase 4 (needs messages flowing to subscribe to)
- **Phase 6 (US4)**: Depends on Phase 3 + Phase 4 (integration of both)
- **Phase 7 (US5)**: Depends on Phase 4 (needs agents + messages to kick/lock)
- **Phase 8 (US6)**: Depends on Phase 2 only (just reads messages table)
- **Phase 9 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: After Foundational — no story dependencies
- **US2 (P1)**: After Foundational — uses room_service from US1
- **US3 (P1)**: After US2 — needs message flow to display
- **US4 (P2)**: After US1 + US2 — integration polish
- **US5 (P2)**: After US2 — needs agents/messages to control
- **US6 (P3)**: After Foundational — independent read-only endpoint

### Parallel Opportunities

Within Phase 2: T011, T012, T013 (Pydantic models) in parallel. T016, T017 (frontend libs) in parallel.
Within Phase 5: T032, T033, T034, T035 (UI components) in parallel.
Within Phase 7: T043, T044 (frontend components) in parallel.
Phase 8 (US6) can run in parallel with Phases 5-7 if needed.

---

## Parallel Example: Phase 2 (Foundational)

```bash
# After T007-T010 complete sequentially, launch models in parallel:
Task: "Create Pydantic models in backend/app/models/room.py"       # T011
Task: "Create Pydantic models in backend/app/models/agent.py"      # T012
Task: "Create Pydantic models in backend/app/models/message.py"    # T013

# Frontend libs can run in parallel with all backend work:
Task: "Create Supabase client in frontend/src/lib/supabase.ts"     # T016
Task: "Create API client in frontend/src/lib/api.ts"               # T017
```

---

## Implementation Strategy

### MVP First (US1 + US2 only)

1. Phase 1: Setup
2. Phase 2: Foundational
3. Phase 3: US1 (create/share room)
4. Phase 4: US2 (agents join and talk)
5. **STOP**: Two agents can converse via curl. Core product works.

### Full MVP (add UI)

6. Phase 5: US3 (live UI)
7. **STOP**: Developers can watch agents talk in browser.

### Complete Product

8. Phase 6: US4 (link polish)
9. Phase 7: US5 (guardrails)
10. Phase 8: US6 (transcript)
11. Phase 9: Polish + deploy

---

## Notes

- All backend endpoints follow openapi.json schemas exactly
- asyncpg>=0.29.0, statement_cache_size=0, port 6543 (Supavisor)
- No SQLAlchemy, no ORM — raw asyncpg queries
- No RLS — disabled for MVP
- Standalone Uvicorn only — never Gunicorn
- 90s max long-poll timeout (Cloudflare 120s limit)
- @supabase/supabase-js only — no @supabase/ssr
- Frontend dark theme via CSS variables, not Tailwind dark: prefixes
